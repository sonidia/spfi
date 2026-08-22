import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_MOVE_LOCATIONS_QUERY,
  FULFILLMENT_ORDERS_QUERY,
  normalizeFulfillmentStatusFilter,
} from "~~/server/utils/shopify-fulfillment-operations";

describe("Shopify fulfillment operations", () => {
  it("queries the shop-wide cursor connection and Shopify-supported actions", () => {
    expect(FULFILLMENT_ORDERS_QUERY).toContain("fulfillmentOrders(");
    expect(FULFILLMENT_ORDERS_QUERY).toContain("includeClosed: $includeClosed");
    expect(FULFILLMENT_ORDERS_QUERY).toContain("supportedActions { action }");
    expect(FULFILLMENT_ORDERS_QUERY).toContain("heldByRequestingApp");
    expect(FULFILLMENT_ORDERS_QUERY).toContain(
      "trackingInfo(first: 10) { company number url }",
    );
  });

  it("loads move eligibility from the fulfillment order instead of all locations", () => {
    expect(FULFILLMENT_MOVE_LOCATIONS_QUERY).toContain("locationsForMove(");
    expect(FULFILLMENT_MOVE_LOCATIONS_QUERY).toContain("movable");
    expect(FULFILLMENT_MOVE_LOCATIONS_QUERY).not.toContain("locations(first:");
  });

  it("normalizes and rejects status filters before building Shopify search syntax", () => {
    expect(normalizeFulfillmentStatusFilter("on_hold")).toBe("ON_HOLD");
    expect(normalizeFulfillmentStatusFilter(undefined)).toBe("ACTIVE");
    expect(() => normalizeFulfillmentStatusFilter("open OR id:1")).toThrow(
      "Invalid fulfillment order status filter",
    );
  });
});
