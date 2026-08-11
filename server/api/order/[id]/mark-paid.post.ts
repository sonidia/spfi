import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { requireShopifyResourceId } from "~~/server/utils/shopify-admin-request";

interface MarkPaidBody {
  storeId?: string;
  token?: string;
}

interface MarkPaidData {
  orderMarkAsPaid: {
    order: {
      id: string;
      displayFinancialStatus: string;
      totalOutstandingSet: {
        presentmentMoney: { amount: string; currencyCode: string };
      };
    } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event) => {
  const orderId = requireShopifyResourceId(event.context.params?.id, "Order");
  const body = (await readBody<MarkPaidBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createApiErrorFromMessage(
      "Order ID, Store ID and Access Token are required.",
      400,
    );
  }

  const data = await callShopifyGraphql<MarkPaidData, { input: { id: string } }>({
    event,
    storeId,
    token,
    operationName: "MarkOrderAsPaid",
    retryTransport: false,
    query: `
      mutation MarkOrderAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          order {
            id
            displayFinancialStatus
            totalOutstandingSet {
              presentmentMoney { amount currencyCode }
            }
          }
          userErrors { field message }
        }
      }
    `,
    variables: { input: { id: toShopifyGid("Order", orderId) } },
  });

  assertNoGraphqlUserErrors(
    data.orderMarkAsPaid.userErrors,
    "Failed to mark the order as paid.",
  );

  return { order: data.orderMarkAsPaid.order };
});
