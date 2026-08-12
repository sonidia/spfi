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
  publication: {
    id: string;
    autoPublish: boolean;
  } | null;
  priceList: {
    id: string;
    name: string;
    currency: string;
  } | null;
}

export interface ShopifyMarketWebPresenceSummary {
  id: string;
  subfolderSuffix: string | null;
  defaultLocale: string;
  alternateLocales: string[];
  domain: {
    id: string;
    host: string;
    url: string;
  } | null;
  rootUrls: Array<{
    locale: string;
    url: string;
  }>;
}

export type ShopifyMarketShippingOptionType =
  "CARRIER_CALCULATED" | "FLAT_RATE" | "VALUE_BASED" | "WEIGHT_BASED";

export interface ShopifyMarketShippingOptionSummary {
  id: string;
  type: ShopifyMarketShippingOptionType;
  name: string | null;
  description: string | null;
  currency: string;
  active: boolean;
  freeDeliveryMinimumValue: string | null;
  carrierService: { id: string; name: string } | null;
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
    options: ShopifyMarketShippingOptionSummary[];
    optionsTruncated: boolean;
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

export interface ShopifyMarketRegionInput {
  countryCode: string;
  subdivision?: string;
}

export interface ShopifyMarketEditorContext {
  primaryDomain: { id: string; host: string; url: string } | null;
  locales: Array<{
    locale: string;
    name: string;
    primary: boolean;
    published: boolean;
  }>;
  catalogs: ShopifyMarketCatalogSummary[];
  webPresences: ShopifyMarketWebPresenceSummary[];
  carrierServices: Array<{
    id: string;
    name: string;
    active: boolean;
    supportsServiceDiscovery: boolean;
  }>;
  warnings: string[];
}

export type ShopifyMarketTaxStrategy =
  | "ADD_TAXES_AT_CHECKOUT"
  | "INCLUDES_TAXES_IN_PRICE"
  | "INCLUDES_TAXES_IN_PRICE_BASED_ON_COUNTRY";

export type ShopifyMarketDutyStrategy =
  "ADD_DUTIES_AT_CHECKOUT" | "INCLUDE_DUTIES_IN_PRICE";

export interface ShopifyMarketPricingInput {
  currency: {
    baseCurrency: string;
    manualRate?: string | null;
    localCurrencies: boolean;
    roundingEnabled: boolean;
  } | null;
  priceInclusions: {
    adaptivePricingEnabled: boolean;
    dutiesPricingStrategy: ShopifyMarketDutyStrategy;
    taxPricingStrategy: ShopifyMarketTaxStrategy;
  } | null;
}

export interface ShopifyMarketShippingOptionInput {
  type: ShopifyMarketShippingOptionType;
  name?: string;
  description?: string;
  currency: string;
  active: boolean;
  freeDeliveryMinimumValue?: string | null;
  price?: string;
  minimum?: string;
  maximum?: string | null;
  weightUnit?: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";
  carrierServiceId?: string;
  percentageAdjustment?: number | null;
}

export interface ShopifyMarketLocalizationField {
  key: string;
  sourceValue: string | null;
  digest: string | null;
  value: string | null;
  outdated: boolean;
  updatedAt: string | null;
}

export interface ShopifyMarketLocalizationResource {
  resourceId: string;
  mode: "MARKET_LOCALIZATION" | "TRANSLATION";
  locale: string | null;
  fields: ShopifyMarketLocalizationField[];
}
