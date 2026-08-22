# Shopify Collection API

The Collection resource uses the Shopify Admin GraphQL API `2026-07`. It is a
top-level Store navigation tab, not a sub-tab of Product, because collections
have their own lifecycle, publication state, source model, pagination, cache
key, and webhook invalidation rules. Legacy
`?tab=products&resource=collections` links are normalized to
`?tab=collections`.

Official references:

- [Flexible collections migration](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/migrate-to-flexible-collections)
- [Use the new collections model](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/use-new-collections-model)
- [`CollectionCreateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/CollectionCreateInput)
- [`CollectionUpdateInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/CollectionUpdateInput)
- [`CollectionInclusionProductSelection`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/CollectionInclusionProductSelection)
- [`CollectionExclusionProductSelection`](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/CollectionExclusionProductSelection)
- [`collectionDuplicate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/collectionDuplicate)
- [`metafieldsSet`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/metafieldsSet)
- [`metafieldsDelete`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/metafieldsDelete)
- [`translationsRegister`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/translationsRegister)
- [`translationsRemove`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/translationsRemove)
- [`publishablePublish`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/publishablePublish)
- [`publishableUnpublish`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/publishableUnpublish)

## App routes

| App route                                | Shopify operation                             | Purpose                                          |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| `POST /api/collection/page`              | `collections`, `collectionsCount`             | Filtered cursor page and count precision         |
| `POST /api/collection/context`           | `publications`, `shopLocales`                 | Publication and localization choices             |
| `POST /api/collection/create`            | `collectionCreate`                            | Create metadata, source, and optional publish    |
| `POST /api/collection/{id}`              | `collection`                                  | Details, sources, metafields, and publications   |
| `PUT /api/collection/{id}`               | `collectionUpdate`                            | Update collection metadata                       |
| `DELETE /api/collection/{id}`            | `collectionDelete`                            | Delete one collection                            |
| `POST /api/collection/{id}/duplicate`    | `collectionDuplicate`                         | Duplicate collection and optionally publications |
| `POST /api/collection/{id}/selections`   | `collectionUpdate(sourcesToUpdate:)`          | Add/remove manual product selections             |
| `POST /api/collection/{id}/publications` | `publishablePublish` / `publishableUnpublish` | Change channel availability                      |
| `PUT /api/collection/{id}/metafields`    | `metafieldsSet`                               | Atomically create/update up to 25 metafields     |
| `DELETE /api/collection/{id}/metafields` | `metafieldsDelete`                            | Delete metafields by owner/namespace/key         |
| `POST /api/collection/{id}/translations` | `translatableResource`                        | Read locale content, translations, and digests   |
| `PUT /api/collection/{id}/translations`  | `translationsRegister` / `translationsRemove` | Save or remove digest-protected locale content   |
| `POST /api/collection/job`               | `job`                                         | Poll an asynchronous collection operation        |

Every route requires `storeId` and `token` in the JSON body. Shopify GIDs are
validated by resource type, user-error arrays are normalized, list limits are
bounded, and publication IDs are checked against the current store before a
mutation is submitted.

Publication and locale context are queried independently. A missing scope for
one capability makes only that panel read-only; it does not prevent collection
metadata or membership from loading.

Core detail/source reads and publication reads are separate GraphQL operations.
If an older installation lacks publication access, metadata and membership stay
usable and the detail response carries a warning instead of failing the entire
editor.

## Flexible source safety

The implementation reads `Collection.sources` with `__typename` and typed
fragments. It does not query or write the removed legacy `ruleSet` field.
Condition sources, subcollection sources, shareable sources, and unknown future
source types remain visible in the editor.

Only a non-shareable product condition source can currently change membership.
Manual membership is represented by the condition source's inclusion
`selections`; edits use `selectionsToAdd` and `selectionsToRemove` on the exact
source ID. Variant-targeted, shareable, subcollection, and unknown sources are
read-only so the app cannot silently flatten or destroy source semantics that it
does not own.

The inclusion and exclusion selection objects are intentionally not treated as
the same GraphQL shape. `CollectionInclusionProductSelection` exposes
`product` and nullable `variantIds`; `CollectionExclusionProductSelection`
exposes only `product` in `2026-07`. Querying `variantIds` on exclusions is a
schema error.

Creation emits `CollectionCreateInput.sources` with a product target and manual
selections, including an empty selection set. The UI does not expose legacy
manual-versus-automated collection types because they no longer describe the
2026-07 model accurately.

## Listing and editing behavior

Collection pages use cursor pagination and only documented collection sort
keys: ID, relevance, title, and updated time. Relevance is accepted only with a
search term. The returned count retains Shopify's `precision` instead of
presenting a capped estimate as exact.

The editor supports title, handle, HTML description, template suffix, image and
alt text, SEO fields, manual product membership, publication channels,
metafields, global-locale translations, duplication, and deletion. A mutation
refreshes both the selected detail and collection list. Metadata updates
compare the loaded `updatedAt` value before writing to avoid silently
overwriting a newer edit.

Metafield updates follow Shopify's 25-item limit and pass `compareDigest` for
compare-and-set protection. A new metafield uses `compareDigest: null` so it
cannot overwrite a concurrently created value. Set and delete are separate UI
actions because `metafieldsSet` is atomic only within its own mutation.

Translations are loaded from `translatableResource` and saved with the current
`translatableContentDigest`. They are global to the locale (no `marketId`), so
market-specific translations are not accidentally overwritten. The panel uses
only locales enabled by `shopLocales`; clearing an existing value uses
`translationsRemove` rather than registering an ambiguous empty translation.

`collectionUpdate` and `collectionDuplicate` can return an asynchronous `job`.
The store records that job per shop, polls it with bounded backoff, and
re-queries canonical detail and list data after `done` is true. The editor
reports the operation as queued instead of incorrectly presenting it as
complete. If the polling window expires, the state becomes unknown and asks for
an explicit refresh; the mutation is never replayed automatically.

Collection creation and publication are separate Shopify mutations. If create
succeeds but publication fails, the response preserves and reports the created
collection instead of claiming that the whole operation was rolled back.

## Cache and webhooks

Products and collections use separate per-store cache timestamps and loading or
error state. Switching the top-level tab does not load both lists. Request
sequence guards prevent a slower response from overwriting a newer one.

`COLLECTIONS_CREATE`, `COLLECTIONS_UPDATE`, `COLLECTIONS_DELETE`,
`COLLECTION_LISTINGS_*`, and `COLLECTION_PUBLICATIONS_*` webhooks are verified
and normalized. The webhook payload is not used as a complete flexible source
snapshot; it invalidates collection data so the next view re-queries GraphQL.
Product webhooks also invalidate collection data because a product change can
affect condition-based membership.

## Deliberate follow-up scope

The source model and API boundaries are prepared for further typed editors, but
this release keeps computed conditions, variant-targeted membership,
subcollections, shareable sources, exclusions, and unknown future sources
read-only. It also does not expose manual product reordering, market-specific
translations, selection pagination beyond the detail snapshot, collection
bulk operations, or product-to-collection bulk assignment. These capabilities
must be added separately with typed source-specific inputs, pagination, access
scope checks, validation, tests, and progress or partial-failure contracts.
