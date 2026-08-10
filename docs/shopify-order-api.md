# Shopify order API coverage

The server targets the Admin API version configured in `app/app.config.ts`.
REST remains in place for Order operations that Shopify still documents in the
2026-07 REST resource. Deprecated Order Risk operations use the GraphQL Risk
Assessment API instead.

## Order operations

| Capability | Internal endpoint | Shopify operation |
| --- | --- | --- |
| List | `POST /api/order/all` | `GET /orders.json` |
| Get | `GET /api/order/:id` | `GET /orders/:id.json` |
| Count | `POST /api/order/count` | `GET /orders/count.json` |
| Create | `POST /api/order` | `POST /orders.json` |
| Update | `PUT /api/order/:id` | `PUT /orders/:id.json` |
| Delete | `DELETE /api/order/:id` | `DELETE /orders/:id.json` |
| Cancel | `POST /api/order/:id/cancel` | `POST /orders/:id/cancel.json` |
| Close | `POST /api/order/:id/close` | `POST /orders/:id/close.json` |
| Re-open | `POST /api/order/:id/open` | `POST /orders/:id/open.json` |
| Timeline | `GET /api/order/:id/events` | `GET /orders/:id/events.json` |

List and count filters are allow-listed in
`server/utils/shopify-order-query.ts`. The list limit is clamped to Shopify's
maximum of 250 records per REST request.

Shopify's REST Order resource calls the Admin action "Close" and "Re-open".
There are no documented `/orders/archived.json`, `/archive.json`, or
`/unarchive.json` endpoints in API version 2026-07.

## Risk assessments

| Capability | Internal endpoint | Shopify GraphQL operation |
| --- | --- | --- |
| Read | `GET /api/order/:id/risk-assessments` | `order(id).risk` |
| Create | `POST /api/order/:id/risk-assessments` | `orderRiskAssessmentCreate` |

The replacement `OrderRiskAssessment` type is immutable and has no public ID,
so the current GraphQL API has no supported single-read, update, or delete
operation. The app does not fall back to the deprecated REST risk endpoints.

Reading orders requires `read_orders`; mutations require `write_orders`.
Orders older than 60 days additionally require approved `read_all_orders`
access. `orderRiskAssessmentCreate` requires an offline access token.

## Payments and refunds

| Capability | Internal endpoint | Shopify GraphQL operation |
| --- | --- | --- |
| Capture authorized funds | `POST /api/order/:id/capture` | `orderCapture` |
| Record an offline payment | `POST /api/order/:id/mark-paid` | `orderMarkAsPaid` |
| Partial line-item refund | `POST /api/order/:id/refund` | `refundCreate` |
| List refund history | `GET /api/order/:id/refunds` | `GET /orders/:id/refunds.json` |

Capture accepts the authorization transaction, amount, currency, and final
capture flag. Refunds require explicit line item quantities and a successful
sale/capture parent transaction. The UI keeps a refund idempotency key across a
failed retry; `refundCreate` requires the `@idempotent` directive in API
versions 2026-04 and later. Refund history supports Shopify's documented
`fields`, `in_shop_currency`, and `limit` query parameters.

## Order editing

| Capability | Internal endpoint | Shopify GraphQL operation |
| --- | --- | --- |
| Start edit session | `POST /api/order/:id/edit/begin` | `orderEditBegin` |
| Stage quantity/removal, add custom items, and commit | `POST /api/order/:id/edit/commit` | `orderEditSetQuantity`, `orderEditAddCustomItem`, `orderEditCommit` |

The editor uses Shopify-calculated line item IDs returned by `orderEditBegin`.
This avoids ambiguous mapping from REST line item IDs. It enforces non-negative
integer quantities and does not let the UI reduce below already-uneditable
(typically fulfilled) units. Shopify documents quantity zero as the supported
way to remove a line item; there is no `orderEditSetLine` or
`orderEditRemoveLineItem` mutation in API version 2026-07. Because the removed
item remains with quantity zero, the editor also permits setting it back to a
positive quantity in a later edit. Custom items require a title, non-negative
unit price, positive quantity, and order currency. Order editing requires
`write_order_edits`, and Shopify doesn't allow editing closed orders or
fulfilled quantities.

## Fulfillment operations

| Capability | Internal endpoint | Shopify operation |
| --- | --- | --- |
| Read fulfillment orders | `GET /api/order/:id/fulfillment_orders` | REST fulfillment orders |
| List fulfillment history | `GET /api/order/:id/fulfillments` | `GET /orders/:id/fulfillments.json` |
| Full or partial fulfillment | `POST /api/order/:id/fulfill` | GraphQL `fulfillmentCreate` |
| Cancel fulfillment | `POST /api/fulfillments/:id/cancel` | GraphQL `fulfillmentCancel` |

Partial fulfillment requests are validated against the order's current open
fulfillment orders and fulfillable quantities. Numeric REST IDs are parsed
without precision loss, validated as decimal strings, and converted to GraphQL
GIDs before `fulfillmentCreate`; there is no legacy fallback that could fulfill
unselected items. Fulfillment history accepts Shopify's documented time range,
`fields`, `limit`, and `since_id` query parameters.

References:

- https://shopify.dev/docs/api/admin-rest/latest/resources/order
- https://shopify.dev/docs/api/admin-rest/latest/resources/order-risk
- https://shopify.dev/docs/api/admin-graphql/latest/objects/OrderRiskSummary
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderRiskAssessmentCreate
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderCapture
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderMarkAsPaid
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/refundCreate
- https://shopify.dev/docs/api/admin-rest/latest/resources/refund
- https://shopify.dev/docs/apps/build/orders-fulfillment/order-management-apps/edit-orders
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderEditSetQuantity
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderEditAddCustomItem
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCreate
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCancel
- https://shopify.dev/docs/api/admin-rest/latest/resources/fulfillment
- https://shopify.dev/docs/api/admin-rest/latest/resources/event
