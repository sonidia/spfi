import type { H3Event } from "h3";
import type {
  ShopifyMarketCatalogSummary,
  ShopifyMarketConditionApplicationLevel,
  ShopifyMarketConditionResourceSummary,
  ShopifyMarketDiscountSummary,
  ShopifyMarketListFilters,
  ShopifyMarketResolution,
  ShopifyMarketShippingOptionSummary,
  ShopifyMarketsResponse,
  ShopifyMarketStatus,
  ShopifyMarketStatusResponse,
  ShopifyMarketSummary,
  ShopifyMarketType,
  ShopifyMarketWebPresenceSummary,
} from "~~/types/shopify-market";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { requireShopifyGid } from "./shopify-commerce-ops-id";

interface MarketRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface GraphqlCount {
  count: number;
  precision: string;
}

interface GraphqlPageInfo {
  hasNextPage: boolean;
  endCursor?: string | null;
}

interface GraphqlConnection<T> {
  nodes: T[];
  pageInfo: GraphqlPageInfo;
}

interface GraphqlCatalog {
  id: string;
  title: string;
  status: string;
  publication?: { id: string; autoPublish: boolean } | null;
  priceList?: { id: string; name: string; currency: string } | null;
}

interface GraphqlDiscountNode {
  id: string;
  discount: {
    __typename: string;
    title?: string | null;
    status?: string | null;
    codes?: { nodes?: Array<{ code: string }> } | null;
  };
}

interface GraphqlWebPresence {
  id: string;
  subfolderSuffix?: string | null;
  defaultLocale: { locale: string };
  alternateLocales: Array<{ locale: string }>;
  domain?: { id: string; host: string; url: string } | null;
  rootUrls: Array<{ locale: string; url: string }>;
}

interface GraphqlMoney {
  amount: string;
  currencyCode?: string;
}

interface GraphqlWeight {
  value: number;
  unit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";
}

interface GraphqlShippingRate {
  id: string;
  price: GraphqlMoney;
  minValue?: GraphqlMoney | null;
  maxValue?: GraphqlMoney | null;
  minWeight?: GraphqlWeight | null;
  maxWeight?: GraphqlWeight | null;
}

interface GraphqlShippingRateGroup {
  id: string;
  carrierService?: { id: string; name: string } | null;
  percentageAdjustment?: number | null;
  rate?: GraphqlShippingRate | null;
  rates?: GraphqlConnection<GraphqlShippingRate> | null;
}

interface GraphqlShippingOption {
  __typename: string;
  id: string;
  currency: string;
  description?: string | null;
  freeDeliveryMinimumValue?: GraphqlMoney | null;
  isActive: boolean;
  name?: string | null;
  rateGroups?: GraphqlConnection<GraphqlShippingRateGroup> | null;
}

interface GraphqlMarketRegion {
  __typename: "MarketRegionCountry" | "MarketRegionSubdivision" | string;
  id: string;
  name: string;
  code?: string;
  country?: { code?: string } | null;
}

interface GraphqlConditionResource {
  id: string;
  name?: string | null;
  accountName?: string | null;
  specificationHandle?: string | null;
  isActive?: boolean | null;
  company?: { name?: string | null } | null;
}

interface GraphqlResourceCondition {
  applicationLevel?: ShopifyMarketConditionApplicationLevel | null;
  companyLocations?: GraphqlConnection<GraphqlConditionResource>;
  locations?: GraphqlConnection<GraphqlConditionResource>;
  channels?: GraphqlConnection<GraphqlConditionResource>;
}

