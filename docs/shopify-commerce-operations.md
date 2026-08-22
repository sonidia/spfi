# Shopify commerce operations workspace

The store page's **Operations** tab is a single workspace for draft conversion,
discount administration, checkout recovery, return requests, and shipping
fulfillment. Each resource loads independently; a missing Shopify scope only
disables the affected panel.

## Internal endpoints

| Resource            | List endpoint                                | Mutation endpoints                           | Shopify API                                              |
| ------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Draft orders        | `POST /api/commerce-ops/draft-orders`        | `draft-orders/create`, `draft-orders/action` | GraphQL draft-order queries and mutations                |
| Discounts           | `POST /api/commerce-ops/discounts`           | `discounts/create`, `discounts/action`       | GraphQL discount nodes and basic code-discount mutations |
| Abandoned checkouts | `POST /api/commerce-ops/abandoned-checkouts` | Read-only recovery link                      | GraphQL `abandonedCheckouts`                             |
| Returns             | `POST /api/commerce-ops/returns`             | `returns/action`                             | GraphQL return lifecycle mutations                       |
| Fulfillment orders  | `POST /api/commerce-ops/fulfillment-orders`  | `fulfillment-orders/*`                       | GraphQL fulfillment-order queries and mutations          |

All requests include the selected `storeId` and access token. IDs that reach a
mutation are validated as the expected Shopify GID type.

## Supported workflows

- Draft orders: create a custom line-item draft, send its invoice, complete it
  as paid, or delete it.
- Discounts: list native and app-managed discounts, create a basic discount
  code, and activate or deactivate code discounts.
- Abandoned checkouts: inspect recent checkouts and open the Shopify-hosted
  recovery URL. Recovery links are never reconstructed locally.
- Returns: review recent return requests, approve or decline requests, and
  cancel or close active returns. Closing is a lifecycle action, not a refund or
  inventory adjustment.
- Fulfillment orders: filter and paginate the shop-wide queue, create exact or
  full fulfillments, update single-package tracking, apply and release app-owned
  holds, and move work only to locations Shopify reports as movable. Bulk
  fulfillment runs each selected fulfillment order independently and returns a
  per-order success or failure result.

Fulfillment listing uses the top-level `fulfillmentOrders` connection with a
25-row cursor page with at most 25 line items per row, keeping Shopify's
requested GraphQL cost bounded. Terminal states are requested explicitly with
`includeClosed`; supported UI actions come from each fulfillment order's
`supportedActions`. Move locations are read from `locationsForMove`, and hold
release always supplies the IDs owned by the requesting app so it cannot
prematurely release holds created elsewhere.

## Access scopes

The relevant scopes are `read_draft_orders`, `write_draft_orders`,
`read_discounts`, `write_discounts`, `read_orders`, `read_returns`, and
`write_returns`. Fulfillment management requires the applicable
`read_merchant_managed_fulfillment_orders` /
`write_merchant_managed_fulfillment_orders` or third-party equivalents, plus
the staff user's `fulfill_and_ship_orders` permission for mutations. Reading
abandoned checkouts also requires the staff user to have Shopify's
`manage_abandoned_checkouts` permission. The Operations UI shows
resource-specific errors so operators can distinguish missing access from a
failure in another panel.

References:

- https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderComplete
- https://shopify.dev/docs/api/admin-graphql/latest/queries/discountNodes
- https://shopify.dev/docs/api/admin-graphql/latest/queries/abandonedCheckouts
- https://shopify.dev/docs/apps/build/orders-fulfillment/returns-apps
- https://shopify.dev/docs/api/admin-graphql/latest/queries/fulfillmentOrders
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCreate
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentOrderHold
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentOrderReleaseHold
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentOrderMove
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentTrackingInfoUpdate
