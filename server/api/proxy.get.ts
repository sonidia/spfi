import axios from "axios";
import { createError, defineEventHandler, getQuery } from "h3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { normalizeProxyUrl } from "../utils/proxy";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const proxy = query.proxy as string;

  if (!proxy) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing proxy query parameter",
    });
  }

  const proxyUrl = normalizeProxyUrl(proxy);
  const agent = proxyUrl.startsWith("http")
    ? new HttpsProxyAgent(proxyUrl)
    : new SocksProxyAgent(proxyUrl);

  const res = await axios.get("https://httpbin.org/ip", {
    httpAgent: agent,
    httpsAgent: agent,
  });

  return res.data;
});
