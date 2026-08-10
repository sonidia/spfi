const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);

/**
 * Parses JSON without rounding integer literals outside JavaScript's safe
 * range. Unsafe integers become decimal strings; all other JSON values keep
 * their native types.
 */
export function parseJsonPreservingUnsafeIntegers(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return value;

  try {
    return JSON.parse(quoteUnsafeIntegerLiterals(value));
  } catch {
    return value;
  }
}

export function quoteUnsafeIntegerLiterals(json: string) {
  let output = "";
  let index = 0;

  while (index < json.length) {
    const character = json[index];

    if (character === '"') {
      const stringEnd = findJsonStringEnd(json, index);
      output += json.slice(index, stringEnd);
      index = stringEnd;
      continue;
    }

    if (character === "-" || isDigit(character)) {
      const match = json.slice(index).match(JSON_NUMBER_PREFIX);
      const literal = match?.[0];

      if (literal) {
        output += isUnsafeIntegerLiteral(literal)
          ? JSON.stringify(literal)
          : literal;
        index += literal.length;
        continue;
      }
    }

    output += character;
    index += 1;
  }

  return output;
}

const JSON_NUMBER_PREFIX =
  /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

function findJsonStringEnd(json: string, start: number) {
  let escaped = false;

  for (let index = start + 1; index < json.length; index += 1) {
    const character = json[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') return index + 1;
  }

  return json.length;
}

function isDigit(value: string | undefined) {
  return Boolean(value && value >= "0" && value <= "9");
}

function isUnsafeIntegerLiteral(value: string) {
  if (value.includes(".") || /e/i.test(value)) return false;

  try {
    const integer = BigInt(value);
    return integer > MAX_SAFE_INTEGER || integer < MIN_SAFE_INTEGER;
  } catch {
    return false;
  }
}
