import axios from "axios";
import { defineEventHandler, readBody } from "h3";
import {
  createApiErrorFromMessage,
  createProxyAgent,
  normalizeProxyUrl,
  toStandardApiError,
} from "~~/server/utils/callShopifyApi";

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
    throw createApiErrorFromMessage("Missing proxy URL or sock string", 400);
  }

  try {
    const proxyUrl = normalizeProxyUrl(proxy);
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
    return toStandardApiError(error, "Proxy check failed");
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
