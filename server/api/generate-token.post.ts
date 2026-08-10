import axios from "axios";
import { defineEventHandler, readBody } from "h3";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import {
  createApiErrorFromMessage,
  createProxyAgent,
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
  resolveShopifyProxyVariants,
  resolveStoreAdminDomain,
} from "~~/server/utils/callShopifyApi";

interface GenerateTokenBody {
  storeId?: string;
  clientId?: string;
  clientSecret?: string;
  sock?: string;
}

interface ProxyVariant {
  name: string;
  proxyUrl: string;
}

interface TokenAttemptError {
  name: string;
  message: string;
  code: string | null;
}

const OAUTH_CONTENT_TYPE = "application/x-www-form-urlencoded";
const TOKEN_TIMEOUT_MS = 15000;

export default defineEventHandler(async (event) => {
  const body = (await readBody<GenerateTokenBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const clientId = String(body.clientId || "").trim();
  const clientSecret = String(body.clientSecret || "").trim();
  const sock = String(body.sock || "").trim();

  if (!storeId || !clientId || !clientSecret) {
    throw createApiErrorFromMessage(
      "Missing storeId, clientId, or clientSecret",
      400,
    );
  }

  if (!sock) {
    throw createApiErrorFromMessage("No proxy (sock) provided.", 400);
  }

  const variants = await buildNamedProxyVariants(event, sock);

  for (const variant of variants) {
    console.log(
      `[GenerateToken] Trying proxy variant (${variant.name}): ${maskProxyUrl(variant.proxyUrl)}`,
    );
  }

  const adminDomain = resolveStoreAdminDomain(storeId);
  const url = `https://${adminDomain}/admin/oauth/access_token`;
  const payload = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const errors: TokenAttemptError[] = [];

  for (const variant of variants) {
    try {
      const agent = createProxyAgent(variant.proxyUrl);
      const response = await axios.post<ShopifyAccessTokenResponse>(
        url,
        payload.toString(),
        {
          httpAgent: agent,
          httpsAgent: agent,
          proxy: false,
          timeout: TOKEN_TIMEOUT_MS,
          headers: {
            "Content-Type": OAUTH_CONTENT_TYPE,
            Accept: "application/json",
          },
        },
      );

      return response.data;
    } catch (error) {
      errors.push({
        name: variant.name,
        message: getTokenErrorMessage(error),
        code: getTokenErrorCode(error),
      });
    }
  }

  const lastError = errors[errors.length - 1];
  const isAuthError = errors.some((item) =>
    /socks5?\s*authentication\s*failed/i.test(item.message),
  );

  if (isAuthError) {
    const inputMeta = inspectProxyInput(sock);
    const hasHiddenChars = hasInvisibleOrControlChars(sock);

    throw createApiErrorFromMessage(
      "Socks5 Authentication failed: proxy credential was rejected after trying encoded/raw SOCKS5H variants",
      500,
      {
        hint: "Verify the proxy credentials. The debug endpoint is available only when explicitly enabled.",
        variantsTried: variants.map((item) => ({
          name: item.name,
          maskedProxy: maskProxyUrl(item.proxyUrl),
        })),
        errors,
        inputMeta: {
          ...inputMeta,
          hasInvisibleChars: hasHiddenChars,
        },
      },
    );
  }

  throw createApiErrorFromMessage(
    lastError?.message || "Error generating access token",
    500,
    { errors },
  );
});

async function buildNamedProxyVariants(
  event: Parameters<typeof resolveShopifyProxyVariants>[0],
  sock: string,
): Promise<ProxyVariant[]> {
  try {
    return (await resolveShopifyProxyVariants(event, sock)).map(
      (proxyUrl, index) => ({
        name: index === 0 ? "normalized_socks5h" : "raw_socks5h",
        proxyUrl,
      }),
    );
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
      400,
    );
  }
}

function getTokenErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const responseMessage = getResponseMessage(data);
    return responseMessage || error.message || "Error generating access token";
  }

  return error instanceof Error ? error.message : "Error generating access token";
}

function getResponseMessage(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message =
      record.message || record.error_description || record.error || record.errors;

    if (typeof message === "string") return message;
    if (message) return JSON.stringify(message);
  }

  return JSON.stringify(data);
}

function getTokenErrorCode(error: unknown) {
  return axios.isAxiosError(error) ? error.code || null : null;
}
