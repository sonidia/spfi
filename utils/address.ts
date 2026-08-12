import type { ShopifyAddress } from "../types/shopify";

export function getAddressLines(addr?: ShopifyAddress | null): string[] {
  if (!addr) return [];

  return [
    normalizeAddressPart(addr.name),
    normalizeAddressPart(addr.company),
    normalizeAddressPart(addr.address1),
    normalizeAddressPart(addr.address2),
    [
      normalizeAddressPart(addr.city),
      normalizeAddressPart(addr.province_code) || normalizeAddressPart(addr.province),
      normalizeAddressPart(addr.zip),
    ]
      .filter(Boolean)
      .join(" "),
    normalizeAddressPart(addr.country),
  ].filter((line): line is string => Boolean(line));
}

function normalizeAddressPart(value?: string | null) {
  if (!value || value === "None") return "";
  return value;
}
