import { randomUUID } from "node:crypto";
import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type { OrderRefundInput } from "~~/types/shopify-order";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";

interface RefundBody extends OrderRefundInput {
  storeId?: string;
  token?: string;
}

interface RefundData {
  refundCreate: {
    refund: {
      id: string;
      note?: string | null;
      totalRefundedSet: {
        presentmentMoney: { amount: string; currencyCode: string };
      };
      transactions: {
        nodes: Array<{ id: string; status: string; kind: string }>;
      };
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<RefundBody>(event)) || ({} as RefundBody);
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const amount = String(body.amount || "").trim();
  const gateway = String(body.gateway || "").trim();
  const parentTransactionId = String(body.parentTransactionId || "").trim();
  const currency = String(body.currency || "")
    .trim()
    .toUpperCase();
  const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
  const discrepancyReason = String(body.discrepancyReason || "OTHER").toUpperCase();

  if (!storeId || !token || !gateway || !parentTransactionId) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token, gateway and parent transaction are required.",
      400,
    );
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw createApiErrorFromMessage("Refund amount must be greater than zero.", 400);
  }
  if (!lineItems.length) {
    throw createApiErrorFromMessage("Select at least one line item to refund.", 400);
  }
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw createApiErrorFromMessage("Currency must be a three-letter code.", 400);
  }
  if (!["CUSTOMER", "DAMAGE", "OTHER", "RESTOCK"].includes(discrepancyReason)) {
    throw createApiErrorFromMessage("Invalid refund discrepancy reason.", 400);
  }

  const seenLineItemIds = new Set<string>();
  const refundLineItems = lineItems.map((lineItem) => {
    const lineItemId = String(lineItem.lineItemId || "").trim();
    const quantity = Number(lineItem.quantity);
    if (
      !lineItemId ||
      seenLineItemIds.has(lineItemId) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw createApiErrorFromMessage(
        "Refund line items must be unique and have positive integer quantities.",
        400,
      );
    }
    seenLineItemIds.add(lineItemId);

    const restockType = lineItem.restockType || "NO_RESTOCK";
    if (!["CANCEL", "NO_RESTOCK", "RETURN"].includes(restockType)) {
      throw createApiErrorFromMessage("Invalid refund restock type.", 400);
    }

    return {
      lineItemId: toShopifyGid("LineItem", lineItemId),
      quantity,
      restockType,
      ...(lineItem.locationId
        ? { locationId: toShopifyGid("Location", lineItem.locationId) }
        : {}),
    };
  });

  const idempotencyKey = String(body.idempotencyKey || randomUUID()).trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    throw createApiErrorFromMessage("Invalid refund idempotency key.", 400);
  }

  const input = {
    orderId: toShopifyGid("Order", orderId),
    refundLineItems,
    transactions: [
      {
        orderId: toShopifyGid("Order", orderId),
        parentId: toShopifyGid("OrderTransaction", parentTransactionId),
        kind: "REFUND",
        gateway,
        amount,
      },
    ],
    discrepancyReason,
    ...(currency ? { currency } : {}),
    ...(body.note?.trim() ? { note: body.note.trim() } : {}),
    ...(typeof body.notify === "boolean" ? { notify: body.notify } : {}),
  };

  const data = await callShopifyGraphql<
    RefundData,
    { input: typeof input; idempotencyKey: string }
  >({
    event,
    storeId,
    token,
    operationName: "CreateOrderRefund",
    query: `
      mutation CreateOrderRefund($input: RefundInput!, $idempotencyKey: String!) {
        refundCreate(input: $input) @idempotent(key: $idempotencyKey) {
          refund {
            id
            note
            totalRefundedSet {
              presentmentMoney { amount currencyCode }
            }
            transactions(first: 10) { nodes { id status kind } }
          }
          userErrors { field message }
        }
      }
    `,
    variables: { input, idempotencyKey },
  });

  assertNoGraphqlUserErrors(
    data.refundCreate.userErrors,
    "Failed to create the order refund.",
  );

  return { refund: data.refundCreate.refund, idempotencyKey };
});
