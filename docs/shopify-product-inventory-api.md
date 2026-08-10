# Shopify Product and Inventory API

These server routes proxy Shopify Admin REST API `2026-07` through the store's
configured SOCKS5H proxy. Shopify classifies the REST Admin API as legacy.
Product Variant REST operations have also been deprecated since API `2024-04`,
so new catalog pipelines should prefer the GraphQL Admin API. The REST routes
below remain available for compatibility with the current application.

Official references:

- [Product REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product)
- [Product Variant REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product-variant)
- [Product Image REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/product-image)
- [InventoryLevel REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/inventorylevel)
- [GraphQL product model migration](https://shopify.dev/docs/apps/build/graphql/migrate/new-product-model)

## Access behavior

Shopify requires product and inventory permissions for these operations:

- `read_products` and `write_products` for product, variant, and product image
  reads and mutations.
- `read_inventory` and `write_inventory` for inventory level reads and
  mutations.
- GraphQL publication and Files operations can additionally require
  `write_publications` and `write_files`.

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

| App route | Shopify REST request | Additional input |
| --- | --- | --- |
| `GET /api/product/{id}` | `GET /products/{id}.json` | optional `fields` query |
| `POST /api/product/count` | `GET /products/count.json` | optional `query` filters |
| `POST /api/product/create` | `POST /products.json` | `product` |
| `PUT /api/product/{id}` | `PUT /products/{id}.json` | partial `product` |
| `DELETE /api/product/{id}` | `DELETE /products/{id}.json` | credentials in body |

The count route accepts Shopify's documented `collection_id`,
`created_at_min`, `created_at_max`, `product_type`, `published_at_min`,
`published_at_max`, `published_status`, `updated_at_min`, `updated_at_max`, and
`vendor` filters inside `query`.

Product create and update payloads support `status` values `active`, `draft`,
and `archived`. They also support the REST `published` boolean. The product UI
exposes both controls; a draft or archived product is always submitted with
`published: false`.

## Variant routes

| App route | Shopify REST request | Additional input |
| --- | --- | --- |
| `POST /api/product/{id}/variant/all` | `GET /products/{id}/variants.json` | optional `query`, or direct `fields`, `limit`, `presentment_currencies`, `since_id` |
| `POST /api/product/{id}/variant/create` | `POST /products/{id}/variants.json` | `variant` |
| `PUT /api/product/{id}/variant/{variantId}` | `PUT /variants/{variantId}.json` | partial `variant` |
| `DELETE /api/product/{id}/variant/{variantId}` | `DELETE /products/{id}/variants/{variantId}.json` | credentials in body |

Variant update inserts the path `variantId` into the upstream payload. Inventory
quantity changes don't belong in the variant payload; use the inventory routes
with the variant's `inventory_item_id`.

## Product image routes

| App route | Shopify REST request | Additional input |
| --- | --- | --- |
| `POST /api/product/{id}/image/all` | `GET /products/{id}/images.json` | optional `query`, or direct `fields`, `limit`, `since_id` |
| `POST /api/product/{id}/image/create` | `POST /products/{id}/images.json` | `image` |
| `GET /api/product/{id}/image/{imageId}` | `GET /products/{id}/images/{imageId}.json` | optional `fields` query |
| `PUT /api/product/{id}/image/{imageId}` | `PUT /products/{id}/images/{imageId}.json` | partial `image` |
| `DELETE /api/product/{id}/image/{imageId}` | `DELETE /products/{id}/images/{imageId}.json` | credentials in body |

Create accepts a remote `src` or base64 `attachment`. Update supports `alt`,
`position`, and `variant_ids`, so the same route handles image reordering and
assigning an image to one or more variants.

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

## Correct GraphQL migration map for `2026-07`

| Capability | GraphQL Admin API |
| --- | --- |
| Product detail and count | `product`, `productsCount` |
| Product lifecycle fields | `productUpdate` or `productSet` |
| Publish or unpublish by sales channel | `publishablePublish`, `publishableUnpublish` |
| Variant list | `product.variants` |
| Create, update, or delete variants | `productVariantsBulkCreate`, `productVariantsBulkUpdate`, `productVariantsBulkDelete` |
| Synchronize/upsert a product and its variant list | `productSet` |
| Create or attach product media | `productUpdate` or `productSet` |
| Update/detach or delete files | `fileUpdate`, `fileDelete` |
| Reorder product media | `productReorderMedia` |
| Set, adjust, or move inventory | `inventorySetQuantities`, `inventoryAdjustQuantities`, `inventoryMoveQuantities` |

There is no current `productVariantsBulkUpsert`, `productSetMedia`, or
`mediaImagesCreate` mutation in Admin GraphQL `2026-07`. `productCreateMedia`,
`productUpdateMedia`, and `productDeleteMedia` still appear in the schema but
are deprecated; use the replacements in the table.

GraphQL inventory quantity mutations require an `@idempotent` key as of API
`2026-04`. `inventorySetQuantities` also supports compare-and-set semantics and
should normally include the expected current quantity to avoid overwriting a
concurrent stock change.
