import * as http from "node:http";
import * as https from "node:https";
import { URL } from "node:url";
import type { SocksProxyAgent } from "socks-proxy-agent";

const PROXY_IP_LOOKUP_URLS = [
  "https://api.ipify.org?format=json",
  "https://icanhazip.com/",
];
const PROXY_IP_TIMEOUT_MS = 3500;
const IP_ADDRESS_PATTERN =
  /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[a-f0-9]{1,4}:){2,}[a-f0-9]{1,4}\b/i;

export async function resolveProxyIp(agents: SocksProxyAgent[]) {
  for (const agent of agents) {
    for (const lookupUrl of PROXY_IP_LOOKUP_URLS) {
      const proxyIp = await requestProxyIp(lookupUrl, agent);

      if (proxyIp) {
        return proxyIp;
      }
    }
  }

  return "";
}

function requestProxyIp(url: string, agent: SocksProxyAgent): Promise<string> {
  return new Promise((resolve) => {
    const targetUrl = new URL(url);
    const isHttps = targetUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;
    const request = requestModule.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: "GET",
        headers: {
          accept: "application/json,text/plain,*/*",
          "user-agent": "StoreStatusChecker/1.0",
        },
        agent: agent as unknown as http.Agent,
        timeout: PROXY_IP_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          if (
            !response.statusCode ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            resolve("");
            return;
          }

          resolve(extractIpAddress(Buffer.concat(chunks).toString("utf8")));
        });
      },
    );

    request.once("timeout", () => {
      request.destroy(new Error("Proxy IP lookup timeout"));
    });

    request.once("error", () => {
      resolve("");
    });

    request.end();
  });
}

function extractIpAddress(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = JSON.parse(trimmed) as { ip?: unknown };

    if (typeof parsed.ip === "string") {
      return parsed.ip.trim();
    }
  } catch {
    // Plain text responses are handled below.
  }

  return trimmed.match(IP_ADDRESS_PATTERN)?.[0] || "";
}

