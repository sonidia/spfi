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
}

const RETURN_ORDER_PAGE_SIZE = 25;
const RETURN_PAGE_SIZE = 25;
const RETURN_LINE_ITEM_PAGE_SIZE = 50;
const RETURN_DETAIL_CONCURRENCY = 4;
const RETURN_ORDER_SEARCH = "-return_status:no_return";

export const RETURN_ORDERS_QUERY = `#graphql
  query CommerceOpsReturns(
    $first: Int!
    $after: String
    $query: String!
    $returnsFirst: Int!
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
  fragment ReturnSummaryFields on Return {
    id
    name
    status
    createdAt
    closedAt
    totalQuantity
  }
`;

export const RETURN_LINE_ITEMS_QUERY = `#graphql
  query CommerceOpsReturnLineItems($id: ID!, $first: Int!, $after: String) {
    return(id: $id) {
      returnLineItems(first: $first, after: $after) {
        nodes {
          id
          quantity
          customerNote
          returnReasonDefinition { name }
          ... on ReturnLineItem {
            fulfillmentLineItem { lineItem { name } }
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
`;

export async function fetchReturns(
  context: ReturnContext,
): Promise<CommerceListResponse<ReturnSummary>> {
  const recordsById = new Map<
    string,
    { order: Pick<ReturnOrderNode, "id" | "name">; item: ReturnNode }
  >();
  const seenOrderCursors = new Set<string>();
  let orderCursor: string | null = null;

  while (true) {
    const data: ReturnOrdersData = await callShopifyGraphql<
      ReturnOrdersData,
      ReturnOrdersVariables
    >({
      ...context,
      operationName: "CommerceOpsReturns",
      query: RETURN_ORDERS_QUERY,
      variables: {
        first: RETURN_ORDER_PAGE_SIZE,
        after: orderCursor,
        query: RETURN_ORDER_SEARCH,
        returnsFirst: RETURN_PAGE_SIZE,
      },
    });

    for (const order of data.orders.nodes) {
      addReturnRecords(recordsById, order, order.returns.nodes);
      let returnsCursor = order.returns.pageInfo.endCursor;
      let hasNextReturns = order.returns.pageInfo.hasNextPage;
      const seenReturnCursors = new Set<string>();

      while (hasNextReturns) {
        assertNextCursor(returnsCursor, seenReturnCursors, "return");
        const nextPage = await fetchOrderReturnsPage(context, order.id, returnsCursor!);
        addReturnRecords(recordsById, order, nextPage.nodes);
        returnsCursor = nextPage.pageInfo.endCursor;
        hasNextReturns = nextPage.pageInfo.hasNextPage;
      }
    }

    if (!data.orders.pageInfo.hasNextPage) break;
    const nextCursor: string | null = data.orders.pageInfo.endCursor;
    assertNextCursor(nextCursor, seenOrderCursors, "order");
    orderCursor = nextCursor;
  }

  const records = [...recordsById.values()].sort(
    (left, right) =>
      new Date(right.item.createdAt).getTime() -
      new Date(left.item.createdAt).getTime(),
  );
  const items = await mapWithConcurrency(
    records,
    RETURN_DETAIL_CONCURRENCY,
    async ({ order, item }) =>
      normalizeReturn(order, item, await fetchReturnLineItems(context, item.id)),
  );

  return {
    items,
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}

async function fetchOrderReturnsPage(
  context: ReturnContext,
  orderId: string,
  after: string,
) {
  const data = await callShopifyGraphql<
    { order: { returns: ReturnConnection } | null },
    { id: string; first: number; after: string }
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
            nodes { id name status createdAt closedAt totalQuantity }
            pageInfo { endCursor hasNextPage }
          }
        }
      }
    `,
    variables: {
      id: orderId,
      first: RETURN_PAGE_SIZE,
      after,
    },
  });
  return (
    data.order?.returns || {
      nodes: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }
  );
}

function addReturnRecords(
  target: Map<
    string,
    { order: Pick<ReturnOrderNode, "id" | "name">; item: ReturnNode }
  >,
  order: Pick<ReturnOrderNode, "id" | "name">,
  returns: ReturnNode[],
) {
  for (const item of returns) {
    target.set(item.id, { order, item });
  }
}

async function fetchReturnLineItems(context: ReturnContext, returnId: string) {
  const items: ReturnLineItemNode[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  while (true) {
    const data: ReturnLineItemsData = await callShopifyGraphql<
      ReturnLineItemsData,
      { id: string; first: number; after: string | null }
    >({
      ...context,
      operationName: "CommerceOpsReturnLineItems",
      query: RETURN_LINE_ITEMS_QUERY,
      variables: { id: returnId, first: RETURN_LINE_ITEM_PAGE_SIZE, after },
    });
    const connection: GraphqlReturnLineItemConnection | undefined =
      data.return?.returnLineItems;
    if (!connection) return items;
    items.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) return items;
    assertNextCursor(connection.pageInfo.endCursor, seenCursors, "return line item");
    after = connection.pageInfo.endCursor;
  }
}

interface GraphqlReturnLineItemConnection {
  nodes: ReturnLineItemNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

interface ReturnLineItemsData {
  return: {
    returnLineItems: GraphqlReturnLineItemConnection;
  } | null;
}

function normalizeReturn(
  order: Pick<ReturnOrderNode, "id" | "name">,
  item: ReturnNode,
  lineItems: ReturnLineItemNode[],
): ReturnSummary {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    createdAt: item.createdAt,
    closedAt: item.closedAt || null,
    totalQuantity: Number(item.totalQuantity || 0),
    orderId: order.id,
    orderName: order.name,
    items: lineItems.map((lineItem) => ({
      id: lineItem.id,
      title: String(lineItem.fulfillmentLineItem?.lineItem?.name || "Returned item"),
      quantity: Number(lineItem.quantity || 0),
      reason: String(lineItem.returnReasonDefinition?.name || "Unspecified"),
      customerNote: String(lineItem.customerNote || ""),
    })),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
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
