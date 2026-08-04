import axios, { type AxiosRequestConfig } from "axios";
import type { H3Event } from "h3";
import { useAppConfig } from "#imports";
import {
  createApiError,
  createApiErrorFromMessage,
  createProxyAgent,
  resolveShopifyProxyVariants,
  resolveStoreAdminDomain,
  resolveStoreCookieData,
} from "./callShopifyApi";

interface ShopifyGraphqlError {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

interface ShopifyGraphqlEnvelope<TData> {
  data?: TData;
  errors?: ShopifyGraphqlError[];
  extensions?: Record<string, unknown>;
}

interface CallShopifyGraphqlOptions<TVariables> {
  event: H3Event;
  storeId: string;
  token?: string;
  query: string;
  variables?: TVariables;
  operationName?: string;
  timeoutMs?: number;
}

interface ShopifyGraphqlRequest<TVariables> {
  query: string;
  variables?: TVariables;
  operationName?: string;
}

const DEFAULT_GRAPHQL_TIMEOUT_MS = 15000;

export async function callShopifyGraphql<
  TData,
  TVariables extends Record<string, unknown> = Record<string, unknown>,
>({
  event,
  storeId,
  token,
  query,
  variables,
  operationName,
  timeoutMs = DEFAULT_GRAPHQL_TIMEOUT_MS,
}: CallShopifyGraphqlOptions<TVariables>): Promise<TData> {
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
    throw createApiErrorFromMessage(
      "Missing sock proxy for this store. Please update it in Manager page.",
      400,
    );
  }

  const domain = resolveStoreAdminDomain(storeId, storeCookie?.domain);
  const endpoint = `https://${domain}/${appConfig.apiBase}/graphql.json`;
  const requestBody: ShopifyGraphqlRequest<TVariables> = {
    query,
    ...(variables ? { variables } : {}),
    ...(operationName ? { operationName } : {}),
  };
  let lastTransportError: unknown;

  for (const proxyUrl of resolveShopifyProxyVariants(sock)) {
    let envelope: ShopifyGraphqlEnvelope<TData>;

    try {
      const agent = createProxyAgent(proxyUrl);
      const config: AxiosRequestConfig<ShopifyGraphqlRequest<TVariables>> = {
        url: endpoint,
        method: "POST",
        data: requestBody,
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        httpAgent: agent,
        httpsAgent: agent,
        proxy: false,
        timeout: timeoutMs,
      };
      const response = await axios.request<ShopifyGraphqlEnvelope<TData>>(config);
      envelope = response.data;
    } catch (error) {
      lastTransportError = error;
      continue;
    }

    if (envelope.errors?.length) {
      throw createApiErrorFromMessage(
        envelope.errors.map((error) => error.message).join("; "),
        422,
        envelope.errors,
      );
    }
    if (!envelope.data) {
      throw createApiErrorFromMessage(
        "Shopify GraphQL response did not include data.",
        502,
      );
    }

    return envelope.data;
  }

  throw createApiError(lastTransportError, "Shopify GraphQL request failed.");
}

export function toShopifyGid(resource: string, id: string | number) {
  const value = String(id || "").trim();
  if (value.startsWith("gid://shopify/")) return value;
  return `gid://shopify/${resource}/${value}`;
}

export function assertNoGraphqlUserErrors(
  errors: Array<{ field?: string[] | null; message: string }> | undefined,
  fallback: string,
) {
  if (!errors?.length) return;
  throw createApiErrorFromMessage(
    errors.map((error) => error.message).join("; ") || fallback,
    422,
    errors,
  );
}
