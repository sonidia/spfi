import assert from "node:assert/strict";
import test from "node:test";
import {
  getGraphqlThrottleDelayMs,
  isGraphqlThrottled,
  parseRetryAfterMs,
} from "../server/utils/shopify-throttle.ts";

test("Retry-After supports fractional seconds and HTTP dates without a cap", () => {
  assert.equal(parseRetryAfterMs("2.5"), 2_500);
  assert.equal(parseRetryAfterMs("15"), 15_000);
  assert.equal(
    parseRetryAfterMs("Fri, 07 Aug 2026 12:00:05 GMT", Date.UTC(2026, 7, 7, 12)),
    5_000,
  );
  assert.equal(parseRetryAfterMs("invalid"), null);
});

test("GraphQL retry delay is calculated from the returned throttle state", () => {
  assert.equal(
    getGraphqlThrottleDelayMs({
      cost: {
        requestedQueryCost: 101,
        throttleStatus: {
          currentlyAvailable: 50,
          restoreRate: 100,
          maximumAvailable: 2_000,
        },
      },
    }),
    510,
  );
});

test("GraphQL throttling is detected from Shopify's error code", () => {
  assert.equal(
    isGraphqlThrottled([{ extensions: { code: "THROTTLED" } }]),
    true,
  );
  assert.equal(
    isGraphqlThrottled([{ extensions: { code: "ACCESS_DENIED" } }]),
    false,
  );
});
