import { defineEventHandler, readBody } from "h3";
import { callShopifyGraphql } from "~~/server/utils/callShopifyGraphql";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { validateShopifyGraphqlRequest } from "~~/server/utils/shopify-graphql-request";

interface GraphqlBody {
  storeId?: string;
  token?: string;
  query?: unknown;
  variables?: unknown;
  operationName?: unknown;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<GraphqlBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const token = String(body.token || "").trim();
  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const request = validateShopifyGraphqlRequest(body);
  const data = await callShopifyGraphql<Record<string, unknown>>({
    event,
    storeId,
    token,
    ...request,
  });

  return { data };
});
