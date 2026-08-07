import type {
  ShopifyCustomer,
  ShopifyCustomerAddress,
  ShopifyMarketingConsent,
  ShopifyMetafield,
} from "./shopify";

export interface ShopifyCustomerAddressInput
  extends Record<string, unknown> {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  province_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  zip?: string | null;
  phone?: string | null;
}

export interface ShopifyCustomerInput extends Record<string, unknown> {
  id?: string | number;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  note?: string | null;
  tags?: string;
  verified_email?: boolean;
  tax_exempt?: boolean;
  tax_exemptions?: string[];
  password?: string;
  password_confirmation?: string;
  send_email_invite?: boolean;
  send_email_welcome?: boolean;
  addresses?: ShopifyCustomerAddressInput[];
  email_marketing_consent?: ShopifyMarketingConsent | null;
  sms_marketing_consent?: ShopifyMarketingConsent | null;
  metafields?: Array<Partial<ShopifyMetafield> & Record<string, unknown>>;
}

export interface ShopifyCustomerInviteInput
  extends Record<string, unknown> {
  to?: string;
  from?: string;
  bcc?: string[];
  subject?: string;
  custom_message?: string;
}

export interface CustomerCountQuery extends Record<string, unknown> {
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
}

export interface CustomerResponse {
  customer?: ShopifyCustomer;
}

export interface CustomerCountResponse {
  count: number;
}

export interface CustomerAccountActivationUrlResponse {
  account_activation_url: string;
}

export interface CustomerInviteResponse {
  customer_invite: ShopifyCustomerInviteInput;
}

export interface CustomerAddressesResponse {
  addresses?: ShopifyCustomerAddress[];
}

export interface CustomerAddressResponse {
  customer_address?: ShopifyCustomerAddress;
}
