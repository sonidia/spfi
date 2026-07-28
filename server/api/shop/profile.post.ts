import { createError, defineEventHandler, readBody } from "h3";
import { callShopifyApi } from "~~/server/utils/callShopifyApi";
import type { ShopifyShop, ShopProfileResponse } from "~~/types/shopify";
import {
  resolveStoreCookieData,
  resolveStoreDomain,
} from "~~/utils/proxy/store-proxy";

interface ShopProfileBody {
  storeId?: string;
  token?: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<ShopProfileBody>(event)) || {};
  const storeId = String(body.storeId || "");
  const token = String(body.token || "");

  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  const storeCookie = resolveStoreCookieData(event, storeId);
  const domain = resolveStoreDomain(storeId, storeCookie?.domain);
  const response = await callShopifyApi<{ shop?: ShopifyShop }>({
    event,
    storeId,
    token,
    path: "/shop.json",
  });

  return {
    shop: response.shop ?? null,
    domain,
  } satisfies ShopProfileResponse;
});
