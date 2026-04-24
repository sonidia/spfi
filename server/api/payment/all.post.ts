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
    const [balance, payoutsRes] = await Promise.all([
      $fetch<any>("/shopify_payments/balance.json", { baseURL, headers }).then(
        (r) => r.balance,
      ),
      $fetch<any>("/shopify_payments/payouts.json", { baseURL, headers }),
    ]);

    const payouts = payoutsRes.payouts ?? [];

    const txResults = await Promise.all(
      payouts.map((payout: any) =>
        $fetch<any>("/shopify_payments/balance/transactions.json", {
          baseURL,
          headers,
          query: { payout_id: payout.id },
        }).then((res: any) => ({ payoutId: payout.id, data: res })),
      ),
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
    const message = err.data?.errors || err.data?.message || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: message,
    });
  }
});
