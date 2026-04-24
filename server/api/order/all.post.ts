import { createError, defineEventHandler, readBody } from "h3";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { storeId, token } = body;

  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  const domain = storeId.includes(".") ? storeId : `${storeId}.myshopify.com`;
  const baseURL = `https://${domain}/admin/api/2026-04`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };

  try {
    const ordersRes = await $fetch<any>("/orders.json?status=any", {
      baseURL,
      headers,
    });
    return ordersRes;
  } catch (err: any) {
    const message = err.data?.errors || err.data?.message || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: message,
    });
  }
});
