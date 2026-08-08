import { createHash, timingSafeEqual } from "node:crypto";
import { useRuntimeConfig } from "#imports";
import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestURL,
  sendNoContent,
  setResponseHeader,
} from "h3";

const HEALTH_PATH = "/api/health";
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

  if (pathname === HEALTH_PATH) return;

  const password = String(config.appAuthPassword || "");
  const authRequired = readBoolean(config.appAuthRequired);
  if (!authRequired && !password) return;

  if (!password) {
    throw createError({
      statusCode: 503,
      statusMessage: "Application authentication is not configured",
      message:
        "Set NUXT_APP_AUTH_PASSWORD before exposing this production server.",
    });
  }

  const expectedUsername = String(config.appAuthUsername || "admin");
  const credentials = readBasicCredentials(getHeader(event, "authorization"));

  if (
    !credentials ||
    !safeEqual(credentials.username, expectedUsername) ||
    !safeEqual(credentials.password, password)
  ) {
    setResponseHeader(
      event,
      "WWW-Authenticate",
      'Basic realm="SPFI", charset="UTF-8"',
    );
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
      message: "Valid application credentials are required.",
    });
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
    "Authorization, Content-Type, X-Shopify-Access-Token",
  );
  setResponseHeader(event, "Access-Control-Max-Age", 600);
  return true;
}

function setSecurityHeaders(event: Parameters<typeof setResponseHeader>[0]) {
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "X-Frame-Options", "DENY");
  setResponseHeader(event, "Referrer-Policy", "no-referrer");
}

function readBasicCredentials(header?: string) {
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function safeEqual(actual: string, expected: string) {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
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
