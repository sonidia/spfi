import assert from "node:assert/strict";
import test from "node:test";
import { createApiSuccessResponse } from "../server/utils/api-response.ts";
import { getAxiosHeaderValue } from "../server/utils/http-headers.ts";
import {
  addMoneyAmount,
  moneyRowsFromMap,
  roundMoneyAmount,
} from "../utils/dashboard-money.ts";
import {
  DEFAULT_SHOPIFY_TOKEN_TTL_MS,
  resolveTokenExpiresAt,
} from "../utils/token-lifecycle.ts";
import { getLocaleDirection, isLocaleCode } from "../app/locales/messages.ts";

test("API success responses advertise strategy and field conventions", () => {
  const data = { orders: [{ id: "1" }] };
  const response = createApiSuccessResponse(data, {
    resource: "orders",
    strategy: "cursor",
    fieldConvention: "shopify-rest",
    pagination: { hasNextPage: false },
  });

  assert.equal(response.success, true);
  assert.equal(response.data, data);
  assert.equal("orders" in response, false);
  assert.deepEqual(response.meta, {
    resource: "orders",
    strategy: "cursor",
    fieldConvention: "shopify-rest",
    pagination: { hasNextPage: false },
  });
});

test("Axios header lookup supports AxiosHeaders and plain objects", () => {
  assert.equal(
    getAxiosHeaderValue(
      { get: (name: string) => (name === "retry-after" ? "2" : undefined) },
      "retry-after",
    ),
    "2",
  );
  assert.equal(
    getAxiosHeaderValue(
      { "x-shopify-shop-api-call-limit": "20/40" },
      "X-Shopify-Shop-Api-Call-Limit",
    ),
    "20/40",
  );
});

test("dashboard money helpers share deterministic rounding and ranking", () => {
  const totals = new Map<string, number>();
  addMoneyAmount(totals, "USD", 0.1);
  addMoneyAmount(totals, "USD", 0.2);
  addMoneyAmount(totals, "JPY", -10);

  assert.equal(roundMoneyAmount(1.005), 1.01);
  assert.equal(roundMoneyAmount(-1.005), -1.01);
  assert.equal(roundMoneyAmount(1234.4, "JPY"), 1234);
  assert.equal(roundMoneyAmount(1.2344, "KWD"), 1.234);
  assert.deepEqual(moneyRowsFromMap(totals), [
    { currency: "JPY", amount: -10 },
    { currency: "USD", amount: 0.3 },
  ]);
});

test("token expiry honors valid Shopify TTL and rejects unsafe values", () => {
  const now = 1_000;
  assert.equal(resolveTokenExpiresAt({ expires_in: 3_600 }, now), 3_601_000);
  assert.equal(
    resolveTokenExpiresAt({ expires_in: 0 }, now),
    now + DEFAULT_SHOPIFY_TOKEN_TTL_MS,
  );
  assert.equal(
    resolveTokenExpiresAt({ expires_in: Number.NaN }, now),
    now + DEFAULT_SHOPIFY_TOKEN_TTL_MS,
  );
});

test("localization exposes an actual RTL locale", () => {
  assert.equal(isLocaleCode("ar"), true);
  assert.equal(getLocaleDirection("ar"), "rtl");
  assert.equal(getLocaleDirection("vi"), "ltr");
});
