import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTracktacoSearchBody,
  collectTracktacoCandidates,
  normalizeTrackingNumberRequest,
  parseTracktacoReveal,
} from "../server/utils/tracktaco-v2.ts";
import {
  buildCarrierTrackingUrl,
  normalizeTrackingCarrier,
} from "../utils/tracktaco.ts";

test("carrier settings normalize safely and tracking URLs encode numbers", () => {
  assert.equal(normalizeTrackingCarrier("UPS"), "ups");
  assert.equal(normalizeTrackingCarrier("unknown"), "fedex");
  assert.equal(
    buildCarrierTrackingUrl("dhl", "ABC 123&next=bad"),
    "https://www.dhl.com/global-en/home/tracking.html?tracking-id=ABC+123%26next%3Dbad",
  );
});

test("Tracktaco v2 request normalization validates destination and ISO dates", () => {
  assert.deepEqual(
    normalizeTrackingNumberRequest({
      carrier: "fedex",
      destination: { country: "us", state: "tx", city: " Austin " },
      shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
    }),
    {
      carrier: "fedex",
      destination: { country: "US", state: "TX", city: "Austin" },
      shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
    },
  );

  assert.throws(
    () =>
      normalizeTrackingNumberRequest({
        carrier: "fedex",
        destination: {},
        shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
      }),
    /destination is required/i,
  );
  assert.throws(
    () =>
      normalizeTrackingNumberRequest({
        carrier: "fedex",
        destination: { country: "US" },
        shippedBetween: { from: "2026-08-12", to: "2026-08-05" },
      }),
    /date range is invalid/i,
  );
});

test("Tracktaco v2 search prioritizes exact city before the broader fallback", () => {
  const request = normalizeTrackingNumberRequest({
    carrier: "fedex",
    destination: { country: "US", state: "TX", city: "Austin" },
    shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
  });
  const body = buildTracktacoSearchBody(request);

  assert.equal(body.searches.length, 2);
  assert.deepEqual(body.searches[0]?.filter.dest, {
    country: "US",
    state: "TX",
    city: "Austin",
  });
  assert.deepEqual(body.searches[1]?.filter.dest, {
    country: "US",
    state: "TX",
  });
  assert.deepEqual(body.searches[0]?.filter.status, ["transit"]);
  assert.equal(body.searches[0]?.filter.signature_required, true);
  assert.equal(body.searches[0]?.filter.photo_confirmed, true);
});

test("Tracktaco v2 never creates an unscoped fallback from a city-only address", () => {
  const request = normalizeTrackingNumberRequest({
    carrier: "fedex",
    destination: { city: "Austin" },
    shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
  });

  const body = buildTracktacoSearchBody(request);

  assert.equal(body.searches.length, 1);
  assert.deepEqual(body.searches[0]?.filter.dest, { city: "Austin" });
});

test("Tracktaco v2 candidates are deduplicated without losing query priority", () => {
  assert.deepEqual(
    collectTracktacoCandidates({
      searches: [
        {
          results: [{ tn_id: "tn_exact", carrier: "fedex", service: "ground" }],
        },
        {
          results: [
            { tn_id: "tn_exact", carrier: "fedex", service: "ground" },
            { tn_id: "tn_fallback", carrier: "fedex", service: "smartpost" },
          ],
        },
      ],
    }),
    [
      { tnId: "tn_exact", carrier: "fedex", service: "ground" },
      { tnId: "tn_fallback", carrier: "fedex", service: "smartpost" },
    ],
  );
});

test("Tracktaco v2 reveal parsing exposes the discriminated outcome", () => {
  assert.deepEqual(
    parseTracktacoReveal(
      {
        results: [
          {
            tn_id: "tn_exact",
            outcome: "revealed",
            tracking_number: "871512246087",
            carrier: "fedex",
            service: "ground",
          },
        ],
        credits_remaining: 23,
      },
      "tn_exact",
    ),
    {
      outcome: "revealed",
      trackingNumber: "871512246087",
      carrier: "fedex",
      service: "ground",
      errorCode: "",
      errorMessage: "",
      creditsRemaining: 23,
    },
  );
});
