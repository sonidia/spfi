export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface AppErrorData {
  data?: {
    error?: {
      message?: unknown;
    };
  };
  error?: {
    message?: unknown;
  };
  message?: unknown;
  statusMessage?: unknown;
}

export interface AppErrorLike {
  data?: AppErrorData;
  message?: unknown;
}

export interface StoreLocalData {
  domain?: string;
  sock?: string;
  clientId?: string;
  /**
   * Legacy plaintext fields. They are read only during the one-time vault
   * migration and are never written back to localStorage.
   */
  clientSecret?: string;
  accessToken?: string;
  expiresTime?: number;
  encryptedCredentials?: EncryptedPayload;
}

export interface StoreCredentials {
  clientSecret?: string;
  accessToken?: string;
}

export interface EncryptedPayload {
  version: 1;
  iv: string;
  ciphertext: string;
}

export interface CredentialVaultMetadata {
  version: 1;
  salt: string;
  verifier: EncryptedPayload;
}

export interface ShopifyMoneySet {
  shop_money?: {
    amount?: string;
    currency_code?: string;
  };
  presentment_money?: {
    amount?: string;
    currency_code?: string;
  };
}

export interface ShopifyAddress {
  name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  province_code?: string | null;
  zip?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ShopifyCustomerAddress extends ShopifyAddress {
  id?: number;
  customer_id?: number;
  first_name?: string | null;
  last_name?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  default?: boolean;
}

export interface ShopifyMarketingConsent {
  state?: string | null;
  opt_in_level?: string | null;
  consent_updated_at?: string | null;
  consent_collected_from?: string | null;
}

export interface ShopifyCustomer {
  id?: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  orders_count?: number;
  total_spent?: string;
  currency?: string;
  state?: string;
  tags?: string;
  note?: string | null;
  verified_email?: boolean;
  tax_exempt?: boolean;
  created_at?: string;
  updated_at?: string;
  last_order_id?: number | null;
  last_order_name?: string | null;
  email_marketing_consent?: ShopifyMarketingConsent | null;
  sms_marketing_consent?: ShopifyMarketingConsent | null;
  default_address?: ShopifyCustomerAddress | null;
  addresses?: ShopifyCustomerAddress[];
}

export interface ShopifyLineItem {
  id: number;
  name?: string;
  title?: string;
  variant_title?: string | null;
  sku?: string | null;
  price?: string;
  quantity?: number;
  fulfillable_quantity?: number;
  product_id?: number | null;
  variant_id?: number | null;
}

export interface ShopifyFulfillment {
  id?: number;
  name?: string;
  status?: string;
  service?: string;
  shipment_status?: string | null;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  created_at?: string;
  line_items?: ShopifyLineItem[];
}

export interface ShopifyOrder {
  id: number;
  name?: string;
  order_number: number;
  created_at: string;
  closed_at?: string | null;
  cancelled_at?: string | null;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  current_total_price?: string;
  subtotal_price?: string;
  current_subtotal_price?: string;
  total_tax?: string;
  current_total_tax?: string;
  total_discounts?: string;
  current_total_discounts?: string;
  total_shipping_price_set?: ShopifyMoneySet;
  currency: string;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  note?: string | null;
  source_name?: string;
  referring_site?: string | null;
  customer?: ShopifyCustomer | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  shipping_lines?: Array<{ title?: string }>;
  line_items: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
}

export interface ShopifyVariant {
  id: number;
  title?: string;
  price?: string;
  sku?: string | null;
  inventory_item_id?: number;
  inventory_management?: string | null;
  inventory_policy?: string;
  inventory_quantity?: number;
}

export interface ShopifyProductImage {
  id?: number;
  src: string;
  alt?: string | null;
}

export interface ShopifyProductInput {
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
}

export interface ShopifyProduct extends ShopifyProductInput {
  id: number;
  status: string;
  variants: ShopifyVariant[];
  image?: ShopifyProductImage | null;
  images?: ShopifyProductImage[];
  updated_at?: string;
}

export interface ShopifyPayoutSummary {
  adjustments_fee_amount: string;
  adjustments_gross_amount: string;
  charges_fee_amount: string;
  charges_gross_amount: string;
  refunds_fee_amount: string;
  refunds_gross_amount: string;
  reserved_funds_fee_amount: string;
  reserved_funds_gross_amount: string;
  retried_payouts_fee_amount: string;
  retried_payouts_gross_amount: string;
}

export interface ShopifyBankAccount {
  bank_name?: string;
  title?: string;
  account_number?: string;
  routing_number?: string;
}

export interface ShopifyPayout {
  id: number;
  status: string;
  date: string;
  currency: string;
  amount: string;
  summary: ShopifyPayoutSummary;
  bank_account?: ShopifyBankAccount | null;
}

export interface ShopifyBalance {
  currency: string;
  amount: string;
  on_hold_amount?: string;
  pending_amount?: string;
}

export interface ShopifyBalanceTransaction {
  id: number;
  type: string;
  test: boolean;
  payout_id: number | null;
  payout_status: string;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  source_id: number | null;
  source_type: string | null;
  source_order_id: number | null;
  source_order_transaction_id: number | null;
  processed_at: string;
  adjustment_order_transactions: unknown;
  adjustment_reason: string | null;
}

export interface ShopifyShop {
  id?: number;
  name?: string;
  email?: string;
  domain?: string;
  myshopify_domain?: string;
  shop_owner?: string;
  customer_email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  currency?: string;
  money_format?: string;
  money_with_currency_format?: string;
  timezone?: string;
  iana_timezone?: string;
  plan_name?: string;
  plan_display_name?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ShopifyFulfillmentOrderLineItem {
  id: number;
  quantity: number;
  fulfillable_quantity?: number;
}

export interface ShopifyFulfillmentOrder {
  id: number;
  status?: string;
  line_items?: ShopifyFulfillmentOrderLineItem[];
}

export interface ShopifyLocation {
  id: number;
  name?: string;
  active?: boolean;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  province?: string | null;
  province_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  phone?: string | null;
  legacy?: boolean;
  created_at?: string;
  updated_at?: string;
  localized_country_name?: string | null;
  localized_province_name?: string | null;
  admin_graphql_api_id?: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number | null;
  updated_at?: string;
  admin_graphql_api_id?: string;
}

export interface ShopifyAccessTokenResponse {
  access_token?: string;
  scope?: string;
  expires_in?: number;
  associated_user_scope?: string;
}

export interface OrdersResponse {
  orders?: ShopifyOrder[];
  order?: ShopifyOrder;
}

export interface ProductsResponse {
  products?: ShopifyProduct[];
  product?: ShopifyProduct;
}

export interface CustomersResponse {
  customers?: ShopifyCustomer[];
  customer?: ShopifyCustomer;
}

export interface CustomerDetailResponse {
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];
}

export interface ShopifyMetafield {
  id: number | string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string | null;
  owner_id?: number | string;
  owner_resource?: string;
  created_at?: string;
  updated_at?: string;
  admin_graphql_api_id?: string;
}

export interface MetafieldsResponse {
  metafields?: ShopifyMetafield[];
  metafield?: ShopifyMetafield;
}

export interface InventoryLevelsResponse {
  inventory_levels?: ShopifyInventoryLevel[];
}

export interface LocationsResponse extends InventoryLevelsResponse {
  locations?: ShopifyLocation[];
  location?: ShopifyLocation;
}

export interface ShopProfileResponse {
  shop: ShopifyShop | null;
  domain: string;
}

export interface BalanceTransactionsResponse {
  transactions: ShopifyBalanceTransaction[];
}

export interface PaymentsOverviewResponse {
  balance: ShopifyBalance | ShopifyBalance[] | null;
  payouts: ShopifyPayout[];
  transactionsByPayout: Record<string, ShopifyBalanceTransaction[]>;
}

export interface PayoutsResponse {
  payouts: ShopifyPayout[];
}

export interface PayoutDetailResponse {
  payout: ShopifyPayout | null;
  transactions: ShopifyBalanceTransaction[];
}
