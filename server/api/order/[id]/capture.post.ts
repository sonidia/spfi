import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type { OrderCaptureInput } from "~~/types/shopify-order";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";

interface CaptureBody extends OrderCaptureInput {
  storeId?: string;
  token?: string;
}

interface CaptureData {
  orderCapture: {
    transaction: {
      id: string;
      kind: string;
      status: string;
      amountSet: {
        presentmentMoney: { amount: string; currencyCode: string };
      };
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<CaptureBody>(event)) || ({} as CaptureBody);
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const amount = String(body.amount || "").trim();
  const parentTransactionId = String(body.parentTransactionId || "").trim();
  const currency = String(body.currency || "")
    .trim()
    .toUpperCase();

  if (!storeId || !token || !parentTransactionId) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and parent transaction are required.",
      400,
    );
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw createApiErrorFromMessage("Capture amount must be greater than zero.", 400);
  }
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw createApiErrorFromMessage("Currency must be a three-letter code.", 400);
  }

  const data = await callShopifyGraphql<
    CaptureData,
    { input: Record<string, unknown> }
  >({
    event,
    storeId,
    token,
    operationName: "CaptureOrderPayment",
    retryTransport: false,
    query: `
      mutation CaptureOrderPayment($input: OrderCaptureInput!) {
        orderCapture(input: $input) {
          transaction {
            id
            kind
            status
            amountSet {
              presentmentMoney { amount currencyCode }
            }
          }
          userErrors { field message }
        }
      }
    `,
    variables: {
      input: {
        id: toShopifyGid("Order", orderId),
        parentTransactionId: toShopifyGid("OrderTransaction", parentTransactionId),
        amount,
        ...(currency ? { currency } : {}),
        ...(typeof body.finalCapture === "boolean"
          ? { finalCapture: body.finalCapture }
          : {}),
      },
    },
  });

  assertNoGraphqlUserErrors(
    data.orderCapture.userErrors,
    "Failed to capture the order payment.",
  );

  return { transaction: data.orderCapture.transaction };
});
