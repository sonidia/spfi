import axios from "axios";
import { createError, defineEventHandler, getQuery } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "../../../../utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const payoutId = event.context.params?.id;
  const query = getQuery(event);
  const storeId = String(query.storeId || "");
  const token = String(query.token || "");

  if (!storeId || !token || !payoutId) {
    throw createError({
      statusCode: 400,
      statusMessage: "storeId, token and payout id are required.",
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

  let lastError: any;
  for (const proxyUrl of proxyVariants) {
    const agent = createProxyAgent(proxyUrl);
    try {
      const [payoutRes, txRes] = await Promise.all([
        axios.get(
          `${baseURL}/shopify_payments/payouts/${payoutId}.json`,
          { headers, httpAgent: agent, httpsAgent: agent },
        ),
        axios.get(
          `${baseURL}/shopify_payments/balance/transactions.json`,
          {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
            params: { payout_id: payoutId },
          },
        ),
      ]);

      return {
        payout: payoutRes.data.payout,
        transactions: txRes.data.transactions ?? [],
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
