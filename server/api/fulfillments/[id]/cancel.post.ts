import { defineEventHandler, readBody } from "h3";
import {
  assertNoGraphqlUserErrors,
  callShopifyGraphql,
  toShopifyGid,
} from "~~/server/utils/callShopifyGraphql";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface CancelFulfillmentBody {
  storeId?: string;
  token?: string;
}

interface CancelFulfillmentData {
  fulfillmentCancel: {
    fulfillment: { id: string; status: string } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
}

export default defineEventHandler(async (event) => {
  const fulfillmentId = requireShopifyResourceId(
    event.context.params?.id,
    "Fulfillment",
  );
  const body = (await readBody<CancelFulfillmentBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);

  const data = await callShopifyGraphql<CancelFulfillmentData, { id: string }>({
    event,
    storeId,
    token,
    operationName: "CancelFulfillment",
    retryTransport: false,
    query: `
      mutation CancelFulfillment($id: ID!) {
        fulfillmentCancel(id: $id) {
          fulfillment { id status }
          userErrors { field message }
        }
      }
    `,
    variables: { id: toShopifyGid("Fulfillment", fulfillmentId) },
  });

  assertNoGraphqlUserErrors(
    data.fulfillmentCancel.userErrors,
    "Failed to cancel the fulfillment.",
  );

  return { fulfillment: data.fulfillmentCancel.fulfillment };
});
