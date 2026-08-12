import type { H3Event } from "h3";
import type {
  ShopifyMarketCatalogSummary,
  ShopifyMarketEditorContext,
  ShopifyMarketLocalizationResource,
  ShopifyMarketPricingInput,
  ShopifyMarketRegionInput,
  ShopifyMarketShippingOptionInput,
} from "~~/types/shopify-market";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import {
  fetchShopifyMarket,
  normalizeMarketCatalog,
  normalizeMarketWebPresence,
} from "./shopify-markets";
import {
  asRecord,
  normalizeCurrencyCode,
  normalizeDutyStrategy,
  normalizeManualRate,
  normalizeMarketRegions,
  normalizeShippingOption,
  normalizeStringList,
  normalizeTaxStrategy,
  requireGenericShopifyGid,
  requireMarketId,
} from "./shopify-market-validation";

interface MarketRequestContext {
  event: H3Event;
  storeId: string;
  token: string;
}

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

export const MARKET_EDITOR_CONTEXT_PAGE_SIZE = 25;
const CONTEXT_PAGE_SIZE = MARKET_EDITOR_CONTEXT_PAGE_SIZE;
const MAX_CONTEXT_ITEMS = 100;

export const CREATE_MANAGED_MARKET_MUTATION = `#graphql
  mutation CreateManagedMarket($input: MarketCreateInput!) {
    marketCreate(input: $input) {
      market { id }
      userErrors { field message code }
    }
  }
`;

export const UPDATE_MANAGED_MARKET_MUTATION = `#graphql
  mutation UpdateManagedMarket($id: ID!, $input: MarketUpdateInput!) {
    marketUpdate(id: $id, input: $input) {
      market { id }
      userErrors { field message code }
    }
  }
`;

export async function fetchMarketEditorContext(
  context: MarketRequestContext,
): Promise<ShopifyMarketEditorContext> {
  const warnings: string[] = [];
  const base = await callShopifyGraphql<{
    shop: { primaryDomain: { id: string; host: string; url: string } };
    shopLocales: Array<{
      locale: string;
      name: string;
      primary: boolean;
      published: boolean;
    }>;
  }>({
    ...context,
    operationName: "MarketEditorBaseContext",
    query: `#graphql
      query MarketEditorBaseContext {
        shop { primaryDomain { id host url } }
        shopLocales { locale name primary published }
      }
    `,
  });

  const catalogResult = await fetchEditorCatalogs(context);
  if (catalogResult.truncated) warnings.push("catalogs_truncated");

  const webPresenceResult = await fetchEditorWebPresences(context);
  if (webPresenceResult.truncated) warnings.push("web_presences_truncated");

  let carrierServices: ShopifyMarketEditorContext["carrierServices"] = [];
  try {
    const carrierResult = await fetchEditorCarrierServices(context);
    carrierServices = carrierResult.items;
    if (carrierResult.truncated) {
      warnings.push("carrier_services_truncated");
    }
  } catch {
    warnings.push("carrier_services_unavailable");
  }

  return {
    primaryDomain: base.shop.primaryDomain,
    locales: base.shopLocales,
    catalogs: catalogResult.items.map(normalizeMarketCatalog),
    webPresences: webPresenceResult.items.map(normalizeMarketWebPresence),
    carrierServices,
    warnings,
  };
}

