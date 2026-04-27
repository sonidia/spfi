import axios from "axios";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import { SocksProxyAgent } from "socks-proxy-agent";

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

  const domain = storeId.includes(".") ? storeId : `${storeId}.myshopify.com`;
  const baseURL = `https://${domain}/admin/api/2026-04`;
  const headers = {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  };

  const proxy = "socks5://minhtuan3101:123456tt@31.57.41.147:5723";
  const agent = new SocksProxyAgent(proxy);

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
  } catch (err: any) {
    const message =
      err.response?.data?.errors || err.response?.data?.message || err.message;
    throw createError({
      statusCode: err.response?.status || 500,
      statusMessage: message,
    });
  }
});
