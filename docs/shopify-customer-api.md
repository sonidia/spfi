# Shopify Customer API

The customer server routes proxy Shopify Admin REST API `2026-07` through the
store's configured SOCKS5H proxy. Shopify classifies the REST Admin API as
legacy, so new customer features should prefer the GraphQL Admin API. These
REST routes remain available for compatibility with the rest of this project.

Official references:

- [Customer REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/customer)
- [Customer Address REST resource](https://shopify.dev/docs/api/admin-rest/2026-07/resources/customer-address)
- [Admin API access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)

## Required access

The Shopify app must be granted both:

- `read_customers` for customer, address, and count reads.
- `write_customers` for create, update, delete, invite, activation, and address
  mutations.

`POST /api/generate-token` does not reject a token based on the `scope` field
in Shopify's response. Shopify remains the source of truth and reports any
missing permission when an API operation is attempted.

This project uses Shopify's client credentials grant. Shopify limits that grant
to apps developed by your own organization and installed on stores that your
organization owns. Public and custom apps outside that model must use Shopify's
supported token exchange or authorization code flow instead.

Protected customer data is a separate Shopify approval/configuration layer,
not an OAuth scope. Configure protected customer data and each required
protected field (name, address, email, and phone) in Shopify. A token can have
`read_customers` and `write_customers` while fields remain redacted or requests
remain unavailable because protected customer data access is not configured.

## Route contract

Mutation routes receive credentials in the JSON body:

```json
{
  "storeId": "example-shop",
  "token": "shpat_..."
}
```

GET and DELETE routes receive `storeId` in the query. Send the token using the
`X-Shopify-Access-Token` header. Query-string tokens are not accepted because
URLs can be retained in logs, browser history, and referrer metadata.

| App route | Shopify REST request | Additional input |
| --- | --- | --- |
| `POST /api/customer/create` | `POST /customers.json` | `customer` |
| `PUT /api/customer/{id}` | `PUT /customers/{id}.json` | `customer` |
| `DELETE /api/customer/{id}` | `DELETE /customers/{id}.json` | — |
| `POST /api/customer/count` | `GET /customers/count.json` | optional `query` with `created_at_min`, `created_at_max`, `updated_at_min`, `updated_at_max` |
| `POST /api/customer/{id}/account-activation-url` | `POST /customers/{id}/account_activation_url.json` | — |
| `POST /api/customer/{id}/send-invite` | `POST /customers/{id}/send_invite.json` | optional `customer_invite` |
| `GET /api/customer/{id}/address/all` | `GET /customers/{id}/addresses.json` | optional `limit`, `page_info` query parameters |
| `POST /api/customer/{id}/address/create` | `POST /customers/{id}/addresses.json` | `address` |
| `GET /api/customer/{id}/address/{addressId}` | `GET /customers/{id}/addresses/{addressId}.json` | — |
| `PUT /api/customer/{id}/address/{addressId}` | `PUT /customers/{id}/addresses/{addressId}.json` | `address` |
| `DELETE /api/customer/{id}/address/{addressId}` | `DELETE /customers/{id}/addresses/{addressId}.json` | — |
| `PUT /api/customer/{id}/address/{addressId}/default` | `PUT /customers/{id}/addresses/{addressId}/default.json` | — |

Customer and address IDs must be Shopify numeric REST IDs. The routes reject
invalid IDs before making an upstream request.

The default invite is sent when `customer_invite` is omitted. To customize it:

```json
{
  "storeId": "example-shop",
  "token": "shpat_...",
  "customer_invite": {
    "to": "customer@example.com",
    "subject": "Welcome",
    "custom_message": "Activate your account to get started."
  }
}
```

An account activation URL is one-time use and expires after 30 days. Creating a
new URL invalidates the previous URL. Account activation and invite operations
only apply to compatible customer account states; the invite operation is for
legacy customer accounts.

Shopify doesn't allow deleting a customer who has orders. Shopify also rejects
deleting a customer's default address; set a different default address first.

## GraphQL migration map

| Capability | GraphQL Admin API |
| --- | --- |
| Create, update, or delete customer | `customerCreate`, `customerUpdate`, `customerDelete` |
| Count customers | `customersCount` |
| Generate activation URL | `customerGenerateAccountActivationUrl` |
| Send account invite | `customerSendAccountInviteEmail` |
| Create, update, or delete address | `customerAddressCreate`, `customerAddressUpdate`, `customerAddressDelete` |
| Set default address | `customerUpdateDefaultAddress` |
| Update email marketing consent | `customerEmailMarketingConsentUpdate` |

`customerSetEmailMarketingContext` is not the current mutation for updating
email marketing consent in Admin API `2026-07`. Use
`customerEmailMarketingConsentUpdate`. Similarly, address creation and deletion
have dedicated Admin GraphQL mutations and shouldn't be omitted from a
migration plan.
