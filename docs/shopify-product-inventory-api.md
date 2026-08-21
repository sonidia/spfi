# Shopify Product and Inventory API

These server routes use a hybrid Shopify Admin API `2026-07` product stack
through the store's configured SOCKS5H proxy. Product list, exact count, bulk
publication, and variant writes use GraphQL. Single-product CRUD, compatibility
variant routes, product images, and metafields remain on REST for backward
compatibility while the migration plan below is completed.

Shopify classifies REST Admin as a legacy API. Product, Product Variant, and
Product Image REST mutations are deprecated, so no new product capability
should be added only to a REST route.

Official references:

- [Product REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product)
- [Product Variant REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product-variant)
- [Product Image REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product-image)
- [InventoryLevel REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/inventorylevel)
- [GraphQL product model migration](https://shopify.dev/docs/apps/build/graphql/migrate/new-product-model)
- [Product query and sort keys](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/products)
- [Product media](https://shopify.dev/docs/api/admin-graphql/2026-07/interfaces/Media)
- [`productDuplicate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productDuplicate)
- [`inventorySetQuantities`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventorySetQuantities)
  and [`inventoryAdjustQuantities`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventoryAdjustQuantities)

## Access behavior

Shopify requires product and inventory permissions for these operations:

- `read_products` and `write_products` for product, variant, and product image
  reads and mutations.
- `read_inventory` and `write_inventory` for inventory level reads and
  mutations.
- GraphQL publication operations require `read_publications` and
  `write_publications`. Files operations can additionally require
  `read_files` and `write_files`.

These are Shopify requirements, not a local preflight gate. The routes do not
reject a request by inspecting the token's returned scope string. Shopify
remains the source of truth and returns an authorization error if an operation
is unavailable.

## Credentials and IDs

Mutation routes receive credentials in the JSON body:

```json
{
  "storeId": "example-shop",
  "token": "shpat_..."
}
```

GET routes receive `storeId` in the query. Send the token using the
`X-Shopify-Access-Token` header. Query-string tokens are not accepted because
URLs can be retained in logs, browser history, and referrer metadata.

Product, variant, image, location, and inventory item IDs are Shopify numeric
REST IDs. Routes reject invalid resource IDs and non-integer inventory
quantities before making an upstream request.

## Product routes

| App route                            | Shopify operation                     | Additional input                                  |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| `POST /api/product/page`             | GraphQL `products`, `productsCount`   | cursor, page size, search, and filters in `query` |
| `POST /api/product/bulk-publication` | GraphQL aliased publication mutations | up to 250 product IDs and `publish`               |
| `POST /api/product/context`          | GraphQL collections and publications  | filter and channel-selection options              |
| `POST /api/product/advanced/read`    | GraphQL `product`                     | category, SEO, collections, selling-plan context  |
| `POST /api/product/advanced/update`  | GraphQL `productUpdate`               | lifecycle, taxonomy, SEO, and collection changes  |
| `POST /api/product/bulk-action`      | `productChangeStatus`/`productDelete` | archive or delete up to 250 selected products     |
| `POST /api/product/duplicate`        | `productDuplicate`                    | queue an asynchronous product duplicate           |
| `POST /api/product/media/all`        | GraphQL `product.media`               | images, video, external video, and 3D models      |
| `POST /api/product/media/create`     | GraphQL `productUpdate(media:)`       | attach media from a public HTTPS source           |
| `POST /api/product/{id}/option/bulk` | GraphQL `productOptionUpdate` aliases | one to three existing option names                |
| `GET /api/product/{id}`              | REST `GET /products/{id}.json`        | no Shopify query parameters                       |
| `POST /api/product/create`           | REST `POST /products.json`            | rich `product` input                              |
| `PUT /api/product/{id}`              | REST `PUT /products/{id}.json`        | rich partial `product` input                      |
| `DELETE /api/product/{id}`           | REST `DELETE /products/{id}.json`     | credentials in body                               |

The page route accepts Shopify's documented `collection_id`,
`created_at_min`, `created_at_max`, `product_type`, `published_at_min`,
`published_at_max`, `published_status`, `updated_at_min`, `updated_at_max`, and
`vendor` filters inside `query`. The page route additionally accepts `title`
free-text search and product `status`. Results use GraphQL cursors and the UI
loads 50 products at a time instead of downloading the entire catalog. Sorting
is limited to actual `ProductSortKeys`: created, published, updated, title,
vendor, product type, inventory total, and ID. Shopify has no product `PRICE`
sort key, so the UI does not imply unsupported server-side price sorting.

The unused compatibility routes `/api/product/all` and `/api/product/count`
were removed. The main `/api/product/page` response already returns the filtered
exact count and cursor state, so retaining separate full-catalog and duplicate
count paths created dead code and inconsistent failure behavior.

The editor assigns collections, updates Shopify taxonomy `category`, native SEO
title/description, and `requiresSellingPlan`. Gift-card state is displayed but
is not presented as an editable field because `giftCard` exists on
`ProductCreateInput`, not `ProductUpdateInput`. Existing selling-plan groups are
shown as context; group mutation is intentionally excluded because Shopify only
allows an app to manage selling plans it owns and requires purchase-option
scopes.

Product create and update payloads support `status`, publication state,
`handle`, `template_suffix`, `options`, `variants`, `images`, and `metafields`.
The create UI can define up to three options, expands their values into variant
combinations, sets an initial price, adds a remote image, and writes SEO
metafields. The compatibility create workflow rejects more than 100 generated
variants because the REST product model can't support Shopify's extended
variant limit.

The detail panel can rename existing product options with targeted
`productOptionUpdate` mutations. Option values remain managed through variant
creation, update, and deletion so every value stays attached to a valid variant.

Bulk publication resolves the Online Store publication once and sends up to 50
aliased product mutations in each GraphQL request. This replaces the former
one-REST-PUT-per-product loop. Shopify must execute top-level mutation fields
serially, and the route returns failed product IDs for partial reporting.
The UI now loads all accessible publications and can target one or many selected
sales channels; Online Store is only the default selection when available.

## Variant routes

| App route                                      | Shopify REST request                              | Additional input                                                                    |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /api/product/{id}/variant/all`           | `GET /products/{id}/variants.json`                | optional `query`, or direct `fields`, `limit`, `presentment_currencies`, `since_id` |
| `POST /api/product/{id}/variant/create`        | `POST /products/{id}/variants.json`               | `variant`                                                                           |
| `PUT /api/product/{id}/variant/{variantId}`    | `PUT /variants/{variantId}.json`                  | partial `variant`                                                                   |
| `DELETE /api/product/{id}/variant/{variantId}` | `DELETE /products/{id}/variants/{variantId}.json` | credentials in body                                                                 |
| `POST /api/product/{id}/variant/bulk`          | GraphQL bulk variant mutation                     | `create`, `update`, or `delete` action                                              |

Variant update inserts the path `variantId` into the upstream payload. Inventory
quantity changes don't belong in the variant payload; use the inventory routes
with the variant's `inventory_item_id`.

The bulk route uses `productVariantsBulkCreate`,
`productVariantsBulkUpdate`, or `productVariantsBulkDelete`. All variant writes
from the product UI use this route; selected prices and selected deletions are
sent together, and the UI prevents deletion of every variant.

## Product image routes

| App route                                  | Shopify REST request                          | Additional input                                          |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------- |
| `POST /api/product/{id}/image/all`         | `GET /products/{id}/images.json`              | optional `query`, or direct `fields`, `limit`, `since_id` |
| `POST /api/product/{id}/image/create`      | `POST /products/{id}/images.json`             | `image`                                                   |
| `GET /api/product/{id}/image/{imageId}`    | `GET /products/{id}/images/{imageId}.json`    | optional `fields` query                                   |
| `PUT /api/product/{id}/image/{imageId}`    | `PUT /products/{id}/images/{imageId}.json`    | partial `image`                                           |
| `DELETE /api/product/{id}/image/{imageId}` | `DELETE /products/{id}/images/{imageId}.json` | credentials in body                                       |

Create accepts a remote `src` or base64 `attachment`. The UI supports both URL
input and direct image-file selection (up to 20 MB). Update supports `alt`,
`position`, and `variant_ids`, so the same route handles image reordering and
assigning an image to one or more variants.

The media manager is separate from legacy Product Image CRUD. It reads all four
GraphQL media types and attaches IMAGE, VIDEO, EXTERNAL_VIDEO, or MODEL_3D from
a public HTTPS source through `productUpdate(media:)`. Shopify processes video
and model media asynchronously, so the UI displays media status after refresh.

Example:

```json
{
  "storeId": "example-shop",
  "token": "shpat_...",
  "image": {
    "src": "https://example.com/product.jpg",
    "alt": "Front view",
    "variant_ids": [123456789]
  }
}
```

## Product metafield routes

| App route                                                 | Shopify REST request       |
| --------------------------------------------------------- | -------------------------- |
| `GET /api/metafield/product/{productId}`                  | list product metafields    |
| `POST /api/metafield/product/{productId}/create`          | create a product metafield |
| `PUT /api/metafield/product/{productId}`                  | update a product metafield |
| `DELETE /api/metafield/product/{productId}/{metafieldId}` | delete a product metafield |

The product operations panel exposes the complete CRUD workflow. GET routes
accept the token only in the `X-Shopify-Access-Token` header; tokens in query
strings are rejected.

## Inventory write routes

`POST /api/inventory/set` sets an absolute available quantity:

```json
{
  "storeId": "example-shop",
  "token": "shpat_...",
  "location_id": 655441491,
  "inventory_item_id": 808950810,
  "available": 42,
  "disconnect_if_necessary": false
}
```

`POST /api/inventory/adjust` applies a signed delta:

```json
{
  "storeId": "example-shop",
  "token": "shpat_...",
  "location_id": 655441491,
  "inventory_item_id": 808950810,
  "available_adjustment": -3
}
```

Prefer `adjust` for ordinary stock movements. An absolute `set` operation is
appropriate when this application is the inventory source of truth. Shopify
rejects writes for untracked inventory items or inventory levels that aren't
connected to the specified location.

`POST /api/inventory/bulk` updates 1 to 250 tracked variants at one location in
a single GraphQL operation. Both SET and ADJUST mutations include the required
2026-07 `@idempotent` key and an audit `referenceDocumentUri`. SET also sends the
current available quantity as `compareQuantity`, so a concurrent stock change
fails safely instead of being silently overwritten. The UI reloads levels after
success and refuses targets that are not connected at the chosen location.

## Correct GraphQL migration map for `2026-07`

| Capability                                        | GraphQL Admin API                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Product detail and count                          | `product`, `productsCount`                                                            |
| Product lifecycle fields                          | `productUpdate` or `productSet`                                                       |
| Publish or unpublish by sales channel             | `publishablePublish`, `publishableUnpublish`                                          |
| Variant list                                      | `product.variants`                                                                    |
| Create, update, or delete variants                | `productVariantsBulkCreate`, `productVariantsBulkUpdate`, `productVariantsBulkDelete` |
| Synchronize/upsert a product and its variant list | `productSet`                                                                          |
| Create or attach product media                    | `productUpdate` or `productSet`                                                       |
| Update/detach or delete files                     | `fileUpdate`, `fileDelete`                                                            |
| Reorder product media                             | `productReorderMedia`                                                                 |
| Set, adjust, or move inventory                    | `inventorySetQuantities`, `inventoryAdjustQuantities`, `inventoryMoveQuantities`      |

There is no current `productVariantsBulkUpsert`, `productSetMedia`, or
`mediaImagesCreate` mutation in Admin GraphQL `2026-07`. `productCreateMedia`,
`productUpdateMedia`, and `productDeleteMedia` still appear in the schema but
are deprecated; use the replacements in the table.

GraphQL inventory quantity mutations require an `@idempotent` key as of API
`2026-04`. `inventorySetQuantities` also supports compare-and-set semantics and
should normally include the expected current quantity to avoid overwriting a
concurrent stock change.

## Migration roadmap

1. **Completed foundation:** GraphQL product connection pagination and exact
   filtered count; bulk variant create/update/delete; aliased bulk Online Store
   publication; REST-to-app response mapping; rich REST compatibility inputs.
2. **Product writes:** move create to `productSet` (or `productCreate` followed
   by `productVariantsBulkCreate`) and move scalar/SEO/metafield updates to
   `productUpdate`. Use product option mutations for targeted option changes so
   omitted variants are never accidentally deleted by `productSet` list
   semantics.
3. **Media:** replace REST Product Image routes with staged uploads plus Files
   and product media mutations. Preserve attachment upload support during the
   transition behind the same app contract.
4. **Market pricing:** replace REST `presentment_currencies` compatibility reads
   with GraphQL `contextualPricing(context:)` keyed by market country, and use
   catalog price lists for market-specific fixed-price edits.
5. **Retirement:** add contract parity tests and per-store rollout telemetry,
   then remove REST Product, Variant, Image, and Metafield calls only after all
   connected stores pass the GraphQL capability checks.
