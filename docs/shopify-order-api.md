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

List and count filters are allow-listed in
`server/utils/shopify-order-query.ts`. The list limit is clamped to Shopify's
maximum of 250 records per REST request.

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

References:

- https://shopify.dev/docs/api/admin-rest/latest/resources/order
- https://shopify.dev/docs/api/admin-rest/latest/resources/order-risk
- https://shopify.dev/docs/api/admin-graphql/latest/objects/OrderRiskSummary
- https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderRiskAssessmentCreate
