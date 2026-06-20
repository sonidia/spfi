import { createError, defineEventHandler, readBody } from "h3";
import { StoreStatusInputError } from "../../utils/status-checker-errors";
import { checkShopifyStoreStatus } from "../../utils/shopify-status-checker";

type StatusCheckBody = {
  target?: string;
  proxy?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<StatusCheckBody>(event);
  const target = body?.target?.trim();
  const proxy = body?.proxy?.trim();

  if (!target) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing target",
    });
  }

  try {
    return await checkShopifyStoreStatus(target, proxy ? { proxy } : {});
  } catch (error) {
    if (error instanceof StoreStatusInputError) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message,
        message: error.message,
      });
    }

    throw error;
  }
});
