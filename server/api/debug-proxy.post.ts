import axios from "axios";
import { defineEventHandler, readBody } from "h3";
import {
  buildProxyVariants,
  createApiErrorFromMessage,
  createProxyAgent,
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
} from "~~/server/utils/callShopifyApi";

interface DebugProxyBody {
  proxy?: string;
  testUrl?: string;
  timeoutMs?: number;
}

interface DebugVariant {
  name: string;
  proxyUrl: string;
}

function buildDebugVariants(proxy: string): DebugVariant[] {
  return buildProxyVariants(proxy).map((proxyUrl, index) => ({
    name: index === 0 ? "normalized_socks5h" : "raw_socks5h",
    proxyUrl,
  }));
}

async function runVariant(
  variant: DebugVariant,
  testUrl: string,
  timeoutMs: number,
) {
  const start = Date.now();

  try {
    const agent = createProxyAgent(variant.proxyUrl);
    const response = await axios.get<unknown>(testUrl, {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
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
  } catch (error) {
    return {
      name: variant.name,
      success: false,
      durationMs: Date.now() - start,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
      error: {
        message: getProxyDebugErrorMessage(error),
        code: axios.isAxiosError(error) ? error.code || null : null,
        status: axios.isAxiosError(error) ? error.response?.status || null : null,
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
    throw createApiErrorFromMessage("Missing proxy in body", 400);
  }

  let variants: DebugVariant[];

  try {
    variants = buildDebugVariants(proxy);
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
    testedUrl: testUrl,
    timeoutMs,
    variantsTried: variants.map((variant) => ({
      name: variant.name,
      maskedProxy: maskProxyUrl(variant.proxyUrl),
    })),
    results,
    hint: "All proxy variants are forced to SOCKS5H remote DNS. If all fail with Socks5 Authentication failed, proxy user/pass from source is incorrect or contains hidden characters.",
  };
});

function getProxyDebugErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
