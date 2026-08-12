export type ProfileFieldRow = {
  key: string;
  label: string;
  value: string;
  isMultiline?: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  id: "Shop ID",
  name: "Name",
  email: "Email",
  domain: "Primary domain",
  myshopify_domain: "MyShopify domain",
  shop_owner: "Shop owner",
  customer_email: "Customer email",
  phone: "Phone",
  address1: "Address 1",
  address2: "Address 2",
  city: "City",
  province: "Province",
  province_code: "Province code",
  country: "Country",
  country_code: "Country code",
  zip: "ZIP",
  currency: "Currency",
  money_format: "Money format",
  money_with_currency_format: "Money with currency format",
  timezone: "Timezone",
  iana_timezone: "IANA timezone",
  plan_name: "Plan",
  plan_display_name: "Plan display name",
  created_at: "Created at",
  updated_at: "Updated at",
  enabled_presentment_currencies: "Presentment currencies",
  taxes_included: "Taxes included",
  tax_shipping: "Tax shipping",
  county_taxes: "County taxes",
  has_discounts: "Has discounts",
  has_gift_cards: "Has gift cards",
  eligible_for_payments: "Eligible for payments",
  requires_extra_payments_agreement: "Requires extra payments agreement",
  password_enabled: "Password enabled",
  setup_required: "Setup required",
  pre_launch_enabled: "Pre-launch enabled",
};

const FIELD_ORDER = [
  "id",
  "name",
  "email",
  "customer_email",
  "shop_owner",
  "domain",
  "myshopify_domain",
  "phone",
  "address1",
  "address2",
  "city",
  "province",
  "province_code",
  "country",
  "country_code",
  "zip",
  "currency",
  "money_format",
  "money_with_currency_format",
  "timezone",
  "iana_timezone",
  "plan_name",
  "plan_display_name",
  "created_at",
  "updated_at",
];

export function humanizeProfileKey(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatProfileValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function buildShopProfileRows(
  shop: Record<string, unknown> | null,
): ProfileFieldRow[] {
  if (!shop) return [];

  return Object.entries(shop)
    .sort(([keyA], [keyB]) => {
      const indexA = FIELD_ORDER.indexOf(keyA);
      const indexB = FIELD_ORDER.indexOf(keyB);

      if (indexA === -1 && indexB === -1) return keyA.localeCompare(keyB);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    .map(([key, value]) => ({
      key,
      label: humanizeProfileKey(key),
      value: formatProfileValue(value),
      isMultiline:
        !!value && typeof value === "object" && !Array.isArray(value),
    }));
}

export function formatProfileTimestamp(value: unknown): string {
  if (!value) return "-";

  const date =
    typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
}
