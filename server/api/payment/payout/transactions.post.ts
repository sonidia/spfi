import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "../../../../utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { storeId, token } = body;

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
      statusMessage: "Missing sock proxy for this store.",
    });
  }

  const domain = resolveStoreDomain(storeId, storeCookie?.domain);
  const baseURL = `https://${domain}/admin/api/2026-04`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };
  const proxyVariants = buildProxyVariants(sock);

  let lastError: any;
  for (const proxyUrl of proxyVariants) {
    const agent = createProxyAgent(proxyUrl);
    try {
      const res = await axios.get(
        `${baseURL}/shopify_payments/balance/transactions.json`,
        { headers, httpAgent: agent, httpsAgent: agent },
      );

      return {
        transactions: res.data.transactions ?? [],
      };
    } catch (error: any) {
      lastError = error;
    }
  }

  const message =
    lastError?.response?.data?.errors ||
    lastError?.response?.data?.message ||
    lastError?.message;
  throw createError({
    statusCode: lastError?.response?.status || 500,
    statusMessage: message,
  });
});
