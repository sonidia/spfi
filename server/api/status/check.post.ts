import { useRuntimeConfig } from "#imports";
import { defineEventHandler, readBody } from "h3";
import { StoreStatusInputError } from "../../utils/status-checker-errors";
import { checkShopifyStoreStatus } from "../../utils/shopify-status-checker";
import { createApiError, createApiErrorFromMessage } from "../../utils/callShopifyApi";
import { readRuntimeBoolean } from "../../utils/runtime-config";

type StatusCheckBody = {
  target?: string;
  proxy?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const body = await readBody<StatusCheckBody>(event);
  const target = body?.target?.trim();
  const proxy = body?.proxy?.trim();

  if (!target) {
    throw createApiErrorFromMessage("Missing target", 400);
  }

  try {
    return await checkShopifyStoreStatus(target, {
      ...(proxy ? { proxy } : {}),
      allowPrivateProxyHosts: readRuntimeBoolean(config.allowPrivateProxyHosts),
    });
  } catch (error) {
    if (error instanceof StoreStatusInputError) {
      throw createApiErrorFromMessage(error.message, 400);
    }

    throw createApiError(error, "Failed to check store status.");
  }
});
