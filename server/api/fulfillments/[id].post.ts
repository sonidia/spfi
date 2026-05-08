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
  const id = event.context.params?.id;
  const body = await readBody(event);
  const { storeId, token, fulfillment: fulfillmentInfo } = body;

  if (!id || !storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Fulfillment ID, Store ID and Access Token are required.",
    });
  }

  const storeCookie = resolveStoreCookieData(event, String(storeId));
  const sock = String(storeCookie?.sock || "").trim();
  if (!sock) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing sock proxy.",
    });
  }

  const domain = resolveStoreDomain(String(storeId), storeCookie?.domain);
  const baseURL = `https://${domain}/${appConfig.apiBase}`;
  const headers = {
    "X-Shopify-Access-Token": String(token),
    "Content-Type": appConfig.contentType,
  };
  const proxyVariants = buildProxyVariants(sock);

  const trackingNumber = fulfillmentInfo?.tracking_info?.number;
  const trackingUrl = `${appConfig.tracking.url}${trackingNumber}`;

  try {
    let lastError: any;

    for (const proxyUrl of proxyVariants) {
      const agent = createProxyAgent(proxyUrl);
      try {
        const response = await axios.put(
          `${baseURL}/fulfillments/${id}.json`,
          {
            fulfillment: {
              notify_customer: true,
              tracking_info: {
                number: trackingNumber,
                company:
                  fulfillmentInfo?.tracking_info?.company ||
                  appConfig.tracking.company,
                url: trackingUrl,
              },
            },
          },
          {
            headers,
            httpAgent: agent,
            httpsAgent: agent,
          },
        );

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
      statusMessage:
        typeof message === "string" ? message : JSON.stringify(message),
    });
  }
});
