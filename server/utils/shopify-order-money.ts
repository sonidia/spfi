interface ParsedDecimal {
  units: bigint;
  scale: number;
}

const BIGINT_ZERO = BigInt(0);
const BIGINT_TEN = BigInt(10);

function parseDecimal(value: string): ParsedDecimal {
  const normalized = String(value || "0").trim();
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("Shopify returned an invalid amount.");
  const fraction = match[3] || "";
  const units = BigInt(`${match[1] || ""}${match[2]}${fraction}`);
  return { units, scale: fraction.length };
}

function alignDecimals(left: ParsedDecimal, right: ParsedDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.units * BIGINT_TEN ** BigInt(scale - left.scale),
    right: right.units * BIGINT_TEN ** BigInt(scale - right.scale),
    scale,
  };
}

function formatDecimal(units: bigint, scale: number) {
  const negative = units < BIGINT_ZERO;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const value = scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "")
    : digits;
  return `${negative ? "-" : ""}${value || "0"}`;
}

export function subtractDecimal(leftValue: string, rightValue: string) {
  const { left, right, scale } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return formatDecimal(left - right, scale);
}

export function sumDecimal(values: string[]) {
  return values.reduce((total, value) => addDecimal(total, value), "0");
}

export function addDecimal(leftValue: string, rightValue: string) {
  const { left, right, scale } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return formatDecimal(left + right, scale);
}

export function compareDecimal(leftValue: string, rightValue: string) {
  const { left, right } = alignDecimals(
    parseDecimal(leftValue),
    parseDecimal(rightValue),
  );
  return left === right ? 0 : left > right ? 1 : -1;
}
