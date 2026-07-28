import axios, { type AxiosRequestConfig } from "axios";
import { createError, getCookie, parseCookies, type H3Event } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { useAppConfig } from "#imports";
import { StoreStatusInputError } from "./status-checker-errors";
type ShopifyApiMethod = "GET" | "POST" | "PUT" | "DELETE";
type ShopifyQueryParams = Record<string, unknown>;
type ApiErrorDetails = Record<string, unknown> | unknown[];

export type StoreCookieData = {
  domain?: string;
  sock?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  expiresTime?: number;
};

export type ProxyInputMeta = {
  hasScheme: boolean;
  segmentCount: number;
  usernameLength: number;
  passwordLength: number;
  hasInvisibleChars: boolean;
};

export interface StandardApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    status?: number;
    details?: ApiErrorDetails;
  };
}

interface CallShopifyApiOptions<TBody = unknown> {
  event: H3Event;
  storeId: string;
  token?: string;
  path: string;
  method?: ShopifyApiMethod;
  body?: TBody;
  params?: ShopifyQueryParams;
  useAdminDomain?: boolean;
  missingProxyMessage?: string;
  timeoutMs?: number;
}

interface SocksProxyAgentInternals {
  proxyUrl?: string;
  shouldLookup?: boolean;
}

const SHOPIFY_JSON_CONTENT_TYPE = "application/json";
const DEFAULT_TIMEOUT_MS = 15000;
const INVISIBLE_OR_CONTROL_CHARS =
  /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g;
const PROXY_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SOCKS5_PROTOCOL_PATTERN = /^socks5h?:\/\//i;
const SOCKS5H_PROTOCOL = "socks5h:";

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
      // Try fallback decode below.
    }

    try {
      const decoded = decodeURIComponent(candidate);
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        return parsed as StoreCookieData;
      }
    } catch {
      // Ignore malformed cookie values.
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

  const host = sanitizePart(parts[0] || "");
  const port = sanitizePart(parts[1] || "");
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5h://${host}:${port}`;
  }

  const user = sanitizePart(parts[2] || "");
  const pass = sanitizePart(parts.slice(3).join(":") || "");
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

