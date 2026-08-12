import axios from "axios";
import { useRuntimeConfig } from "#imports";
import { createError, defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
  createProxyAgent,
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
  resolveShopifyProxyVariants,
} from "~~/server/utils/callShopifyApi";
import { PublicUrlError, resolvePublicUrl } from "~~/server/utils/public-outbound-url";
import { readRuntimeBoolean } from "~~/server/utils/runtime-config";

interface DebugProxyBody {
  proxy?: string;
  testUrl?: string;
  timeoutMs?: number;
}

interface DebugVariant {
  name: string;
  proxyUrl: string;
}

const DEFAULT_TEST_URL = "https://httpbin.org/ip";
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 16_384;
const RESPONSE_PREVIEW_LENGTH = 240;

async function buildDebugVariants(
  event: Parameters<typeof resolveShopifyProxyVariants>[0],
  proxy: string,
): Promise<DebugVariant[]> {
  return (await resolveShopifyProxyVariants(event, proxy)).map((proxyUrl, index) => ({
    name: index === 0 ? "normalized_socks5h" : "raw_socks5h",
    proxyUrl,
  }));
}

async function runVariant(variant: DebugVariant, testUrl: URL, timeoutMs: number) {
  const start = Date.now();

  try {
    const agent = createProxyAgent(variant.proxyUrl);
    const response = await axios.get<string>(testUrl.toString(), {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
      timeout: timeoutMs,
      maxRedirects: 0,
      maxContentLength: MAX_RESPONSE_BYTES,
      responseType: "text",
      transformResponse: [(data) => String(data || "")],
    });

    return {
      name: variant.name,
      success: true,
      durationMs: Date.now() - start,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
      status: response.status,
      responsePreview: response.data.slice(0, RESPONSE_PREVIEW_LENGTH),
    };
  } catch (error) {
    return {
      name: variant.name,
      success: false,
      durationMs: Date.now() - start,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
      error: {
        message: "Proxy test request failed.",
        code: axios.isAxiosError(error) ? error.code || null : null,
        status: axios.isAxiosError(error) ? error.response?.status || null : null,
      },
    };
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!readRuntimeBoolean(config.debugProxyEnabled)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const body = (await readBody<DebugProxyBody>(event)) || {};
  const proxy = String(body.proxy || "");
  const requestedTestUrl = String(body.testUrl || DEFAULT_TEST_URL);
  const timeoutMs = clampTimeout(body.timeoutMs);

  if (!proxy.trim()) {
    throw createApiErrorFromMessage("Missing proxy in body", 400);
  }

  let testUrl: URL;
  try {
    const resolution = await resolvePublicUrl(requestedTestUrl, {
      allowedHosts: parseCsv(config.debugProxyAllowedHosts),
    });
    testUrl = resolution.url;
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof PublicUrlError ? error.message : "Invalid proxy test URL.",
      400,
    );
  }

  let variants: DebugVariant[];

  try {
    variants = await buildDebugVariants(event, proxy);
  } catch (error) {
    throw createApiErrorFromMessage(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
      400,
    );
  }

  const results = [];

  for (const variant of variants) {
    results.push(await runVariant(variant, testUrl, timeoutMs));
  }

  return {
    ok: results.some((item) => item.success),
    inputMeta: {
      ...inspectProxyInput(proxy),
      hasInvisibleChars: hasInvisibleOrControlChars(proxy),
      inputLength: proxy.length,
    },
    testedUrl: testUrl.toString(),
    timeoutMs,
    variantsTried: variants.map((variant) => ({
      name: variant.name,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
    })),
    results,
    hint: "All proxy variants use SOCKS5H remote DNS. Verify the proxy credentials if every allowlisted test fails.",
  };
});

function clampTimeout(value: unknown) {
  const timeout = Number(value || 10_000);
  if (!Number.isFinite(timeout)) return 10_000;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(timeout)));
}

function parseCsv(value: unknown) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
