<p align="center">
  <img src="./public/banner.png" alt="SPFI Shopify Operations Console" width="100%" />
</p>

<h1 align="center">SPFI</h1>

<p align="center">
  A compact Shopify operations console for setup, token rotation, Google Sheets lookup, payments, orders, products, and storefront status checks.
</p>

<p align="center">
  <img alt="Nuxt 4" src="https://img.shields.io/badge/Nuxt_4-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-42B883?style=for-the-badge&logo=vuedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Pinia" src="https://img.shields.io/badge/Pinia-FFD859?style=for-the-badge&logo=pinia&logoColor=14221B" />
  <img alt="Google Sheets" src="https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white" />
  <img alt="Node 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
</p>

## ✨ Highlights

- One desk for Shopify setup, profile management, product operations, payments, order inspection, sheet lookup, and storefront checks.
- Nitro server routes keep Shopify, proxy, status, and Google Sheets calls behind the app surface.
- Proxy-aware status checking supports direct, shared proxy, and per-row proxy modes.
- Local-first shop profile workflows help reduce repeated credential and token handling.

## 🧭 Core Workflows

| Route       | Workflow        | What it does                                                                                                     |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/setup`    | Setup Guide     | Documents the Shopify custom app setup flow and required access scopes.                                          |
| `/manager`  | Shop Management | Stores Shopify credentials locally, tests proxies, and generates or rotates access tokens.                       |
| `/payment`  | Payments        | Reads Shopify Payments payouts, balance transactions, orders, and related product data through server APIs.      |
| `/sheet`    | Sheets          | Opens Google Sheets tabs, remembers recent sheets, and supports read/write operations through a service account. |
| `/status`   | Status Checker  | Batch-checks Shopify storefront availability with direct, common-proxy, or per-row proxy modes.                  |
| `/settings` | Settings        | Stores Tracktaco credentials locally and controls the in-memory Pinia data lifetime.                             |

## 🧰 Tech Stack

- Nuxt 4, Vue 3, and TypeScript for the application shell.
- Nitro server routes for Shopify, proxy, status, and Google Sheets APIs.
- Pinia for app stores and shared operational state.
- Google Sheets API via `googleapis`.
- SOCKS/HTTP proxy support via `socks-proxy-agent` and `https-proxy-agent`.

## 🚀 Quick Start

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

## 🔐 Configuration

### Browser origin policy

API requests are same-origin by default. If a separate trusted browser UI must
call the API, allow its exact origins as a comma-separated list:

```text
NUXT_ALLOWED_ORIGINS=https://ops.example.com,https://admin.example.com
```

Unsafe API methods reject requests without an `Origin` header unless the
browser supplies `Sec-Fetch-Site: same-origin`. Host-header origin fallback is
off in production; enable `NUXT_ALLOW_HOST_ORIGIN_FALLBACK=true` only for a
known legacy local client.

Copy `.env.example` to `.env` as a starting point.

Shopify Admin REST and GraphQL requests share a runtime-configured API version.
The default is `2026-07`; after validating the next quarterly release and once
it is stable, rotate it without rebuilding the app, for example:

```text
NUXT_ADMIN_API_VERSION=2026-10
```

Add the Google service account file:

```text
server/service_account.json
```

The file must include `client_email` and `private_key`. Share any target spreadsheets with the service account email before using the Sheets workflow.

Required local inputs:

- Node.js 20 or newer.
- npm 10 or newer.
- A Google service account JSON file for Sheets features.
- Shopify store credentials for authenticated store operations.

Shopify Admin requests are throttled from Shopify's own response metadata, not
from a hard-coded store plan. REST requests honor `Retry-After` and share the
upstream bucket state per app/store; GraphQL retries use
`extensions.cost.throttleStatus.currentlyAvailable` and `restoreRate`.

### Data access endpoints

Order lists use Shopify cursor pagination end to end. `POST /api/order/all`
returns one page at a time:

```json
{
  "orders": [],
  "pageInfo": {
    "nextCursor": null,
    "previousCursor": null,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Pass a returned cursor as `query.page_info`; cursor requests intentionally drop
filters that Shopify does not permit alongside `page_info`.

`POST /api/graphql` provides a generic Admin GraphQL read endpoint for nested
data. It accepts `{ storeId, token, query, variables?, operationName? }` and
returns `{ data }`. This endpoint is deliberately read-only: mutations,
subscriptions, schema introspection, oversized inputs, and excessively nested
queries are rejected.

CSV downloads are available from `POST /api/export/csv/:resource`, where
`resource` is `orders`, `products`, or `payments`. Responses are streamed page
by page, emitted as UTF-8 CSV, and protected against spreadsheet formula
injection. The store UI exposes the same exports through reusable buttons.

`/dashboard` is an all-store operational view. The browser loads saved stores
with a concurrency limit and calls `POST /api/dashboard` once per store. Each
response aggregates the current calendar month's orders, daily revenue, top
products, pending fulfillments, customer and product totals, Shopify Payments,
and staff access. Totals remain separated by currency, date boundaries follow
the viewer's timezone, and restricted resources degrade independently instead
of hiding the rest of a store's dashboard.

The optional local per-IP limits are disabled by default so they don't reduce
Shopify throughput. A deployment that exposes the server publicly can enable
them without changing source code:

```text
NUXT_API_RATE_LIMIT_PER_MINUTE=600
NUXT_TOKEN_RATE_LIMIT_PER_MINUTE=30
```

Forwarded client IP headers are ignored by default. Set
`NUXT_TRUST_PROXY_HEADERS=true` only behind a trusted reverse proxy that
overwrites `X-Forwarded-For`; the bundled nginx and Compose configuration do.

Automatic FedEx tracking is configured from `/settings`. The Tracktaco endpoint
and API key are saved in browser-local storage; no PIN/password unlock or
Tracktaco `.env` values are required.

The same page controls how long Shopify operational data stays reusable in
Pinia. Presets range from no cache through one day to the default session mode,
which keeps data until the browser page is refreshed. Only this preference is
persisted; the Shopify response data remains in memory.

## 🏭 Production

Build the application:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

For a Node deployment, ship the Nuxt output and start the Nitro server:

```bash
node .output/server/index.mjs
```

## Docker Compose + Nginx

The production stack runs Nuxt behind Nginx. Nginx is the only public
service; the Nuxt port is available only on the internal Compose network.

The app service is tagged as `ghcr.io/sonidia/spfi:latest` by default. Override
it with `APP_IMAGE` when you want to run another image tag.

Make sure the Google service account file exists before starting the stack:

```text
server/service_account.json
```

Build and start the containers:

```bash
docker compose up -d --build
```

To run a published GHCR image without rebuilding locally:

```bash
docker compose pull app
docker compose up -d --no-build
```

Open `http://localhost`. To use another host port:

```bash
NGINX_PORT=8080 docker compose up -d --build
```

On PowerShell:

```powershell
$env:NGINX_PORT = "8080"
docker compose up -d --build
```

Inspect or stop the stack:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## GitHub Actions CI/CD

The Docker workflow lives at `.github/workflows/docker-image.yml`. It builds the
Docker image on pull requests to `main` or `master`, then publishes to GHCR on
pushes to `main`, `master`, version tags like `v1.2.3`, or manual dispatch.

Published image:

```text
ghcr.io/sonidia/spfi
```

Tag rules:

- Pull requests build only and do not publish.
- Pushes to the default branch publish `latest`, the branch tag, and `sha-<short>`.
- Tags like `v1.2.3` publish `1.2.3`, `1.2`, and `sha-<short>`.

The workflow uses GitHub's built-in `GITHUB_TOKEN`, so no custom PAT is required
unless the repository or organization has restricted package publishing. The
token needs `contents: read` and `packages: write`, which are already declared
in the workflow.

## 🌐 Proxy Formats

Proxy fields accept SOCKS5H remote-DNS shorthand or full proxy URLs:

```text
127.0.0.1:1080
127.0.0.1:1080:user:pass
socks5h://user:pass@127.0.0.1:1080
```

The status checker supports three modes:

- **No proxy**: checks each target directly.
- **Common proxy**: applies one SOCKS5 proxy to every target.
- **Separate proxy**: parses each row as `proxy target`, `proxy|target`, `proxy,target`, or `proxy<TAB>target`.

## 📊 Google Sheets

Sheet routes are backed by `server/service_account.json` and default to the `A:Z` range unless a specific range or tab is selected.

Known sheet tab defaults are configured in `utils/sheetConfig.ts`. Optional default sheet URLs can be added in `utils/sheets.ts` when a deployment needs preloaded sheets.

Expected header aliases for store auto-fill:

- Store ID: `store id`, `store_id`, `storeId`, `id`
- Shop: `shop`, `shop_name`
- Domain: `domain`, `shop_domain`
- Proxy URL: `proxy`, `proxy_url`

## 🛡️ Security Notes

- Do not commit `server/service_account.json`, `.env` files, logs, or generated build output.
- Store credentials and proxy details should be treated as sensitive operational data.
- Browser API calls are same-origin unless explicitly listed in `NUXT_ALLOWED_ORIGINS`.
- Shopify access tokens for GET and DELETE routes must use the `X-Shopify-Access-Token` header; query-string tokens are rejected.
- CORS is a browser boundary, not user authentication. Keep deployments on localhost, a trusted network, or behind a VPN/reverse proxy when public access is not intended.
- SOCKS proxy hosts are DNS-resolved, rejected if any result is private/reserved, and pinned to a validated public IP before connecting. Isolated VPN deployments that intentionally use a private proxy can opt out with `NUXT_ALLOW_PRIVATE_PROXY_HOSTS=true`.
- `/api/debug-proxy` is disabled by default in production. When explicitly enabled, it accepts only HTTPS destinations on `NUXT_DEBUG_PROXY_ALLOWED_HOSTS`, blocks private/reserved DNS results and redirects, caps response size, and suppresses raw socket errors.
- Store status targets and every redirect are restricted to public HTTPS port 443; direct connections use the validated DNS address to reduce DNS-rebinding risk.
- Production environments must allow outbound HTTPS requests to Shopify, Google APIs, and any proxy endpoints used by status checks.

## 🧪 Scripts

| Command               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Nuxt development server.                   |
| `npm run build`       | Build the production client and Nitro server.        |
| `npm run preview`     | Run a local preview of the production build.         |
| `npm run generate`    | Generate a static output where supported by the app. |
| `npm run postinstall` | Prepare Nuxt after dependency installation.          |