export async function callShopifyApi<TResponse, TBody = unknown>({
  event,
  storeId,
  token,
  path,
  method = "GET",
  body,
  params,
  useAdminDomain = false,
  missingProxyMessage = "Missing sock proxy for this store. Please update it in Manager page.",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CallShopifyApiOptions<TBody>): Promise<TResponse> {
  if (!storeId) {
    throw createApiErrorFromMessage("Store ID is required.", 400);
  }

  const appConfig = useAppConfig();
  const storeCookie = resolveStoreCookieData(event, storeId);
  const accessToken = String(token || storeCookie?.accessToken || "").trim();

  if (!accessToken) {
    throw createApiErrorFromMessage("Access Token is required.", 400);
  }

  const sock = String(storeCookie?.sock || "").trim();

  if (!sock) {
    throw createApiErrorFromMessage(missingProxyMessage, 400);
  }

  const domain = useAdminDomain
    ? resolveStoreAdminDomain(storeId, storeCookie?.domain)
    : resolveStoreDomain(storeId, storeCookie?.domain);
  const baseURL = `https://${domain}/${appConfig.apiBase}`;
  const proxyVariants = resolveShopifyProxyVariants(sock);

  let lastError: unknown;

  for (const proxyUrl of proxyVariants) {
    const agent = createProxyAgent(proxyUrl);
    const requestConfig: AxiosRequestConfig<TBody> = {
      url: `${baseURL}${path.startsWith("/") ? path : `/${path}`}`,
      method,
      data: body,
      params,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": SHOPIFY_JSON_CONTENT_TYPE,
      },
      httpAgent: agent,
      httpsAgent: agent,
      timeout: timeoutMs,
    };

    try {
      const response = await axios.request<TResponse, { data: TResponse }, TBody>(
        requestConfig,
      );

      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throwShopifyApiError(lastError);
}

export function resolveShopifyProxyVariants(sock: string): string[] {
  try {
    const proxyVariants = buildProxyVariants(sock);

    if (proxyVariants.length > 0) {
      return proxyVariants;
    }
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof Error
        ? error.message
        : "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
      400,
    );
  }

  throw createApiErrorFromMessage(
    "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
    400,
  );
}

export function createSocksProxyAgents(proxy?: string) {
  const proxyVariants = buildStoreStatusProxyVariants(proxy);
  const agents: SocksProxyAgent[] = [];

  for (const proxyUrl of proxyVariants) {
    try {
      const agent = new SocksProxyAgent(proxyUrl);

      assertRemoteDnsSocks5hAgent(agent, proxyUrl);
      agents.push(agent);
    } catch (error) {
      const isLastVariant =
        proxyVariants.indexOf(proxyUrl) === proxyVariants.length - 1;

      if (!agents.length && isLastVariant) {
        throw new StoreStatusInputError(
          error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
        );
      }
    }
  }

  return agents;
}

export function describeSocksProxyRoute(agent: SocksProxyAgent) {
  const internals = agent as SocksProxyAgentInternals;
  const proxyUrl = internals.proxyUrl || "";
  const protocol = getProxyProtocol(proxyUrl);
  const dnsMode = internals.shouldLookup === false ? "remote DNS" : "local DNS";

  return `${protocol.toUpperCase()} (${dnsMode}) via ${maskProxyUrl(proxyUrl)}`;
}

export function getSocksProxyUrl(agent: SocksProxyAgent) {
  return (agent as SocksProxyAgentInternals).proxyUrl || "";
}

function buildStoreStatusProxyVariants(proxy?: string) {
  try {
    return buildProxyVariants(proxy || "");
  } catch (error) {
    throw new StoreStatusInputError(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
    );
  }
}

function assertRemoteDnsSocks5hAgent(
  agent: SocksProxyAgent,
  proxyUrl: string,
) {
  const internals = agent as SocksProxyAgentInternals;
  const protocol = getProxyProtocol(internals.proxyUrl || proxyUrl);

  if (protocol !== "socks5h" || internals.shouldLookup !== false) {
    throw new StoreStatusInputError(
      "Proxy must use SOCKS5H remote DNS for every request.",
    );
  }
}

function getProxyProtocol(proxyUrl: string) {
  try {
    return new URL(proxyUrl).protocol.replace(/:$/, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function throwShopifyApiError(error: unknown): never {
  throw createApiError(error, "Shopify request failed.");
}

export function getErrorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status || 500 : 500;
}

export function extractErrorMessage(
  error: unknown,
  fallback = "Request failed.",
): string {
  if (axios.isAxiosError(error)) {
    const responseMessage = formatResponseData(error.response?.data);
    return responseMessage || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function formatErrorMessage(error: unknown): string {
  return extractErrorMessage(error, "Shopify request failed.");
}

export function createApiError(
  error: unknown,
  fallback = "Request failed.",
): ReturnType<typeof createError> {
  const standardError = toStandardApiError(error, fallback);

  return createError({
    statusCode: standardError.error.status || 500,
    statusMessage: standardError.error.message,
    data: standardError,
  });
}

export function createApiErrorFromMessage(
  message: string,
  status = 500,
  details?: ApiErrorDetails,
): ReturnType<typeof createError> {
  return createError({
    statusCode: status,
    statusMessage: message,
    data: buildStandardApiError(message, status, undefined, details),
  });
}

export function toStandardApiError(
  error: unknown,
  fallback = "Request failed.",
): StandardApiError {
  return buildStandardApiError(
    extractErrorMessage(error, fallback),
    getErrorStatus(error),
    getErrorCode(error),
    getErrorDetails(error),
  );
}

function formatResponseData(data: unknown): string {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message || record.error || record.errors;

    if (typeof message === "string") {
      return message;
    }

    if (message) {
      return stringifyUnknown(message);
    }
  }

  return stringifyUnknown(data);
}

function stringifyUnknown(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return error.code || undefined;
  }

  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : undefined;
}

function getErrorDetails(error: unknown): ApiErrorDetails | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      return data as ApiErrorDetails;
    }
  }

  return undefined;
}

export function buildStandardApiError(
  message: string,
  status?: number,
  code?: string,
  details?: ApiErrorDetails,
): StandardApiError {
  return {
    success: false,
    error: {
      message,
      ...(code ? { code } : {}),
      ...(status ? { status } : {}),
      ...(details ? { details } : {}),
    },
  };
}

