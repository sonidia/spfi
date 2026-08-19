import type { H3Event } from "h3";
import type {
  CommerceListResponse,
  ReturnAction,
  ReturnActionInput,
  ReturnSummary,
} from "~~/types/shopify-operations";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { requireShopifyGid } from "./shopify-commerce-ops-id";

interface ReturnContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface UserError {
  field?: string[] | null;
  message: string;
}

interface ReturnLineItemNode {
  id: string;
  quantity: number;
  customerNote?: string | null;
  returnReasonDefinition?: { name?: string | null } | null;
  fulfillmentLineItem?: {
    lineItem?: { name?: string | null } | null;
  } | null;
}

interface ReturnNode {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  closedAt?: string | null;
  totalQuantity: number;
  returnLineItems: { nodes: ReturnLineItemNode[] };
}

interface ReturnConnection {
  nodes: ReturnNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

interface ReturnOrderNode {
  id: string;
  name: string;
  returns: ReturnConnection;
}

interface ReturnOrdersData {
  orders: {
    nodes: ReturnOrderNode[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

interface ReturnOrdersVariables extends Record<string, unknown> {
  first: number;
  after: string | null;
  query: string;
  returnsFirst: number;
  lineItemsFirst: number;
}

const RETURN_ORDER_PAGE_SIZE = 25;
const RETURN_PAGE_SIZE = 50;
const RETURN_LINE_ITEM_PAGE_SIZE = 250;
const RETURN_ORDER_SEARCH = "-return_status:no_return";

export async function fetchReturns(
  context: ReturnContext,
): Promise<CommerceListResponse<ReturnSummary>> {
  const itemsById = new Map<string, ReturnSummary>();
  const seenOrderCursors = new Set<string>();
  let orderCursor: string | null = null;

  while (true) {
    const data: ReturnOrdersData = await callShopifyGraphql<
      ReturnOrdersData,
      ReturnOrdersVariables
    >({
      ...context,
      operationName: "CommerceOpsReturns",
      query: `#graphql
        query CommerceOpsReturns(
          $first: Int!
          $after: String
          $query: String!
          $returnsFirst: Int!
          $lineItemsFirst: Int!
        ) {
          orders(
            first: $first
            after: $after
            query: $query
            reverse: true
            sortKey: UPDATED_AT
          ) {
            nodes {
              id
              name
              returns(first: $returnsFirst, reverse: true) {
                nodes { ...ReturnSummaryFields }
                pageInfo { endCursor hasNextPage }
              }
            }
            pageInfo { endCursor hasNextPage }
          }
        }
        ${RETURN_SUMMARY_FRAGMENT}
      `,
      variables: {
        first: RETURN_ORDER_PAGE_SIZE,
        after: orderCursor,
        query: RETURN_ORDER_SEARCH,
        returnsFirst: RETURN_PAGE_SIZE,
        lineItemsFirst: RETURN_LINE_ITEM_PAGE_SIZE,
      },
    });

    for (const order of data.orders.nodes) {
      addReturnSummaries(itemsById, order, order.returns.nodes);
      let returnsCursor = order.returns.pageInfo.endCursor;
      let hasNextReturns = order.returns.pageInfo.hasNextPage;
      const seenReturnCursors = new Set<string>();

      while (hasNextReturns) {
        assertNextCursor(returnsCursor, seenReturnCursors, "return");
        const nextPage = await fetchOrderReturnsPage(context, order.id, returnsCursor!);
        addReturnSummaries(itemsById, order, nextPage.nodes);
        returnsCursor = nextPage.pageInfo.endCursor;
        hasNextReturns = nextPage.pageInfo.hasNextPage;
      }
    }

    if (!data.orders.pageInfo.hasNextPage) break;
    const nextCursor: string | null = data.orders.pageInfo.endCursor;
    assertNextCursor(nextCursor, seenOrderCursors, "order");
    orderCursor = nextCursor;
  }

  const items = [...itemsById.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    items,
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}

const RETURN_SUMMARY_FRAGMENT = `#graphql
  fragment ReturnSummaryFields on Return {
    id
    name
    status
    createdAt
    closedAt
    totalQuantity
    returnLineItems(first: $lineItemsFirst) {
      nodes {
        id
        quantity
        customerNote
        returnReasonDefinition { name }
        ... on ReturnLineItem {
          fulfillmentLineItem { lineItem { name } }
        }
      }
    }
  }
`;

async function fetchOrderReturnsPage(
  context: ReturnContext,
  orderId: string,
  after: string,
) {
  const data = await callShopifyGraphql<
    { order: { returns: ReturnConnection } | null },
    { id: string; first: number; after: string; lineItemsFirst: number }
  >({
    ...context,
    operationName: "CommerceOpsOrderReturnsPage",
    query: `#graphql
      query CommerceOpsOrderReturnsPage(
        $id: ID!
        $first: Int!
        $after: String!
        $lineItemsFirst: Int!
      ) {
        order(id: $id) {
          returns(first: $first, after: $after, reverse: true) {
            nodes { ...ReturnSummaryFields }
            pageInfo { endCursor hasNextPage }
          }
        }
      }
      ${RETURN_SUMMARY_FRAGMENT}
    `,
    variables: {
      id: orderId,
      first: RETURN_PAGE_SIZE,
      after,
      lineItemsFirst: RETURN_LINE_ITEM_PAGE_SIZE,
    },
  });
  return (
    data.order?.returns || {
      nodes: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }
  );
}

function addReturnSummaries(
  target: Map<string, ReturnSummary>,
  order: Pick<ReturnOrderNode, "id" | "name">,
  returns: ReturnNode[],
) {
  for (const item of returns) {
    target.set(item.id, {
      id: item.id,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      closedAt: item.closedAt || null,
      totalQuantity: Number(item.totalQuantity || 0),
      orderId: order.id,
      orderName: order.name,
      items: item.returnLineItems.nodes.map((lineItem) => ({
        id: lineItem.id,
        title: String(lineItem.fulfillmentLineItem?.lineItem?.name || "Returned item"),
        quantity: Number(lineItem.quantity || 0),
        reason: String(lineItem.returnReasonDefinition?.name || "Unspecified"),
        customerNote: String(lineItem.customerNote || ""),
      })),
    });
  }
}

function assertNextCursor(
  cursor: string | null,
  seen: Set<string>,
  resource: string,
): asserts cursor is string {
  if (!cursor || seen.has(cursor)) {
    throw createApiErrorFromMessage(
      `Shopify returned a missing or repeated ${resource} pagination cursor.`,
      502,
    );
  }
  seen.add(cursor);
}

export async function runReturnAction(
  context: ReturnContext,
  idValue: unknown,
  action: ReturnAction,
  input: ReturnActionInput = {},
) {
  const id = requireShopifyGid(idValue, "Return");
  const config = {
    approve: {
      field: "returnApproveRequest",
      operation: "CommerceOpsApproveReturn",
      type: "ReturnApproveRequestInput!",
      argument: "input: $input",
      variables: { input: { id } },
    },
    decline: {
      field: "returnDeclineRequest",
      operation: "CommerceOpsDeclineReturn",
      type: "ReturnDeclineRequestInput!",
      argument: "input: $input",
      variables: {
        input: {
          id,
          declineReason: input.declineReason || "OTHER",
          notifyCustomer: input.notifyCustomer === true,
          ...(String(input.declineNote || "").trim()
            ? { declineNote: String(input.declineNote).trim() }
            : {}),
        },
      },
    },
    close: {
      field: "returnClose",
      operation: "CommerceOpsCloseReturn",
      type: "ID!",
      argument: "id: $input",
      variables: { input: id },
    },
    cancel: {
      field: "returnCancel",
      operation: "CommerceOpsCancelReturn",
      type: "ID!",
      argument: "id: $input",
      variables: { input: id },
    },
  }[action];
  const data = await callShopifyGraphql<
    Record<
      string,
      { return: { id: string; status: string } | null; userErrors: UserError[] }
    >
  >({
    ...context,
    operationName: config.operation,
    retryTransport: false,
    query: `#graphql
      mutation ${config.operation}($input: ${config.type}) {
        ${config.field}(${config.argument}) {
          return { id status }
          userErrors { field message }
        }
      }
    `,
    variables: config.variables,
  });
  const result = data[config.field]!;
  assertNoGraphqlUserErrors(result.userErrors, `Failed to ${action} the return.`);
  return result.return || { id, status: action.toUpperCase() };
}
