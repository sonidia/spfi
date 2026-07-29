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

| Route      | Workflow        | What it does                                                                                                     |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/setup`   | Setup Guide     | Documents the Shopify custom app setup flow and required access scopes.                                          |
| `/manager` | Shop Management | Stores Shopify credentials locally, tests proxies, and generates or rotates access tokens.                       |
| `/payment` | Payments        | Reads Shopify Payments payouts, balance transactions, orders, and related product data through server APIs.      |
| `/sheet`   | Sheets          | Opens Google Sheets tabs, remembers recent sheets, and supports read/write operations through a service account. |
| `/status`  | Status Checker  | Batch-checks Shopify storefront availability with direct, common-proxy, or per-row proxy modes.                  |

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

Make sure the Google service account file exists before starting the stack:

```text
server/service_account.json
```

Build and start the containers:

```bash
docker compose up -d --build
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
- Production environments must allow outbound HTTPS requests to Shopify, Google APIs, and any proxy endpoints used by status checks.

## 🧪 Scripts

| Command               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Nuxt development server.                   |
| `npm run build`       | Build the production client and Nitro server.        |
| `npm run preview`     | Run a local preview of the production build.         |
| `npm run generate`    | Generate a static output where supported by the app. |
| `npm run postinstall` | Prepare Nuxt after dependency installation.          |
