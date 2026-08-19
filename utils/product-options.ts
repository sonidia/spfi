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

export function isValidProductPrice(value: unknown) {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value ?? "").trim());
}

export function isProductPriceChanged(draft: unknown, current: unknown) {
  return (
    normalizeComparableProductPrice(draft) !== normalizeComparableProductPrice(current)
  );
}

function normalizeComparableProductPrice(value: unknown) {
  const price = String(value ?? "").trim();
  if (!price) return "";
  return isValidProductPrice(price) ? Number(price).toFixed(2) : price;
}
