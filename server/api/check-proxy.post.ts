import axios from "axios";
import { defineEventHandler, readBody } from "h3";
import {
  buildStandardApiError,
  createApiErrorFromMessage,
  createProxyAgent,
  maskProxyUrl,
  resolveShopifyProxyVariants,
} from "~~/server/utils/callShopifyApi";
import { resolveProxyIp } from "~~/server/utils/status-proxy-ip";

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

interface ProxyAttemptError {
  variant: string;
  maskedProxy: string;
  message: string;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<CheckProxyBody>(event)) || {};
  const proxy = String(body.proxy || "");

  if (!proxy) {
    throw createApiErrorFromMessage("Missing proxy URL or sock string", 400);
  }

  const start = Date.now();
  const attempts: ProxyAttemptError[] = [];
  const proxyVariants = await buildCheckProxyVariants(event, proxy);

  for (const [index, proxyUrl] of proxyVariants.entries()) {
    const variantName = index === 0 ? "normalized_socks5h" : "raw_socks5h";

    try {
      const agent = createProxyAgent(proxyUrl);
      const ip = await resolveProxyIp([agent]);

      if (!ip) {
        attempts.push({
          variant: variantName,
          maskedProxy: maskProxyUrl(proxyUrl),
          message: "Proxy did not return a public IP from lookup endpoints.",
        });
        continue;
      }

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
        duration: Date.now() - start,
      };
    } catch (error) {
      attempts.push({
        variant: variantName,
        maskedProxy: maskProxyUrl(proxyUrl),
        message: getProxyErrorMessage(error),
      });
    }
  }

  return buildStandardApiError("Proxy check failed.", 500, undefined, {
    attempts,
  });
});

async function buildCheckProxyVariants(
  event: Parameters<typeof resolveShopifyProxyVariants>[0],
  proxy: string,
) {
  try {
    const proxyVariants = await resolveShopifyProxyVariants(event, proxy);

    if (proxyVariants.length > 0) {
      return proxyVariants;
    }
  } catch (error) {
    throw createApiErrorFromMessage(getProxyErrorMessage(error), 400);
  }

  throw createApiErrorFromMessage("Invalid SOCKS5 proxy.", 400);
}

async function resolveProxyLocation(agent: ProxyAgent) {
  try {
    const response = await axios.get<ProxyLocationResponse>(
      "http://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp,org,timezone",
      {
        httpAgent: agent,
        httpsAgent: agent,
        proxy: false,
        timeout: 10000,
      },
    );

    return response.data?.status === "success" ? response.data : null;
  } catch {
    return null;
  }
}

function getProxyErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Proxy check failed.";
}
