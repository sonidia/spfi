import { defineEventHandler, getQuery } from "h3";
import {
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type {
  OrderRiskAssessmentsResponse,
  ShopifyOrderRiskSummary,
} from "~~/types/shopify-order";

const ORDER_RISK_ASSESSMENTS_QUERY = `#graphql
  query OrderRiskAssessmentsList($orderId: ID!) {
    order(id: $orderId) {
      risk {
        assessments {
          riskLevel
          provider {
            title
          }
          facts {
            description
            sentiment
          }
        }
        recommendation
      }
    }
  }
`;

interface OrderRiskQueryData {
  order: { risk: ShopifyOrderRiskSummary } | null;
}

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "");
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");
  if (!id || !storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  const orderId = toShopifyGid("Order", id);
  const data = await callShopifyGraphql<OrderRiskQueryData>({
    event,
    storeId,
    token,
    query: ORDER_RISK_ASSESSMENTS_QUERY,
    variables: { orderId },
    operationName: "OrderRiskAssessmentsList",
  });

  if (!data.order) {
    throw createApiErrorFromMessage("Order not found.", 404);
  }

  return {
    orderId,
    risk: data.order.risk,
    capabilities: {
      read: true,
      create: true,
      update: false,
      delete: false,
    },
  } satisfies OrderRiskAssessmentsResponse;
});
