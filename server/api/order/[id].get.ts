import axios from "axios";
import { createError, defineEventHandler, getQuery } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "~~/utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const id = event.context.params?.id;
  const { storeId, token } = getQuery(event);

  if (!id || !storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID, Store ID and Access Token are required.",
    });
  }

  const storeCookie = resolveStoreCookieData(event, String(storeId));
  const sock = String(storeCookie?.sock || "").trim();
  if (!sock) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing sock proxy for this store.",
    });
  }

  const domain = resolveStoreDomain(String(storeId), storeCookie?.domain);
  const baseURL = `https://${domain}/${appConfig.apiBase}`;
  const headers = {
    "X-Shopify-Access-Token": String(token),
    "Content-Type": appConfig.contentType,
  };
  const proxyVariants = buildProxyVariants(sock);

  try {
    let lastError: any;

    for (const proxyUrl of proxyVariants) {
      const agent = createProxyAgent(proxyUrl);
      try {
        const orderRes = await axios.get(`${baseURL}/orders/${id}.json`, {
          headers,
          httpAgent: agent,
          httpsAgent: agent,
        });

        return orderRes.data;
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
