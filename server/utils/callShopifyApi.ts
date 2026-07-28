import axios, { type AxiosRequestConfig } from "axios";
import { createError, type H3Event } from "h3";
import { SocksProxyAgent } from "socks-proxy-agent";
import { useAppConfig } from "#imports";
import { StoreStatusInputError } from "./status-checker-errors";
import {
  buildProxyVariants,
  createProxyAgent,
  maskProxyUrl,
  resolveStoreAdminDomain,
  resolveStoreCookieData,
  resolveStoreDomain,
} from "~~/utils/proxy/store-proxy";

type ShopifyApiMethod = "GET" | "POST" | "PUT" | "DELETE";
type ShopifyQueryParams = Record<string, unknown>;

interface CallShopifyApiOptions<TBody = unknown> {
  event: H3Event;
  storeId: string;
  token: string;
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
  if (!storeId || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Store ID and Access Token are required.",
    });
  }

  const appConfig = useAppConfig();
  const storeCookie = resolveStoreCookieData(event, storeId);
  const sock = String(storeCookie?.sock || "").trim();

  if (!sock) {
    throw createError({
      statusCode: 400,
      statusMessage: missingProxyMessage,
    });
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
        "X-Shopify-Access-Token": token,
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
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error
          ? error.message
          : "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
    });
  }

  throw createError({
    statusCode: 400,
    statusMessage:
      "Invalid sock proxy format. Please verify this store's proxy in Manager page.",
  });
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
  throw createError({
    statusCode: getErrorStatus(error),
    statusMessage: formatErrorMessage(error),
  });
}

function getErrorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status || 500 : 500;
}

export function formatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseMessage = formatResponseData(error.response?.data);
    return responseMessage || error.message || "Shopify request failed.";
  }

  return error instanceof Error ? error.message : "Shopify request failed.";
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

