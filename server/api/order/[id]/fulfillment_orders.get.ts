import axios from "axios";
import { createError, defineEventHandler, getQuery } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
  resolveStoreAdminDomain,
} from "../../../../utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  const query = getQuery(event);
  const { storeId, token } = query;

  if (!id || !storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order ID, Store ID and Access Token are required in query params.",
    });
  }

  const storeCookie = resolveStoreCookieData(event, String(storeId));
  const sock = String(storeCookie?.sock || "").trim();
  if (!sock) {
    throw createError({ statusCode: 400, statusMessage: "Missing sock proxy." });
  }

  const adminDomain = resolveStoreAdminDomain(String(storeId), storeCookie?.domain);
  const baseURL = `https://${adminDomain}/admin/api/2026-04`;
  const headers = {
    "X-Shopify-Access-Token": String(token),
    "Content-Type": "application/json",
  };
  const proxyVariants = buildProxyVariants(sock);

  try {
    let lastError: any;

    for (const proxyUrl of proxyVariants) {
      const agent = createProxyAgent(proxyUrl);
      try {
        const response = await axios.get(`${baseURL}/orders/${id}/fulfillment_orders.json`, {
          headers,
          httpAgent: agent,
          httpsAgent: agent,
        });

        return response.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unknown proxy error");
  } catch (err: any) {
    const message = err.response?.data || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }
});
