# Refactor Plan - Shopify SPF Console

## Priority Legend

- **P0**: Critical (security/stability, do first)
- **P1**: High (architecture/functionality)
- **P2**: Medium (UI/UX)
- **P3**: Low (nice to have)

---

## P0 - Bảo mật & Ổn định

### 0.1 Tạo `callShopifyApi()` wrapper

**Mục đích:** DRY ~15 server routes cùng logic proxy/variant/retry.

**Files affected:**

- `server/api/fulfillments/[id].post.ts`
- `server/api/order/all.post.ts`
- `server/api/order/[id].get.ts`
- `server/api/order/[id]/transactions.get.ts`
- `server/api/order/[id]/fulfillment_orders.get.ts`
- `server/api/order/[id]/fulfill.post.ts`
- `server/api/payment/all.post.ts`
- `server/api/payment/balance-transactions.post.ts`
- `server/api/payment/payout/[id].get.ts`
- `server/api/payment/payout/all.post.ts`
- `server/api/payment/payout/transactions.post.ts`
- `server/api/product/[id].delete.ts`
- `server/api/product/[id].put.ts`
- `server/api/product/all.post.ts`
- `server/api/product/create.post.ts`
- `server/api/shop/profile.post.ts`

**Implementation:**

```ts
// server/utils/callShopifyApi.ts
export async function callShopifyApi<T>(
  event: H3Event,
  options: {
    storeId: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string; // e.g. '/admin/api/2026-04/orders.json'
    data?: Record<string, any>;
    token?: string; // override token
    params?: Record<string, string>; // query params
  },
): Promise<{ data: T; headers: Headers } | { error: string; status: number }>;
```

**Steps:**

1. Tạo `server/utils/callShopifyApi.ts`
2. Extract logic: resolve store → get token → build proxy variants → try each variant → retry on failure → normalize response
3. Replace body của từng server route bằng 1-2 dòng gọi `callShopifyApi`
4. Xóa `utils/proxy/store-proxy.ts` (không cần thiết nữa)
5. Xóa `server/api/shop/profile.post.ts` nếu redundant

---

### 0.2 Encrypt localStorage credentials

**Mục đích:** Client Secret, Access Token không còn plaintext trong localStorage.

**Files affected:**

- `app/composables/useLocalStorage.ts`

**Implementation:**

- Tạo encryption key từ store password/pin (yêu cầu user nhập khi login)
- Dùng `crypto.subtle.encrypt` với AES-GCM
- Decrypt chỉ khi cần dùng (trong memory)
- Tự động xóa khỏi memory sau tab close

**Alternative (simpler):**

- Chuyển từ localStorage sang sessionStorage + httpOnly cookie cho sensitive data
- Server routes tự động inject token từ cookie, không cần gửi qua client

---

### 0.3 Rate limiting cho API routes

**Mục đính:** Chống brute-force token, abuse API.

**Files affected:**

- `server/middleware/rateLimit.ts` (tạo mới)

**Implementation:**

```ts
// Dùng in-memory Map với IP key
// 100 requests / phút mỗi IP
// 10 requests / phút mỗi IP cho /api/generate-token
// 429 Too Many Requests nếu vượt quá
```

**Steps:**

1. Tạo `server/middleware/rateLimit.ts`
2. Apply cho tất cả `/api/*` routes
3. Stricter limit cho `/api/generate-token`

---

### 0.4 Fix token rotation interval

**Mục đích:** Token rotation interval hiện tại dùng `setInterval` → không chính xác, dễ bị drift.
Cân nhắc thêm:

- Chỉ chạy khi component visible (`document.visibilityState`)
- Dùng `requestIdleCallback` thay vì `setInterval`

---

## P1 - Kiến trúc & Tính năng

### 1.3 Thêm Shopify REST APIs còn thiếu

#### Customers (Priority: High)

**Files:**

- `server/api/customer/all.post.ts` (tạo mới)
- `server/api/customer/[id].get.ts` (tạo mới)
- `app/pages/customer/index.vue` (tạo mới)
- `app/stores/customers.ts` (tạo mới)
- `app/composables/useCustomers.ts` (tạo mới)

**Endpoints:**
| Method | Endpoint | Mục đích |
|--------|----------|----------|
| GET | /admin/api/2024-07/customers.json | List customers |
| GET | /admin/api/2024-07/customers/search.json | Search customers |
| GET | /admin/api/2024-07/customers/{id}.json | Customer detail |
| GET | /admin/api/2024-07/orders.json?customer_id={id} | Orders by customer |

#### GraphQL (Priority: Medium)

**Files:**

- `server/api/graphql.post.ts` (tạo mới)
- `server/utils/shopify-graphql.ts` (tạo mới - query builder helper)

