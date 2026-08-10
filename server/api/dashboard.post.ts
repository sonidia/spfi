import { defineEventHandler, readBody, setResponseHeader } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { fetchStoreDashboard } from "~~/server/utils/shopify-dashboard";

interface DashboardBody {
  storeId?: string;
  token?: string;
  timezoneOffsetMinutes?: number;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<DashboardBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const token = String(body.token || "").trim();

  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const timezoneOffsetMinutes = Number(body.timezoneOffsetMinutes || 0);
  if (
    !Number.isFinite(timezoneOffsetMinutes) ||
    timezoneOffsetMinutes < -840 ||
    timezoneOffsetMinutes > 840
  ) {
    throw createApiErrorFromMessage("Invalid timezone offset.", 400);
  }

  setResponseHeader(event, "cache-control", "private, no-store");
  return fetchStoreDashboard({
    event,
    storeId,
    token,
    timezoneOffsetMinutes,
  });
});
