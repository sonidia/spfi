import { defineEventHandler, readBody } from "h3";
import { StoreStatusInputError } from "../../utils/status-checker-errors";
import { checkShopifyStoreStatus } from "../../utils/shopify-status-checker";
import {
  createApiError,
  createApiErrorFromMessage,
} from "../../utils/callShopifyApi";

type StatusCheckBody = {
  target?: string;
  proxy?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<StatusCheckBody>(event);
  const target = body?.target?.trim();
  const proxy = body?.proxy?.trim();

  if (!target) {
    throw createApiErrorFromMessage("Missing target", 400);
  }

  try {
    return await checkShopifyStoreStatus(target, proxy ? { proxy } : {});
  } catch (error) {
    if (error instanceof StoreStatusInputError) {
      throw createApiErrorFromMessage(error.message, 400);
    }

    throw createApiError(error, "Failed to check store status.");
  }
});
