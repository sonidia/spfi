import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVariantsFromOptions,
  isProductPriceChanged,
  isValidCompareAtPrice,
  isValidProductPrice,
  normalizeProductPriceInput,
  normalizeProductOptions,
} from "../utils/product-options.ts";

test("product options are trimmed, deduplicated, and expanded into variants", () => {
  const options = normalizeProductOptions([
    { name: " Color ", values: "Black, White, Black" },
    { name: "Size", values: ["S", "M"] },
  ]);
  const variants = buildVariantsFromOptions(options, { price: "19.90" });

  assert.deepEqual(options, [
    { name: "Color", position: 1, values: ["Black", "White"] },
    { name: "Size", position: 2, values: ["S", "M"] },
  ]);
  assert.deepEqual(
    variants.map(({ option1, option2, price }) => ({ option1, option2, price })),
    [
      { option1: "Black", option2: "S", price: "19.90" },
      { option1: "Black", option2: "M", price: "19.90" },
      { option1: "White", option2: "S", price: "19.90" },
      { option1: "White", option2: "M", price: "19.90" },
    ],
  );
});

test("variant expansion rejects incomplete options and REST-limit overflow", () => {
  assert.throws(
    () => normalizeProductOptions([{ name: "Color", values: "" }]),
    /requires a name and at least one value/i,
  );
  const options = normalizeProductOptions([
    { name: "Color", values: Array.from({ length: 11 }, (_, index) => `C${index}`) },
    { name: "Size", values: Array.from({ length: 10 }, (_, index) => `S${index}`) },
  ]);
  assert.throws(() => buildVariantsFromOptions(options, {}, 100), /110 variants/i);
});

test("product prices accept locale decimal separators and normalize for Shopify", () => {
  assert.equal(isValidProductPrice("0"), true);
  assert.equal(isValidProductPrice("19.99"), true);
  assert.equal(isValidProductPrice("48,88"), true);
  assert.equal(normalizeProductPriceInput("48,88"), "48.88");
  assert.equal(normalizeProductPriceInput("00048,80"), "48.80");
  assert.equal(isValidProductPrice("19.999"), false);
  assert.equal(isValidProductPrice("-1"), false);
  assert.equal(isValidProductPrice("1,234.56"), false);
  assert.equal(isValidCompareAtPrice("48,88", "50,00"), true);
  assert.equal(isValidCompareAtPrice("48,88", "48,88"), false);
});

test("price change detection ignores display-only decimal formatting", () => {
  assert.equal(isProductPriceChanged("19.9", "19.90"), false);
  assert.equal(isProductPriceChanged("19,9", "19.90"), false);
  assert.equal(isProductPriceChanged("", null), false);
  assert.equal(isProductPriceChanged("20.00", "19.90"), true);
  assert.equal(isProductPriceChanged("invalid", "19.90"), true);
});
