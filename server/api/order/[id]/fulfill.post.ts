import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import {
  buildProxyVariants,
  createProxyAgent,
  resolveStoreAdminDomain,
  resolveStoreCookieData,
} from "~~/utils/proxy/store-proxy";

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const id = event.context.params?.id;
  const body = await readBody(event);
  const { storeId, token, fulfillment: fulfillmentInfo } = body;

  if (!id || !storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Order ID, Store ID and Access Token are required.",
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

  const adminDomain = resolveStoreAdminDomain(
    String(storeId),
    storeCookie?.domain,
  );
  const baseURL = `https://${adminDomain}/${appConfig.apiBase}`;
  const headers = {
    "X-Shopify-Access-Token": String(token),
    "Content-Type": appConfig.contentType,
  };
  const proxyVariants = buildProxyVariants(sock);

  try {
    let lastError: any;

    for (const proxyUrl of proxyVariants) {
      const agent = createProxyAgent(proxyUrl);
      const commonAxiosConfig = {
        headers,
        httpAgent: agent,
        httpsAgent: agent,
      };

      try {
        const trackingNumber = fulfillmentInfo?.tracking_info?.number;
        const trackingUrl = `${appConfig.tracking.url}${trackingNumber}`;

        // --- TRY MODERN WAY FIRST (Fulfillment Orders) ---
        try {
          let openFO: any;
          let foLineItems: any[] = [];

          // If fulfillment_order_id is provided in the body, use it directly
          const explicitFO =
            fulfillmentInfo?.line_items_by_fulfillment_order?.[0];
          if (explicitFO?.fulfillment_order_id) {
            openFO = { id: explicitFO.fulfillment_order_id };
            foLineItems = explicitFO.fulfillment_order_line_items || [];
          } else {
            // Fallback to searching for an open FO
            const foRes = await axios.get(
              `${baseURL}/orders/${id}/fulfillment_orders.json`,
              commonAxiosConfig,
            );
            const fulfillmentOrders = foRes.data.fulfillment_orders;
            openFO = fulfillmentOrders.find(
              (fo: any) => fo.status === "open" || fo.status === "in_progress",
            );

            if (openFO) {
              foLineItems = (openFO.line_items || [])
                .map((li: any) => ({
                  id: li.id,
                  quantity: li.fulfillable_quantity || li.quantity,
                }))
                .filter((li: any) => li.quantity > 0);
            }
          }

          if (openFO) {
            const fulfillmentPayload: any = {
              notify_customer: true,
              line_items_by_fulfillment_order: [
                {
                  fulfillment_order_id: openFO.id,
                },
              ],
              tracking_info: {
                number: trackingNumber,
                company:
                  fulfillmentInfo?.tracking_info?.company ||
                  appConfig.tracking.company,
                url: trackingUrl,
              },
            };

            if (foLineItems && foLineItems.length > 0) {
              fulfillmentPayload.line_items_by_fulfillment_order[0].fulfillment_order_line_items =
                foLineItems;
            }

            const createRes = await axios.post(
              `${baseURL}/fulfillments.json`,
              {
                fulfillment: fulfillmentPayload,
              },
              commonAxiosConfig,
            );

            return createRes.data;
          }
        } catch (foErr: any) {
          console.warn("[Fulfillment] Modern way failed: ", foErr.message);
        }

        // --- TRY LEGACY WAY (Orders/Fulfillments) ---
        // 1. Get locations (required for legacy fulfillment)
        const locRes = await axios.get(
          `${baseURL}/locations.json`,
          commonAxiosConfig,
        );
        const locations = locRes.data.locations;
        const primaryLoc = locations.find((l: any) => l.active) || locations[0];

        if (!primaryLoc) {
          throw new Error("No active location found to fulfill items.");
        }

        const legacyRes = await axios.post(
          `${baseURL}/orders/${id}/fulfillments.json`,
          {
            fulfillment: {
              location_id: primaryLoc.id,
              notify_customer: true,
              tracking_info: {
                number: trackingNumber,
                company:
                  fulfillmentInfo?.tracking_info?.company ||
                  appConfig.tracking.company,
                url: trackingUrl,
              },
              tracking_number: trackingNumber,
              tracking_company:
                fulfillmentInfo?.tracking_info?.company ||
                appConfig.tracking.company,
            },
          },
          commonAxiosConfig,
        );

        return legacyRes.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unknown proxy error");
  } catch (err: any) {
    let message = err.response?.data || err.message;
    let statusCode = err.response?.status || 500;

    throw createError({
      statusCode,
      statusMessage:
        typeof message === "string" ? message : JSON.stringify(message),
    });
  }
});
