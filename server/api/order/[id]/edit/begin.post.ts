import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";
import type {
  CalculatedOrderLineItem,
  OrderEditSessionResponse,
} from "~~/types/shopify-order";

interface BeginEditBody {
  storeId?: string;
  token?: string;
}

interface BeginEditData {
  orderEditBegin: {
    calculatedOrder: {
      id: string;
      lineItems: {
        nodes: CalculatedOrderLineItem[];
        pageInfo: {
          hasNextPage: boolean;
        };
      };
    } | null;
    orderEditSession: {
      id: string;
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event): Promise<OrderEditSessionResponse> => {
  const orderId = requireShopifyResourceId(
    event.context.params?.id,
    "Order",
  );
  const body = (await readBody<BeginEditBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!orderId || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  const data = await callShopifyGraphql<BeginEditData, { id: string }>({
    event,
    storeId,
    token,
    operationName: "BeginOrderEdit",
    retryTransport: false,
    query: `
      mutation BeginOrderEdit($id: ID!) {
        orderEditBegin(id: $id) {
          calculatedOrder {
            id
            lineItems(first: 250) {
              nodes {
                id
                title
                sku
                quantity
                editableQuantity
                restockable
              }
              pageInfo { hasNextPage }
            }
          }
          orderEditSession { id }
          userErrors { field message }
        }
      }
    `,
    variables: { id: toShopifyGid("Order", orderId) },
  });

  assertNoGraphqlUserErrors(
    data.orderEditBegin.userErrors,
    "Failed to begin editing the order.",
  );

  const calculatedOrder = data.orderEditBegin.calculatedOrder;
  const orderEditSession = data.orderEditBegin.orderEditSession;
  if (!calculatedOrder || !orderEditSession) {
    throw createApiErrorFromMessage(
      "Shopify did not return an editable order session.",
      422,
    );
  }

  return {
    orderEditSessionId: orderEditSession.id,
    calculatedOrderId: calculatedOrder.id,
    lineItems: calculatedOrder.lineItems.nodes,
    hasMoreLineItems: calculatedOrder.lineItems.pageInfo.hasNextPage,
  };
});
