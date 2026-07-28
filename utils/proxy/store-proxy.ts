import { type H3Event, getCookie, parseCookies } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export type StoreCookieData = {
  domain?: string;
  sock?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  expiresTime?: number;
};

const INVISIBLE_OR_CONTROL_CHARS =
  /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g;
const PROXY_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SOCKS5_PROTOCOL_PATTERN = /^socks5h?:\/\//i;
const SOCKS5H_PROTOCOL = "socks5h:";

export type ProxyInputMeta = {
  hasScheme: boolean;
  segmentCount: number;
  usernameLength: number;
  passwordLength: number;
  hasInvisibleChars: boolean;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizePart(value: string) {
  return String(value || "").replace(INVISIBLE_OR_CONTROL_CHARS, "").trim();
}

function normalizeCredential(value: string) {
  return encodeURIComponent(safeDecode(sanitizePart(value)));
}

export function hasInvisibleOrControlChars(value: string): boolean {
  return INVISIBLE_OR_CONTROL_CHARS.test(String(value || ""));
}

export function inspectProxyInput(input: string): ProxyInputMeta {
  const raw = String(input || "");
  const hasScheme = SOCKS5_PROTOCOL_PATTERN.test(raw);

  if (hasScheme) {
    try {
      const parsed = new URL(raw);
      const username = safeDecode(parsed.username || "");
      const password = safeDecode(parsed.password || "");
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: username.length,
        passwordLength: password.length,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    } catch {
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: 0,
        passwordLength: 0,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    }
  }

  const parts = raw.split(":");
  const username = sanitizePart(parts[2] || "");
  const password = sanitizePart(parts.slice(3).join(":") || "");

  return {
    hasScheme: false,
    segmentCount: parts.length,
    usernameLength: username.length,
    passwordLength: password.length,
    hasInvisibleChars: hasInvisibleOrControlChars(raw),
  };
}

function tryParseCookieValue(rawValue: string): StoreCookieData | null {
  if (!rawValue) return null;

  const candidates = [
    rawValue,
    rawValue.startsWith("j:") ? rawValue.slice(2) : rawValue,
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as StoreCookieData;
      }
    } catch {
      // Try fallback decode below
    }

    try {
      const decoded = decodeURIComponent(candidate);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        return parsed as StoreCookieData;
      }
    } catch {
      // Ignore malformed cookie values
    }
  }

  return null;
}

function toRawProxyVariant(sock: string): string | null {
  const raw = sanitizePart(sock || "");
  if (!raw) return null;

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    return raw.replace(/^socks5:\/\//i, "socks5h://");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw)) {
    return null;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const host = (parts[0] || "").trim();
  const port = (parts[1] || "").trim();
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5h://${host}:${port}`;
  }

  const user = (parts[2] || "").trim();
  const pass = parts
    .slice(3)
    .join(":")
    .replace(INVISIBLE_OR_CONTROL_CHARS, "")
    .trim();
  if (!user || !pass) return null;

  return `socks5h://${user}:${pass}@${host}:${port}`;
}

export function resolveStoreCookieData(
  event: H3Event,
  storeId: string,
): StoreCookieData | null {
  const headerData = event.node?.req?.headers?.["x-store-data"];
  if (typeof headerData === "string" && headerData.length > 0) {
    const parsed = tryParseCookieValue(headerData);
    if (parsed) return parsed;
  }

  const normalizedStoreId = String(storeId || "").trim();
  if (!normalizedStoreId) return null;

  const normalizedDomain = normalizedStoreId.includes(".")
    ? normalizedStoreId.toLowerCase()
    : `${normalizedStoreId}.myshopify.com`.toLowerCase();
  const shortId = normalizedStoreId.split(".")[0] || "";
  const directKeys = Array.from(new Set([normalizedStoreId, shortId])).filter(
    (key): key is string => typeof key === "string" && key.length > 0,
  );

  for (const key of directKeys) {
    const cookieValue = getCookie(event, key);
    if (typeof cookieValue !== "string") continue;

    const parsed = tryParseCookieValue(cookieValue);
    if (parsed) return parsed;
  }

  const allCookies = parseCookies(event);
  for (const rawValue of Object.values(allCookies)) {
    if (typeof rawValue !== "string") continue;

    const parsed = tryParseCookieValue(rawValue);
    if (!parsed) continue;

    const domain = String(parsed.domain || "")
      .trim()
      .toLowerCase();
    if (domain && domain === normalizedDomain) {
      return parsed;
    }
  }

  return null;
}

export function resolveStoreDomain(
  storeId: string,
  cookieDomain?: string,
): string {
  const fromCookie = String(cookieDomain || "").trim();
  if (fromCookie) return fromCookie;

  const normalized = String(storeId || "").trim();
  if (!normalized) return "";
  return normalized.includes(".") ? normalized : `${normalized}.myshopify.com`;
}

export function resolveStoreAdminDomain(
  storeId: string,
  _cookieDomain?: string,
): string {
  const sid = String(storeId || "").trim();
  if (sid.includes(".myshopify.com")) return sid;
  return `${sid}.myshopify.com`;
}

export function normalizeProxyUrl(input: string): string {
  const raw = sanitizePart(input || "");

  if (!raw) {
    throw new Error("Proxy is empty.");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw) && !SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    throw new Error(
      "Only SOCKS5 proxy is supported. Use host:port or host:port:user:pass.",
    );
  }

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    const parsed = new URL(raw);

    if (parsed.username) {
      parsed.username = normalizeCredential(parsed.username);
    }

    if (parsed.password) {
      parsed.password = normalizeCredential(parsed.password);
    }

    parsed.hostname = sanitizePart(parsed.hostname);
    if (parsed.port) {
      parsed.port = sanitizePart(parsed.port);
    }

    parsed.protocol = SOCKS5H_PROTOCOL;

    return parsed.toString();
  }

  const parts = raw.split(":").map((part) => sanitizePart(part));
  if (parts.length < 2) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  const [host, port, ...credentials] = parts;
  if (!host || !port) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  if (credentials.length === 0) {
    return `socks5h://${host}:${port}`;
  }

  const username = sanitizePart(credentials.shift() || "");
  const password = sanitizePart(credentials.join(":") || "");
  if (!username || !password) {
    throw new Error(
      "Invalid proxy credentials. Use ip:port:user:pass when auth is required.",
    );
  }

  return `socks5h://${normalizeCredential(username)}:${normalizeCredential(
    password,
  )}@${host}:${port}`;
}

export function buildProxyVariants(sock: string): string[] {
  const raw = String(sock || "").trim();
  if (!raw) return [];

  const rawVariant = toRawProxyVariant(raw);

  const variants = [
    normalizeProxyUrl(raw),
    ...(rawVariant ? [rawVariant] : []),
  ];

  return variants.filter(
    (variant, index) =>
      variants.findIndex((candidate) => candidate === variant) === index,
  );
}

export function createProxyAgent(proxyUrl: string) {
  return proxyUrl.startsWith("http")
    ? new HttpsProxyAgent(proxyUrl)
    : new SocksProxyAgent(proxyUrl);
}

export function maskProxyUrl(proxyUrl: string): string {
  return proxyUrl.replace(/\/\/([^:/@]+):([^@]+)@/, "//****:****@");
}
