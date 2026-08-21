import { createApiErrorFromMessage } from "./callShopifyApi";
import { requireShopifyGid } from "./shopify-commerce-ops-id";
import type {
  ShopifyMarketDutyStrategy,
  ShopifyMarketRegionInput,
  ShopifyMarketShippingOptionInput,
  ShopifyMarketShippingOptionType,
  ShopifyMarketTaxStrategy,
} from "~~/types/shopify-market";

const TAX_STRATEGIES = new Set<ShopifyMarketTaxStrategy>([
  "ADD_TAXES_AT_CHECKOUT",
  "INCLUDES_TAXES_IN_PRICE",
  "INCLUDES_TAXES_IN_PRICE_BASED_ON_COUNTRY",
]);
const DUTY_STRATEGIES = new Set<ShopifyMarketDutyStrategy>([
  "ADD_DUTIES_AT_CHECKOUT",
  "INCLUDE_DUTIES_IN_PRICE",
]);
const SHIPPING_TYPES = new Set<ShopifyMarketShippingOptionType>([
  "CARRIER_CALCULATED",
  "FLAT_RATE",
  "VALUE_BASED",
  "WEIGHT_BASED",
]);

export function requireMarketId(value: unknown) {
  return requireShopifyGid(value, "Market");
}

export function requireGenericShopifyGid(value: unknown, label = "Resource ID") {
  const id = String(value || "").trim();
  if (!/^gid:\/\/shopify\/[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_-]+$/.test(id)) {
    throw createApiErrorFromMessage(`${label} must be a valid Shopify GID.`, 400);
  }
  return id;
}

export function normalizeMarketRegions(value: unknown): ShopifyMarketRegionInput[] {
  if (!Array.isArray(value)) {
    throw createApiErrorFromMessage("Regions must be an array.", 400);
  }
  if (value.length > 250) {
    throw createApiErrorFromMessage(
      "A single update supports at most 250 regions.",
      400,
    );
  }

  const seen = new Set<string>();
  return value.map((entry, index) => {
    const row = asRecord(entry, `Region ${index + 1}`);
    const countryCode = normalizeCountryCode(row.countryCode);
    const subdivision = String(row.subdivision || "")
      .trim()
      .toUpperCase();
    if (subdivision && !/^[A-Z0-9-]{1,32}$/.test(subdivision)) {
      throw createApiErrorFromMessage(
        `Region ${index + 1} has an invalid subdivision code.`,
        400,
      );
    }
    const key = `${countryCode}:${subdivision}`;
    if (seen.has(key)) {
      throw createApiErrorFromMessage(`Duplicate region ${key}.`, 400);
    }
    seen.add(key);
    return { countryCode, ...(subdivision ? { subdivision } : {}) };
  });
}

export function normalizeCountryCode(value: unknown) {
  const countryCode = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw createApiErrorFromMessage(
      "Country code must be a two-letter ISO 3166-1 code.",
      400,
    );
  }
  return countryCode;
}

export function normalizeCurrencyCode(value: unknown) {
  const currency = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createApiErrorFromMessage("Currency must be a three-letter code.", 400);
  }
  return currency;
}

export function normalizeMoney(value: unknown, label: string, allowEmpty = false) {
  const text = String(value ?? "").trim();
  if (allowEmpty && !text) return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text)) {
    throw createApiErrorFromMessage(`${label} must be a non-negative decimal.`, 400);
  }
  return text;
}

export function normalizeManualRate(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (!/^(?:0\.(?:0*[1-9]\d*)|[1-9]\d*(?:\.\d+)?)$/.test(text)) {
    throw createApiErrorFromMessage(
      "Manual exchange rate must be greater than zero.",
      400,
    );
  }
  return text;
}

export function normalizeTaxStrategy(value: unknown): ShopifyMarketTaxStrategy {
  const strategy = String(value || "")
    .trim()
    .toUpperCase() as ShopifyMarketTaxStrategy;
  if (!TAX_STRATEGIES.has(strategy)) {
    throw createApiErrorFromMessage("Invalid tax pricing strategy.", 400);
  }
  return strategy;
}

