import type { ShopifyProductOption } from "../types/shopify.ts";
import type { ShopifyVariantInput } from "../types/shopify-product.ts";

export interface ProductOptionDraft {
  name: string;
  values: string | string[];
}

export function normalizeProductOptions(
  drafts: ProductOptionDraft[],
): ShopifyProductOption[] {
  return drafts.slice(0, 3).flatMap((draft, index) => {
    const name = String(draft.name || "").trim();
    const rawValues = Array.isArray(draft.values)
      ? draft.values
      : String(draft.values || "").split(",");
    const values = Array.from(
      new Set(rawValues.map((value) => String(value).trim()).filter(Boolean)),
    );
    if (!name && !values.length) return [];
    if (!name || !values.length) {
      throw new Error("Each product option requires a name and at least one value.");
    }
    return [{ name, position: index + 1, values }];
  });
}

export function buildVariantsFromOptions(
  options: ShopifyProductOption[],
  defaults: ShopifyVariantInput,
  maximumVariants = 100,
): ShopifyVariantInput[] {
  if (!options.length) return [{ ...defaults }];

  const combinations = options.reduce<string[][]>(
    (current, option) =>
      current.flatMap((combination) =>
        option.values.map((value) => [...combination, value]),
      ),
    [[]],
  );
  if (combinations.length > maximumVariants) {
    throw new Error(
      `These options create ${combinations.length} variants; the current REST product workflow supports at most ${maximumVariants}.`,
    );
  }

  return combinations.map((combination) => ({
    ...defaults,
    option1: combination[0] || null,
    option2: combination[1] || null,
    option3: combination[2] || null,
  }));
}

/**
 * Accepts merchant-entered prices with either a period or comma decimal separator.
 * Grouping separators are deliberately rejected because values such as `1,234` are
 * ambiguous across locales. Shopify always receives the normalized period form.
 */
export function normalizeProductPriceInput(value: unknown): string | null {
  const price = String(value ?? "").trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(price)) return null;

  const [wholePart = "0", decimalPart] = price.replace(",", ".").split(".");
  const normalizedWholePart = wholePart.replace(/^0+(?=\d)/, "");
  return decimalPart === undefined
    ? normalizedWholePart
    : `${normalizedWholePart}.${decimalPart}`;
}

export function isValidProductPrice(value: unknown) {
  return normalizeProductPriceInput(value) !== null;
}

export function isValidCompareAtPrice(price: unknown, compareAtPrice: unknown) {
  const normalizedPrice = normalizeProductPriceInput(price);
  const normalizedCompareAtPrice = normalizeProductPriceInput(compareAtPrice);
  if (normalizedPrice === null || normalizedCompareAtPrice === null) return false;
  return (
    toProductPriceMinorUnits(normalizedCompareAtPrice) >
    toProductPriceMinorUnits(normalizedPrice)
  );
}

export function isProductPriceChanged(draft: unknown, current: unknown) {
  return (
    normalizeComparableProductPrice(draft) !== normalizeComparableProductPrice(current)
  );
}

function normalizeComparableProductPrice(value: unknown) {
  const price = String(value ?? "").trim();
  if (!price) return "";
  const normalized = normalizeProductPriceInput(price);
  if (normalized === null) return price;
  const [wholePart, decimalPart = ""] = normalized.split(".");
  return `${wholePart}.${decimalPart.padEnd(2, "0")}`;
}

function toProductPriceMinorUnits(normalizedPrice: string) {
  const [wholePart, decimalPart = ""] = normalizedPrice.split(".");
  return BigInt(wholePart || "0") * 100n + BigInt(decimalPart.padEnd(2, "0"));
}
