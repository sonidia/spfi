import { useRuntimeConfig } from "#imports";
import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendNoContent,
  setResponseHeader,
} from "h3";
import { evaluateApiOriginPolicy } from "../utils/request-origin-policy";
import { readRuntimeBoolean } from "../utils/runtime-config";
import {
  buildSecurityResponseHeaders,
  createContentSecurityPolicyNonce,
} from "../utils/security-headers";

const API_PATH_PREFIX = "/api/";
const SHOPIFY_WEBHOOK_PATH = "/api/webhooks/shopify";

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;
  const config = useRuntimeConfig(event);
  const cspNonce = createContentSecurityPolicyNonce();
  event.context.cspNonce = cspNonce;

  setSecurityHeaders(event, cspNonce);

  if (pathname.startsWith(API_PATH_PREFIX)) {
    setResponseHeader(event, "Cache-Control", "no-store");
    // Shopify is a non-browser caller and doesn't send Origin/Fetch Metadata.
    // Its dedicated route authenticates the exact raw body with Shopify HMAC.
    if (pathname !== SHOPIFY_WEBHOOK_PATH) {
      const preflightHandled = enforceApiOrigin(event, {
        allowedOrigins: config.allowedOrigins,
        requireOrigin: readRuntimeBoolean(config.apiOriginRequired, true),
        allowHostFallback: readRuntimeBoolean(config.allowHostOriginFallback, false),
      });
      if (preflightHandled) return sendNoContent(event, 204);
    }
  }
});

function enforceApiOrigin(
  event: Parameters<typeof getRequestURL>[0],
  options: {
    allowedOrigins: unknown;
    requireOrigin: boolean;
    allowHostFallback: boolean;
  },
) {
  const origin = getHeader(event, "origin");
  const result = evaluateApiOriginPolicy({
    method: event.method,
    origin,
    fetchSite: getHeader(event, "sec-fetch-site"),
    allowedOrigins: options.allowedOrigins,
    requireOrigin: options.requireOrigin,
    allowHostFallback: options.allowHostFallback,
    requestOrigin: getRequestURL(event).origin,
  });

  if (!result.allowed) {
    throw createError({ statusCode: 403, statusMessage: "Origin not allowed" });
  }

  if (!origin || !result.responseOrigin) return false;

  setResponseHeader(event, "Access-Control-Allow-Origin", result.responseOrigin);
  setResponseHeader(event, "Access-Control-Allow-Credentials", "true");
  setResponseHeader(event, "Vary", "Origin");

  if (event.method !== "OPTIONS") return false;

  setResponseHeader(
    event,
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PUT, DELETE, OPTIONS",
  );
  setResponseHeader(
    event,
    "Access-Control-Allow-Headers",
    "Content-Type, X-Shopify-Access-Token, X-Store-Data",
  );
  setResponseHeader(event, "Access-Control-Max-Age", 600);
  return true;
}

function setSecurityHeaders(
  event: Parameters<typeof setResponseHeader>[0],
  nonce: string,
) {
  for (const [name, value] of Object.entries(buildSecurityResponseHeaders(nonce))) {
    setResponseHeader(event, name, value);
  }
}
