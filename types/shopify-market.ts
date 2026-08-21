export type ShopifyMarketStatus = "ACTIVE" | "DRAFT";

export type ShopifyMarketType =
  "CHANNEL" | "COMPANY_LOCATION" | "LOCATION" | "NONE" | "REGION";

export interface ShopifyMarketListFilters {
  search?: string;
  status?: ShopifyMarketStatus;
  type?: ShopifyMarketType;
  conditionTypes?: Array<Exclude<ShopifyMarketType, "NONE">>;
}

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

export interface ShopifyMarketDiscountSummary {
  id: string;
  type: string;
  title: string;
  code: string | null;
  status: string;
}

export type ShopifyMarketConditionApplicationLevel = "ALL" | "SPECIFIED";

export interface ShopifyMarketConditionResourceSummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
}

export interface ShopifyMarketResourceConditionSummary {
  applicationLevel: ShopifyMarketConditionApplicationLevel | null;
  items: ShopifyMarketConditionResourceSummary[];
  truncated: boolean;
}

export interface ShopifyMarketConditionsSummary {
  regions: {
    applicationLevel: ShopifyMarketConditionApplicationLevel | null;
    truncated: boolean;
  } | null;
  companyLocations: ShopifyMarketResourceConditionSummary | null;
  locations: ShopifyMarketResourceConditionSummary | null;
  channels: ShopifyMarketResourceConditionSummary | null;
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
  rateGroupId: string | null;
  rates: ShopifyMarketShippingRateSummary[];
  ratesTruncated: boolean;
  percentageAdjustment: number | null;
}

export interface ShopifyMarketShippingRateSummary {
  id: string;
  price: string;
  minimum: string | null;
  maximum: string | null;
  weightUnit: "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS" | null;
}

export interface ShopifyMarketSummary {
  id: string;
  /** False when the record came from the lightweight Markets list query. */
  detailsLoaded?: boolean;
  handle: string;
  name: string;
  status: ShopifyMarketStatus;
  type: ShopifyMarketType;
  conditionTypes: string[];
  conditionApplicationLevel: string | null;
  conditions: ShopifyMarketConditionsSummary;
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
  discountCount: ShopifyMarketCount | null;
  discounts: ShopifyMarketDiscountSummary[];
  discountsTruncated: boolean;
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
  domains: Array<{
    id: string;
    host: string;
    url: string;
    primary: boolean;
    assigned: boolean;
  }>;
  capabilities: {
    companyLocationsAvailable: boolean;
    locationsAvailable: boolean;
    channelsAvailable: boolean;
  };
  locales: Array<{
    locale: string;
    name: string;
    primary: boolean;
    published: boolean;
  }>;
  catalogs: ShopifyMarketCatalogSummary[];
  discounts: ShopifyMarketDiscountSummary[];
  webPresences: ShopifyMarketWebPresenceSummary[];
  conditionOptions: {
    companyLocations: ShopifyMarketConditionResourceSummary[];
    locations: ShopifyMarketConditionResourceSummary[];
    channels: ShopifyMarketConditionResourceSummary[];
  };
  carrierServices: Array<{
    id: string;
    name: string;
    active: boolean;
    supportsServiceDiscovery: boolean;
  }>;
  warnings: string[];
}

export interface ShopifyMarketCatalogCreateResult {
  catalog: ShopifyMarketCatalogSummary;
  priceListCreated: boolean;
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

export interface ShopifyMarketShippingOptionUpdateInput {
  id: string;
  type: ShopifyMarketShippingOptionType;
  name?: string;
  description?: string;
  currency: string;
  active: boolean;
  freeDeliveryMinimumValue?: string | null;
  rateGroupId?: string | null;
  rates?: ShopifyMarketShippingRateSummary[];
  carrierServiceId?: string;
  percentageAdjustment?: number | null;
}

export interface ShopifyMarketConditionsInput {
  regions?: ShopifyMarketRegionInput[];
  companyLocations?: {
    applicationLevel: ShopifyMarketConditionApplicationLevel;
    ids: string[];
  };
  locations?: {
    applicationLevel: ShopifyMarketConditionApplicationLevel;
    ids: string[];
  };
  channels?: { ids: string[] };
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

export interface ShopifyMarketLocalizationOverviewItem {
  resourceId: string;
  fieldCount: number;
  localizedCount: number;
  outdatedCount: number;
  preview: string;
}

export interface ShopifyMarketLocalizationOverview {
  mode: "MARKET_LOCALIZATION" | "TRANSLATION";
  resourceType: string;
  locale: string | null;
  items: ShopifyMarketLocalizationOverviewItem[];
  truncated: boolean;
}
