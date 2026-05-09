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
  const { storeId, token, product } = body;

  if (!storeId || !token || !product) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID, Access Token, and Product payload are required.",
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
        const prodRes = await axios.post(
          `${baseURL}/products.json`,
          { product },
          {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
          }
        );

        return prodRes.data;
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
      statusMessage: typeof message === "object" ? JSON.stringify(message) : message,
    });
  }
});
