const PAYMENT_LABEL_WORDS: Record<string, string> = {
  ach: "ACH",
  jp: "JP",
  shopify: "Shopify",
  usdc: "USDC",
  vat: "VAT",
};

/**
 * Formats both REST values (`payout_failure`) and namespaced source values
 * (`Payments::Balance::AdjustmentReversal`) without exposing implementation
 * namespaces in the UI.
 */
export function formatShopifyPaymentLabel(value: string | null | undefined) {
  const leaf = String(value || "")
    .split("::")
    .filter(Boolean)
    .pop();
  if (!leaf) return "";

  const words = leaf
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/);

  return words
    .map((word, index) => {
      const known = PAYMENT_LABEL_WORDS[word];
      if (known) return known;
      return index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
    })
    .join(" ");
}
