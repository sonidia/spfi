import { defineEventHandler, readBody } from "h3";
import { requireShopifyCredentials } from "~~/server/utils/shopify-admin-request";
import { requireJobGid } from "~~/server/utils/shopify-collection-validation";
import { getShopifyJob } from "~~/server/utils/shopify-job";

export default defineEventHandler(async (event) => {
  const body =
    (await readBody<{ storeId?: string; token?: string; jobId?: unknown }>(event)) ||
    {};
  const { storeId, token } = requireShopifyCredentials(body);
  const id = requireJobGid(body.jobId);
  return getShopifyJob({ event, storeId, token, id });
});
