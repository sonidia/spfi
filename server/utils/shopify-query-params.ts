export function pickPrimitiveQueryParams(
  input: Record<string, unknown> | null | undefined,
  allowedKeys: readonly string[],
) {
  const params: Record<string, string | number | boolean> = {};

  for (const key of allowedKeys) {
    const value = input?.[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = value;
    }
  }

  return params;
}