**Mục đích:** Cho phép GraphQL queries cho dữ liệu phức tạp (nested resources).

**Implementation:**

```ts
// POST /api/graphql
// Body: { query: string, variables?: Record<string, any> }
// Response: { data: any, error?: string }
```

#### Locations (Priority: Low)

**Mục đích:** Inventory management.

- `server/api/location/all.get.ts`
- Hiển thị trong UI product detail

#### Metafields (Priority: Medium)

**Mục đích:** Custom metadata cho products/orders/customers.

- `server/api/metafield/[resource]/[id].get.ts`
- `server/api/metafield/[resource]/[id].put.ts`

#### Webhooks (Priority: Low)

**Mục đích:** Webhook management UI.

- `server/api/webhook/all.get.ts`
- `server/api/webhook/create.post.ts`
- `server/api/webhook/[id].delete.ts`

---

### 1.4 Pagination cho Orders

**Files affected:**

- `server/api/order/all.post.ts`

**Implementation:**

```ts
// Shopify uses cursor-based pagination (Link header)
// Parse 'Link' header for 'rel="next"' and 'rel="previous"'
// Return page_info cursor in response
// Client sends page_info in request body
```

**Response format:**

```json
{
  "orders": [...],
  "pageInfo": {
    "next": "cursor_string",
    "previous": "cursor_string_or_null"
  }
}
```

---

### 1.5 Standardize error handling

**Files affected:** Tất cả server routes.

**Standard response format:**

```ts
{
  success: false,
  error: {
    message: string,
    code?: string,
    status?: number,
    details?: any
  }
}
```

**Pattern thống nhất:**

```ts
// Thay vì 3 patterns khác nhau:
catch (err) {
  const message = err.response?.data?.errors
    || err.response?.data?.message
    || err.message;
  // hoặc
  const message = typeof err.response?.data === 'object'
    ? JSON.stringify(err.response.data)
    : err.message;

  // Dùng:
  throw createError({
    statusCode: err.response?.status || 500,
    statusMessage: extractErrorMessage(err)
  });
}
```

---

## P2 - UI/UX

### 2.1 Internationalization (i18n)

**Mục đích:** Loại bỏ mixed Vietnamese/English.

**Files affected:**

- `app/composables/useI18n.ts` (tạo mới)
- Tất cả template files

**Implementation:**

```ts
// Use a simple composable or vue-i18n
// Detect browser language
// Store preference in localStorage
// Keys:
//   'proxy.connectionError' -> { en: 'Cannot connect to proxy or Shopify', vi: 'Không kết nối được tới proxy hoặc Shopify' }
//   'proxy.missingSocks' -> { en: 'Missing socks info', vi: 'Thiếu thông tin sock' }
//   ...
```

**Steps:**

1. Tạo locale files `app/locales/en.json`, `app/locales/vi.json`
2. Tạo composable hoặc dùng vue-i18n
3. Thay all hardcoded strings bằng `$t('key')`

---

### 2.2 Confirm dialogs trước khi xóa

**Files affected:**

- `app/pages/manager.vue:175` - `deleteStore`
- `app/components/SheetDataModal.vue` - `removeRecentSheet`

**Implementation:**

```ts
// Dùng window.confirm() hoặc custom modal component
if (!confirm("Are you sure you want to delete this store?")) return;
```

---

### 2.3 Fix Payment tab - transactionsCount

**Files affected:**

- `app/pages/payment/index.vue:200`

**Change:**

```ts
// Before
const transactionsCount = computed(() => paymentStore.payouts?.length || 0);
// After - need to check what the actual count should be
// Probably: balanceTransactions.length
const transactionsCount = computed(
  () => paymentStore.balanceTransactions?.length || 0,
);
```

---

### 2.4 Scrollbar styling

**Files affected:**

- `app/app.vue:109`

**Change:**

- Remove hardcoded `scrollbar-width: thin`
- Hoặc move vào CSS class, chỉ apply khi user opt-in
- Hoặc dùng CSS custom properties để dễ override

---

### 2.5 Dark mode

**Files affected:**

- `app/composables/useTheme.ts` (tạo mới)
- `app/app.vue` - CSS variables
- Tất cả components dùng màu

**Implementation:**

```ts
// Toggle .dark class on <html>
// CSS variables đã có sẵn, chỉ cần định nghĩa --bg--dark, --text--dark...
// Store preference in localStorage
```

---

## P3 - Cải tiến phụ

### 3.1 Xóa `tracktaco/` folder

**Action:** Xóa folder vì empty, hoặc implement nếu có kế hoạch.

### 3.2 Data export (CSV)

**Files:**

- `server/api/export/csv/[resource].post.ts` (tạo mới)
- `app/composables/useExport.ts` (tạo mới)

**Implementation:**

