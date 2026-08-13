import type { H3Event } from "h3";
import type {
  ShopifyMarketCatalogSummary,
  ShopifyMarketCatalogCreateResult,
  ShopifyMarketEditorContext,
  ShopifyMarketLocalizationOverview,
  ShopifyMarketLocalizationResource,
  ShopifyMarketPricingInput,
  ShopifyMarketRegionInput,
  ShopifyMarketShippingOptionInput,
} from "~~/types/shopify-market";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import {
  fetchShopifyMarket,
  normalizeConditionResource,
  normalizeMarketCatalog,
  normalizeMarketDiscount,
  normalizeMarketWebPresence,
} from "./shopify-markets";
import {
  asRecord,
  normalizeCurrencyCode,
  normalizeDutyStrategy,
  normalizeManualRate,
  normalizeMarketRegions,
  normalizeMoney,
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
const MAX_CONTEXT_ITEMS = 250;

const EDITOR_DISCOUNT_FIELDS = `
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

  const [
    catalogResult,
    webPresenceResult,
    discountResult,
    companyLocationResult,
    locationResult,
    channelResult,
    carrierResult,
  ] = await Promise.all([
    fetchEditorCatalogs(context),
    fetchEditorWebPresences(context),
    fetchOptionalEditorResource(context, fetchEditorDiscounts, "discounts"),
    fetchOptionalEditorResource(
      context,
      fetchEditorCompanyLocations,
      "company_locations",
    ),
    fetchOptionalEditorResource(context, fetchEditorLocations, "locations"),
    fetchOptionalEditorResource(context, fetchEditorChannels, "channels"),
    fetchOptionalEditorResource(
      context,
      fetchEditorCarrierServices,
      "carrier_services",
    ),
  ]);

  if (catalogResult.truncated) warnings.push("catalogs_truncated");
  if (webPresenceResult.truncated) warnings.push("web_presences_truncated");
  for (const result of [
    discountResult,
    companyLocationResult,
    locationResult,
    channelResult,
    carrierResult,
  ]) {
    if (result.warning) warnings.push(result.warning);
    if (result.truncatedWarning) warnings.push(result.truncatedWarning);
  }

  return {
    primaryDomain: base.shop.primaryDomain,
    domains: Array.from(
      new Map(
        [
          {
            ...base.shop.primaryDomain,
            primary: true,
            assigned: Boolean(
              webPresenceResult.items.some(
                (presence) => presence.domain?.id === base.shop.primaryDomain.id,
              ),
            ),
          },
          ...webPresenceResult.items
            .filter((presence) => presence.domain)
            .map((presence) => ({
              id: presence.domain!.id,
              host: presence.domain!.host,
              url: presence.domain!.url,
              primary: presence.domain!.id === base.shop.primaryDomain.id,
              assigned: true,
            })),
        ].map((domain) => [domain.id, domain]),
      ).values(),
    ),
    capabilities: {
      companyLocationsAvailable: !companyLocationResult.warning,
      locationsAvailable: !locationResult.warning,
      channelsAvailable: !channelResult.warning,
    },
    locales: base.shopLocales,
    catalogs: catalogResult.items.map(normalizeMarketCatalog),
    discounts: discountResult.items.map(normalizeMarketDiscount),
    webPresences: webPresenceResult.items.map(normalizeMarketWebPresence),
    conditionOptions: {
      companyLocations: companyLocationResult.items.map(normalizeConditionResource),
      locations: locationResult.items.map(normalizeConditionResource),
      channels: channelResult.items.map(normalizeConditionResource),
    },
    carrierServices: carrierResult.items,
    warnings,
  };
}

async function fetchOptionalEditorResource<T>(
  context: MarketRequestContext,
  loader: (request: MarketRequestContext) => Promise<{
    items: T[];
    truncated: boolean;
  }>,
  warningPrefix: string,
) {
  try {
    const result = await loader(context);
    return {
      ...result,
      warning: null,
      truncatedWarning: result.truncated ? `${warningPrefix}_truncated` : null,
    };
  } catch {
    return {
      items: [] as T[],
      truncated: false,
      warning: `${warningPrefix}_unavailable`,
      truncatedWarning: null,
    };
  }
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

async function fetchEditorDiscounts(context: MarketRequestContext) {
  const items: RawDiscountNode[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;

  do {
    const data: {
      discountNodes: {
        nodes: RawDiscountNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql({
      ...context,
      operationName: "MarketEditorDiscounts",
      query: `#graphql
        query MarketEditorDiscounts($first: Int!, $after: String) {
          discountNodes(first: $first, after: $after, sortKey: UPDATED_AT) {
            nodes { ${EDITOR_DISCOUNT_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    items.push(...data.discountNodes.nodes);
    hasNextPage = data.discountNodes.pageInfo.hasNextPage;
    after = data.discountNodes.pageInfo.endCursor;
  } while (hasNextPage && after && items.length < MAX_CONTEXT_ITEMS);

  return { items, truncated: hasNextPage };
}

async function fetchEditorCompanyLocations(context: MarketRequestContext) {
  return fetchEditorConditionResources(context, {
    operationName: "MarketEditorCompanyLocations",
    field: "companyLocations",
    selection: "id name company { name }",
  });
}

async function fetchEditorLocations(context: MarketRequestContext) {
  return fetchEditorConditionResources(context, {
    operationName: "MarketEditorLocations",
    field: "locations",
    selection: "id name isActive",
    arguments: "includeInactive: true",
  });
}

async function fetchEditorChannels(context: MarketRequestContext) {
  return fetchEditorConditionResources(context, {
    operationName: "MarketEditorChannels",
    field: "channels",
    selection: "id accountName specificationHandle",
  });
}

async function fetchEditorConditionResources(
  context: MarketRequestContext,
  options: {
    operationName: string;
    field: "companyLocations" | "locations" | "channels";
    selection: string;
    arguments?: string;
  },
) {
  const items: RawConditionResource[] = [];
  let after: string | null = null;
  let hasNextPage: boolean;
  const extraArguments = options.arguments ? `, ${options.arguments}` : "";

  do {
    const data: Record<
      string,
      {
        nodes: RawConditionResource[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      }
    > = await callShopifyGraphql({
      ...context,
      operationName: options.operationName,
      query: `#graphql
        query ${options.operationName}($first: Int!, $after: String) {
          ${options.field}(first: $first, after: $after${extraArguments}) {
            nodes { ${options.selection} }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: {
        first: Math.min(CONTEXT_PAGE_SIZE, MAX_CONTEXT_ITEMS - items.length),
        after,
      },
    });
    const connection = data[options.field];
    if (!connection) throw badGateway(`Missing ${options.field} editor context.`);
    items.push(...connection.nodes);
    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
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
  const handle = String(input.handle || "").trim();
  if (handle && !/^[A-Za-z0-9-]{1,255}$/.test(handle)) {
    throw badRequest("Market handle can contain only letters, numbers, and hyphens.");
  }

  const conditions = normalizeMarketConditionsInput(
    input.conditions || { regions: input.regions },
    false,
  );
  const marketInput: Record<string, unknown> = {
    name,
    status,
    makeDuplicateUniqueMarketsDraft: input.makeDuplicateUniqueMarketsDraft === true,
    ...(Object.keys(conditions).length ? { conditions } : {}),
    ...(handle ? { handle } : {}),
  };

  const catalogIds = validateGidList(
    input.catalogIds,
    ["Catalog", "MarketCatalog"],
    "Catalogs",
  );
  const discountIds = validateGidList(input.discountIds, "DiscountNode", "Discounts");
  const webPresenceIds = validateGidList(
    input.webPresenceIds,
    "MarketWebPresence",
    "Web presences",
  );
  if (catalogIds.length) marketInput.catalogs = catalogIds;
  if (discountIds.length) marketInput.discounts = discountIds;
  if (webPresenceIds.length) marketInput.webPresences = webPresenceIds;

  const currencyInput =
    input.currency ||
    (input.baseCurrency
      ? {
          baseCurrency: input.baseCurrency,
          localCurrencies: input.localCurrencies,
          roundingEnabled: input.roundingEnabled,
        }
      : null);
  if (currencyInput) {
    const currency = asRecord(currencyInput, "Currency settings");
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

  if (input.priceInclusions) {
    const prices = asRecord(input.priceInclusions, "Price inclusion settings");
    marketInput.priceInclusions = {
      adaptivePricingEnabled: prices.adaptivePricingEnabled === true,
      dutiesPricingStrategy: normalizeDutyStrategy(prices.dutiesPricingStrategy),
      taxPricingStrategy: normalizeTaxStrategy(prices.taxPricingStrategy),
    } satisfies ShopifyMarketPricingInput["priceInclusions"];
  }

  if (input.delivery) {
    const delivery = asRecord(input.delivery, "Delivery settings");
    const mode = String(delivery.mode || "INHERIT").toUpperCase();
    if (mode !== "INHERIT") {
      if (mode !== "ENABLED" && mode !== "DISABLED") {
        throw badRequest("Invalid shipping mode.");
      }
      const options = Array.isArray(delivery.options)
        ? delivery.options.map(normalizeShippingOption)
        : [];
      marketInput.delivery = {
        shipping: {
          isEnabled: mode === "ENABLED",
          optionDefinitions:
            mode === "ENABLED"
              ? options.map(buildShippingOptionCreateInput)
              : undefined,
        },
      };
    }
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

export async function deleteShopifyMarket(
  context: MarketRequestContext,
  marketId: unknown,
) {
  const id = requireMarketId(marketId);
  const data = await callShopifyGraphql<{
    marketDelete: {
      deletedId: string | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "DeleteManagedMarket",
    retryTransport: false,
    query: `#graphql
        mutation DeleteManagedMarket($id: ID!) {
          marketDelete(id: $id) {
            deletedId
            userErrors { field message code }
          }
        }
      `,
    variables: { id },
  });
  assertNoGraphqlUserErrors(
    data.marketDelete.userErrors,
    "Failed to delete the market.",
  );
  if (data.marketDelete.deletedId !== id) {
    throw badGateway("Shopify did not confirm the deleted market ID.");
  }
  return { id };
}

export async function createMarketCatalog(
  context: MarketRequestContext,
  marketId: unknown,
  rawInput: unknown,
): Promise<ShopifyMarketCatalogCreateResult> {
  const id = requireMarketId(marketId);
  const input = asRecord(rawInput, "Catalog input");
  const title = String(input.title || "").trim();
  if (!title || title.length > 255) {
    throw badRequest("Catalog title is required and must be at most 255 characters.");
  }
  const status = String(input.status || "DRAFT").toUpperCase();
  if (!new Set(["ACTIVE", "DRAFT"]).has(status)) {
    throw badRequest("Catalog status must be ACTIVE or DRAFT.");
  }
  const shouldCreatePriceList = input.createPriceList === true;
  const priceListName = String(input.priceListName || "").trim();
  const priceListCurrency = shouldCreatePriceList
    ? normalizeCurrencyCode(input.currency)
    : "";
  const adjustmentValue = Number(input.adjustmentValue ?? 0);
  if (shouldCreatePriceList && (!priceListName || priceListName.length > 255)) {
    throw badRequest("Price list name is required and must be at most 255 characters.");
  }
  if (
    shouldCreatePriceList &&
    (!Number.isFinite(adjustmentValue) || adjustmentValue < -100)
  ) {
    throw badRequest(
      "Price adjustment must be a number greater than or equal to -100.",
    );
  }

  const catalogData = await callShopifyGraphql<{
    catalogCreate: { catalog: RawCatalog | null; userErrors: GraphqlUserError[] };
  }>({
    ...context,
    operationName: "CreateMarketCatalog",
    retryTransport: false,
    query: `#graphql
      mutation CreateMarketCatalog($input: CatalogCreateInput!) {
        catalogCreate(input: $input) {
          catalog {
            id title status publication { id autoPublish }
            priceList { id name currency }
          }
          userErrors { field message code }
        }
      }
    `,
    variables: {
      input: { title, status, context: { marketIds: [id] } },
    },
  });
  assertNoGraphqlUserErrors(
    catalogData.catalogCreate.userErrors,
    "Failed to create the market catalog.",
  );
  const catalog = catalogData.catalogCreate.catalog;
  if (!catalog) throw badGateway("Shopify did not return the created catalog.");

  const warnings: string[] = [];
  let priceListCreated = false;
  if (shouldCreatePriceList) {
    const adjustmentType =
      adjustmentValue < 0 ? "PERCENTAGE_DECREASE" : "PERCENTAGE_INCREASE";
    try {
      const priceListData = await callShopifyGraphql<{
        priceListCreate: {
          priceList: { id: string; name: string; currency: string } | null;
          userErrors: GraphqlUserError[];
        };
      }>({
        ...context,
        operationName: "CreateMarketPriceList",
        retryTransport: false,
        query: `#graphql
          mutation CreateMarketPriceList($input: PriceListCreateInput!) {
            priceListCreate(input: $input) {
              priceList { id name currency }
              userErrors { field message code }
            }
          }
        `,
        variables: {
          input: {
            catalogId: catalog.id,
            name: priceListName,
            currency: priceListCurrency,
            parent: {
              adjustment: {
                type: adjustmentType,
                value: Math.abs(adjustmentValue),
              },
            },
          },
        },
      });
      assertNoGraphqlUserErrors(
        priceListData.priceListCreate.userErrors,
        "The catalog was created, but its price list could not be created.",
      );
      if (!priceListData.priceListCreate.priceList) {
        throw badGateway("Shopify did not return the created price list.");
      }
      catalog.priceList = priceListData.priceListCreate.priceList;
      priceListCreated = true;
    } catch {
      warnings.push("price_list_create_failed");
    }
  }

  return {
    catalog: normalizeMarketCatalog(catalog),
    priceListCreated,
    warnings,
  };
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

export async function updateMarketConditions(
  context: MarketRequestContext,
  marketId: unknown,
  currentValue: unknown,
  nextValue: unknown,
  makeDuplicatesDraft: unknown,
) {
  const current = normalizeMarketConditionsInput(currentValue, true);
  const next = normalizeMarketConditionsInput(nextValue, true);
  const conditionsToAdd: Record<string, unknown> = {};
  const conditionsToDelete: Record<string, unknown> = {};

  const currentRegions = getConditionRegions(current);
  const nextRegions = getConditionRegions(next);
  const currentRegionMap = new Map(
    currentRegions.map((region) => [regionKey(region), region]),
  );
  const nextRegionMap = new Map(
    nextRegions.map((region) => [regionKey(region), region]),
  );
  const regionAdditions = nextRegions.filter(
    (region) => !currentRegionMap.has(regionKey(region)),
  );
  const regionDeletions = currentRegions.filter(
    (region) => !nextRegionMap.has(regionKey(region)),
  );
  if (regionAdditions.length) {
    conditionsToAdd.regionsCondition = { regions: regionAdditions };
  }
  if (regionDeletions.length) {
    conditionsToDelete.regionsCondition = { regions: regionDeletions };
  }

  for (const key of [
    "companyLocationsCondition",
    "locationsCondition",
    "channelsCondition",
  ] as const) {
    const before = current[key];
    const after = next[key];
    if (stableConditionValue(before) === stableConditionValue(after)) continue;
    if (before) conditionsToDelete[key] = before;
    if (after) conditionsToAdd[key] = after;
  }

  if (!Object.keys(conditionsToAdd).length && !Object.keys(conditionsToDelete).length) {
    throw badRequest("No buyer-condition changes were detected.");
  }

  return updateMarket(
    context,
    marketId,
    {
      makeDuplicateUniqueMarketsDraft: makeDuplicatesDraft === true,
      conditions: {
        ...(Object.keys(conditionsToAdd).length ? { conditionsToAdd } : {}),
        ...(Object.keys(conditionsToDelete).length ? { conditionsToDelete } : {}),
      },
    },
    "update market conditions",
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
    ["Catalog", "MarketCatalog"],
    "Catalogs to add",
  );
  const catalogsToDelete = validateGidList(
    input.catalogsToDelete,
    ["Catalog", "MarketCatalog"],
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
  const discountsToAdd = validateGidList(
    input.discountsToAdd,
    "DiscountNode",
    "Discounts to add",
  );
  const discountsToDelete = validateGidList(
    input.discountsToDelete,
    "DiscountNode",
    "Discounts to remove",
  );
  if (
    !catalogsToAdd.length &&
    !catalogsToDelete.length &&
    !webPresencesToAdd.length &&
    !webPresencesToDelete.length &&
    !discountsToAdd.length &&
    !discountsToDelete.length
  ) {
    throw badRequest("No assignment changes were detected.");
  }
  return updateMarket(
    context,
    marketId,
    {
      catalogsToAdd,
      catalogsToDelete,
      discountsToAdd,
      discountsToDelete,
      webPresencesToAdd,
      webPresencesToDelete,
    },
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
    ? input.updateOptions.map(buildShippingOptionUpdateInput)
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

export async function deleteWebPresence(
  context: MarketRequestContext,
  presenceId: unknown,
) {
  const id = requireGenericShopifyGid(presenceId, "Web presence ID");
  if (!id.startsWith("gid://shopify/MarketWebPresence/")) {
    throw badRequest("Web presence ID has the wrong resource type.");
  }
  const data = await callShopifyGraphql<{
    webPresenceDelete: {
      deletedId: string | null;
      userErrors: GraphqlUserError[];
    };
  }>({
    ...context,
    operationName: "DeleteMarketWebPresence",
    retryTransport: false,
    query: `#graphql
      mutation DeleteMarketWebPresence($id: ID!) {
        webPresenceDelete(id: $id) {
          deletedId
          userErrors { field message code }
        }
      }
    `,
    variables: { id },
  });
  assertNoGraphqlUserErrors(
    data.webPresenceDelete.userErrors,
    "Failed to delete the web presence.",
  );
  if (!data.webPresenceDelete.deletedId) {
    throw badGateway("Shopify did not return the deleted web presence ID.");
  }
  return { id: data.webPresenceDelete.deletedId };
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

const MARKET_LOCALIZABLE_RESOURCE_TYPES = new Set(["METAFIELD", "METAOBJECT"]);
const TRANSLATABLE_RESOURCE_TYPES = new Set([
  "ARTICLE",
  "ARTICLE_IMAGE",
  "BLOG",
  "COLLECTION",
  "COLLECTION_IMAGE",
  "DELIVERY_METHOD_DEFINITION",
  "EMAIL_TEMPLATE",
  "FILTER",
  "LINK",
  "MEDIA_IMAGE",
  "MENU",
  "METAFIELD",
  "METAOBJECT",
  "ONLINE_STORE_THEME",
  "ONLINE_STORE_THEME_APP_EMBED",
  "ONLINE_STORE_THEME_JSON_TEMPLATE",
  "ONLINE_STORE_THEME_LOCALE_CONTENT",
  "ONLINE_STORE_THEME_SECTION_GROUP",
  "ONLINE_STORE_THEME_SETTINGS_CATEGORY",
  "ONLINE_STORE_THEME_SETTINGS_DATA_SECTIONS",
  "PACKING_SLIP_TEMPLATE",
  "PAGE",
  "PAYMENT_GATEWAY",
  "PRODUCT",
  "PRODUCT_OPTION",
  "PRODUCT_OPTION_VALUE",
  "SELLING_PLAN",
  "SELLING_PLAN_GROUP",
  "SHOP",
  "SHOP_POLICY",
]);

export async function fetchMarketLocalizationOverview(
  context: MarketRequestContext,
  marketIdValue: unknown,
  resourceTypeValue: unknown,
  localeValue: unknown,
): Promise<ShopifyMarketLocalizationOverview> {
  const marketId = requireMarketId(marketIdValue);
  const resourceType = String(resourceTypeValue || "")
    .trim()
    .toUpperCase();
  const locale = String(localeValue || "")
    .trim()
    .toLowerCase();
  if (locale && !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(locale)) {
    throw badRequest("Locale must be a valid Shopify locale code.");
  }
  const allowedTypes = locale
    ? TRANSLATABLE_RESOURCE_TYPES
    : MARKET_LOCALIZABLE_RESOURCE_TYPES;
  if (!allowedTypes.has(resourceType)) {
    throw badRequest("Resource type is not supported for this localization mode.");
  }

  const items: ShopifyMarketLocalizationOverview["items"] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  while (hasNextPage && items.length < 250) {
    if (locale) {
      const data: {
        translatableResources: {
          nodes: Array<{
            resourceId: string;
            translatableContent: Array<{ key: string; value: string | null }>;
            translations: Array<{
              key: string;
              value: string;
              outdated: boolean;
            }>;
          }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await callShopifyGraphql({
        ...context,
        operationName: "MarketTranslationResources",
        query: `#graphql
          query MarketTranslationResources(
            $resourceType: TranslatableResourceType!
            $locale: String!
            $marketId: ID!
            $after: String
          ) {
            translatableResources(first: 100, after: $after, resourceType: $resourceType) {
              nodes {
                resourceId
                translatableContent(marketId: $marketId) { key value }
                translations(locale: $locale, marketId: $marketId) {
                  key value outdated
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
        variables: { resourceType, locale, marketId, after: cursor },
      });
      items.push(
        ...data.translatableResources.nodes.map((node) => ({
          resourceId: node.resourceId,
          fieldCount: node.translatableContent.length,
          localizedCount: node.translations.length,
          outdatedCount: node.translations.filter((item) => item.outdated).length,
          preview: buildLocalizationPreview(node.translatableContent),
        })),
      );
      hasNextPage = data.translatableResources.pageInfo.hasNextPage;
      cursor = data.translatableResources.pageInfo.endCursor;
      if (hasNextPage && !cursor) break;
      continue;
    }

    const data: {
      marketLocalizableResources: {
        nodes: Array<{
          resourceId: string;
          marketLocalizableContent: Array<{ key: string; value: string | null }>;
          marketLocalizations: Array<{
            key: string;
            value: string | null;
            outdated: boolean;
          }>;
        }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await callShopifyGraphql({
      ...context,
      operationName: "MarketLocalizableResources",
      query: `#graphql
        query MarketLocalizableResources(
          $resourceType: MarketLocalizableResourceType!
          $marketId: ID!
          $after: String
        ) {
          marketLocalizableResources(first: 100, after: $after, resourceType: $resourceType) {
            nodes {
              resourceId
              marketLocalizableContent { key value }
              marketLocalizations(marketId: $marketId) { key value outdated }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      variables: { resourceType, marketId, after: cursor },
    });
    items.push(
      ...data.marketLocalizableResources.nodes.map((node) => ({
        resourceId: node.resourceId,
        fieldCount: node.marketLocalizableContent.length,
        localizedCount: node.marketLocalizations.length,
        outdatedCount: node.marketLocalizations.filter((item) => item.outdated).length,
        preview: buildLocalizationPreview(node.marketLocalizableContent),
      })),
    );
    hasNextPage = data.marketLocalizableResources.pageInfo.hasNextPage;
    cursor = data.marketLocalizableResources.pageInfo.endCursor;
    if (hasNextPage && !cursor) break;
  }

  return {
    mode: locale ? "TRANSLATION" : "MARKET_LOCALIZATION",
    resourceType,
    locale: locale || null,
    items: items.slice(0, 250),
    truncated: hasNextPage || items.length > 250,
  };
}

function buildLocalizationPreview(
  content: Array<{ key: string; value: string | null }>,
) {
  const values = content
    .map((item) =>
      String(item.value || "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return (values[0] || content.map((item) => item.key).join(", ")).slice(0, 140);
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
  return {
    [fieldByType[type] as string]: {
      id,
      isActive: row.active === true,
    },
  };
}

export function buildShippingOptionUpdateInput(value: unknown) {
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
  const currency = normalizeCurrencyCode(row.currency);
  const freeDeliveryMinimumValue = normalizeMoney(
    row.freeDeliveryMinimumValue,
    "Free-shipping threshold",
    true,
  );
  const common: Record<string, unknown> = {
    id,
    isActive: row.active === true,
    currency,
    description: String(row.description || "").trim(),
    freeDeliveryMinimumValue: freeDeliveryMinimumValue
      ? { amount: freeDeliveryMinimumValue, currencyCode: currency }
      : null,
  };
  if (type !== "CARRIER_CALCULATED") {
    const name = String(row.name || "").trim();
    if (!name) throw badRequest("Shipping option name is required.");
    common.name = name;
  }

  const rateGroupId = String(row.rateGroupId || "").trim();
  const rates = Array.isArray(row.rates) ? row.rates : [];
  if (rateGroupId) {
    const groupId = requireGenericShopifyGid(rateGroupId, "Shipping rate group ID");
    const groupResourceByType: Record<string, string> = {
      CARRIER_CALCULATED: "DeliveryCarrierCalculatedRateGroup",
      FLAT_RATE: "DeliveryFlatRateGroup",
      VALUE_BASED: "DeliveryValueBasedRateGroup",
      WEIGHT_BASED: "DeliveryWeightBasedRateGroup",
    };
    if (!groupId.startsWith(`gid://shopify/${groupResourceByType[type]}/`)) {
      throw badRequest("Shipping rate group ID does not match its option type.");
    }
    if (type === "FLAT_RATE" && rates[0]) {
      const rate = asRecord(rates[0], "Flat shipping rate");
      common.rateGroupsToUpdate = [
        {
          id: groupId,
          rate: {
            price: {
              amount: normalizeMoney(rate.price, "Shipping price"),
              currencyCode: currency,
            },
          },
        },
      ];
    } else if (type === "VALUE_BASED" && rates.length) {
      common.rateGroupsToUpdate = [
        {
          id: groupId,
          ratesToUpdate: rates.map((value, index) => {
            const rate = asRecord(value, `Value rate ${index + 1}`);
            const minimum = normalizeMoney(rate.minimum, "Minimum tier value") || "0";
            const maximum = normalizeMoney(rate.maximum, "Maximum tier value", true);
            if (maximum && Number(maximum) < Number(minimum)) {
              throw badRequest(
                "Maximum tier value must be greater than or equal to the minimum.",
              );
            }
            const rateId = requireGenericShopifyGid(rate.id, "Value rate ID");
            if (!rateId.startsWith("gid://shopify/DeliveryValueBasedRate/")) {
              throw badRequest("Value rate ID has the wrong resource type.");
            }
            return {
              id: rateId,
              minValue: { amount: minimum, currencyCode: currency },
              maxValue: maximum ? { amount: maximum, currencyCode: currency } : null,
              price: {
                amount: normalizeMoney(rate.price, "Shipping price"),
                currencyCode: currency,
              },
            };
          }),
        },
      ];
    } else if (type === "WEIGHT_BASED" && rates.length) {
      common.rateGroupsToUpdate = [
        {
          id: groupId,
          ratesToUpdate: rates.map((value, index) => {
            const rate = asRecord(value, `Weight rate ${index + 1}`);
            const unit = String(rate.weightUnit || "KILOGRAMS").toUpperCase();
            if (!new Set(["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"]).has(unit)) {
              throw badRequest("Invalid shipping weight unit.");
            }
            const minimum = normalizeMoney(rate.minimum, "Minimum tier weight") || "0";
            const maximum = normalizeMoney(rate.maximum, "Maximum tier weight", true);
            if (maximum && Number(maximum) < Number(minimum)) {
              throw badRequest(
                "Maximum tier weight must be greater than or equal to the minimum.",
              );
            }
            const rateId = requireGenericShopifyGid(rate.id, "Weight rate ID");
            if (!rateId.startsWith("gid://shopify/DeliveryWeightBasedRate/")) {
              throw badRequest("Weight rate ID has the wrong resource type.");
            }
            return {
              id: rateId,
              minWeight: { value: Number(minimum), unit },
              maxWeight: maximum ? { value: Number(maximum), unit } : null,
              price: {
                amount: normalizeMoney(rate.price, "Shipping price"),
                currencyCode: currency,
              },
            };
          }),
        },
      ];
    } else if (type === "CARRIER_CALCULATED") {
      const adjustment = row.percentageAdjustment;
      const percentageAdjustment =
        adjustment === null || adjustment === undefined || adjustment === ""
          ? null
          : Number(adjustment);
      if (
        percentageAdjustment !== null &&
        (!Number.isInteger(percentageAdjustment) ||
          percentageAdjustment < -100 ||
          percentageAdjustment > 1000)
      ) {
        throw badRequest("Carrier adjustment must be an integer from -100 to 1000.");
      }
      common.rateGroupToUpdate = {
        ...(row.carrierServiceId
          ? {
              carrierServiceId: requireGenericShopifyGid(
                row.carrierServiceId,
                "Carrier service ID",
              ),
            }
          : {}),
        percentageAdjustment,
      };
    }
  } else if (
    type === "CARRIER_CALCULATED" &&
    (row.carrierServiceId ||
      (row.percentageAdjustment !== null &&
        row.percentageAdjustment !== undefined &&
        row.percentageAdjustment !== ""))
  ) {
    throw badRequest("Carrier shipping option is missing its rate group ID.");
  }

  return { [fieldByType[type] as string]: common };
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
  const normalizedDomainId = domainId
    ? requireGenericShopifyGid(domainId, "Domain ID")
    : "";
  if (normalizedDomainId && !normalizedDomainId.startsWith("gid://shopify/Domain/")) {
    throw badRequest("Domain ID has the wrong Shopify resource type.");
  }
  return {
    defaultLocale,
    alternateLocales,
    ...(normalizedDomainId ? { domainId: normalizedDomainId } : { subfolderSuffix }),
  };
}

function validateGidList(value: unknown, resource: string | string[], label: string) {
  const resources = Array.isArray(resource) ? resource : [resource];
  return normalizeStringList(value || [], label).map((id) => {
    if (!resources.some((item) => id.startsWith(`gid://shopify/${item}/`))) {
      throw badRequest(`${label} contains an unsupported Shopify resource ID.`);
    }
    return id;
  });
}

function normalizeMarketConditionsInput(
  value: unknown,
  allowEmpty: boolean,
): Record<string, Record<string, unknown>> {
  if ((value === null || value === undefined) && allowEmpty) return {};
  const input = asRecord(value, "Market conditions");
  const result: Record<string, Record<string, unknown>> = {};

  if (input.regions !== undefined) {
    const regions = normalizeMarketRegions(input.regions);
    if (regions.length) result.regionsCondition = { regions };
  }
  if (input.companyLocations !== undefined) {
    result.companyLocationsCondition = normalizeResourceConditionInput(
      input.companyLocations,
      "Company location condition",
      "companyLocationIds",
      "CompanyLocation",
    );
  }
  if (input.locations !== undefined) {
    result.locationsCondition = normalizeResourceConditionInput(
      input.locations,
      "Retail location condition",
      "locationIds",
      "Location",
    );
  }
  if (input.channels !== undefined) {
    const channelInput = asRecord(input.channels, "Channel condition");
    const channelIds = validateGidList(
      channelInput.ids,
      "Channel",
      "Channel condition",
    );
    if (!channelIds.length) {
      throw badRequest("Channel condition requires at least one channel.");
    }
    result.channelsCondition = { channelIds };
  }

  return result;
}

function normalizeResourceConditionInput(
  value: unknown,
  label: string,
  idField: "companyLocationIds" | "locationIds",
  resource: "CompanyLocation" | "Location",
) {
  const input = asRecord(value, label);
  const applicationLevel = String(input.applicationLevel || "SPECIFIED").toUpperCase();
  if (applicationLevel !== "ALL" && applicationLevel !== "SPECIFIED") {
    throw badRequest(`${label} application level must be ALL or SPECIFIED.`);
  }
  if (applicationLevel === "ALL") return { applicationLevel: "ALL" };
  const ids = validateGidList(input.ids, resource, label);
  if (!ids.length) throw badRequest(`${label} requires at least one selection.`);
  return { applicationLevel: "SPECIFIED", [idField]: ids };
}

function getConditionRegions(conditions: Record<string, Record<string, unknown>>) {
  const regions = conditions.regionsCondition?.regions;
  return Array.isArray(regions) ? (regions as ShopifyMarketRegionInput[]) : [];
}

function stableConditionValue(value: unknown) {
  if (!value) return "";
  const input = value as Record<string, unknown>;
  const normalized = Object.fromEntries(
    Object.entries(input).map(([key, item]) => [
      key,
      Array.isArray(item) ? [...item].sort() : item,
    ]),
  );
  return JSON.stringify(normalized);
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
interface RawDiscountNode {
  id: string;
  discount: {
    __typename: string;
    title?: string | null;
    status?: string | null;
    codes?: { nodes?: Array<{ code: string }> } | null;
  };
}
interface RawConditionResource {
  id: string;
  name?: string | null;
  accountName?: string | null;
  specificationHandle?: string | null;
  isActive?: boolean | null;
  company?: { name?: string | null } | null;
}
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
