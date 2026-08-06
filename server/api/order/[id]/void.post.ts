import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import type { OrderVoidInput } from "~~/types/shopify-order";

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
  const orderId = String(event.context.params?.id || "");
  const body = (await readBody<VoidBody>(event)) || ({} as VoidBody);
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");
  const parentTransactionId = String(body.parentTransactionId || "").trim();

  if (!orderId || !storeId || !token || !parentTransactionId) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID, Access Token and parent transaction are required.",
      400,
    );
  }

  const data = await callShopifyGraphql<
    VoidData,
    { parentTransactionId: string }
  >({
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
      parentTransactionId: toShopifyGid(
        "OrderTransaction",
        parentTransactionId,
      ),
    },
  });

  assertNoGraphqlUserErrors(
    data.transactionVoid.userErrors,
    "Failed to void the authorization.",
  );

  return { transaction: data.transactionVoid.transaction };
});
