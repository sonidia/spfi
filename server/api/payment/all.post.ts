import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { SocksProxyAgent } from "socks-proxy-agent";

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

  const proxy = "socks5://minhtuan3101:123456tt@31.57.41.147:5723";
  const agent = new SocksProxyAgent(proxy);

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
  } catch (err: any) {
    const message =
      err.response?.data?.errors || err.response?.data?.message || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: message,
    });
  }
});
