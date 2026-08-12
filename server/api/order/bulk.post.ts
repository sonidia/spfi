import { defineEventHandler, readBody } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { runShopifyOrderBulkAction } from "~~/server/utils/shopify-order-bulk";
import {
  requireShopifyCredentials,
  requireShopifyExactResourceId,
} from "~~/server/utils/shopify-admin-request";
import type {
  OrderBulkAction,
  OrderBulkRequest,
  OrderBulkResponse,
} from "~~/types/shopify-operations";

const ACTIONS = new Set<OrderBulkAction>(["capture", "fulfill", "refund"]);
const MAX_BULK_ORDERS = 25;

export default defineEventHandler(async (event): Promise<OrderBulkResponse> => {
  const body = (await readBody<Partial<OrderBulkRequest>>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const action = String(body.action || "") as OrderBulkAction;
  if (!ACTIONS.has(action)) {
    throw createApiErrorFromMessage("Invalid bulk order action.", 400);
  }
  if (!Array.isArray(body.orderIds) || !body.orderIds.length) {
    throw createApiErrorFromMessage("Select at least one order.", 400);
  }
  if (body.orderIds.length > MAX_BULK_ORDERS) {
    throw createApiErrorFromMessage(
      `Bulk order actions are limited to ${MAX_BULK_ORDERS} orders per request.`,
      400,
    );
  }

  const orderIds = Array.from(
    new Set(body.orderIds.map((id) => requireShopifyExactResourceId(id, "Order"))),
  );
  const results = await runShopifyOrderBulkAction(
    {
      event,
      storeId,
      token,
      notifyCustomer: body.notifyCustomer === true,
    },
    action,
    orderIds,
  );
  const succeeded = results.filter((result) => result.ok).length;

  return {
    action,
    requested: orderIds.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
});
