import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { maskProxyUrl, normalizeProxyUrl } from "~~/utils/proxy/proxy";

type ProxyLocationResponse = {
  status?: string;
  query?: string;
  country?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  timezone?: string;
};

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
  // console.log(`[CheckProxy] Final URL: ${maskedProxy}`);

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
    const ip = String(res.data?.origin || "");
    const location = await resolveProxyLocation(agent);

    return {
      success: true,
      ip,
      location: {
        ip: location?.query || ip,
        country: location?.country || "",
        region: location?.regionName || "",
        city: location?.city || "",
        isp: location?.isp || "",
        org: location?.org || "",
        timezone: location?.timezone || "",
      },
      duration,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Proxy check failed",
    };
  }
});

async function resolveProxyLocation(agent: any) {
  try {
    const response = await axios.get<ProxyLocationResponse>(
      "http://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp,org,timezone",
      {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 10000,
      },
    );

    return response.data?.status === "success" ? response.data : null;
  } catch {
    return null;
  }
}
