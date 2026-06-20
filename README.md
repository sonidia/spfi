# SPF

SPF is a Nuxt-based Shopify operations console for store setup, token rotation,
Google Sheets lookup, payment/order inspection, product operations, and public
storefront status checks.

## Core Workflows

- **Setup guide** (`/setup`): documents the Shopify custom app setup flow and
  required access scopes.
- **Manager** (`/manager`): stores Shopify credentials locally, tests proxies,
  and generates/rotates access tokens.
- **Payments** (`/payment`): reads Shopify Payments payouts, balance
  transactions, orders, and related product data through the server API.
- **Sheets** (`/sheet`): opens Google Sheets tabs, remembers recent sheets, and
  supports read/write operations through a service account.
- **Status checker** (`/status`): batch-checks Shopify storefront availability
  with direct, common-proxy, or per-row proxy modes.

## Tech Stack

- Nuxt 4, Vue 3, TypeScript
- Nitro server routes for Shopify, proxy, status, and Google Sheets APIs
- Pinia for app stores
- Google Sheets API via `googleapis`
- SOCKS/HTTP proxy support via `socks-proxy-agent` and `https-proxy-agent`

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A Google service account JSON file for Sheets features
- Shopify store credentials for authenticated store operations

## Local Setup

Install dependencies:

```bash
npm install
```

Add the Google service account file:

```text
server/service_account.json
```

The file must include `client_email` and `private_key`. Share any target
spreadsheets with the service account email before using the Sheets workflow.

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Production

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

## Proxy Formats

Proxy fields accept SOCKS-style shorthand or full proxy URLs:

```text
127.0.0.1:1080
127.0.0.1:1080:user:pass
socks5://user:pass@127.0.0.1:1080
http://user:pass@127.0.0.1:8080
```

The status checker supports three modes:

- **No proxy**: checks each target directly.
- **Common proxy**: applies one SOCKS5 proxy to every target.
- **Separate proxy**: parses each row as `proxy target`, `proxy|target`,
  `proxy,target`, or `proxy<TAB>target`.

## Google Sheets

Sheet routes are backed by `server/service_account.json` and default to the
`A:Z` range unless a specific range or tab is selected.

Known sheet tab defaults are configured in `utils/sheetConfig.ts`. Optional
default sheet URLs can be added in `utils/sheets.ts` when a deployment needs
preloaded sheets.

Expected header aliases for store auto-fill:

- Store ID: `store id`, `store_id`, `storeId`, `id`
- Shop: `shop`, `shop_name`
- Domain: `domain`, `shop_domain`
- Proxy URL: `proxy`, `proxy_url`

## Security Notes

- Do not commit `server/service_account.json`, `.env` files, logs, or generated
  build output.
- Store credentials and proxy details should be treated as sensitive operational
  data.
- Production environments must allow outbound HTTPS requests to Shopify, Google
  APIs, and any proxy endpoints used by status checks.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Nuxt development server. |
| `npm run build` | Build the production client and Nitro server. |
| `npm run preview` | Run a local preview of the production build. |
| `npm run generate` | Generate a static output where supported by the app. |
| `npm run postinstall` | Prepare Nuxt after dependency installation. |
