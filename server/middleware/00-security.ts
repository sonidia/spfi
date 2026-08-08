import { useRuntimeConfig } from "#imports";
import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendNoContent,
  setResponseHeader,
} from "h3";

const API_PATH_PREFIX = "/api/";

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname;
  const config = useRuntimeConfig(event);

  setSecurityHeaders(event);

  if (pathname.startsWith(API_PATH_PREFIX)) {
    setResponseHeader(event, "Cache-Control", "no-store");
    const preflightHandled = enforceApiOrigin(event, config.allowedOrigins);
    if (preflightHandled) return sendNoContent(event, 204);
  }
});

function enforceApiOrigin(
  event: Parameters<typeof getRequestURL>[0],
  value: unknown,
) {
  const origin = getHeader(event, "origin");
  if (!origin) return false;

  const allowedOrigins = parseOrigins(value);
  const requestOrigin = getRequestOrigin(event);
  let originUrl: URL;

  try {
    originUrl = new URL(origin);
  } catch {
    throw createError({ statusCode: 403, statusMessage: "Origin not allowed" });
  }

  const isSameOrigin = originUrl.origin.toLowerCase() === requestOrigin;
  if (!isSameOrigin && !allowedOrigins.has(originUrl.origin.toLowerCase())) {
    throw createError({ statusCode: 403, statusMessage: "Origin not allowed" });
  }

  setResponseHeader(event, "Access-Control-Allow-Origin", originUrl.origin);
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
    "Content-Type, X-Shopify-Access-Token",
  );
  setResponseHeader(event, "Access-Control-Max-Age", 600);
  return true;
}

function setSecurityHeaders(event: Parameters<typeof setResponseHeader>[0]) {
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "X-Frame-Options", "DENY");
  setResponseHeader(event, "Referrer-Policy", "no-referrer");
}

function getRequestOrigin(event: Parameters<typeof getRequestURL>[0]) {
  const requestUrl = getRequestURL(event);
  const forwardedProtocol = getHeader(event, "x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol = ["http", "https"].includes(forwardedProtocol || "")
    ? `${forwardedProtocol}:`
    : requestUrl.protocol;

  return `${protocol}//${requestUrl.host}`.toLowerCase();
}

function parseOrigins(value: unknown) {
  const origins = new Set<string>();

  for (const item of String(value || "").split(",")) {
    try {
      const url = new URL(item.trim());
      if (["http:", "https:"].includes(url.protocol)) {
        origins.add(url.origin.toLowerCase());
      }
    } catch {
      // Ignore malformed deployment configuration instead of widening access.
    }
  }

  return origins;
}