interface GraphqlMarketNode {
  id: string;
  handle: string;
  name: string;
  status: ShopifyMarketStatus;
  type: ShopifyMarketSummary["type"];
  catalogsCount?: GraphqlCount | null;
  discountsCount?: GraphqlCount | null;
  conditions?: {
    conditionTypes: string[];
    regionsCondition?: {
      applicationLevel?: ShopifyMarketConditionApplicationLevel | null;
      regions: GraphqlConnection<GraphqlMarketRegion>;
    } | null;
    companyLocationsCondition?: GraphqlResourceCondition | null;
    locationsCondition?: GraphqlResourceCondition | null;
    channelsCondition?: GraphqlResourceCondition | null;
  } | null;
  currencySettings?: {
    baseCurrency: {
      currencyCode: string;
      currencyName: string;
      enabled: boolean;
      manualRate?: string | null;
      rateUpdatedAt?: string | null;
    };
    localCurrencies: boolean;
    roundingEnabled: boolean;
  } | null;
  priceInclusions?: {
    adaptivePricingEnabled: boolean;
    inclusiveDutiesPricingStrategy: string;
    inclusiveTaxPricingStrategy: string;
  } | null;
  catalogs: GraphqlConnection<GraphqlCatalog>;
  discounts: GraphqlConnection<GraphqlDiscountNode>;
  webPresences: GraphqlConnection<GraphqlWebPresence>;
  delivery: {
    shipping?: {
      isEnabled: boolean;
      optionDefinitionsCount: GraphqlCount;
      optionDefinitions: GraphqlConnection<GraphqlShippingOption>;
    } | null;
  };
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

export const MARKET_QUERY_PAGE_SIZES = Object.freeze({
  markets: 50,
  regions: 25,
  conditions: 25,
  catalogs: 25,
  discounts: 25,
  webPresences: 25,
  shippingOptions: 25,
});

const MARKET_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.markets;
const MAX_MARKETS = 250;
const MAX_MARKET_CONNECTION_ITEMS = 250;
const MARKET_DETAIL_CONCURRENCY = 4;

const CATALOG_FIELDS = `
  id title status publication { id autoPublish }
  priceList { id name currency }
`;

const WEB_PRESENCE_FIELDS = `
  id subfolderSuffix defaultLocale { locale }
  alternateLocales { locale }
  domain { id host url }
  rootUrls { locale url }
`;

const DISCOUNT_FIELDS = `
  id
  discount {
    __typename
    ... on DiscountCodeBasic { title status codes(first: 1) { nodes { code } } }
    ... on DiscountAutomaticBasic { title status }
    ... on DiscountCodeBxgy { title status codes(first: 1) { nodes { code } } }
    ... on DiscountAutomaticBxgy { title status }
    ... on DiscountCodeFreeShipping { title status codes(first: 1) { nodes { code } } }
    ... on DiscountAutomaticFreeShipping { title status }
    ... on DiscountCodeApp { title status codes(first: 1) { nodes { code } } }
    ... on DiscountAutomaticApp { title status }
  }
`;

const SHIPPING_OPTION_FIELDS = `
  __typename id currency description
  freeDeliveryMinimumValue { amount currencyCode }
  isActive
  ... on DeliveryFlatRateOptionDefinition {
    name
    rateGroups(first: 1) {
      nodes { id rate { id price { amount currencyCode } } }
      pageInfo { hasNextPage endCursor }
    }
  }
  ... on DeliveryValueBasedOptionDefinition {
    name
    rateGroups(first: 1) {
      nodes {
        id
        rates(first: 10) {
          nodes {
            id minValue { amount currencyCode } maxValue { amount currencyCode }
            price { amount currencyCode }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  ... on DeliveryWeightBasedOptionDefinition {
    name
    rateGroups(first: 1) {
      nodes {
        id
        rates(first: 10) {
          nodes {
            id minWeight { value unit } maxWeight { value unit }
            price { amount currencyCode }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  ... on DeliveryCarrierCalculatedOptionDefinition {
    rateGroups(first: 1) {
      nodes { id carrierService { id name } percentageAdjustment }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const MARKET_LIST_QUERY = `#graphql
  query StoreMarketIds($first: Int!, $after: String, $query: String, $type: MarketType) {
    markets(first: $first, after: $after, query: $query, type: $type, sortKey: NAME) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const MARKET_DETAILS_QUERY = `#graphql
  query StoreMarketDetails(
    $id: ID!
    $regionFirst: Int!
    $conditionFirst: Int!
    $catalogFirst: Int!
    $discountFirst: Int!
    $webPresenceFirst: Int!
    $shippingOptionFirst: Int!
  ) {
    market(id: $id) {
      id handle name status type
      catalogsCount { count precision }
      discountsCount { count precision }
      conditions {
        conditionTypes
        regionsCondition {
          applicationLevel
          regions(first: $regionFirst) {
            nodes {
              __typename id name
              ... on MarketRegionCountry { code }
              ... on MarketRegionSubdivision { code country { code } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        companyLocationsCondition {
          applicationLevel
          companyLocations(first: $conditionFirst) {
            nodes { id name company { name } }
            pageInfo { hasNextPage endCursor }
          }
        }
        locationsCondition {
          applicationLevel
          locations(first: $conditionFirst) {
            nodes { id name isActive }
            pageInfo { hasNextPage endCursor }
          }
        }
        channelsCondition {
          applicationLevel
          channels(first: $conditionFirst) {
            nodes { id accountName specificationHandle }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
      currencySettings {
        baseCurrency { currencyCode currencyName enabled manualRate rateUpdatedAt }
        localCurrencies roundingEnabled
      }
      priceInclusions {
        adaptivePricingEnabled inclusiveDutiesPricingStrategy inclusiveTaxPricingStrategy
      }
      catalogs(first: $catalogFirst) {
        nodes { ${CATALOG_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
      discounts(first: $discountFirst) {
        nodes { ${DISCOUNT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
      webPresences(first: $webPresenceFirst) {
        nodes { ${WEB_PRESENCE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
      delivery {
        shipping {
          isEnabled
          optionDefinitionsCount { count precision }
          optionDefinitions(first: $shippingOptionFirst) {
            nodes { ${SHIPPING_OPTION_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

export const MARKET_REGIONS_PAGE_QUERY = `#graphql
  query StoreMarketRegionPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      conditions {
        regionsCondition {
          regions(first: $first, after: $after) {
            nodes {
              __typename id name
              ... on MarketRegionCountry { code }
              ... on MarketRegionSubdivision { code country { code } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

const MARKET_COMPANY_LOCATIONS_PAGE_QUERY = `#graphql
  query StoreMarketCompanyLocationPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      conditions {
        companyLocationsCondition {
          companyLocations(first: $first, after: $after) {
            nodes { id name company { name } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

const MARKET_LOCATIONS_PAGE_QUERY = `#graphql
  query StoreMarketLocationPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      conditions {
        locationsCondition {
          locations(first: $first, after: $after) {
            nodes { id name isActive }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

const MARKET_CHANNELS_PAGE_QUERY = `#graphql
  query StoreMarketChannelPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      conditions {
        channelsCondition {
          channels(first: $first, after: $after) {
            nodes { id accountName specificationHandle }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

const MARKET_CATALOGS_PAGE_QUERY = `#graphql
  query StoreMarketCatalogPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      catalogs(first: $first, after: $after) {
        nodes { ${CATALOG_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const MARKET_DISCOUNTS_PAGE_QUERY = `#graphql
  query StoreMarketDiscountPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      discounts(first: $first, after: $after) {
        nodes { ${DISCOUNT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const MARKET_WEB_PRESENCES_PAGE_QUERY = `#graphql
  query StoreMarketWebPresencePage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      webPresences(first: $first, after: $after) {
        nodes { ${WEB_PRESENCE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const MARKET_SHIPPING_OPTIONS_PAGE_QUERY = `#graphql
  query StoreMarketShippingOptionPage($id: ID!, $first: Int!, $after: String) {
    market(id: $id) {
      delivery {
        shipping {
          optionDefinitions(first: $first, after: $after) {
            nodes { ${SHIPPING_OPTION_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  }
`;

export async function fetchShopifyMarkets(
  context: MarketRequestContext,
  rawFilters?: unknown,
): Promise<ShopifyMarketsResponse> {
  const filters = normalizeMarketListFilters(rawFilters);
  const marketIds: string[] = [];
  let after: string | null = null;
  let hasMoreMarkets: boolean;

  do {
    const data: {
      markets: GraphqlConnection<{ id: string }>;
    } = await callShopifyGraphql({
      ...context,
      operationName: "StoreMarketIds",
      query: MARKET_LIST_QUERY,
      variables: {
        first: Math.min(MARKET_PAGE_SIZE, MAX_MARKETS - marketIds.length),
        after,
        query: buildMarketSearchQuery(filters),
        type: filters.type || null,
      },
    });
    marketIds.push(...data.markets.nodes.map((market) => market.id));
    hasMoreMarkets = data.markets.pageInfo.hasNextPage;
    after = data.markets.pageInfo.endCursor || null;
  } while (hasMoreMarkets && after && marketIds.length < MAX_MARKETS);

  const items = await mapWithConcurrency(
    marketIds,
    MARKET_DETAIL_CONCURRENCY,
    async (id) => {
      const market = await fetchShopifyMarket(context, id);
      if (!market) {
        throw createApiErrorFromMessage(
          `Shopify returned no details for market ${id}. Refresh and try again.`,
          502,
        );
      }
      return market;
    },
  );

  return {
    items,
    fetchedAt: new Date().toISOString(),
    truncated: hasMoreMarkets,
  };
}

export async function fetchShopifyMarket(
  context: MarketRequestContext,
  marketId: string,
): Promise<ShopifyMarketSummary | null> {
  const data = await callShopifyGraphql<{ market: GraphqlMarketNode | null }>({
    ...context,
    operationName: "StoreMarketDetails",
    query: MARKET_DETAILS_QUERY,
    variables: {
      id: requireShopifyGid(marketId, "Market"),
      regionFirst: MARKET_QUERY_PAGE_SIZES.regions,
      conditionFirst: MARKET_QUERY_PAGE_SIZES.conditions,
      catalogFirst: MARKET_QUERY_PAGE_SIZES.catalogs,
      discountFirst: MARKET_QUERY_PAGE_SIZES.discounts,
      webPresenceFirst: MARKET_QUERY_PAGE_SIZES.webPresences,
      shippingOptionFirst: MARKET_QUERY_PAGE_SIZES.shippingOptions,
    },
  });
  if (!data.market) return null;
  await loadRemainingMarketConnections(context, data.market);
  return normalizeMarket(data.market);
}

async function loadRemainingMarketConnections(
  context: MarketRequestContext,
  market: GraphqlMarketNode,
) {
  const tasks: Array<Promise<void>> = [];
  const regions = market.conditions?.regionsCondition?.regions;
  if (regions?.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, regions, {
        operationName: "StoreMarketRegionPage",
        query: MARKET_REGIONS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.regions,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.conditions
            ?.regionsCondition?.regions,
      }),
    );
  }

  const companyLocations =
    market.conditions?.companyLocationsCondition?.companyLocations;
  if (companyLocations?.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, companyLocations, {
        operationName: "StoreMarketCompanyLocationPage",
        query: MARKET_COMPANY_LOCATIONS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.conditions,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.conditions
            ?.companyLocationsCondition?.companyLocations,
      }),
    );
  }

  const locations = market.conditions?.locationsCondition?.locations;
  if (locations?.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, locations, {
        operationName: "StoreMarketLocationPage",
        query: MARKET_LOCATIONS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.conditions,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.conditions
            ?.locationsCondition?.locations,
      }),
    );
  }

  const channels = market.conditions?.channelsCondition?.channels;
  if (channels?.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, channels, {
        operationName: "StoreMarketChannelPage",
        query: MARKET_CHANNELS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.conditions,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.conditions
            ?.channelsCondition?.channels,
      }),
    );
  }

  if (market.catalogs.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, market.catalogs, {
        operationName: "StoreMarketCatalogPage",
        query: MARKET_CATALOGS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.catalogs,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.catalogs,
      }),
    );
  }
  if (market.discounts.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, market.discounts, {
        operationName: "StoreMarketDiscountPage",
        query: MARKET_DISCOUNTS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.discounts,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.discounts,
      }),
    );
  }
  if (market.webPresences.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, market.webPresences, {
        operationName: "StoreMarketWebPresencePage",
        query: MARKET_WEB_PRESENCES_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.webPresences,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.webPresences,
      }),
    );
  }

  const shippingOptions = market.delivery.shipping?.optionDefinitions;
  if (shippingOptions?.pageInfo.hasNextPage) {
    tasks.push(
      loadConnectionPages(context, market.id, shippingOptions, {
        operationName: "StoreMarketShippingOptionPage",
        query: MARKET_SHIPPING_OPTIONS_PAGE_QUERY,
        pageSize: MARKET_QUERY_PAGE_SIZES.shippingOptions,
        select: (data) =>
          (data as { market?: GraphqlMarketNode | null }).market?.delivery.shipping
            ?.optionDefinitions,
      }),
    );
  }

  await Promise.all(tasks);
}

async function loadConnectionPages<T>(
  context: MarketRequestContext,
  marketId: string,
  connection: GraphqlConnection<T>,
  options: {
    operationName: string;
    query: string;
    pageSize: number;
    select: (data: unknown) => GraphqlConnection<T> | null | undefined;
  },
) {
  let after = connection.pageInfo.endCursor || null;
  while (
    connection.pageInfo.hasNextPage &&
    after &&
    connection.nodes.length < MAX_MARKET_CONNECTION_ITEMS
  ) {
    const data = await callShopifyGraphql<unknown>({
      ...context,
      operationName: options.operationName,
      query: options.query,
      variables: {
        id: marketId,
        first: Math.min(
          options.pageSize,
          MAX_MARKET_CONNECTION_ITEMS - connection.nodes.length,
        ),
        after,
      },
    });
    const page = options.select(data);
    if (!page) break;
    connection.nodes.push(...page.nodes);
    connection.pageInfo = page.pageInfo;
    after = page.pageInfo.endCursor || null;
  }
}

export async function resolveShopifyMarket(
  context: MarketRequestContext,
  countryValue: unknown,
): Promise<ShopifyMarketResolution> {
  const countryCode = normalizeCountryCode(countryValue);
  const data = await callShopifyGraphql<{
    marketsResolvedValues: {
      currencyCode: string;
      priceInclusivity: { taxesIncluded: boolean; dutiesIncluded: boolean };
      catalogs: GraphqlConnection<GraphqlCatalog>;
      webPresences: GraphqlConnection<GraphqlWebPresence>;
    };
  }>({
    ...context,
    operationName: "ResolveStoreMarket",
    query: `#graphql
      query ResolveStoreMarket($countryCode: CountryCode!, $catalogFirst: Int!, $webPresenceFirst: Int!) {
        marketsResolvedValues(buyerSignal: { countryCode: $countryCode }) {
          currencyCode
          priceInclusivity { taxesIncluded dutiesIncluded }
          catalogs(first: $catalogFirst) {
            nodes { ${CATALOG_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
          webPresences(first: $webPresenceFirst) {
            nodes { ${WEB_PRESENCE_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `,
    variables: {
      countryCode,
      catalogFirst: MARKET_QUERY_PAGE_SIZES.catalogs,
      webPresenceFirst: MARKET_QUERY_PAGE_SIZES.webPresences,
    },
  });
  const resolved = data.marketsResolvedValues;

  return {
    countryCode,
    currencyCode: resolved.currencyCode,
    taxesIncluded: resolved.priceInclusivity.taxesIncluded,
    dutiesIncluded: resolved.priceInclusivity.dutiesIncluded,
    catalogs: resolved.catalogs.nodes.map(normalizeMarketCatalog),
    catalogsTruncated: resolved.catalogs.pageInfo.hasNextPage,
    webPresences: resolved.webPresences.nodes.map(normalizeMarketWebPresence),
    webPresencesTruncated: resolved.webPresences.pageInfo.hasNextPage,
  };
}

export async function updateShopifyMarketStatus(
  context: MarketRequestContext,
  marketIdValue: unknown,
  statusValue: unknown,
): Promise<ShopifyMarketStatusResponse> {
  const id = requireShopifyGid(marketIdValue, "Market");
  const status = normalizeMarketStatus(statusValue);
  const data = await callShopifyGraphql<{
    marketUpdate: {
      market?: { id: string; status: ShopifyMarketStatus } | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "UpdateStoreMarketStatus",
    retryTransport: false,
    query: `#graphql
      mutation UpdateStoreMarketStatus($id: ID!, $input: MarketUpdateInput!) {
        marketUpdate(id: $id, input: $input) {
          market { id status }
          userErrors { field message code }
        }
      }
    `,
    variables: { id, input: { status } },
  });
  assertNoGraphqlUserErrors(
    data.marketUpdate.userErrors,
    "Failed to update the market status.",
  );
  if (!data.marketUpdate.market) {
    throw createApiErrorFromMessage("Shopify did not return the updated market.", 502);
  }
  return data.marketUpdate.market;
}

function normalizeMarket(node: GraphqlMarketNode): ShopifyMarketSummary {
  const regionCondition = node.conditions?.regionsCondition;
  const shipping = node.delivery.shipping;

  return {
    id: node.id,
    handle: node.handle,
    name: node.name,
    status: node.status,
    type: node.type,
    conditionTypes: node.conditions?.conditionTypes || [],
    conditionApplicationLevel: regionCondition?.applicationLevel || null,
    conditions: {
      regions: regionCondition
        ? {
            applicationLevel: regionCondition.applicationLevel || null,
            truncated: regionCondition.regions.pageInfo.hasNextPage,
          }
        : null,
      companyLocations: normalizeResourceCondition(
        node.conditions?.companyLocationsCondition,
        "companyLocations",
      ),
      locations: normalizeResourceCondition(
        node.conditions?.locationsCondition,
        "locations",
      ),
      channels: normalizeResourceCondition(
        node.conditions?.channelsCondition,
        "channels",
      ),
    },
    regions: (regionCondition?.regions.nodes || []).map((region) => ({
      id: region.id,
      name: region.name,
      code: String(region.code || ""),
      kind: region.__typename === "MarketRegionSubdivision" ? "subdivision" : "country",
      countryCode:
        region.__typename === "MarketRegionSubdivision"
          ? String(region.country?.code || "") || null
          : String(region.code || "") || null,
    })),
    regionsTruncated: Boolean(regionCondition?.regions.pageInfo.hasNextPage),
    currencySettings: node.currencySettings
      ? {
          baseCurrencyCode: node.currencySettings.baseCurrency.currencyCode,
          baseCurrencyName: node.currencySettings.baseCurrency.currencyName,
          baseCurrencyEnabled: node.currencySettings.baseCurrency.enabled,
          manualRate: node.currencySettings.baseCurrency.manualRate || null,
          rateUpdatedAt: node.currencySettings.baseCurrency.rateUpdatedAt || null,
          localCurrencies: node.currencySettings.localCurrencies,
          roundingEnabled: node.currencySettings.roundingEnabled,
        }
      : null,
    priceInclusions: node.priceInclusions
      ? {
          adaptivePricingEnabled: node.priceInclusions.adaptivePricingEnabled,
          dutiesStrategy: node.priceInclusions.inclusiveDutiesPricingStrategy,
          taxesStrategy: node.priceInclusions.inclusiveTaxPricingStrategy,
        }
      : null,
    catalogCount: normalizeCount(node.catalogsCount),
    catalogs: node.catalogs.nodes.map(normalizeMarketCatalog),
    catalogsTruncated: node.catalogs.pageInfo.hasNextPage,
    discountCount: normalizeCount(node.discountsCount),
    discounts: node.discounts.nodes.map(normalizeMarketDiscount),
    discountsTruncated: node.discounts.pageInfo.hasNextPage,
    webPresences: node.webPresences.nodes.map(normalizeMarketWebPresence),
    webPresencesTruncated: node.webPresences.pageInfo.hasNextPage,
    shipping: {
      inherits: !shipping,
      enabled: shipping?.isEnabled ?? null,
      optionCount: normalizeCount(shipping?.optionDefinitionsCount),
      options: (shipping?.optionDefinitions.nodes || []).map(normalizeShippingOption),
      optionsTruncated: Boolean(shipping?.optionDefinitions.pageInfo.hasNextPage),
    },
  };
}

function normalizeResourceCondition(
  condition: GraphqlResourceCondition | null | undefined,
  key: "companyLocations" | "locations" | "channels",
) {
  if (!condition) return null;
  const connection = condition[key] || { nodes: [], pageInfo: { hasNextPage: false } };
  return {
    applicationLevel: condition.applicationLevel || null,
    items: connection.nodes.map(normalizeConditionResource),
    truncated: connection.pageInfo.hasNextPage,
  };
}

export function normalizeConditionResource(
  node: GraphqlConditionResource,
): ShopifyMarketConditionResourceSummary {
  const name =
    node.name || node.accountName || node.specificationHandle || "Shopify resource";
  const description = node.company?.name || node.specificationHandle || null;
  return {
    id: node.id,
    name,
    description: description === name ? null : description,
    active: typeof node.isActive === "boolean" ? node.isActive : null,
  };
}

export function normalizeMarketCatalog(
  node: GraphqlCatalog,
): ShopifyMarketCatalogSummary {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    publication: node.publication
      ? { id: node.publication.id, autoPublish: node.publication.autoPublish }
      : null,
    priceList: node.priceList
      ? {
          id: node.priceList.id,
          name: node.priceList.name,
          currency: node.priceList.currency,
        }
      : null,
  };
}

export function normalizeMarketDiscount(
  node: GraphqlDiscountNode,
): ShopifyMarketDiscountSummary {
  return {
    id: node.id,
    type: node.discount.__typename || "Discount",
    title: String(node.discount.title || "Untitled discount"),
    code: node.discount.codes?.nodes?.[0]?.code || null,
    status: String(node.discount.status || "UNKNOWN"),
  };
}

export function normalizeMarketWebPresence(
  node: GraphqlWebPresence,
): ShopifyMarketWebPresenceSummary {
  return {
    id: node.id,
    subfolderSuffix: node.subfolderSuffix || null,
    defaultLocale: node.defaultLocale.locale,
    alternateLocales: node.alternateLocales.map((locale) => locale.locale),
    domain: node.domain
      ? { id: node.domain.id, host: node.domain.host, url: node.domain.url }
      : null,
    rootUrls: node.rootUrls.map((item) => ({ locale: item.locale, url: item.url })),
  };
}

function normalizeShippingOption(
  node: GraphqlShippingOption,
): ShopifyMarketShippingOptionSummary {
  const type = (
    {
      DeliveryCarrierCalculatedOptionDefinition: "CARRIER_CALCULATED",
      DeliveryFlatRateOptionDefinition: "FLAT_RATE",
      DeliveryValueBasedOptionDefinition: "VALUE_BASED",
      DeliveryWeightBasedOptionDefinition: "WEIGHT_BASED",
    } as const
  )[node.__typename];
  const groups = node.rateGroups;
  const group = groups?.nodes[0];
  const carrierService = group?.carrierService;
  const rawRates = group?.rate ? [group.rate] : group?.rates?.nodes || [];

  return {
    id: node.id,
    type: type || "FLAT_RATE",
    name: node.name || carrierService?.name || null,
    description: node.description || null,
    currency: node.currency,
    active: node.isActive,
    freeDeliveryMinimumValue: node.freeDeliveryMinimumValue?.amount || null,
    carrierService: carrierService
      ? { id: carrierService.id, name: carrierService.name }
      : null,
    rateGroupId: group?.id || null,
    rates: rawRates.map((rate) => ({
      id: rate.id,
      price: rate.price.amount,
      minimum: rate.minValue?.amount || formatWeight(rate.minWeight),
      maximum: rate.maxValue?.amount || formatWeight(rate.maxWeight),
      weightUnit: rate.minWeight?.unit || rate.maxWeight?.unit || null,
    })),
    ratesTruncated: Boolean(
      groups?.pageInfo.hasNextPage || group?.rates?.pageInfo.hasNextPage,
    ),
    percentageAdjustment: group?.percentageAdjustment ?? null,
  };
}

function formatWeight(weight?: GraphqlWeight | null) {
  return weight ? String(weight.value) : null;
}

function normalizeCount(value?: GraphqlCount | null) {
  if (!value) return null;
  return {
    count: Number(value.count || 0),
    precision: String(value.precision || "EXACT"),
  };
}

function normalizeMarketListFilters(value: unknown): ShopifyMarketListFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const search = String(input.search || "")
    .trim()
    .slice(0, 100);
  const status = String(input.status || "").toUpperCase();
  const type = String(input.type || "").toUpperCase();
  const validTypes = new Set<ShopifyMarketType>([
    "CHANNEL",
    "COMPANY_LOCATION",
    "LOCATION",
    "NONE",
    "REGION",
  ]);
  const conditionTypes = Array.isArray(input.conditionTypes)
    ? (Array.from(
        new Set(
          input.conditionTypes
            .map((item) => String(item || "").toUpperCase())
            .filter(
              (item) => validTypes.has(item as ShopifyMarketType) && item !== "NONE",
            ),
        ),
      ) as ShopifyMarketListFilters["conditionTypes"])
    : undefined;
  return {
    ...(search ? { search } : {}),
    ...(status === "ACTIVE" || status === "DRAFT"
      ? { status: status as ShopifyMarketStatus }
      : {}),
    ...(validTypes.has(type as ShopifyMarketType)
      ? { type: type as ShopifyMarketType }
      : {}),
    ...(conditionTypes?.length ? { conditionTypes } : {}),
  };
}

function buildMarketSearchQuery(filters: ShopifyMarketListFilters) {
  const parts: string[] = [];
  if (filters.search) parts.push(`name:${quoteSearchValue(filters.search)}`);
  if (filters.status) parts.push(`status:${filters.status}`);
  if (filters.type) parts.push(`market_type:${filters.type}`);
  if (filters.conditionTypes?.length) {
    parts.push(`market_condition_types:${filters.conditionTypes.join(",")}`);
  }
  return parts.join(" AND ") || null;
}

function quoteSearchValue(value: string) {
  return `"${value.replace(/[\\"]/g, (character) => `\\${character}`)}"`;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index] as T, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function normalizeCountryCode(value: unknown) {
  const countryCode = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw createApiErrorFromMessage(
      "Country code must be a two-letter ISO 3166-1 code.",
      400,
    );
  }
  return countryCode;
}

function normalizeMarketStatus(value: unknown): ShopifyMarketStatus {
  const status = String(value || "")
    .trim()
    .toUpperCase();
  if (status !== "ACTIVE" && status !== "DRAFT") {
    throw createApiErrorFromMessage("Market status must be ACTIVE or DRAFT.", 400);
  }
  return status;
}
