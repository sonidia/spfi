import type { H3Event } from "h3";
import type {
  OrdersResponse,
  ShopifyOrder,
  ShopifyOrderTransaction,
  ShopifyRefund,
} from "~~/types/shopify";
import { callShopifyApi, createApiErrorFromMessage } from "./callShopifyApi";
import { callShopifyPaginatedApi } from "./callShopifyPaginatedApi";

interface FinancialContextRequest {
  event: H3Event;
  storeId: string;
  token: string;
  orderId: string;
}

export async function loadShopifyFinancialOrder({
  event,
  storeId,
  token,
  orderId,
}: FinancialContextRequest): Promise<ShopifyOrder> {
  const response = await callShopifyApi<OrdersResponse>({
    event,
    storeId,
    token,
    path: `/orders/${orderId}.json`,
    params: {
      fields:
        "id,cancelled_at,currency,total_outstanding,current_total_price,total_price,line_items,financial_status",
    },
    forwardResponseHeaders: false,
  });

  if (!response.order) {
    throw createApiErrorFromMessage(
      "Shopify did not return the order required for validation.",
      502,
    );
  }
  return response.order;
}

export function loadShopifyFinancialTransactions(
  request: FinancialContextRequest,
): Promise<ShopifyOrderTransaction[]> {
  return callShopifyPaginatedApi<ShopifyOrderTransaction>({
    ...request,
    path: `/orders/${request.orderId}/transactions.json`,
    resourceKey: "transactions",
    params: {
      fields: "id,order_id,kind,gateway,status,amount,currency,parent_id",
    },
    forwardResponseHeaders: false,
  });
}

export function loadShopifyFinancialRefunds(
  request: FinancialContextRequest,
): Promise<ShopifyRefund[]> {
  return callShopifyPaginatedApi<ShopifyRefund>({
    ...request,
    path: `/orders/${request.orderId}/refunds.json`,
    resourceKey: "refunds",
    params: { fields: "id,refund_line_items" },
    forwardResponseHeaders: false,
  });
}
