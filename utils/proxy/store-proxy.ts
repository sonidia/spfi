import { type H3Event, getCookie, parseCookies } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { normalizeProxyUrl } from "./proxy";

export type StoreCookieData = {
  domain?: string;
  sock?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  expiresTime?: number;
};

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
  const raw = String(sock || "").trim();
  if (!raw) return null;

  if (/^socks(4|4a|5|5h)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    return raw;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const host = (parts[0] || "").trim();
  const port = (parts[1] || "").trim();
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5://${host}:${port}`;
  }

  const user = (parts[2] || "").trim();
  const pass = parts
    .slice(3)
    .join(":")
    .replace(/[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!user || !pass) return null;

  return `socks5://${user}:${pass}@${host}:${port}`;
}

export function resolveStoreCookieData(
  event: H3Event,
  storeId: string,
): StoreCookieData | null {
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