- Export orders, products, payments ra CSV
- Dùng `json2csv` hoặc tự build
- Streaming response cho dữ liệu lớn

### 3.3 Dashboard/Analytics

**Files:**

- `app/pages/dashboard/index.vue` (tạo mới)
- `server/api/dashboard/summary.get.ts` (tạo mới)

**Metrics:**

- Total revenue (today/week/month)
- Total orders
- New customers
- Top products
- Pending fulfillments

### 3.4 Multi-store search

**Files:**

- `app/pages/search/index.vue` (tạo mới)
- `server/api/search/[resource].post.ts` (tạo mới)

**Implementation:**

```ts
// POST /api/search/orders
// Body: { query: string, storeIds: string[] }
// Query mỗi store song song, aggregate results
```

### 3.5 Audit log

**Files:**

- `server/utils/audit-log.ts` (tạo mới)
- Audit events: token rotate, product update, store delete...

**Implementation:**

```ts
// Lưu vào file JSON hoặc DB nhẹ (SQLite/better-sqlite3)
// Format: { timestamp, action, storeId, userId, details }
```

---

## Phụ lục: File dependency tree

```
app/ (Nuxt frontend)
├── composables/
│   ├── useLocalStorage.ts        ← P0.2 Encrypt
│   ├── useTokenRotation.ts       ← P0.4 Fix interval
│   ├── useStores.ts
│   ├── useOrders.ts
│   ├── useProducts.ts
│   ├── usePayments.ts
│   ├── useCustomers.ts           ← P1.3 New
│   └── useTheme.ts              ← P2.5 New
├── components/
│   ├── icons/
│   ├── profile/
│   ├── shop/
│   ├── payment/
│   ├── status/
│   ├── SheetDataModal.vue        ← P2.2 Confirm
│   └── OrderTransactions.vue
├── pages/
│   ├── manager.vue               ← P2.2 Confirm + P2.1 i18n
│   ├── shop.vue
│   ├── payment/index.vue         ← P2.3 Fix transactionsCount
│   ├── payment/payout/[id].vue
│   ├── customer/                 ← P1.3 New
│   ├── dashboard/                ← P3.3 New
│   └── search/                   ← P3.4 New
├── layouts/
│   ├── shop.vue
│   └── manager.vue
├── stores/
│   ├── orders.ts                 ← P1.2 Typed
│   ├── products.ts               ← P1.2 Typed
│   ├── shops.ts                  ← P1.2 Typed
│   ├── payment.ts                ← P1.2 Typed
│   ├── customers.ts              ← P1.3 New
│   └── app.ts
├── locales/                      ← P2.1 New
│   ├── en.json
│   └── vi.json
└── app.vue                       ← P2.4 Scrollbar + P2.5 Dark mode

server/ (Nitro backend)
├── api/
│   ├── generate-token.post.ts
│   ├── fulfillments/[id].post.ts ← P0.1 Wrapper
│   ├── order/
│   │   ├── all.post.ts           ← P0.1 + P1.4 Pagination
│   │   ├── [id].get.ts           ← P0.1
│   │   ├── [id]/transactions.get.ts ← P0.1
│   │   ├── [id]/fulfillment_orders.get.ts ← P0.1
│   │   └── [id]/fulfill.post.ts  ← P0.1
│   ├── payment/
│   │   ├── all.post.ts           ← P0.1
│   │   ├── balance-transactions.post.ts ← P0.1
│   │   └── payout/
│   │       ├── [id].get.ts       ← P0.1
│   │       ├── all.post.ts       ← P0.1
│   │       └── transactions.post.ts ← P0.1
│   ├── product/
│   │   ├── [id].delete.ts        ← P0.1
│   │   ├── [id].put.ts           ← P0.1
│   │   ├── all.post.ts           ← P0.1
│   │   └── create.post.ts        ← P0.1
│   ├── shop/profile.post.ts      ← P0.1 (redundant?)
│   ├── customer/                 ← P1.3 New
│   ├── graphql.post.ts           ← P1.3 New
│   ├── dashboard/                ← P3.3 New
│   ├── search/                   ← P3.4 New
│   └── export/                   ← P3.2 New
├── middleware/
│   └── rateLimit.ts              ← P0.3 New
└── utils/
    ├── callShopifyApi.ts          ← P0.1 New (wrapper)
    ├── shopify-status-checker.ts
    ├── status-proxy-agent.ts      ← P1.1 Remove
    └── google-sheet-client.ts

utils/ (Shared)
├── proxy/
│   ├── proxy.ts                  ← P1.1 Fix protocol
│   └── store-proxy.ts            ← P0.1 Remove
├── order.ts                      ← P1.2 Typed
└── index.ts

types/
└── index.ts                      ← P1.2 Add Shopify interfaces
```
