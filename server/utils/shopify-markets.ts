import type { H3Event } from "h3";
import type {
  ShopifyMarketCatalogSummary,
  ShopifyMarketResolution,
  ShopifyMarketsResponse,
  ShopifyMarketStatus,
  ShopifyMarketStatusResponse,
  ShopifyMarketSummary,
  ShopifyMarketWebPresenceSummary,
  ShopifyMarketShippingOptionSummary,
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

interface GraphqlCatalog {
  id: string;
  title: string;
  status: string;
  publication?: { id: string; autoPublish: boolean } | null;
  priceList?: {
    id: string;
    name: string;
    currency: string;
  } | null;
}

interface GraphqlWebPresence {
  id: string;
  subfolderSuffix?: string | null;
  defaultLocale: { locale: string };
  alternateLocales: Array<{ locale: string }>;
  domain?: { id: string; host: string; url: string } | null;
  rootUrls: Array<{ locale: string; url: string }>;
}

interface GraphqlShippingOption {
  __typename: string;
  id: string;
  currency: string;
  description?: string | null;
  freeDeliveryMinimumValue?: { amount: string } | null;
  isActive: boolean;
  name?: string | null;
  rateGroups?: {
    nodes: Array<{
      carrierService?: { id: string; name: string } | null;
    }>;
  } | null;
}

interface GraphqlMarketRegion {
  __typename: "MarketRegionCountry" | "MarketRegionSubdivision" | string;
  id: string;
  name: string;
  code?: string;
  country?: { code?: string } | null;
}

interface GraphqlMarketRegionConnection {
  nodes: GraphqlMarketRegion[];
  pageInfo: GraphqlPageInfo;
}

interface GraphqlMarketNode {
  id: string;
  handle: string;
  name: string;
  status: ShopifyMarketStatus;
  type: ShopifyMarketSummary["type"];
  catalogsCount?: GraphqlCount | null;
  conditions?: {
    conditionTypes: string[];
    regionsCondition?: {
      applicationLevel?: string | null;
      regions: GraphqlMarketRegionConnection;
    } | null;
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
  catalogs: {
    nodes: GraphqlCatalog[];
    pageInfo: { hasNextPage: boolean };
  };
  webPresences: {
    nodes: GraphqlWebPresence[];
    pageInfo: { hasNextPage: boolean };
  };
  delivery: {
    shipping?: {
      isEnabled: boolean;
      optionDefinitionsCount: GraphqlCount;
      optionDefinitions: {
        nodes: GraphqlShippingOption[];
        pageInfo: { hasNextPage: boolean };
      };
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
  catalogs: 10,
  webPresences: 10,
  shippingOptions: 10,
});

const MARKET_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.markets;
const MAX_MARKETS = 250;
const MAX_MARKET_REGIONS = 250;
const REGION_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.regions;
const CATALOG_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.catalogs;
const WEB_PRESENCE_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.webPresences;
const SHIPPING_OPTION_PAGE_SIZE = MARKET_QUERY_PAGE_SIZES.shippingOptions;

export const MARKET_LIST_QUERY = `#graphql
  query StoreMarketIds($first: Int!, $after: String) {
    markets(first: $first, after: $after, sortKey: NAME) {
      nodes { id }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const MARKET_DETAILS_QUERY = `#graphql
  query StoreMarketDetails($id: ID!, $regionFirst: Int!, $catalogFirst: Int!, $webPresenceFirst: Int!, $shippingOptionFirst: Int!) {
    market(id: $id) {
      id
      handle
      name
      status
      type
      catalogsCount { count precision }
      conditions {
        conditionTypes
        regionsCondition {
          applicationLevel
          regions(first: $regionFirst) {
            nodes {
              __typename
              id
              name
              ... on MarketRegionCountry { code }
              ... on MarketRegionSubdivision {
                code
                country { code }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
      currencySettings {
        baseCurrency {
          currencyCode
          currencyName
          enabled
          manualRate
          rateUpdatedAt
        }
        localCurrencies
        roundingEnabled
      }
      priceInclusions {
        adaptivePricingEnabled
        inclusiveDutiesPricingStrategy
        inclusiveTaxPricingStrategy
      }
      catalogs(first: $catalogFirst) {
        nodes {
          id
          title
          status
          publication { id autoPublish }
          priceList { id name currency }
        }
        pageInfo { hasNextPage }
      }
      webPresences(first: $webPresenceFirst) {
        nodes {
          id
          subfolderSuffix
          defaultLocale { locale }
          alternateLocales { locale }
          domain { id host url }
          rootUrls { locale url }
        }
        pageInfo { hasNextPage }
      }
      delivery {
        shipping {
          isEnabled
          optionDefinitionsCount { count precision }
          optionDefinitions(first: $shippingOptionFirst) {
            nodes {
              __typename
              id
              currency
              description
              freeDeliveryMinimumValue { amount }
              isActive
              ... on DeliveryFlatRateOptionDefinition { name }
              ... on DeliveryValueBasedOptionDefinition { name }
              ... on DeliveryWeightBasedOptionDefinition { name }
              ... on DeliveryCarrierCalculatedOptionDefinition {
                rateGroups(first: 1) {
                  nodes { carrierService { id name } }
                }
              }
            }
            pageInfo { hasNextPage }
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
              __typename
              id
              name
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

export async function fetchShopifyMarkets(
  context: MarketRequestContext,
): Promise<ShopifyMarketsResponse> {
  const marketIds: string[] = [];
  let after: string | null = null;
  let hasMoreMarkets: boolean;

  do {
    const data: {
      markets: { nodes: Array<{ id: string }>; pageInfo: GraphqlPageInfo };
    } = await callShopifyGraphql<{
      markets: { nodes: Array<{ id: string }>; pageInfo: GraphqlPageInfo };
    }>({
      ...context,
      operationName: "StoreMarketIds",
      query: MARKET_LIST_QUERY,
      variables: {
        first: Math.min(MARKET_PAGE_SIZE, MAX_MARKETS - marketIds.length),
        after,
      },
    });
    marketIds.push(...data.markets.nodes.map((market) => market.id));
    hasMoreMarkets = data.markets.pageInfo.hasNextPage;
    after = data.markets.pageInfo.endCursor || null;
  } while (hasMoreMarkets && after && marketIds.length < MAX_MARKETS);

  const items: ShopifyMarketSummary[] = [];
  for (const id of marketIds) {
    const market = await fetchShopifyMarket(context, id);
    if (market) items.push(market);
  }

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
      regionFirst: REGION_PAGE_SIZE,
      catalogFirst: CATALOG_PAGE_SIZE,
      webPresenceFirst: WEB_PRESENCE_PAGE_SIZE,
      shippingOptionFirst: SHIPPING_OPTION_PAGE_SIZE,
    },
  });
  if (data.market) await loadRemainingMarketRegions(context, data.market);
  return data.market ? normalizeMarket(data.market) : null;
}

async function loadRemainingMarketRegions(
  context: MarketRequestContext,
  market: GraphqlMarketNode,
) {
  const connection = market.conditions?.regionsCondition?.regions;
  if (!connection?.pageInfo.hasNextPage) return;

  let after = connection.pageInfo.endCursor || null;
  while (
    connection.pageInfo.hasNextPage &&
    after &&
    connection.nodes.length < MAX_MARKET_REGIONS
  ) {
    const data: {
      market: {
        conditions?: {
          regionsCondition?: { regions: GraphqlMarketRegionConnection } | null;
        } | null;
      } | null;
    } = await callShopifyGraphql<{
      market: {
        conditions?: {
          regionsCondition?: { regions: GraphqlMarketRegionConnection } | null;
        } | null;
      } | null;
    }>({
      ...context,
      operationName: "StoreMarketRegionPage",
      query: MARKET_REGIONS_PAGE_QUERY,
      variables: {
        id: market.id,
        first: Math.min(REGION_PAGE_SIZE, MAX_MARKET_REGIONS - connection.nodes.length),
        after,
      },
    });
    const page = data.market?.conditions?.regionsCondition?.regions;
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
      priceInclusivity: {
        taxesIncluded: boolean;
        dutiesIncluded: boolean;
      };
      catalogs: {
        nodes: GraphqlCatalog[];
        pageInfo: { hasNextPage: boolean };
      };
      webPresences: {
        nodes: GraphqlWebPresence[];
        pageInfo: { hasNextPage: boolean };
      };
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
            nodes {
              id
              title
              status
              publication { id autoPublish }
              priceList { id name currency }
            }
            pageInfo { hasNextPage }
          }
          webPresences(first: $webPresenceFirst) {
            nodes {
              id
              subfolderSuffix
              defaultLocale { locale }
              alternateLocales { locale }
              domain { id host url }
              rootUrls { locale url }
            }
            pageInfo { hasNextPage }
          }
        }
      }
    `,
    variables: {
      countryCode,
      catalogFirst: CATALOG_PAGE_SIZE,
      webPresenceFirst: WEB_PRESENCE_PAGE_SIZE,
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
  const regionConnection = node.conditions?.regionsCondition?.regions;
  const shipping = node.delivery.shipping;

  return {
    id: node.id,
    handle: node.handle,
    name: node.name,
    status: node.status,
    type: node.type,
    conditionTypes: node.conditions?.conditionTypes || [],
    conditionApplicationLevel:
      node.conditions?.regionsCondition?.applicationLevel || null,
    regions: (regionConnection?.nodes || []).map((region) => ({
      id: region.id,
      name: region.name,
      code: String(region.code || ""),
      kind: region.__typename === "MarketRegionSubdivision" ? "subdivision" : "country",
      countryCode:
        region.__typename === "MarketRegionSubdivision"
          ? String(region.country?.code || "") || null
          : String(region.code || "") || null,
    })),
    regionsTruncated: Boolean(regionConnection?.pageInfo.hasNextPage),
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
    rootUrls: node.rootUrls.map((item) => ({
      locale: item.locale,
      url: item.url,
    })),
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
  const carrierService = node.rateGroups?.nodes[0]?.carrierService;
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
  };
}

function normalizeCount(value?: GraphqlCount | null) {
  if (!value) return null;
  return {
    count: Number(value.count || 0),
    precision: String(value.precision || "EXACT"),
  };
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
