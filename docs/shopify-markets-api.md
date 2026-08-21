# Shopify Markets API integration (Admin GraphQL 2026-07)

The app pins `NUXT_ADMIN_API_VERSION=2026-07`. Store > Markets is designed
against the 2026-07 GraphQL Admin schema, not the legacy Markets model or REST
Admin API.

## Official sources

- [`Market` and `markets`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Market)
- [`MarketConditionsInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MarketConditionsInput)
  and [`MarketCreateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MarketCreateInput)
- [`marketCreate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketCreate),
  [`marketUpdate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketUpdate),
  [`marketDelete`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketDelete),
  and [`MarketUpdateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MarketUpdateInput)
- [`catalogCreate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/catalogCreate)
  and [`priceListCreate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/priceListCreate)
- [`marketsResolvedValues`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/marketsResolvedValues)
- [Subdivision markets guide](https://shopify.dev/docs/apps/build/markets/subdivision-markets)
- [`MarketWebPresence`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MarketWebPresence)
  and [`webPresenceDelete`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/webPresenceDelete)
- [`ShippingConfigurationUpdateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/ShippingConfigurationUpdateInput)
  and [`DeliveryOptionDefinitionUpdateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DeliveryOptionDefinitionUpdateInput)
  and [market-driven shipping changelog](https://shopify.dev/changelog/market-driven-delivery-profiles-admin-api)
- [`marketLocalizableResource`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/marketLocalizableResource),
  [`marketLocalizableResources`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/marketLocalizableResources),
  [`translatableResources`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/translatableResources),
  [`marketLocalizationsRegister`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketLocalizationsRegister),
  and [`translationsRegister`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/translationsRegister)
- [GraphQL Admin API calculated query cost and the 1,000-point single-query limit](https://shopify.dev/docs/api/usage/limits#graphql-admin-api-rate-limits)
  and [cursor pagination](https://shopify.dev/docs/api/usage/pagination-graphql)

## Authentication and scopes

Reading Markets requires `read_markets`; mutations require both `read_markets`
and `write_markets`. Catalog reads also require `read_products`. Locale discovery
uses `read_locales` or `read_markets_home`. Localized content requires
`read_translations` and `write_translations`. Discount assignment requires
`read_discounts`; B2B company-location and retail-location pickers depend on the
corresponding company and location scopes. Optional editor resources fail
independently and surface an actionable warning instead of hiding the market.

Changing configured scopes does not expand an already-issued token. Stores
connected before these scopes were added must regenerate their token. Every app
route remains server-side and uses the existing Shopify GraphQL transport,
including per-store SOCKS proxy support, pinned API version, cost throttling,
safe transport retry policy, and sanitized errors.

## Implemented API surface

| App route                                 | Shopify operation                                     | Purpose                                                                                                |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /api/market/all`                    | `markets`, then concurrent bounded `market(id)` reads | Filter by name, status, market type, and condition type; page up to 250 IDs and load editor summaries. |
| `POST /api/market/resolve`                | `marketsResolvedValues`                               | Resolve effective currency, tax/duty inclusion, catalogs, and URLs for a buyer country.                |
| `POST /api/market/context`                | Resource connections                                  | Load locales, catalogs, discounts, web presences, condition resources, primary domain, and carriers.   |
| `POST /api/market/create`                 | `marketCreate`                                        | Create a complete market with conditions, pricing, assignments, delivery, status, and conflict policy. |
| `POST /api/market/delete`                 | `marketDelete`                                        | Delete a non-primary market after explicit destructive confirmation.                                   |
| `POST /api/market/catalog/create`         | `catalogCreate`, optional `priceListCreate`           | Create and assign a MARKET catalog, optionally with its first price list.                              |
| `POST /api/market/status`                 | `marketUpdate`                                        | Change `Market.status` between `ACTIVE` and `DRAFT`.                                                   |
| `POST /api/market/identity`               | `marketUpdate`                                        | Update name and handle.                                                                                |
| `POST /api/market/regions`                | `marketUpdate.conditions`                             | Diff region conditions into `conditionsToAdd` and `conditionsToDelete`.                                |
| `POST /api/market/conditions`             | `marketUpdate.conditions`                             | Diff region, B2B company-location, retail-location, and channel conditions.                            |
| `POST /api/market/pricing`                | `marketUpdate`                                        | Update or remove currency settings and price inclusions.                                               |
| `POST /api/market/assignments`            | `marketUpdate`                                        | Associate or dissociate catalogs, eligible discounts, and web presences.                               |
| `POST /api/market/shipping`               | `marketUpdate.delivery`                               | Inherit, disable, enable, create, fully edit, or remove 2026-07 shipping options.                      |
| `POST /api/market/web-presence/create`    | `webPresenceCreate`                                   | Create a localized domain or subfolder URL strategy.                                                   |
| `POST /api/market/web-presence/update`    | `webPresenceUpdate`                                   | Update locales and, for an existing subfolder presence, its suffix.                                    |
| `POST /api/market/web-presence/delete`    | `webPresenceDelete`                                   | Delete a web presence after explicit destructive confirmation.                                         |
| `POST /api/market/localization/read`      | `marketLocalizableResource`/`translatableResource`    | Load source content, digest, current market value, and `outdated`.                                     |
| `POST /api/market/localization/resources` | `marketLocalizableResources`/`translatableResources`  | Browse up to 250 resources of a selected type with localization progress.                              |
| `POST /api/market/localization/save`      | `marketLocalizationsRegister`/`translationsRegister`  | Save digest-protected market content or locale translations.                                           |

## Contract decisions

### Buyer conditions and subdivisions

`Market.regions` is deprecated and can omit `MarketRegionSubdivision`. Reads use
`market.conditions.regionsCondition.regions` and branch on `__typename`.
Subdivision conditions use `{countryCode, subdivision}` in
`MarketConditionsRegionInput`. Updates calculate a diff and send
`conditionsToAdd`/`conditionsToDelete`; deprecated `marketRegionsCreate/Delete`
are not used.

The editor also reads and updates `companyLocationsCondition`,
`locationsCondition`, and `channelsCondition`. Company and retail conditions
support both `ALL` and `SPECIFIED`; the channel input accepts explicit channel
IDs. Condition updates replace only changed groups through a single explicit
diff. Editing is locked if any condition is truncated, preventing accidental
replacement from partial data.

Subdivision markets support market-driven shipping first in the 2026-07
rollout. Shopify documents catalog, discount, theme contextualization, and
market metafield limitations. The editor shows a feature notice and disables
catalog association changes when a subdivision is present.

### Status and safe creation

`Market.status` replaces deprecated `enabled`. Creation defaults to `DRAFT` and
enables `makeDuplicateUniqueMarketsDraft` by default, so an overlap does not
silently leave multiple unique markets active. Status and condition changes are
confirmed independently.

### Currency and price inclusions

The editor uses `marketUpdate.currencySettings`; deprecated
`marketCurrencySettingsUpdate` is not used. A manual rate cannot be combined
with local currencies. Removing market-level currency or price-inclusion
settings requires confirmation. Adaptive pricing is labeled Managed Markets
only because Shopify can force compatible tax, duty, and delivery-duty states.

### Web presence

Reads use plural `Market.webPresences` and effective `rootUrls`; legacy singular
fields and `marketWebPresence*` mutations are not used. `WebPresenceCreateInput`
accepts either `domainId` or `subfolderSuffix`, never both.
`WebPresenceUpdateInput` does not accept `domainId`, so the UI locks the routing
type after creation. A shared-presence warning is shown because editing one can
change URLs for several markets. Deletion uses the current `webPresenceDelete`
mutation, never deprecated `marketWebPresenceDelete`, and requires confirmation.

### Market-driven shipping

`Market.delivery.shipping === null` means inheritance. `isEnabled: false` is
different: it hides all shipping options for the market, including app-managed
ones. The UI preserves three explicit modes: inherit, enabled, and disabled.

Custom mode supports exactly one of `flatRate`, `valueBased`, `weightBased`, or
`carrierCalculated` per new option. Value and weight rate groups include the
required `conditions: {}` when no collection/location filter is selected.
Carrier percentage adjustments are integers. Tier maxima must be greater than
or equal to minima. Existing concrete option IDs can be activated, deactivated,
or deleted; they can also update buyer-facing metadata, currency,
free-shipping thresholds, flat/tier rates, and carrier adjustments. New options
are queued and sent in one confirmed mutation. Carrier updates use Shopify's
singular `rateGroupToUpdate`; the other option types use `rateGroupsToUpdate`.

### Catalogs and discounts

The Markets workspace associates existing `MARKET` catalogs and shows whether a
catalog has a publication and price list. It can create a catalog already scoped
to the current market and optionally create its initial price list. Product
publication and price-list item maintenance remain explicit product workflows
because they can change assortment or variant pricing outside one market edit.
Discounts are read from `Market.discounts`, displayed with `discountsCount`, and
assigned with `discountsToAdd`/`discountsToDelete`.

### Localized content

Shopify exposes two distinct models. METAFIELD and METAOBJECT market
localizations use `marketLocalizableResource` and
`marketLocalizationsRegister`. Product, collection, page, and other translated
resources use `translatableResource` and `translationsRegister` with a
`marketId`. The overview uses the plural connections and paginates each selected
resource type up to 250 resources; this replaces the former GID-only discovery
flow while preserving direct GID entry. Both write models require the current
source digest. The UI loads first, displays `outdated`, disables fields without
a digest, saves, and refreshes the resource.

### Buyer resolution

Rows do not prove the experience a buyer receives when conditions and shared
resources overlap. The preview calls
`marketsResolvedValues(buyerSignal: {countryCode})`, letting Shopify resolve
precedence instead of reimplementing it in the client.

## Pagination and destructive boundaries

Shopify rejects a GraphQL request before execution when its requested cost is
greater than 1,000, even if the actual store contains fewer records. For that
reason, the Markets list never nests large connections under
`markets(first: 250)`. It cursor-pages IDs in groups of 50, applies Shopify's
`name`, `status`, `market_type`, and `market_condition_types` filters with
`sortKey: NAME`, then loads details through a concurrency-limited worker pool.
A failed detail read fails the request visibly instead of silently dropping a
market. Mutation payloads return only the updated market ID; a separate bounded
detail query refreshes the UI.

Market detail and editor-context connections are queried independently and
cursor-paged in groups of 25, up to 250 items. This includes conditions,
catalogs, discounts, web presences, and shipping options. Every connection
checks `pageInfo.hasNextPage` and surfaces a precise truncation warning.
Shipping rate groups are cost-bounded to one group per option and ten tier rates;
the editor warns instead of pretending a partial rate graph is complete.
`Count.precision` is preserved. Shopify's
`requestedQueryCost` and `actualQueryCost` are forwarded as
`x-shopify-graphql-requested-cost` and `x-shopify-graphql-actual-cost` response
headers for production diagnostics.

Bulk operations aren't used for the interactive editor: they are asynchronous,
and taking the shop's bulk-operation slot for a normally small Markets dataset
would make edits less predictable. A future export/reporting workflow that must
read a large graph should use a bulk query instead of increasing these page
sizes.

`marketDelete` is exposed only for non-primary markets and requires a dedicated
confirmation that names the target and warns that the action is irreversible.
`webPresenceDelete` has its own confirmation warning about shared assignments.
Shopify remains the final integrity check and can reject either operation when
the resource still violates market invariants.

## Upgrade checklist

1. Re-run all queries and input shapes against the target stable schema.
2. Check deprecations for every selected field and mutation.
3. Re-test subdivision and market-driven shipping rollout limitations.
4. Confirm `MarketUpdateInput` validation and new user-error codes.
5. Test minimum read-only scopes and missing write scopes.
6. Test overlaps, ACTIVE/DRAFT changes, and duplicate draft protection.
7. Resolve representative countries with local currency, inclusive taxes/duties,
   shared/no web presence, and inherited/disabled shipping.
