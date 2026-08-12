import type { H3Event } from "h3";
import type {
  CommerceListResponse,
  ReturnAction,
  ReturnActionInput,
  ReturnSummary,
} from "~~/types/shopify-operations";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
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

export async function fetchReturns(
  context: ReturnContext,
): Promise<CommerceListResponse<ReturnSummary>> {
  const orderData = await callShopifyGraphql<{
    orders: {
      nodes: Array<{
        id: string;
        name: string;
        returnStatus: string;
      }>;
      pageInfo: { endCursor?: string | null; hasNextPage: boolean };
    };
  }>({
    ...context,
    operationName: "CommerceOpsReturnOrders",
    query: `#graphql
      query CommerceOpsReturnOrders($first: Int!) {
        orders(first: $first, reverse: true, sortKey: UPDATED_AT) {
          nodes { id name returnStatus }
          pageInfo { endCursor hasNextPage }
        }
      }
    `,
    variables: { first: 50 },
  });

  const candidateIds = orderData.orders.nodes
    .filter((order) => order.returnStatus !== "NO_RETURN")
    .slice(0, 10)
    .map((order) => order.id);
  if (candidateIds.length === 0) {
    return {
      items: [],
      pageInfo: {
        endCursor: orderData.orders.pageInfo.endCursor || null,
        hasNextPage: orderData.orders.pageInfo.hasNextPage,
      },
    };
  }

  const returnData = await callShopifyGraphql<{
    nodes: Array<{
      id: string;
      name: string;
      returns: {
        nodes: Array<{
          id: string;
          name: string;
          status: string;
          createdAt: string;
          closedAt?: string | null;
          totalQuantity: number;
          returnLineItems: {
            nodes: Array<{
              id: string;
              quantity: number;
              customerNote?: string | null;
              returnReasonDefinition?: { name?: string | null } | null;
              fulfillmentLineItem?: {
                lineItem?: { name?: string | null } | null;
              } | null;
            }>;
          };
        }>;
      };
    } | null>;
  }>({
    ...context,
    operationName: "CommerceOpsReturns",
    query: `#graphql
      query CommerceOpsReturns($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id name
            returns(first: 5, reverse: true) {
              nodes {
                id name status createdAt closedAt totalQuantity
                returnLineItems(first: 10) {
                  nodes {
                    id quantity customerNote
                    returnReasonDefinition { name }
                    ... on ReturnLineItem {
                      fulfillmentLineItem { lineItem { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { ids: candidateIds },
  });

  const items = returnData.nodes
    .filter((order) => order !== null)
    .flatMap((order) =>
      order.returns.nodes.map((item): ReturnSummary => ({
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
          title: String(
            lineItem.fulfillmentLineItem?.lineItem?.name || "Returned item",
          ),
          quantity: Number(lineItem.quantity || 0),
          reason: String(lineItem.returnReasonDefinition?.name || "Unspecified"),
          customerNote: String(lineItem.customerNote || ""),
        })),
      })),
    );

  return {
    items,
    pageInfo: {
      endCursor: orderData.orders.pageInfo.endCursor || null,
      hasNextPage: orderData.orders.pageInfo.hasNextPage,
    },
  };
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
