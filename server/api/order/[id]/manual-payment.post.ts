import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type { OrderManualPaymentInput } from "~~/types/shopify-order";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import { loadShopifyFinancialOrder } from "~~/server/utils/shopify-order-financial-context";
import { assertManualPaymentAllowed } from "~~/server/utils/shopify-order-financial-validation";

interface ManualPaymentBody extends OrderManualPaymentInput {
  storeId?: string;
  token?: string;
}

interface ManualPaymentVariables extends Record<string, unknown> {
  id: string;
  amount: { amount: string; currencyCode: string };
  paymentMethodName?: string;
  processedAt?: string;
}

interface ManualPaymentData {
  orderCreateManualPayment: {
    order: {
      id: string;
      displayFinancialStatus: string;
      totalOutstandingSet: {
        presentmentMoney: { amount: string; currencyCode: string };
      };
    } | null;
    userErrors: Array<{
      code?: string | null;
      field?: string[] | null;
      message: string;
    }>;
  };
}

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<ManualPaymentBody>(event)) || ({} as ManualPaymentBody);
  const { storeId, token } = requireShopifyCredentials(body);
  const amount = String(body.amount || "").trim();
  const currency = String(body.currency || "")
    .trim()
    .toUpperCase();
  const paymentMethodName = String(body.paymentMethodName || "").trim();
  const processedAt = normalizeProcessedAt(body.processedAt);

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw createApiErrorFromMessage(
      "Manual payment amount must be greater than zero.",
      400,
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createApiErrorFromMessage("Currency must be a three-letter code.", 400);
  }

  const order = await loadShopifyFinancialOrder({
    event,
    storeId,
    token,
    orderId,
  });
  const validated = assertManualPaymentAllowed(order, { amount, currency });

  const variables: ManualPaymentVariables = {
    id: toShopifyGid("Order", orderId),
    amount: {
      amount: validated.amount,
      currencyCode: validated.currency,
    },
    ...(paymentMethodName ? { paymentMethodName } : {}),
    ...(processedAt ? { processedAt } : {}),
  };
  const data = await callShopifyGraphql<ManualPaymentData, ManualPaymentVariables>({
    event,
    storeId,
    token,
    operationName: "CreateOrderManualPayment",
    retryTransport: false,
    query: `
      mutation CreateOrderManualPayment(
        $id: ID!
        $amount: MoneyInput
        $paymentMethodName: String
        $processedAt: DateTime
      ) {
        orderCreateManualPayment(
          id: $id
          amount: $amount
          paymentMethodName: $paymentMethodName
          processedAt: $processedAt
        ) {
          order {
            id
            displayFinancialStatus
            totalOutstandingSet {
              presentmentMoney { amount currencyCode }
            }
          }
          userErrors { code field message }
        }
      }
    `,
    variables,
  });

  assertNoGraphqlUserErrors(
    data.orderCreateManualPayment.userErrors,
    "Failed to record the manual payment.",
  );

  return { order: data.orderCreateManualPayment.order };
});

function normalizeProcessedAt(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw createApiErrorFromMessage(
      "Processed time must be a valid ISO 8601 date and time.",
      400,
    );
  }
  return timestamp.toISOString();
}
