# Shopify Markets API integration (Admin GraphQL 2026-07)

This project pins `NUXT_ADMIN_API_VERSION=2026-07`. The Store > Markets tab is
therefore designed against the 2026-07 GraphQL Admin schema, not the legacy
Markets model and not the REST Admin API.

## Sources of truth

- [`markets` query](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/markets)
- [`Market` object](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Market)
- [`marketCreate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketCreate)
  and [`marketUpdate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/marketUpdate)
- [`MarketUpdateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/MarketUpdateInput)
- [`marketsResolvedValues`](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/marketsResolvedValues)
- [`MarketWebPresence`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MarketWebPresence)
- [Market-driven shipping API changelog](https://shopify.dev/changelog/market-driven-delivery-profiles-admin-api)
- [Subdivision support changelog](https://shopify.dev/changelog/markets-apis-now-support-marketregionsubdivision)
- [Access scopes](https://shopify.dev/docs/api/usage/access-scopes)

## Authentication and scopes

Reading Markets requires `read_markets`. Mutating Markets requires both
`read_markets` and `write_markets`. Catalog objects additionally require
`read_products`; market-specific translations use `read_translations` and
`write_translations`. The setup guide already requests these scopes, but an
existing token created before they were added must be regenerated because
changing an app's scope configuration does not expand an already-issued token.

All app routes remain server-side and use the existing Shopify GraphQL proxy,
including the store-specific SOCKS proxy, API version selection, transport
retry policy, GraphQL cost throttling, and user-safe error conversion.

## Implemented surface

| App route                  | Shopify operation       | Purpose                                                                                                                  |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/market/all`     | `markets`               | Read up to 250 markets with buyer conditions, currency, price inclusion, catalogs, web presences, and delivery settings. |
| `POST /api/market/resolve` | `marketsResolvedValues` | Resolve the actual currency, tax/duty inclusion, catalogs, and URLs for a two-letter buyer country code.                 |
| `POST /api/market/status`  | `marketUpdate`          | Change only `Market.status` between `ACTIVE` and `DRAFT`.                                                                |

The UI includes per-store in-memory caching and follows the same retention and
force-refresh behavior as the other Store tabs. Status changes are confirmed
before the mutation and update the cached row only after Shopify succeeds.

## Why the query uses the new model

### Buyer conditions and subdivisions

`Market.regions` is deprecated. More importantly, in 2026-07 it can omit
`MarketRegionSubdivision` records. A state/province market can therefore look
empty or appear to cover an entire country if an app reads the legacy field.
The tab reads:

```text
market.conditions.regionsCondition.regions
```

and preserves both `MarketRegionCountry` and `MarketRegionSubdivision` nodes.
Subdivision markets currently support market-driven shipping first. Shopify
documents that catalog, discount, theme contextualization, and market metafield
paths can reject unsupported subdivision configurations. The UI consequently
reports configuration but does not offer a generic "edit all settings" action.

### Status

`Market.status` (`ACTIVE` or `DRAFT`) replaces the deprecated `enabled` field.
The status action uses `marketUpdate(id, input: {status})`. This avoids building
new code on `enabled`, which can disappear in a later quarterly version.

### Web presence

`Market.webPresence` and `marketWebPresenceCreate/Update/Delete` are legacy.
The read path uses `Market.webPresences`, which supports multiple associations,
and renders `rootUrls` because those are the effective locale URLs. Any future
write UI must use `webPresenceCreate`, `webPresenceUpdate`, and
`webPresenceDelete`, then associate/dissociate IDs through `marketUpdate`.

### Currency and price inclusivity

The tab reads `Market.currencySettings`, including the base currency, local
currency conversion, manual rate, and multi-currency rounding. It also reads
`Market.priceInclusions` to distinguish taxes or duties included in product
prices from amounts added at checkout. The old
`marketCurrencySettingsUpdate` mutation is deprecated; future edits should be
sent through `marketUpdate.currencySettings`.

### Market-driven shipping

API 2026-07 introduces `Market.delivery.shipping`. A `null` shipping object
means the market inherits from its parent (or the shop default for a root
market). `isEnabled: false` is not inheritance: it explicitly prevents buyers
in that market from seeing shipping options, including app-managed options.
The tab therefore presents these as three different states:

1. inherited;
2. explicitly enabled, with the option count;
3. explicitly disabled.

This distinction is operationally important and should not be reduced to a
single enabled/disabled boolean.

### Effective buyer experience

Individual market rows do not by themselves prove which settings a buyer will
receive when several conditions and shared resources apply. The country preview
uses `marketsResolvedValues(buyerSignal: {countryCode})`, Shopify's own resolver,
to show the effective currency, price inclusivity, catalogs, and prioritized
web presences. This is more reliable than reimplementing precedence rules in
the client.

## Pagination and precision

The initial tab intentionally limits the top-level `markets` connection to 250,
regions per market to 250, and catalogs/web presences to 20 each. Every nested
connection checks `pageInfo.hasNextPage` and the UI displays truncation warnings.
Shopify's `Count` object also carries `precision`; the API response preserves it
instead of silently presenting an approximate count as exact.

A future server-cursor table can remove the top-level 250-item display limit.
Nested pagination should remain on-demand per expanded market to control
GraphQL query cost.

## Evaluated features and recommendation

| Capability                                   | API                                                                                                           | Recommendation                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List/search/filter and configuration audit   | `markets`, `market`                                                                                           | Implemented. Highest value and read-only.                                                                                                                  |
| Buyer-country resolution                     | `marketsResolvedValues`                                                                                       | Implemented. Best diagnostic for overlapping configurations.                                                                                               |
| Activate / move to draft                     | `marketUpdate`                                                                                                | Implemented with confirmation. Small, reversible write surface.                                                                                            |
| Create a market                              | `marketCreate`                                                                                                | Next phase. Requires condition builder, duplicate-condition handling, currency, price inclusion, delivery, catalog and web-presence validation.            |
| Edit regions/subdivisions                    | `marketUpdate.conditions`                                                                                     | Next phase only with a diff-based editor. Do not use deprecated `marketRegionsCreate/Delete`.                                                              |
| Currency and tax/duty editor                 | `marketUpdate`                                                                                                | Useful next phase. Validate incompatible local currency/manual rate combinations and preview before saving.                                                |
| Web presence and locale editor               | `webPresenceCreate/Update/Delete` plus `marketUpdate` association fields                                      | Useful, but requires domain and published-locale discovery first. Do not use deprecated `marketWebPresence*` mutations.                                    |
| Market-driven shipping editor                | `marketCreate` / `marketUpdate.delivery`                                                                      | High operational value but high risk. Build a dedicated rate editor for flat, value, weight, and carrier-calculated options; never expose a raw JSON form. |
| Catalog/product availability and price lists | `catalog*`, `publication*`, `priceList*` APIs                                                                 | Keep as a separate module. The workflow has background operations and product scopes beyond core Markets.                                                  |
| Market-specific content                      | `marketLocalizableResource(s)`, `marketLocalizationsRegister/Remove`, or market-scoped `translationsRegister` | Useful for content teams. Requires digest/outdated handling and translation scopes; belongs in a localization workspace, not the overview card.            |
| Delete market/web presence                   | `marketDelete`, `webPresenceDelete`                                                                           | Do not expose in the first release. Destructive, cross-resource effects need dependency checks and a stronger confirmation flow.                           |

## Upgrade checklist

Before changing `NUXT_ADMIN_API_VERSION`:

1. Re-run all Markets queries against the target stable schema.
2. Check Shopify's deprecation notices for every selected field.
3. Verify subdivision and market-driven shipping feature-preview behavior.
4. Confirm `MarketUpdateInput` validation and user-error codes.
5. Test tokens with only the minimum read scopes and with write scopes absent.
6. Test active/draft changes on overlapping region conditions.
7. Confirm buyer resolution for countries with local currencies, inclusive tax,
   duties, no web presence, and inherited shipping.
