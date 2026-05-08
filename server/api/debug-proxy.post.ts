import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import {
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
  normalizeProxyUrl,
} from "~~/utils/proxy/proxy";

type DebugProxyBody = {
  proxy?: string;
  testUrl?: string;
  timeoutMs?: number;
};

type DebugVariant = {
  name: string;
  proxyUrl: string;
};

function toRawVariant(proxy: string): string | null {
  const raw = String(proxy || "").trim();
  if (!raw) return null;

  if (/^socks(4|4a|5|5h)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    return raw;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const host = parts[0] || "";
  const port = parts[1] || "";
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5://${host}:${port}`;
  }

  const user = parts[2] || "";
  const pass = parts.slice(3).join(":");
  if (!user || !pass) return null;

  return `socks5://${user}:${pass}@${host}:${port}`;
}

function toSanitizedRawVariant(proxy: string): string | null {
  const raw = String(proxy || "");
  if (!raw) return null;

  const sanitized = raw
    .split(":")
    .map((part) =>
      part
        .replace(/[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g, "")
        .trim(),
    )
    .join(":");

  return toRawVariant(sanitized);
}

function pickAgent(proxyUrl: string) {
  return proxyUrl.startsWith("http")
    ? new HttpsProxyAgent(proxyUrl)
    : new SocksProxyAgent(proxyUrl);
}

async function runVariant(
  variant: DebugVariant,
  testUrl: string,
  timeoutMs: number,
) {
  const start = Date.now();

  try {
    const agent = pickAgent(variant.proxyUrl);
    const response = await axios.get(testUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: timeoutMs,
    });

    return {
      name: variant.name,
      success: true,
      durationMs: Date.now() - start,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
      status: response.status,
      responsePreview:
        typeof response.data === "string"
          ? response.data.slice(0, 120)
          : response.data,
    };
  } catch (error: any) {
    return {
      name: variant.name,
      success: false,
      durationMs: Date.now() - start,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
      error: {
        message: error?.message || "Unknown error",
        code: error?.code || null,
        status: error?.response?.status || null,
      },
    };
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<DebugProxyBody>(event)) || {};
  const proxy = String(body.proxy || "");
  const testUrl = String(body.testUrl || "https://httpbin.org/ip");
  const timeoutMs = Number(body.timeoutMs || 10000);

  if (!proxy.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing proxy in body",
    });
  }

  const variants: DebugVariant[] = [];

  try {
    variants.push({
      name: "normalized_encoded",
      proxyUrl: normalizeProxyUrl(proxy),
    });
  } catch {
    // ignore, diagnostic will still include raw variants
  }

  const rawVariant = toRawVariant(proxy);
  if (rawVariant) {
    variants.push({ name: "raw_unencoded", proxyUrl: rawVariant });
  }

  const sanitizedRawVariant = toSanitizedRawVariant(proxy);
  if (sanitizedRawVariant) {
    variants.push({
      name: "raw_sanitized",
      proxyUrl: sanitizedRawVariant,
    });
  }

  const dedupVariants = variants.filter(
    (variant, index) =>
      variants.findIndex(
        (candidate) => candidate.proxyUrl === variant.proxyUrl,
      ) === index,
  );

  const results = [];
  for (const variant of dedupVariants) {
    results.push(await runVariant(variant, testUrl, timeoutMs));
  }

  return {
    ok: results.some((item) => item.success),
    inputMeta: {
      ...inspectProxyInput(proxy),
      hasInvisibleChars: hasInvisibleOrControlChars(proxy),
      inputLength: proxy.length,
    },
    testedUrl: testUrl,
    timeoutMs,
    variantsTried: dedupVariants.map((variant) => ({
      name: variant.name,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
    })),
    results,
    hint: "If raw_unencoded passes but normalized_encoded fails, credentials likely break when URL-encoded. If all fail with Socks5 Authentication failed, proxy user/pass from source is incorrect or contains hidden characters.",
  };
});
