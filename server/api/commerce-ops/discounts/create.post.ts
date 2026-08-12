import { defineEventHandler, readBody } from "h3";
import { createDiscount } from "~~/server/utils/shopify-discounts";
import {
  requireShopifyCredentials,
  requireShopifyPayload,
} from "~~/server/utils/shopify-admin-request";
import type { DiscountCreateInput } from "~~/types/shopify-operations";

interface Body {
  storeId?: string;
  token?: string;
  input?: DiscountCreateInput;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {};
  const auth = requireShopifyCredentials(body);
  const input = requireShopifyPayload<DiscountCreateInput>(body.input, "Discount");
  return createDiscount({ event, ...auth }, input);
});
