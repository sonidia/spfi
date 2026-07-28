import axios from "axios";
import { createError, defineEventHandler, readBody } from "h3";
import { createProxyAgent, maskProxyUrl, normalizeProxyUrl } from "~~/utils/proxy/store-proxy";

interface CheckProxyBody {
  proxy?: string;
}

type ProxyAgent = ReturnType<typeof createProxyAgent>;

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
  const body = (await readBody<CheckProxyBody>(event)) || {};
  const proxy = String(body.proxy || "");

  if (!proxy) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing proxy URL or sock string",
    });
  }

  const proxyUrl = normalizeProxyUrl(proxy);
  const maskedProxy = maskProxyUrl(proxyUrl);
  void maskedProxy;

  try {
    const agent = createProxyAgent(proxyUrl);
    const start = Date.now();
    const res = await axios.get<{ origin?: string }>("https://httpbin.org/ip", {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Proxy check failed",
    };
  }
});

async function resolveProxyLocation(agent: ProxyAgent) {
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
