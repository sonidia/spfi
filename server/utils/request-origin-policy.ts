const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface ApiOriginPolicyInput {
  method: string;
  origin?: string;
  fetchSite?: string;
  allowedOrigins?: unknown;
  requireOrigin?: boolean;
  allowHostFallback?: boolean;
  requestOrigin?: string;
}

export interface ApiOriginPolicyResult {
  allowed: boolean;
  responseOrigin?: string;
}

export function evaluateApiOriginPolicy({
  method,
  origin,
  fetchSite,
  allowedOrigins,
  requireOrigin = true,
  allowHostFallback = false,
  requestOrigin,
}: ApiOriginPolicyInput): ApiOriginPolicyResult {
  const normalizedFetchSite = String(fetchSite || "")
    .trim()
    .toLowerCase();
  const configuredOrigins = parseOrigins(allowedOrigins);

  if (origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) return { allowed: false };

    const allowedByConfiguration = configuredOrigins.has(normalizedOrigin);
    const requestMatchesOrigin =
      normalizeOrigin(requestOrigin || "") === normalizedOrigin;
    const allowedByFetchMetadata =
      normalizedFetchSite === "same-origin" && requestMatchesOrigin;
    const allowedByHostFallback = allowHostFallback && requestMatchesOrigin;

    return {
      allowed:
        allowedByConfiguration || allowedByFetchMetadata || allowedByHostFallback,
      // CORS headers are emitted only for explicitly configured cross-origin
      // clients. Same-origin and Host fallback requests do not need ACAO.
      ...(allowedByConfiguration ? { responseOrigin: normalizedOrigin } : {}),
    };
  }

  if (method.toUpperCase() === "OPTIONS") return { allowed: false };
  if (["cross-site", "same-site"].includes(normalizedFetchSite)) {
    return { allowed: false };
  }

  if (
    requireOrigin &&
    UNSAFE_METHODS.has(method.toUpperCase()) &&
    normalizedFetchSite !== "same-origin"
  ) {
    return { allowed: false };
  }

  return { allowed: true };
}

export function parseOrigins(value: unknown) {
  const origins = new Set<string>();

  for (const item of String(value || "").split(",")) {
    const origin = normalizeOrigin(item);
    if (origin) origins.add(origin);
  }

  return origins;
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return url.origin.toLowerCase();
  } catch {
    return "";
  }
}
