import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "~~/utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
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
      statusMessage:
        "Missing sock proxy for this store. Please update it in Manager page.",
    });
  }

  const domain = resolveStoreDomain(storeId, storeCookie?.domain);
  const baseURL = `https://${domain}/${appConfig.apiBase}`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": appConfig.contentType,
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
        const [balanceRes, payoutsRes] = await Promise.all([
          axios.get(`${baseURL}/shopify_payments/balance.json`, {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
          }),
          axios.get(`${baseURL}/shopify_payments/payouts.json`, {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
          }),
        ]);

        const balance = balanceRes.data.balance;
        const payouts = payoutsRes.data.payouts ?? [];

        const txResults = await Promise.all(
          payouts.map(async (payout: any) => {
            const res = await axios.get(
              `${baseURL}/shopify_payments/balance/transactions.json`,
              {
                headers,
                httpAgent: agent,
                httpsAgent: agent,
                params: { payout_id: payout.id },
              },
            );
            return { payoutId: payout.id, data: res.data };
          }),
        );

        const transactionsByPayout: Record<string, any[]> = {};
        for (const { payoutId, data } of txResults) {
          transactionsByPayout[String(payoutId)] = data.transactions ?? [];
        }

        return {
          balance,
          payouts,
          transactionsByPayout,
        };
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