export function normalizeDutyStrategy(value: unknown): ShopifyMarketDutyStrategy {
  const strategy = String(value || "")
    .trim()
    .toUpperCase() as ShopifyMarketDutyStrategy;
  if (!DUTY_STRATEGIES.has(strategy)) {
    throw createApiErrorFromMessage("Invalid duties pricing strategy.", 400);
  }
  return strategy;
}

export function normalizeShippingOption(
  value: unknown,
): ShopifyMarketShippingOptionInput {
  const row = asRecord(value, "Shipping option");
  const type = String(row.type || "")
    .trim()
    .toUpperCase() as ShopifyMarketShippingOptionType;
  if (!SHIPPING_TYPES.has(type)) {
    throw createApiErrorFromMessage("Invalid shipping option type.", 400);
  }
  const currency = normalizeCurrencyCode(row.currency);
  const name = String(row.name || "").trim();
  const description = String(row.description || "").trim();
  const freeDeliveryMinimumValue = normalizeMoney(
    row.freeDeliveryMinimumValue,
    "Free-shipping threshold",
    true,
  );

  if (type !== "CARRIER_CALCULATED" && !name) {
    throw createApiErrorFromMessage("Shipping option name is required.", 400);
  }

  const normalized: ShopifyMarketShippingOptionInput = {
    type,
    currency,
    active: row.active !== false,
    ...(name ? { name } : {}),
    ...(description ? { description } : {}),
    ...(freeDeliveryMinimumValue ? { freeDeliveryMinimumValue } : {}),
  };

  if (type === "CARRIER_CALCULATED") {
    normalized.carrierServiceId = requireShopifyGid(
      row.carrierServiceId,
      "DeliveryCarrierService",
    );
    const adjustment = row.percentageAdjustment;
    if (adjustment !== null && adjustment !== undefined && adjustment !== "") {
      const number = Number(adjustment);
      if (!Number.isInteger(number) || number < -100 || number > 1000) {
        throw createApiErrorFromMessage(
          "Carrier adjustment must be an integer from -100 to 1000.",
          400,
        );
      }
      normalized.percentageAdjustment = number;
    }
    return normalized;
  }

  normalized.price = normalizeMoney(row.price, "Shipping price") || "0";
  if (type === "VALUE_BASED" || type === "WEIGHT_BASED") {
    normalized.minimum = normalizeMoney(row.minimum, "Minimum tier value") || "0";
    normalized.maximum = normalizeMoney(row.maximum, "Maximum tier value", true);
    if (
      normalized.maximum &&
      compareNonNegativeDecimals(normalized.maximum, normalized.minimum) < 0
    ) {
      throw createApiErrorFromMessage(
        "Maximum tier value must be greater than or equal to the minimum.",
        400,
      );
    }
  }
  if (type === "WEIGHT_BASED") {
    const unit = String(row.weightUnit || "KILOGRAMS").toUpperCase();
    if (!new Set(["GRAMS", "KILOGRAMS", "OUNCES", "POUNDS"]).has(unit)) {
      throw createApiErrorFromMessage("Invalid shipping weight unit.", 400);
    }
    normalized.weightUnit = unit as ShopifyMarketShippingOptionInput["weightUnit"];
  }
  return normalized;
}

export function normalizeStringList(value: unknown, label: string, max = 250) {
  if (!Array.isArray(value)) {
    throw createApiErrorFromMessage(`${label} must be an array.`, 400);
  }
  const items = Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  );
  if (items.length > max) {
    throw createApiErrorFromMessage(`${label} supports at most ${max} values.`, 400);
  }
  return items;
}

export function asRecord(value: unknown, label = "Input") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createApiErrorFromMessage(`${label} must be an object.`, 400);
  }
  return value as Record<string, unknown>;
}

function compareNonNegativeDecimals(left: string, right: string) {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  const normalizedLeftWhole = leftWhole.replace(/^0+/, "") || "0";
  const normalizedRightWhole = rightWhole.replace(/^0+/, "") || "0";
  if (normalizedLeftWhole.length !== normalizedRightWhole.length) {
    return normalizedLeftWhole.length > normalizedRightWhole.length ? 1 : -1;
  }
  const wholeComparison = normalizedLeftWhole.localeCompare(normalizedRightWhole);
  if (wholeComparison) return wholeComparison;
  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction
    .padEnd(fractionLength, "0")
    .localeCompare(rightFraction.padEnd(fractionLength, "0"));
}
