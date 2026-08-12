import type { H3Event } from "h3";
import type {
  ShopifyMarketCatalogSummary,
  ShopifyMarketResolution,
  ShopifyMarketsResponse,
  ShopifyMarketStatus,
  ShopifyMarketStatusResponse,
  ShopifyMarketSummary,
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

interface GraphqlCatalog {
  id: string;
  title: string;
  status: string;
  priceList?: {
    id: string;
    name: string;
    currency: string;
  } | null;
}

interface GraphqlWebPresence {
  id: string;
  subfolderSuffix?: string | null;
  rootUrls: Array<{ locale: string; url: string }>;
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
      regions: {
        nodes: Array<{
          __typename: "MarketRegionCountry" | "MarketRegionSubdivision" | string;
          id: string;
          name: string;
          code?: string;
          country?: { code?: string } | null;
        }>;
        pageInfo: { hasNextPage: boolean };
      };
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
    } | null;
  };
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

const MARKET_PAGE_SIZE = 250;
const NESTED_PAGE_SIZE = 250;
const CATALOG_PAGE_SIZE = 20;
const WEB_PRESENCE_PAGE_SIZE = 20;

export async function fetchShopifyMarkets(
  context: MarketRequestContext,
): Promise<ShopifyMarketsResponse> {
  const data = await callShopifyGraphql<{
    markets: {
      nodes: GraphqlMarketNode[];
      pageInfo: { hasNextPage: boolean };
    };
  }>({
    ...context,
    operationName: "StoreMarkets",
    query: `#graphql
      query StoreMarkets($first: Int!, $regionFirst: Int!, $catalogFirst: Int!, $webPresenceFirst: Int!) {
        markets(first: $first, sortKey: NAME) {
          nodes {
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
                  pageInfo { hasNextPage }
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
                priceList { id name currency }
              }
              pageInfo { hasNextPage }
            }
            webPresences(first: $webPresenceFirst) {
              nodes {
                id
                subfolderSuffix
                rootUrls { locale url }
              }
              pageInfo { hasNextPage }
            }
            delivery {
              shipping {
                isEnabled
                optionDefinitionsCount { count precision }
              }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `,
    variables: {
      first: MARKET_PAGE_SIZE,
      regionFirst: NESTED_PAGE_SIZE,
      catalogFirst: CATALOG_PAGE_SIZE,
      webPresenceFirst: WEB_PRESENCE_PAGE_SIZE,
    },
  });

  return {
    items: data.markets.nodes.map(normalizeMarket),
    fetchedAt: new Date().toISOString(),
    truncated: data.markets.pageInfo.hasNextPage,
  };
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
              priceList { id name currency }
            }
            pageInfo { hasNextPage }
          }
          webPresences(first: $webPresenceFirst) {
            nodes { id subfolderSuffix rootUrls { locale url } }
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
    catalogs: resolved.catalogs.nodes.map(normalizeCatalog),
    catalogsTruncated: resolved.catalogs.pageInfo.hasNextPage,
    webPresences: resolved.webPresences.nodes.map(normalizeWebPresence),
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
    catalogs: node.catalogs.nodes.map(normalizeCatalog),
    catalogsTruncated: node.catalogs.pageInfo.hasNextPage,
    webPresences: node.webPresences.nodes.map(normalizeWebPresence),
    webPresencesTruncated: node.webPresences.pageInfo.hasNextPage,
    shipping: {
      inherits: !shipping,
      enabled: shipping?.isEnabled ?? null,
      optionCount: normalizeCount(shipping?.optionDefinitionsCount),
    },
  };
}

function normalizeCatalog(node: GraphqlCatalog): ShopifyMarketCatalogSummary {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    priceList: node.priceList
      ? {
          id: node.priceList.id,
          name: node.priceList.name,
          currency: node.priceList.currency,
        }
      : null,
  };
}

function normalizeWebPresence(
  node: GraphqlWebPresence,
): ShopifyMarketWebPresenceSummary {
  return {
    id: node.id,
    subfolderSuffix: node.subfolderSuffix || null,
    rootUrls: node.rootUrls.map((item) => ({
      locale: item.locale,
      url: item.url,
    })),
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
