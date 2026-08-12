import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type { OrderVoidInput } from "~~/types/shopify-order";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface VoidBody extends OrderVoidInput {
  storeId?: string;
  token?: string;
}

interface VoidData {
  transactionVoid: {
    transaction: {
      id: string;
      kind: string;
      status: string;
      gateway: string | null;
      createdAt: string;
      amountSet: {
        presentmentMoney: { amount: string; currencyCode: string };
      };
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event) => {
  requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<VoidBody>(event)) || ({} as VoidBody);
  const { storeId, token } = requireShopifyCredentials(body);
  const parentTransactionId = String(body.parentTransactionId || "").trim();

  if (!parentTransactionId) {
    throw createApiErrorFromMessage("Parent transaction is required.", 400);
  }

  const data = await callShopifyGraphql<VoidData, { parentTransactionId: string }>({
    event,
    storeId,
    token,
    operationName: "VoidOrderTransaction",
    retryTransport: false,
    query: `
      mutation VoidOrderTransaction($parentTransactionId: ID!) {
        transactionVoid(parentTransactionId: $parentTransactionId) {
          transaction {
            id
            kind
            status
            gateway
            createdAt
            amountSet {
              presentmentMoney { amount currencyCode }
            }
          }
          userErrors { field message }
        }
      }
    `,
    variables: {
      parentTransactionId: toShopifyGid("OrderTransaction", parentTransactionId),
    },
  });

  assertNoGraphqlUserErrors(
    data.transactionVoid.userErrors,
    "Failed to void the authorization.",
  );

  return { transaction: data.transactionVoid.transaction };
});
