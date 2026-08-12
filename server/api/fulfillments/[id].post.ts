import { defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import {
  requireShopifyCredentials,
  requireShopifyResourceId,
} from "~~/server/utils/shopify-admin-request";
import {
  buildCarrierTrackingUrl,
  findTrackingCarrierByCompany,
} from "~~/utils/tracktaco";

interface TrackingInfo {
  number?: string;
  company?: string;
  url?: string;
}

interface FulfillmentUpdateBody {
  storeId?: string;
  token?: string;
  fulfillment?: {
    notify_customer?: boolean;
    tracking_info?: TrackingInfo;
  };
}

interface FulfillmentUpdatePayload {
  fulfillment: {
    notify_customer: boolean;
    tracking_info: {
      number?: string;
      company?: string;
      url?: string;
    };
  };
}

export default defineEventHandler(async (event) => {
  const id = requireShopifyResourceId(event.context.params?.id, "Fulfillment");
  const body = (await readBody<FulfillmentUpdateBody>(event)) || {};
  const { storeId, token } = requireShopifyCredentials(body);
  const fulfillmentInfo = body.fulfillment;

  const trackingNumber = String(fulfillmentInfo?.tracking_info?.number || "").trim();
  const trackingCompany = String(fulfillmentInfo?.tracking_info?.company || "").trim();
  const carrier = findTrackingCarrierByCompany(trackingCompany);
  const trackingUrl = String(
    fulfillmentInfo?.tracking_info?.url ||
      (carrier ? buildCarrierTrackingUrl(carrier, trackingNumber) : ""),
  ).trim();

  return callShopifyApi<Record<string, unknown>, FulfillmentUpdatePayload>({
    event,
    storeId,
    token,
    method: "PUT",
    path: `/fulfillments/${id}.json`,
    body: {
      fulfillment: {
        notify_customer: fulfillmentInfo?.notify_customer === true,
        tracking_info: {
          ...(trackingNumber ? { number: trackingNumber } : {}),
          ...(trackingCompany ? { company: trackingCompany } : {}),
          ...(trackingUrl ? { url: trackingUrl } : {}),
        },
      },
    },
    missingProxyMessage: "Missing sock proxy.",
  });
});