async function fetchEditorCatalogs(context: MarketRequestContext) {
  const items: RawCatalog[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;

  do {
    const data: {
      catalogs: {
        nodes: RawCatalog[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql<{
      catalogs: {
        nodes: RawCatalog[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>({
      ...context,
      operationName: "MarketEditorCatalogs",
      query: `#graphql
        query MarketEditorCatalogs($first: Int!, $after: String) {
          catalogs(first: $first, after: $after, type: MARKET, sortKey: TITLE) {
            nodes {
              id title status publication { id autoPublish }
              priceList { id name currency }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(...data.catalogs.nodes);
    hasNextPage = data.catalogs.pageInfo.hasNextPage;
    after = data.catalogs.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);

  return { items, truncated: hasNextPage };
}

async function fetchEditorWebPresences(context: MarketRequestContext) {
  const items: RawWebPresence[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;

  do {
    const data: {
      webPresences: {
        nodes: RawWebPresence[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql<{
      webPresences: {
        nodes: RawWebPresence[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>({
      ...context,
      operationName: "MarketEditorWebPresences",
      query: `#graphql
        query MarketEditorWebPresences($first: Int!, $after: String) {
          webPresences(first: $first, after: $after) {
            nodes {
              id subfolderSuffix defaultLocale { locale }
              alternateLocales { locale }
              domain { id host url }
              rootUrls { locale url }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(...data.webPresences.nodes);
    hasNextPage = data.webPresences.pageInfo.hasNextPage;
    after = data.webPresences.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);

  return { items, truncated: hasNextPage };
}

async function fetchEditorCarrierServices(context: MarketRequestContext) {
  const items: ShopifyMarketEditorContext["carrierServices"] = [];
  let after: string | null = null;
  let hasNextPage: boolean;

  do {
    const data: {
      carrierServices: {
        nodes: ShopifyMarketEditorContext["carrierServices"];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql<{
      carrierServices: {
        nodes: ShopifyMarketEditorContext["carrierServices"];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>({
      ...context,
      operationName: "MarketCarrierServices",
      query: `#graphql
        query MarketCarrierServices($first: Int!, $after: String) {
          carrierServices(first: $first, after: $after, query: "active:true") {
            nodes { id name active supportsServiceDiscovery }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(...data.carrierServices.nodes);
    hasNextPage = data.carrierServices.pageInfo.hasNextPage;
    after = data.carrierServices.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);

  return { items, truncated: hasNextPage };
}

export async function createShopifyMarket(
  context: MarketRequestContext,
  rawInput: unknown,
) {
  const input = asRecord(rawInput, "Market input");
  const name = String(input.name || "").trim();
  if (!name || name.length > 255) {
    throw badRequest("Market name is required and must be at most 255 characters.");
  }
  const status = String(input.status || "DRAFT").toUpperCase();
  if (status !== "ACTIVE" && status !== "DRAFT") {
    throw badRequest("Market status must be ACTIVE or DRAFT.");
  }
  const regions = normalizeMarketRegions(input.regions);
  if (!regions.length) throw badRequest("Add at least one buyer region.");
  const handle = String(input.handle || "").trim();
  if (handle && !/^[A-Za-z0-9-]{1,255}$/.test(handle)) {
    throw badRequest("Market handle can contain only letters, numbers, and hyphens.");
  }

  const marketInput: Record<string, unknown> = {
    name,
    status,
    makeDuplicateUniqueMarketsDraft: input.makeDuplicateUniqueMarketsDraft === true,
    conditions: { regionsCondition: { regions } },
    ...(handle ? { handle } : {}),
  };
  if (input.baseCurrency) {
    marketInput.currencySettings = {
      baseCurrency: normalizeCurrencyCode(input.baseCurrency),
      localCurrencies: input.localCurrencies === true,
      roundingEnabled: input.roundingEnabled === true,
    };
  }

  const data = await callShopifyGraphql<MarketMutationResult>({
    ...context,
    operationName: "CreateManagedMarket",
    retryTransport: false,
    query: CREATE_MANAGED_MARKET_MUTATION,
    variables: { input: marketInput },
  });
  return refreshMarketMutation(
    context,
    data.marketCreate,
    "Failed to create the market.",
  );
}

export async function updateMarketIdentity(
  context: MarketRequestContext,
  marketId: unknown,
  rawInput: unknown,
) {
  const input = asRecord(rawInput, "Market details");
  const name = String(input.name || "").trim();
  const handle = String(input.handle || "").trim();
  if (!name || name.length > 255) throw badRequest("Market name is required.");
  if (!/^[A-Za-z0-9-]{1,255}$/.test(handle)) {
    throw badRequest("Market handle can contain only letters, numbers, and hyphens.");
  }
  return updateMarket(context, marketId, { name, handle }, "update market details");
}

export async function replaceMarketRegions(
  context: MarketRequestContext,
  marketId: unknown,
  currentValue: unknown,
  nextValue: unknown,
  makeDuplicatesDraft: unknown,
) {
  const current = normalizeMarketRegions(currentValue);
  const next = normalizeMarketRegions(nextValue);
  if (!next.length)
    throw badRequest("A regional market must keep at least one region.");
  const currentMap = new Map(current.map((region) => [regionKey(region), region]));
  const nextMap = new Map(next.map((region) => [regionKey(region), region]));
  const additions = next.filter((region) => !currentMap.has(regionKey(region)));
  const deletions = current.filter((region) => !nextMap.has(regionKey(region)));
  if (!additions.length && !deletions.length) {
    throw badRequest("No region changes were detected.");
  }
  return updateMarket(
    context,
    marketId,
    {
      makeDuplicateUniqueMarketsDraft: makeDuplicatesDraft === true,
      conditions: {
        ...(additions.length
          ? { conditionsToAdd: { regionsCondition: { regions: additions } } }
          : {}),
        ...(deletions.length
          ? { conditionsToDelete: { regionsCondition: { regions: deletions } } }
          : {}),
      },
    },
    "update market regions",
  );
}

export async function updateMarketPricing(
  context: MarketRequestContext,
  marketId: unknown,
  rawInput: unknown,
) {
  const input = asRecord(rawInput, "Pricing input");
  const marketInput: Record<string, unknown> = {};
  if (input.currency === null) {
    marketInput.removeCurrencySettings = true;
  } else {
    const currency = asRecord(input.currency, "Currency settings");
    const localCurrencies = currency.localCurrencies === true;
    const manualRate = normalizeManualRate(currency.manualRate);
    if (localCurrencies && manualRate) {
      throw badRequest("Manual rates cannot be combined with local currencies.");
    }
    marketInput.currencySettings = {
      baseCurrency: normalizeCurrencyCode(currency.baseCurrency),
      baseCurrencyManualRate: manualRate,
      localCurrencies,
      roundingEnabled: currency.roundingEnabled === true,
    };
  }
  if (input.priceInclusions === null) {
    marketInput.removePriceInclusions = true;
  } else {
    const prices = asRecord(input.priceInclusions, "Price inclusion settings");
    marketInput.priceInclusions = {
      adaptivePricingEnabled: prices.adaptivePricingEnabled === true,
      dutiesPricingStrategy: normalizeDutyStrategy(prices.dutiesPricingStrategy),
      taxPricingStrategy: normalizeTaxStrategy(prices.taxPricingStrategy),
    } satisfies ShopifyMarketPricingInput["priceInclusions"];
  }
  return updateMarket(context, marketId, marketInput, "update market pricing");
}

export async function updateMarketAssignments(
  context: MarketRequestContext,
  marketId: unknown,
  rawInput: unknown,
) {
  const input = asRecord(rawInput, "Assignment input");
  const catalogsToAdd = validateGidList(
    input.catalogsToAdd,
    "Catalog",
    "Catalogs to add",
  );
  const catalogsToDelete = validateGidList(
    input.catalogsToDelete,
    "Catalog",
    "Catalogs to remove",
  );
  const webPresencesToAdd = validateGidList(
    input.webPresencesToAdd,
    "MarketWebPresence",
    "Web presences to add",
  );
  const webPresencesToDelete = validateGidList(
    input.webPresencesToDelete,
    "MarketWebPresence",
    "Web presences to remove",
  );
  if (
    !catalogsToAdd.length &&
    !catalogsToDelete.length &&
    !webPresencesToAdd.length &&
    !webPresencesToDelete.length
  ) {
    throw badRequest("No assignment changes were detected.");
  }
  return updateMarket(
    context,
    marketId,
    { catalogsToAdd, catalogsToDelete, webPresencesToAdd, webPresencesToDelete },
    "update market assignments",
  );
}

export async function updateMarketShipping(
  context: MarketRequestContext,
  marketId: unknown,
  rawInput: unknown,
) {
  const input = asRecord(rawInput, "Shipping input");
  const mode = String(input.mode || "").toUpperCase();
  if (mode === "INHERIT") {
    return updateMarket(
      context,
      marketId,
      { delivery: { removeShipping: true } },
      "inherit shipping",
    );
  }
  if (mode === "DISABLED") {
    return updateMarket(
      context,
      marketId,
      { delivery: { shipping: { isEnabled: false } } },
      "disable shipping",
    );
  }
  if (mode !== "ENABLED") throw badRequest("Invalid shipping mode.");

  const createOptions = Array.isArray(input.createOptions)
    ? input.createOptions.map(normalizeShippingOption)
    : [];
  const deleteOptionIds = normalizeStringList(
    input.deleteOptionIds || [],
    "Shipping options to delete",
  ).map((value) => {
    const id = requireGenericShopifyGid(value, "Shipping option ID");
    if (
      !/^gid:\/\/shopify\/Delivery(?:CarrierCalculated|FlatRate|ValueBased|WeightBased)OptionDefinition\//.test(
        id,
      )
    ) {
      throw badRequest("Shipping option ID has the wrong resource type.");
    }
    return id;
  });
  const updateOptions = Array.isArray(input.updateOptions)
    ? input.updateOptions.map(buildShippingOptionStatusUpdate)
    : [];
  return updateMarket(
    context,
    marketId,
    {
      delivery: {
        shipping: {
          isEnabled: true,
          optionDefinitionsToCreate: createOptions.map(buildShippingOptionCreateInput),
          optionDefinitionsToDelete: deleteOptionIds,
          optionDefinitionsToUpdate: updateOptions,
        },
      },
    },
    "update market shipping",
  );
}

export async function createWebPresence(
  context: MarketRequestContext,
  rawInput: unknown,
) {
  const input = normalizeWebPresenceInput(rawInput, true);
  const data = await callShopifyGraphql<{
    webPresenceCreate: {
      webPresence: RawWebPresence | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "CreateMarketWebPresence",
    retryTransport: false,
    query: `#graphql
      mutation CreateMarketWebPresence($input: WebPresenceCreateInput!) {
        webPresenceCreate(input: $input) {
          webPresence {
            id subfolderSuffix defaultLocale { locale }
            alternateLocales { locale } domain { id host url }
            rootUrls { locale url }
          }
          userErrors { field message code }
        }
      }
    `,
    variables: { input },
  });
  assertNoGraphqlUserErrors(
    data.webPresenceCreate.userErrors,
    "Failed to create the web presence.",
  );
  if (!data.webPresenceCreate.webPresence) throw badGateway("Missing web presence.");
  return normalizeMarketWebPresence(data.webPresenceCreate.webPresence);
}

export async function updateWebPresence(
  context: MarketRequestContext,
  presenceId: unknown,
  rawInput: unknown,
) {
  const id = requireGenericShopifyGid(presenceId, "Web presence ID");
  if (!id.startsWith("gid://shopify/MarketWebPresence/")) {
    throw badRequest("Web presence ID has the wrong resource type.");
  }
  const input = normalizeWebPresenceInput(rawInput, false);
  const data = await callShopifyGraphql<{
    webPresenceUpdate: {
      webPresence: RawWebPresence | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "UpdateMarketWebPresence",
    retryTransport: false,
    query: `#graphql
      mutation UpdateMarketWebPresence($id: ID!, $input: WebPresenceUpdateInput!) {
        webPresenceUpdate(id: $id, input: $input) {
          webPresence {
            id subfolderSuffix defaultLocale { locale }
            alternateLocales { locale } domain { id host url }
            rootUrls { locale url }
          }
          userErrors { field message code }
        }
      }
    `,
    variables: { id, input },
  });
  assertNoGraphqlUserErrors(
    data.webPresenceUpdate.userErrors,
    "Failed to update the web presence.",
  );
  if (!data.webPresenceUpdate.webPresence) throw badGateway("Missing web presence.");
  return normalizeMarketWebPresence(data.webPresenceUpdate.webPresence);
}

export async function fetchMarketLocalization(
  context: MarketRequestContext,
  marketIdValue: unknown,
  resourceIdValue: unknown,
  localeValue: unknown,
): Promise<ShopifyMarketLocalizationResource> {
  const marketId = requireMarketId(marketIdValue);
  const resourceId = requireGenericShopifyGid(resourceIdValue);
  const locale = String(localeValue || "")
    .trim()
    .toLowerCase();
  if (locale && !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale)) {
    throw badRequest("Locale must be a valid Shopify locale code.");
  }
  if (locale) {
    const data = await callShopifyGraphql<{
      translatableResource: {
        resourceId: string;
        translatableContent: Array<{
          key: string;
          value: string | null;
          digest: string;
        }>;
        translations: Array<{
          key: string;
          value: string;
          outdated: boolean;
          updatedAt?: string | null;
        }>;
      } | null;
    }>({
      ...context,
      operationName: "MarketTranslationResource",
      query: `#graphql
        query MarketTranslationResource($resourceId: ID!, $locale: String!, $marketId: ID!) {
          translatableResource(resourceId: $resourceId) {
            resourceId
            translatableContent(marketId: $marketId) { key value digest }
            translations(locale: $locale, marketId: $marketId) {
              key value outdated updatedAt
            }
          }
        }
      `,
      variables: { resourceId, locale, marketId },
    });
    if (!data.translatableResource) throw badRequest("Resource is not translatable.");
    const values = new Map(
      data.translatableResource.translations.map((item) => [item.key, item]),
    );
    return {
      resourceId,
      mode: "TRANSLATION",
      locale,
      fields: data.translatableResource.translatableContent.map((item) => ({
        key: item.key,
        sourceValue: item.value,
        digest: item.digest,
        value: values.get(item.key)?.value || null,
        outdated: values.get(item.key)?.outdated || false,
        updatedAt: values.get(item.key)?.updatedAt || null,
      })),
    };
  }

  const data = await callShopifyGraphql<{
    marketLocalizableResource: {
      resourceId: string;
      marketLocalizableContent: Array<{
        key: string;
        value: string | null;
        digest: string | null;
      }>;
      marketLocalizations: Array<{
        key: string;
        value: string | null;
        outdated: boolean;
        updatedAt?: string | null;
      }>;
    } | null;
  }>({
    ...context,
    operationName: "MarketLocalizableResource",
    query: `#graphql
      query MarketLocalizableResource($resourceId: ID!, $marketId: ID!) {
        marketLocalizableResource(resourceId: $resourceId) {
          resourceId
          marketLocalizableContent { key value digest }
          marketLocalizations(marketId: $marketId) { key value outdated updatedAt }
        }
      }
    `,
    variables: { resourceId, marketId },
  });
  if (!data.marketLocalizableResource) {
    throw badRequest("Resource is not market localizable.");
  }
  const values = new Map(
    data.marketLocalizableResource.marketLocalizations.map((item) => [item.key, item]),
  );
  return {
    resourceId,
    mode: "MARKET_LOCALIZATION",
    locale: null,
    fields: data.marketLocalizableResource.marketLocalizableContent.map((item) => ({
      key: item.key,
      sourceValue: item.value,
      digest: item.digest,
      value: values.get(item.key)?.value || null,
      outdated: values.get(item.key)?.outdated || false,
      updatedAt: values.get(item.key)?.updatedAt || null,
    })),
  };
}

export async function saveMarketLocalization(
  context: MarketRequestContext,
  marketIdValue: unknown,
  resourceIdValue: unknown,
  rawFields: unknown,
  localeValue: unknown,
) {
  const marketId = requireMarketId(marketIdValue);
  const resourceId = requireGenericShopifyGid(resourceIdValue);
  if (!Array.isArray(rawFields) || !rawFields.length || rawFields.length > 100) {
    throw badRequest("Provide between 1 and 100 localization fields.");
  }
  const fields = rawFields.map((entry) => {
    const row = asRecord(entry, "Localization field");
    const key = String(row.key || "").trim();
    const digest = String(row.digest || "").trim();
    const value = String(row.value ?? "");
    if (!key || !digest) throw badRequest("Localization key and digest are required.");
    return { key, digest, value };
  });
  const locale = String(localeValue || "")
    .trim()
    .toLowerCase();
  if (locale) {
    const data = await callShopifyGraphql<{
      translationsRegister: { userErrors: GraphqlUserError[] };
    }>({
      ...context,
      operationName: "SaveMarketTranslations",
      retryTransport: false,
      query: `#graphql
        mutation SaveMarketTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
          translationsRegister(resourceId: $resourceId, translations: $translations) {
            userErrors { field message code }
          }
        }
      `,
      variables: {
        resourceId,
        translations: fields.map((field) => ({
          locale,
          key: field.key,
          value: field.value,
          translatableContentDigest: field.digest,
          marketId,
        })),
      },
    });
    assertNoGraphqlUserErrors(
      data.translationsRegister.userErrors,
      "Failed to save market translations.",
    );
    return { success: true };
  }

  const data = await callShopifyGraphql<{
    marketLocalizationsRegister: { userErrors: GraphqlUserError[] };
  }>({
    ...context,
    operationName: "SaveMarketLocalizations",
    retryTransport: false,
    query: `#graphql
      mutation SaveMarketLocalizations($resourceId: ID!, $marketLocalizations: [MarketLocalizationRegisterInput!]!) {
        marketLocalizationsRegister(resourceId: $resourceId, marketLocalizations: $marketLocalizations) {
          userErrors { field message code }
        }
      }
    `,
    variables: {
      resourceId,
      marketLocalizations: fields.map((field) => ({
        key: field.key,
        value: field.value,
        marketLocalizableContentDigest: field.digest,
        marketId,
      })),
    },
  });
  assertNoGraphqlUserErrors(
    data.marketLocalizationsRegister.userErrors,
    "Failed to save market localizations.",
  );
  return { success: true };
}

async function updateMarket(
  context: MarketRequestContext,
  marketIdValue: unknown,
  input: Record<string, unknown>,
  action: string,
) {
  const id = requireMarketId(marketIdValue);
  const data = await callShopifyGraphql<MarketMutationResult>({
    ...context,
    operationName: "UpdateManagedMarket",
    retryTransport: false,
    query: UPDATE_MANAGED_MARKET_MUTATION,
    variables: { id, input },
  });
  return refreshMarketMutation(context, data.marketUpdate, `Failed to ${action}.`);
}

async function refreshMarketMutation(
  context: MarketRequestContext,
  result: { market: { id: string } | null; userErrors: GraphqlUserError[] },
  fallback: string,
) {
  assertNoGraphqlUserErrors(result.userErrors, fallback);
  if (!result.market) throw badGateway("Shopify did not return the updated market.");
  const market = await fetchShopifyMarket(context, result.market.id);
  if (!market) throw badGateway("Shopify did not return the refreshed market.");
  return market;
}

export function buildShippingOptionCreateInput(
  option: ShopifyMarketShippingOptionInput,
) {
  const common = {
    currency: option.currency,
    description: option.description || undefined,
    isActive: option.active,
    freeDeliveryMinimumValue: option.freeDeliveryMinimumValue
      ? { amount: option.freeDeliveryMinimumValue, currencyCode: option.currency }
      : undefined,
  };
  if (option.type === "FLAT_RATE") {
    return {
      flatRate: {
        ...common,
        name: option.name,
        rateGroups: [
          { rate: { price: { amount: option.price, currencyCode: option.currency } } },
        ],
      },
    };
  }
  if (option.type === "VALUE_BASED") {
    return {
      valueBased: {
        ...common,
        name: option.name,
        rateGroups: [
          {
            conditions: {},
            rates: [
              {
                minValue: { amount: option.minimum, currencyCode: option.currency },
                ...(option.maximum
                  ? {
                      maxValue: {
                        amount: option.maximum,
                        currencyCode: option.currency,
                      },
                    }
                  : {}),
                price: { amount: option.price, currencyCode: option.currency },
              },
            ],
          },
        ],
      },
    };
  }
  if (option.type === "WEIGHT_BASED") {
    return {
      weightBased: {
        ...common,
        name: option.name,
        rateGroups: [
          {
            conditions: {},
            rates: [
              {
                minWeight: { value: Number(option.minimum), unit: option.weightUnit },
                ...(option.maximum
                  ? {
                      maxWeight: {
                        value: Number(option.maximum),
                        unit: option.weightUnit,
                      },
                    }
                  : {}),
                price: { amount: option.price, currencyCode: option.currency },
              },
            ],
          },
        ],
      },
    };
  }
  return {
    carrierCalculated: {
      ...common,
      rateGroups: [
        {
          carrierServiceId: option.carrierServiceId,
          autoIncludeNewServices: true,
          ...(option.percentageAdjustment !== null &&
          option.percentageAdjustment !== undefined
            ? { percentageAdjustment: option.percentageAdjustment }
            : {}),
        },
      ],
    },
  };
}

export function buildShippingOptionStatusUpdate(value: unknown) {
  const row = asRecord(value, "Shipping option update");
  const type = String(row.type || "").toUpperCase();
  const resourceByType: Record<string, string> = {
    CARRIER_CALCULATED: "DeliveryCarrierCalculatedOptionDefinition",
    FLAT_RATE: "DeliveryFlatRateOptionDefinition",
    VALUE_BASED: "DeliveryValueBasedOptionDefinition",
    WEIGHT_BASED: "DeliveryWeightBasedOptionDefinition",
  };
  const resource = resourceByType[type];
  if (!resource) throw badRequest("Invalid shipping option update type.");
  const id = requireGenericShopifyGid(row.id, "Shipping option ID");
  if (!id.startsWith(`gid://shopify/${resource}/`)) {
    throw badRequest("Shipping option ID does not match its option type.");
  }
  const fieldByType: Record<string, string> = {
    CARRIER_CALCULATED: "carrierCalculated",
    FLAT_RATE: "flatRate",
    VALUE_BASED: "valueBased",
    WEIGHT_BASED: "weightBased",
  };
  return { [fieldByType[type] as string]: { id, isActive: row.active === true } };
}

export function normalizeWebPresenceInput(value: unknown, create: boolean) {
  const input = asRecord(value, "Web presence");
  const defaultLocale = String(input.defaultLocale || "")
    .trim()
    .toLowerCase();
  if (create && !defaultLocale) throw badRequest("Default locale is required.");
  if (defaultLocale && !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(defaultLocale)) {
    throw badRequest("Default locale is invalid.");
  }
  const alternateLocales = normalizeStringList(
    input.alternateLocales || [],
    "Alternate locales",
    20,
  ).map((locale) => locale.toLowerCase());
  if (defaultLocale && alternateLocales.includes(defaultLocale)) {
    throw badRequest("Default locale cannot also be an alternate locale.");
  }
  if (!create) {
    const subfolderSuffix = String(input.subfolderSuffix || "")
      .trim()
      .toLowerCase();
    if (
      subfolderSuffix &&
      !/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(subfolderSuffix)
    ) {
      throw badRequest(
        "Subfolder suffix must contain only lowercase ASCII letters, numbers, and hyphens.",
      );
    }
    return {
      ...(defaultLocale ? { defaultLocale } : {}),
      alternateLocales,
      ...(subfolderSuffix ? { subfolderSuffix } : {}),
    };
  }
  const domainId = String(input.domainId || "").trim();
  const subfolderSuffix = String(input.subfolderSuffix || "")
    .trim()
    .toLowerCase();
  if (domainId && subfolderSuffix) {
    throw badRequest("Choose either a domain or a subfolder suffix, not both.");
  }
  if (!domainId && !subfolderSuffix) {
    throw badRequest("Choose a domain or enter a subfolder suffix.");
  }
  if (
    subfolderSuffix &&
    !/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(subfolderSuffix)
  ) {
    throw badRequest(
      "Subfolder suffix must contain only lowercase ASCII letters, numbers, and hyphens.",
    );
  }
  return {
    defaultLocale,
    alternateLocales,
    ...(domainId
      ? { domainId: requireGenericShopifyGid(domainId, "Domain ID") }
      : { subfolderSuffix }),
  };
}

function validateGidList(value: unknown, resource: string, label: string) {
  return normalizeStringList(value || [], label).map((id) => {
    if (!id.startsWith(`gid://shopify/${resource}/`)) {
      throw badRequest(`${label} contains an invalid ${resource} ID.`);
    }
    return id;
  });
}

function regionKey(region: ShopifyMarketRegionInput) {
  return `${region.countryCode}:${region.subdivision || ""}`;
}

function badRequest(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function badGateway(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 502;
  return error;
}

type RawCatalog = ShopifyMarketCatalogSummary;
interface RawWebPresence {
  id: string;
  subfolderSuffix: string | null;
  defaultLocale: { locale: string };
  alternateLocales: Array<{ locale: string }>;
  domain: { id: string; host: string; url: string } | null;
  rootUrls: Array<{ locale: string; url: string }>;
}
interface MarketMutationResult {
  marketCreate: {
    market: { id: string } | null;
    userErrors: GraphqlUserError[];
  };
  marketUpdate: {
    market: { id: string } | null;
    userErrors: GraphqlUserError[];
  };
}
