import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import {
  hasInvisibleOrControlChars,
  inspectProxyInput,
  maskProxyUrl,
  normalizeProxyUrl,
} from "../../utils/proxy/proxy";

function toRawProxyVariant(sock: string): string | null {
  const raw = String(sock || "").trim();
  if (!raw) return null;

  if (/^socks(4|4a|5|5h)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    return raw;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;

  const host = (parts[0] || "").trim();
  const port = (parts[1] || "").trim();
  if (!host || !port) return null;

  if (parts.length === 2) {
    return `socks5://${host}:${port}`;
  }

  const user = (parts[2] || "").trim();
  const pass = parts
    .slice(3)
    .join(":")
    .replace(/[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!user || !pass) return null;

  return `socks5://${user}:${pass}@${host}:${port}`;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { storeId, clientId, clientSecret, sock } = body;

  if (!storeId || !clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing storeId, clientId, or clientSecret",
    });
  }

  // ── Debug Logging ────────────────────────────────────────────────────────
  console.log(`[GenerateToken] Received StoreId: ${storeId}`);
  console.log(
    `[GenerateToken] Incoming Sock: ${sock ? sock.substring(0, 10) + "..." : "MISSING"}`,
  );

  // ── Parse Proxy ────────────────────────────────────────────────────────────
  if (!sock) {
    throw createError({
      statusCode: 400,
      statusMessage: "No proxy (sock) provided.",
    });
  }

  const variants = [
    { name: "normalized_encoded", proxyUrl: normalizeProxyUrl(sock) },
    ...(toRawProxyVariant(sock)
      ? [{ name: "raw_unencoded", proxyUrl: toRawProxyVariant(sock) as string }]
      : []),
  ].filter(
    (variant, index, list) =>
      list.findIndex((candidate) => candidate.proxyUrl === variant.proxyUrl) ===
      index,
  );

  for (const variant of variants) {
    console.log(
      `[GenerateToken] Trying proxy variant (${variant.name}): ${maskProxyUrl(variant.proxyUrl)}`,
    );
  }

  const url = `https://${storeId}.myshopify.com/admin/oauth/access_token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

  const errors: Array<{ name: string; message: string; code?: string | null }> =
    [];

  for (const variant of variants) {
    try {
      const agent = variant.proxyUrl.startsWith("http")
        ? new HttpsProxyAgent(variant.proxyUrl)
        : new SocksProxyAgent(variant.proxyUrl);

      const response = await axios.post(url, null, {
        httpAgent: agent,
        httpsAgent: agent,
        headers: { "Content-Type": "application/json" },
      });

      return response.data;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Error generating access token";

      errors.push({
        name: variant.name,
        message: errorMessage,
        code: error?.code || null,
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

    throw createError({
      statusCode: 500,
      statusMessage:
        "Socks5 Authentication failed: proxy credential bị từ chối sau khi đã thử encoded/raw variant",
      data: {
        hint: "Gọi POST /api/debug-proxy với body { proxy } để xem variant nào pass/fail chi tiết.",
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
    });
  }

  throw createError({
    statusCode: 500,
    statusMessage: lastError?.message || "Error generating access token",
    data: {
      errors,
    },
  });
});
