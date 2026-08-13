import { describe, expect, it } from "vitest";
import {
  buildShippingOptionCreateInput,
  buildShippingOptionStatusUpdate,
  buildShippingOptionUpdateInput,
  CREATE_MANAGED_MARKET_MUTATION,
  MARKET_EDITOR_CONTEXT_PAGE_SIZE,
  normalizeWebPresenceInput,
  UPDATE_MANAGED_MARKET_MUTATION,
} from "~~/server/utils/shopify-market-management";
import {
  MARKET_DETAILS_QUERY,
  MARKET_LIST_QUERY,
  MARKET_QUERY_PAGE_SIZES,
  MARKET_REGIONS_PAGE_QUERY,
} from "~~/server/utils/shopify-markets";
import {
  normalizeMarketRegions,
  normalizeShippingOption,
} from "~~/server/utils/shopify-market-validation";

describe("Shopify Markets input validation", () => {
  it("keeps list, detail, context, and mutation refresh queries cost-bounded", () => {
    expect(MARKET_LIST_QUERY).toContain("nodes { id }");
    expect(MARKET_LIST_QUERY).toContain("query: $query");
    expect(MARKET_LIST_QUERY).toContain("type: $type");
    expect(MARKET_LIST_QUERY).toContain("sortKey: NAME");
    expect(MARKET_LIST_QUERY).not.toMatch(
      /regions\(|catalogs\(|webPresences\(|optionDefinitions\(/,
    );
    expect(MARKET_DETAILS_QUERY).toContain("market(id: $id)");
    expect(MARKET_DETAILS_QUERY).toContain("discountsCount");
    expect(MARKET_DETAILS_QUERY).toContain("discounts(first: $discountFirst)");
    expect(MARKET_DETAILS_QUERY).toContain("companyLocationsCondition");
    expect(MARKET_DETAILS_QUERY).toContain("locationsCondition");
    expect(MARKET_DETAILS_QUERY).toContain("channelsCondition");
    expect(MARKET_DETAILS_QUERY).not.toContain("first: 250");
    expect(MARKET_DETAILS_QUERY).not.toContain("rates(first: 50)");
    expect(MARKET_DETAILS_QUERY).not.toContain("rateGroups(first: 10)");
    expect(MARKET_REGIONS_PAGE_QUERY).toContain("after: $after");
    expect(MARKET_REGIONS_PAGE_QUERY).not.toContain("first: 250");
    expect(Math.max(...Object.values(MARKET_QUERY_PAGE_SIZES))).toBeLessThanOrEqual(50);
    expect(MARKET_EDITOR_CONTEXT_PAGE_SIZE).toBeLessThanOrEqual(25);

    for (const mutation of [
      CREATE_MANAGED_MARKET_MUTATION,
      UPDATE_MANAGED_MARKET_MUTATION,
    ]) {
      expect(mutation).toMatch(/market \{ id \}/);
      expect(mutation).not.toMatch(
        /regions\(|catalogs\(|webPresences\(|optionDefinitions\(/,
      );
    }
  });

  it("normalizes country and subdivision conditions without using deprecated region mutations", () => {
    expect(
      normalizeMarketRegions([
        { countryCode: "us", subdivision: "ca" },
        { countryCode: "CA" },
      ]),
    ).toEqual([{ countryCode: "US", subdivision: "CA" }, { countryCode: "CA" }]);

    expect(() =>
      normalizeMarketRegions([
        { countryCode: "US", subdivision: "CA" },
        { countryCode: "us", subdivision: "ca" },
      ]),
    ).toThrow(/Duplicate region/);
  });

  it("builds the four mutually-exclusive 2026-07 shipping option inputs", () => {
    expect(
      buildShippingOptionCreateInput(
        normalizeShippingOption({
          type: "FLAT_RATE",
          name: "Standard",
          currency: "usd",
          price: "5.00",
          active: true,
        }),
      ),
    ).toMatchObject({
      flatRate: {
        name: "Standard",
        currency: "USD",
        rateGroups: [{ rate: { price: { amount: "5.00", currencyCode: "USD" } } }],
      },
    });

    expect(
      buildShippingOptionCreateInput(
        normalizeShippingOption({
          type: "VALUE_BASED",
          name: "Order value",
          currency: "USD",
          minimum: "0",
          maximum: "50",
          price: "8",
        }),
      ),
    ).toMatchObject({
      valueBased: {
        rateGroups: [
          {
            conditions: {},
            rates: [{ minValue: { amount: "0", currencyCode: "USD" } }],
          },
        ],
      },
    });

    expect(
      buildShippingOptionCreateInput(
        normalizeShippingOption({
          type: "WEIGHT_BASED",
          name: "Heavy",
          currency: "USD",
          minimum: "1",
          price: "12",
          weightUnit: "KILOGRAMS",
        }),
      ),
    ).toMatchObject({
      weightBased: {
        rateGroups: [
          {
            conditions: {},
            rates: [{ minWeight: { value: 1, unit: "KILOGRAMS" } }],
          },
        ],
      },
    });

    expect(
      buildShippingOptionCreateInput(
        normalizeShippingOption({
          type: "CARRIER_CALCULATED",
          currency: "USD",
          carrierServiceId: "gid://shopify/DeliveryCarrierService/1",
          percentageAdjustment: 10,
        }),
      ),
    ).toMatchObject({
      carrierCalculated: {
        rateGroups: [
          {
            carrierServiceId: "gid://shopify/DeliveryCarrierService/1",
            autoIncludeNewServices: true,
            percentageAdjustment: 10,
          },
        ],
      },
    });
  });

  it("enforces carrier integer adjustments and tier bounds", () => {
    expect(() =>
      normalizeShippingOption({
        type: "CARRIER_CALCULATED",
        currency: "USD",
        carrierServiceId: "gid://shopify/DeliveryCarrierService/1",
        percentageAdjustment: 1.5,
      }),
    ).toThrow(/integer/);

    expect(() =>
      normalizeShippingOption({
        type: "VALUE_BASED",
        name: "Bad",
        currency: "USD",
        minimum: "10",
        maximum: "5",
        price: "1",
      }),
    ).toThrow(/greater than or equal/);
  });

  it("wraps shipping status changes in exactly one concrete update type", () => {
    expect(
      buildShippingOptionStatusUpdate({
        id: "gid://shopify/DeliveryFlatRateOptionDefinition/1",
        type: "FLAT_RATE",
        active: false,
      }),
    ).toEqual({
      flatRate: {
        id: "gid://shopify/DeliveryFlatRateOptionDefinition/1",
        isActive: false,
      },
    });

    expect(() =>
      buildShippingOptionStatusUpdate({
        id: "gid://shopify/DeliveryValueBasedOptionDefinition/1",
        type: "FLAT_RATE",
        active: true,
      }),
    ).toThrow(/does not match/);
  });

  it("updates shipping metadata, tier rates, and carrier adjustments", () => {
    expect(
      buildShippingOptionUpdateInput({
        id: "gid://shopify/DeliveryValueBasedOptionDefinition/1",
        type: "VALUE_BASED",
        active: true,
        name: "Order value",
        description: "Tracked delivery",
        currency: "usd",
        freeDeliveryMinimumValue: "100",
        rateGroupId: "gid://shopify/DeliveryValueBasedRateGroup/1",
        rates: [
          {
            id: "gid://shopify/DeliveryValueBasedRate/1",
            minimum: "0",
            maximum: "50",
            price: "8",
          },
        ],
      }),
    ).toMatchObject({
      valueBased: {
        name: "Order value",
        currency: "USD",
        freeDeliveryMinimumValue: { amount: "100", currencyCode: "USD" },
        rateGroupsToUpdate: [
          {
            id: "gid://shopify/DeliveryValueBasedRateGroup/1",
            ratesToUpdate: [
              {
                id: "gid://shopify/DeliveryValueBasedRate/1",
                minValue: { amount: "0", currencyCode: "USD" },
                maxValue: { amount: "50", currencyCode: "USD" },
                price: { amount: "8", currencyCode: "USD" },
              },
            ],
          },
        ],
      },
    });

    expect(
      buildShippingOptionUpdateInput({
        id: "gid://shopify/DeliveryCarrierCalculatedOptionDefinition/1",
        type: "CARRIER_CALCULATED",
        active: true,
        currency: "USD",
        rateGroupId: "gid://shopify/DeliveryCarrierCalculatedRateGroup/1",
        carrierServiceId: "gid://shopify/DeliveryCarrierService/1",
        percentageAdjustment: 15,
      }),
    ).toMatchObject({
      carrierCalculated: {
        rateGroupToUpdate: {
          carrierServiceId: "gid://shopify/DeliveryCarrierService/1",
          percentageAdjustment: 15,
        },
      },
    });

    expect(() =>
      buildShippingOptionUpdateInput({
        id: "gid://shopify/DeliveryValueBasedOptionDefinition/1",
        type: "VALUE_BASED",
        active: true,
        name: "Invalid tier",
        currency: "USD",
        rateGroupId: "gid://shopify/DeliveryValueBasedRateGroup/1",
        rates: [
          {
            id: "gid://shopify/DeliveryValueBasedRate/1",
            minimum: "50",
            maximum: "10",
            price: "8",
          },
        ],
      }),
    ).toThrow(/greater than or equal/);
  });

  it("keeps create and update web-presence schemas separate", () => {
    expect(
      normalizeWebPresenceInput(
        {
          defaultLocale: "en",
          alternateLocales: ["fr"],
          domainId: "gid://shopify/Domain/1",
        },
        true,
      ),
    ).toEqual({
      defaultLocale: "en",
      alternateLocales: ["fr"],
      domainId: "gid://shopify/Domain/1",
    });

    expect(
      normalizeWebPresenceInput(
        {
          defaultLocale: "en",
          alternateLocales: ["fr"],
          domainId: "gid://shopify/Domain/1",
        },
        false,
      ),
    ).toEqual({ defaultLocale: "en", alternateLocales: ["fr"] });
  });
});
