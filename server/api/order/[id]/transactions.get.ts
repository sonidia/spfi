import axios from "axios";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "../../../utils/store-proxy";

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, "id");
  const query = getQuery(event);
  const storeId = query.storeId as string;
  const token = query.token as string;

  if (!orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order ID is required.",
    });
  }

  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  const storeCookie = resolveStoreCookieData(event, storeId);
  const sock = String(storeCookie?.sock || "").trim();
  if (!sock) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Missing sock proxy for this store. Please update it in Manager page.",
    });
  }

  const domain = resolveStoreDomain(storeId, storeCookie?.domain);
  const baseURL = `https://${domain}/admin/api/2026-04`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
  const proxyVariants = buildProxyVariants(sock);

  if (proxyVariants.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
    });
  }

  try {
    let lastError: any;

    for (const proxyUrl of proxyVariants) {
      const agent = createProxyAgent(proxyUrl);
      try {
        const res = await axios.get(
          `${baseURL}/orders/${orderId}/transactions.json`,
          {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
          },
        );

        return res.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unknown proxy error");
  } catch (err: any) {
    const message =
      err.response?.data?.errors || err.response?.data?.message || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: message,
    });
  }
});
