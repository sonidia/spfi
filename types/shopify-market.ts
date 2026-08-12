export type ShopifyMarketStatus = "ACTIVE" | "DRAFT";

export type ShopifyMarketType =
  "CHANNEL" | "COMPANY_LOCATION" | "LOCATION" | "NONE" | "REGION";

export interface ShopifyMarketCount {
  count: number;
  precision: string;
}

export interface ShopifyMarketRegionSummary {
  id: string;
  name: string;
  code: string;
  kind: "country" | "subdivision";
  countryCode: string | null;
}

export interface ShopifyMarketCatalogSummary {
  id: string;
  title: string;
  status: string;
  priceList: {
    id: string;
    name: string;
    currency: string;
  } | null;
}

export interface ShopifyMarketWebPresenceSummary {
  id: string;
  subfolderSuffix: string | null;
  rootUrls: Array<{
    locale: string;
    url: string;
  }>;
}

export interface ShopifyMarketSummary {
  id: string;
  handle: string;
  name: string;
  status: ShopifyMarketStatus;
  type: ShopifyMarketType;
  conditionTypes: string[];
  conditionApplicationLevel: string | null;
  regions: ShopifyMarketRegionSummary[];
  regionsTruncated: boolean;
  currencySettings: {
    baseCurrencyCode: string;
    baseCurrencyName: string;
    baseCurrencyEnabled: boolean;
    manualRate: string | null;
    rateUpdatedAt: string | null;
    localCurrencies: boolean;
    roundingEnabled: boolean;
  } | null;
  priceInclusions: {
    adaptivePricingEnabled: boolean;
    dutiesStrategy: string;
    taxesStrategy: string;
  } | null;
  catalogCount: ShopifyMarketCount | null;
  catalogs: ShopifyMarketCatalogSummary[];
  catalogsTruncated: boolean;
  webPresences: ShopifyMarketWebPresenceSummary[];
  webPresencesTruncated: boolean;
  shipping: {
    inherits: boolean;
    enabled: boolean | null;
    optionCount: ShopifyMarketCount | null;
  };
}

export interface ShopifyMarketsResponse {
  items: ShopifyMarketSummary[];
  fetchedAt: string;
  truncated: boolean;
}

export interface ShopifyMarketResolution {
  countryCode: string;
  currencyCode: string;
  taxesIncluded: boolean;
  dutiesIncluded: boolean;
  catalogs: ShopifyMarketCatalogSummary[];
  catalogsTruncated: boolean;
  webPresences: ShopifyMarketWebPresenceSummary[];
  webPresencesTruncated: boolean;
}

export interface ShopifyMarketStatusResponse {
  id: string;
  status: ShopifyMarketStatus;
}
