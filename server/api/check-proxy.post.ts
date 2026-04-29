import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { maskProxyUrl, normalizeProxyUrl } from "../../utils/proxy/proxy";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { proxy } = body;

  if (!proxy) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing proxy URL or sock string",
    });
  }

  // ── Parse Proxy ────────────────────────────────────────────────────────────
  const proxyUrl = normalizeProxyUrl(proxy);

  // Diagnostic logging (masked password)
  const maskedProxy = maskProxyUrl(proxyUrl);
  console.log(`[CheckProxy] Final URL: ${maskedProxy}`);

  let agent: any;
  try {
    if (proxyUrl.startsWith("socks")) {
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      agent = new HttpsProxyAgent(proxyUrl);
    }

    const start = Date.now();
    const res = await axios.get("https://httpbin.org/ip", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000, // 10 seconds timeout
    });
    const duration = Date.now() - start;

    return {
      success: true,
      ip: res.data.origin,
      duration,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Proxy check failed",
    };
  }
});
