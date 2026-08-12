import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";

interface TrackingInfo {
  number?: string;
  company?: string;
}

interface FulfillmentUpdateBody {
  storeId?: string;
  token?: string;
  fulfillment?: {
    tracking_info?: TrackingInfo;
  };
}

interface FulfillmentUpdatePayload {
  fulfillment: {
    notify_customer: boolean;
    tracking_info: {
      number?: string;
      company: string;
      url: string;
    };
  };
}

export default defineEventHandler(async (event) => {
  const appConfig = useAppConfig();
  const id = requireShopifyResourceId(event.context.params?.id, "Fulfillment");
  const body = (await readBody<FulfillmentUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const fulfillmentInfo = body.fulfillment;

  const trackingNumber = fulfillmentInfo?.tracking_info?.number;
  const trackingUrl = `${appConfig.tracking.url}${trackingNumber || ""}`;

  return callShopifyApi<Record<string, unknown>, FulfillmentUpdatePayload>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/fulfillments/${id}.json`,
    body: {
      fulfillment: {
        notify_customer: true,
        tracking_info: {
          number: trackingNumber,
          company:
            fulfillmentInfo?.tracking_info?.company || appConfig.tracking.company,
          url: trackingUrl,
        },
      },
    },
    missingProxyMessage: "Missing sock proxy.",
  });
});
