# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Google Sheet (Service Account) for Proxy page

To enable **Load Sheet** on `/proxy`, configure these environment variables in `spf/.env`:

- `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON string of service account) **or**
	- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
	- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep `\n` escaped in `.env`)
- `GOOGLE_SHEET_SPREADSHEET_ID`
- `GOOGLE_SHEET_RANGE` (default: `Sheet1!A:Z`)

Optional public defaults for client requests:

- `NUXT_PUBLIC_GOOGLE_SHEET_SPREADSHEET_ID`
- `NUXT_PUBLIC_GOOGLE_SHEET_RANGE`

Expected header aliases in sheet for auto-fill on `/proxy`:

- Store ID: `store id`, `store_id`, `storeId`, `id`
- Shop: `shop`, `shop_name`
- Domain: `domain`, `shop_domain`
- Proxy URL (optional): `proxy`, `proxy_url`
