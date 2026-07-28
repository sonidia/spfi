import { resolve4, resolve6, resolveCname, resolveNs } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import tls from "node:tls";
import { URL } from "node:url";
import type { SocksProxyAgent } from "socks-proxy-agent";
import type {
  CheckItem,
  CheckSeverity,
  StoreCheckResult,
} from "~~/types/store-status";
import { StoreStatusInputError } from "./status-checker-errors";
import { createSocksProxyAgents } from "./callShopifyApi";
import { resolveProxyIp } from "./status-proxy-ip";
import {
  buildShopifyStatusVerdict,
  classifyShopifyStoreStatus,
} from "./shopify-status-classifier";

interface StoreCheckOptions {
  proxy?: string;
}

interface FetchSnapshot {
  ok: boolean;
  status: number | null;
  statusText: string;
  url: string;
  redirected: boolean;
  headers: Record<string, string>;
  bodySnippet: string;
  contentType: string;
  ssl?: SslSnapshot;
  error?: string;
}

interface DnsSnapshot {
  a: string[];
  aaaa: string[];
  cname: string[];
  ns: string[];
  errors: string[];
}

interface SslSnapshot {
  ok: boolean;
  validFrom?: string;
  validTo?: string;
  subject?: string;
  issuer?: string;
  fingerprint?: string;
  daysRemaining?: number;
  error?: string;
}


type CertificateFieldValue = string | string[] | undefined;

interface CertificateDetails {
  valid_from?: string;
  valid_to?: string;
  subject?: Record<string, CertificateFieldValue>;
  issuer?: Record<string, CertificateFieldValue>;
  fingerprint256?: string;
}

const SHOPIFY_A_RECORDS = new Set(["23.227.38.65"]);
const SHOPIFY_TEXT_MARKERS = [
  "this store is unavailable",
  "sorry, this shop is currently unavailable",
  "store not found",
  "opening soon",
  "enter store using password",
  "password",
];

const REQUEST_TIMEOUT_MS = 12000;
const SSL_CHECK_TIMEOUT_MS = 3500;
const PROXY_IP_TIMEOUT_MS = 3500;
const MAX_REDIRECTS = 5;
const BODY_SNIPPET_LIMIT = 12000;

export async function checkShopifyStoreStatus(
  input: string,
  options: StoreCheckOptions = {},
): Promise<StoreCheckResult> {
  const normalizedUrl = normalizeTarget(input);
  const url = new URL(normalizedUrl);
  const host = url.hostname;
  const blockedHostReason = getBlockedHostReason(host);
  const proxyAgents = createSocksProxyAgents(options.proxy);
  const hasProxy = proxyAgents.length > 0;

  if (blockedHostReason) {
    throw new StoreStatusInputError(blockedHostReason);
  }

  const dns = await checkDns(host);
  const blockedDnsReason = getBlockedDnsReason(dns);

  if (blockedDnsReason && !hasProxy) {
    throw new StoreStatusInputError(blockedDnsReason);
  }

  const productsUrl = new URL("/products.json?limit=1", normalizedUrl).toString();
  const [website, http, endpoint, ssl, proxyIp] = await Promise.all([
    resolveWithin(
      fetchSnapshot(normalizedUrl, "GET", "follow", proxyAgents),
      REQUEST_TIMEOUT_MS + 500,
      () => buildTimeoutSnapshot(normalizedUrl, "GET", "Website request"),
    ),
    resolveWithin(
      fetchSnapshot(normalizedUrl, "HEAD", "manual", proxyAgents),
      REQUEST_TIMEOUT_MS + 500,
      () => buildTimeoutSnapshot(normalizedUrl, "HEAD", "HTTP request"),
    ),
    resolveWithin(
      fetchSnapshot(productsUrl, "GET", "follow", proxyAgents),
      REQUEST_TIMEOUT_MS + 500,
      () => buildTimeoutSnapshot(productsUrl, "GET", "Products endpoint"),
    ),
    hasProxy
      ? Promise.resolve<SslSnapshot | null>(null)
      : resolveWithin(checkSsl(host), SSL_CHECK_TIMEOUT_MS, () => ({
          ok: false,
          error: `TLS check exceeded ${SSL_CHECK_TIMEOUT_MS}ms.`,
        })),
    hasProxy
      ? resolveWithin(resolveProxyIp(proxyAgents), PROXY_IP_TIMEOUT_MS, () => "")
      : Promise.resolve(""),
  ]);

  if (
    hasProxy &&
    [website, http, endpoint].every((snapshot) => snapshot.error)
  ) {
    const errors = Array.from(
      new Set(
        [website.error, http.error, endpoint.error].filter(
          (error): error is string => Boolean(error),
        ),
      ),
    );

    throw new StoreStatusInputError(
      `SOCKS5 proxy request failed: ${errors.join(" | ")}`,
    );
  }

  const checks = [
    buildWebsiteCheck(website),
    buildDnsCheck(dns, host, hasProxy),
    buildHttpCheck(http),
    buildProductsCheck(endpoint),
    buildSslCheck(
      ssl ||
        http.ssl ||
        website.ssl ||
        endpoint.ssl || {
          ok: false,
          error: hasProxy
            ? "Cannot read a separate SSL certificate through proxy."
            : "Cannot read SSL certificate.",
        },
      host,
      hasProxy,
    ),
  ];
  const statusClassification = classifyShopifyStoreStatus({
    website,
    http,
    endpoint,
  });

  return {
    input,
    platform: "shopify",
    storeStatus: statusClassification.status,
    normalizedUrl,
    host,
    ...(proxyIp ? { proxyIp } : {}),
    checkedAt: new Date().toISOString(),
    verdict: buildShopifyStatusVerdict(statusClassification),
    checks,
    limitations: [
      "Public signals cannot confirm the exact Shopify Admin account state.",
      "Billing, policy, disputes, and internal admin reasons are not visible here.",
      "The result reflects public network signals at check time only.",
    ],
  };
}

function resolveWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: () => T,
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(fallback()), timeoutMs);

    promise
      .then(resolve)
      .catch(() => resolve(fallback()))
      .finally(() => clearTimeout(timeout));
  });
}

function buildTimeoutSnapshot(
  url: string,
  method: "GET" | "HEAD",
  label: string,
): FetchSnapshot {
  return {
    ok: false,
    status: null,
    statusText: `${method} timed out`,
    url,
    redirected: false,
    headers: {},
    bodySnippet: "",
    contentType: "",
    error: `${label} exceeded ${REQUEST_TIMEOUT_MS}ms.`,
  };
}
function normalizeTarget(input: string) {
  const trimmed = input.trim().replace(/^@/, "");
  if (!trimmed || /\s/.test(trimmed)) {
    throw new StoreStatusInputError(
      "Invalid target. Enter one public domain or URL.",
    );
  }

  const withHost = trimmed.includes(".")
    ? trimmed
    : `${trimmed}.myshopify.com`;
  const withProtocol = /^https?:\/\//i.test(withHost)
    ? withHost
    : `https://${withHost}`;

  try {
    const url = new URL(withProtocol);

    url.protocol = "https:";
    url.pathname = "/";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    throw new StoreStatusInputError("Invalid target URL or domain.");
  }
}

async function fetchSnapshot(
  url: string,
  method: "GET" | "HEAD",
  redirect: RequestRedirect = "follow",
  agents: SocksProxyAgent[] = [],
): Promise<FetchSnapshot> {
  if (agents.length) {
    return fetchSnapshotWithProxyVariants(url, method, redirect, agents);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 ShopifyStatusChecker/1.0",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const shouldReadBody = method === "GET";
    const bodySnippet = shouldReadBody
      ? await response.text().then((text) => text.slice(0, BODY_SNIPPET_LIMIT))
      : "";

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      redirected: response.redirected,
      headers: Object.fromEntries(response.headers.entries()),
      bodySnippet,
      contentType,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: "Request failed",
      url,
      redirected: false,
      headers: {},
      bodySnippet: "",
      contentType: "",
      error: error instanceof Error ? error.message : "Unknown request error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSnapshotWithProxyVariants(
  url: string,
  method: "GET" | "HEAD",
  redirect: RequestRedirect,
  agents: SocksProxyAgent[],
): Promise<FetchSnapshot> {
  let lastSnapshot: FetchSnapshot | null = null;

  for (const agent of agents) {
    const snapshot = await fetchSnapshotWithNodeRequest(
      url,
      method,
      redirect,
      agent,
    );

    if (!snapshot.error) {
      return snapshot;
    }

    lastSnapshot = snapshot;
  }

  return (
    lastSnapshot || {
      ok: false,
      status: null,
      statusText: "Request failed",
      url,
      redirected: false,
      headers: {},
      bodySnippet: "",
      contentType: "",
      error: "No SOCKS5 proxy variant was available.",
    }
  );
}

async function fetchSnapshotWithNodeRequest(
  url: string,
  method: "GET" | "HEAD",
  redirect: RequestRedirect,
  agent: SocksProxyAgent,
  redirectCount = 0,
  redirected = false,
): Promise<FetchSnapshot> {
  const snapshot = await requestSnapshot(url, method, agent);
  const location = snapshot.headers.location;

  if (
    redirect === "follow" &&
    location &&
    snapshot.status !== null &&
    snapshot.status >= 300 &&
    snapshot.status < 400 &&
    redirectCount < MAX_REDIRECTS
  ) {
    const nextUrl = new URL(location, snapshot.url).toString();
    return fetchSnapshotWithNodeRequest(
      nextUrl,
      method,
      redirect,
      agent,
      redirectCount + 1,
      true,
    );
  }

  return {
    ...snapshot,
    redirected,
  };
}

function requestSnapshot(
  url: string,
  method: "GET" | "HEAD",
  agent: SocksProxyAgent,
): Promise<FetchSnapshot> {
  return new Promise((resolve) => {
    const targetUrl = new URL(url);
    const isHttps = targetUrl.protocol === "https:";
    const requestModule = isHttps ? https : http;
    const headers: Record<string, string> = {
      "user-agent": "Mozilla/5.0 ShopifyStatusChecker/1.0",
      accept: "*/*",
    };

    const request = requestModule.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method,
        headers,
        agent: agent as unknown as http.Agent,
        timeout: SSL_CHECK_TIMEOUT_MS,
      },
      (response) => {
        const responseHeaders = normalizeResponseHeaders(response.headers);
        const chunks: Buffer[] = [];
        let snippetSize = 0;

        response.on("data", (chunk: Buffer) => {
          if (method !== "GET" || snippetSize >= BODY_SNIPPET_LIMIT) {
            return;
          }

          const remaining = BODY_SNIPPET_LIMIT - snippetSize;
          const nextChunk =
            chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          chunks.push(nextChunk);
          snippetSize += nextChunk.length;
        });

        response.on("end", () => {
          const bodySnippet =
            method === "GET" ? Buffer.concat(chunks).toString("utf8") : "";

          resolve({
            ok:
              response.statusCode !== undefined &&
              response.statusCode >= 200 &&
              response.statusCode < 300,
            status: response.statusCode ?? null,
            statusText: response.statusMessage || "",
            url,
            redirected: false,
            headers: responseHeaders,
            bodySnippet,
            contentType: responseHeaders["content-type"] || "",
            ssl: getSslSnapshotFromSocket(response.socket),
          });
        });
      },
    );

    request.once("timeout", () => {
      request.destroy(new Error("Request timeout"));
    });

    request.once("error", (error: Error) => {
      resolve({
        ok: false,
        status: null,
        statusText: "Request failed",
        url,
        redirected: false,
        headers: {},
        bodySnippet: "",
        contentType: "",
        error: error.message,
      });
    });

    request.end();
  });
}

function normalizeResponseHeaders(
  headers: http.IncomingHttpHeaders,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(", ") : String(value || ""),
    ]),
  );
}

async function checkDns(host: string): Promise<DnsSnapshot> {
  const errors: string[] = [];
  const [a, aaaa, cname, ns] = await Promise.all([
    resolveOrEmpty<string>(() => resolve4(host), errors, "A"),
    resolveOrEmpty<string>(() => resolve6(host), errors, "AAAA"),
    resolveOrEmpty<string>(() => resolveCname(host), errors, "CNAME"),
    resolveOrEmpty<string>(() => resolveNs(host), errors, "NS"),
  ]);

  return {
    a,
    aaaa,
    cname,
    ns,
    errors,
  };
}

async function resolveOrEmpty<T>(
  resolver: () => Promise<T[]>,
  errors: string[],
  label: string,
): Promise<T[]> {
  try {
    return await resolver();
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";

    if (code && !["ENODATA", "ENOTFOUND", "ENODOMAIN"].includes(code)) {
      errors.push(
        `${label}: ${error instanceof Error ? error.message : "Query failed"}`,
      );
    }

    return [];
  }
}

function buildWebsiteCheck(snapshot: FetchSnapshot): CheckItem {
  if (snapshot.error) {
    return {
      key: "website",
      title: "Website availability",
      status: "Website is not reachable",
      severity: "danger",
      details: [`Connection error: ${snapshot.error}`],
    };
  }

  const body = snapshot.bodySnippet.toLowerCase();
  const marker = SHOPIFY_TEXT_MARKERS.find((item) => body.includes(item));

  if (marker?.includes("unavailable")) {
    return {
      key: "website",
      title: "Website availability",
      status: "Store appears unavailable",
      severity: "danger",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        "The page content includes a store unavailable signal.",
        snapshot.redirected
          ? `Redirected to ${snapshot.url}`
          : "No redirect recorded.",
      ],
    };
  }

  if (marker?.includes("store not found")) {
    return {
      key: "website",
      title: "Website availability",
      status: "Store not found signal detected",
      severity: "danger",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        "The page content includes a Store not found signal.",
      ],
    };
  }

  if (marker?.includes("password") || marker?.includes("opening soon")) {
    return {
      key: "website",
      title: "Website availability",
      status: "Storefront appears password protected",
      severity: "warning",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        "The store responds, but the storefront may not be public.",
      ],
    };
  }

  if (snapshot.ok) {
    return {
      key: "website",
      title: "Website availability",
      status: "Website responds normally",
      severity: "ok",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        snapshot.redirected
          ? `Redirected to ${snapshot.url}`
          : "No redirect recorded.",
        snapshot.contentType
          ? `Content-Type: ${snapshot.contentType}`
          : "No Content-Type header.",
      ],
    };
  }

  return {
    key: "website",
    title: "Website availability",
    status: "Website response is unusual",
    severity: snapshot.status && snapshot.status >= 500 ? "danger" : "warning",
    details: [
      `HTTP ${snapshot.status} ${snapshot.statusText}`,
      snapshot.redirected
        ? `Redirected to ${snapshot.url}`
        : "No redirect recorded.",
    ],
  };
}

function buildDnsCheck(
  snapshot: DnsSnapshot,
  host: string,
  viaProxy = false,
): CheckItem {
  const allTargets = [...snapshot.cname, ...snapshot.ns].map((item) =>
    item.toLowerCase(),
  );
  const hasShopifyTarget =
    host.endsWith(".myshopify.com") ||
    snapshot.a.some((record) => SHOPIFY_A_RECORDS.has(record)) ||
    allTargets.some(
      (record) => record.includes("shopify") || record.includes("myshopify"),
    );

  if (hasShopifyTarget) {
    return {
      key: "dns",
      title: "Domain DNS",
      status: "DNS points to Shopify",
      severity: "ok",
      details: formatDnsDetails(snapshot),
    };
  }

  if (viaProxy) {
    return {
      key: "dns",
      title: "Domain DNS",
      status: "Local DNS is reference-only when using SOCKS5H",
      severity: "neutral",
      details: [
        ...formatDnsDetails(snapshot),
        "Requests use SOCKS5H, so hostname resolution happens on the proxy server.",
      ],
    };
  }

  if (snapshot.a.length || snapshot.aaaa.length || snapshot.cname.length) {
    return {
      key: "dns",
      title: "Domain DNS",
      status: "DNS exists but no clear Shopify signal was found",
      severity: "warning",
      details: formatDnsDetails(snapshot),
    };
  }

  return {
    key: "dns",
    title: "Domain DNS",
    status: "No main DNS records found",
    severity: "danger",
    details: snapshot.errors.length
      ? snapshot.errors
      : ["No A, AAAA, or CNAME records were found."],
  };
}

function buildHttpCheck(snapshot: FetchSnapshot): CheckItem {
  if (snapshot.error) {
    return {
      key: "http",
      title: "HTTP response",
      status: "Could not get HTTP response",
      severity: "danger",
      details: [`Connection error: ${snapshot.error}`],
    };
  }

  const status = snapshot.status || 0;
  let statusText = "Response is unclear";
  let severity: CheckSeverity = "neutral";

  if (status >= 200 && status < 300) {
    statusText = "Website is serving content";
    severity = "ok";
  } else if (status >= 300 && status < 400) {
    statusText = "Website redirects";
    severity = "ok";
  } else if (status === 403) {
    statusText = "Access may be blocked";
    severity = "warning";
  } else if (status === 404) {
    statusText = "Not found";
    severity = "danger";
  } else if (status >= 500) {
    statusText = "Server error";
    severity = "danger";
  } else if (status >= 400) {
    statusText = "Client error";
    severity = "warning";
  }

  return {
    key: "http",
    title: "HTTP response",
    status: statusText,
    severity,
    details: [
      `HTTP ${snapshot.status} ${snapshot.statusText}`,
      snapshot.headers.location
        ? `Location: ${snapshot.headers.location}`
        : snapshot.redirected
          ? `Fetch followed redirect to ${snapshot.url}`
          : "No redirect recorded.",
      snapshot.headers.server
        ? `Server: ${snapshot.headers.server}`
        : "No Server header.",
    ],
  };
}

function buildProductsCheck(snapshot: FetchSnapshot): CheckItem {
  if (snapshot.error) {
    return {
      key: "products",
      title: "Shopify endpoint",
      status: "Could not access /products.json",
      severity: "warning",
      details: [`Connection error: ${snapshot.error}`],
    };
  }

  const snippet = snapshot.bodySnippet.trim();
  const lower = snippet.toLowerCase();

  if (snapshot.ok && snapshot.contentType.includes("json")) {
    return {
      key: "products",
      title: "Shopify endpoint",
      status: "Endpoint returns valid JSON",
      severity: "ok",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        snippet.includes('"products"')
          ? "The response includes the products key."
          : "The response is JSON, but the first snippet does not include products.",
      ],
    };
  }

  if (lower.includes('"errors"') && lower.includes("not found")) {
    return {
      key: "products",
      title: "Shopify endpoint",
      status: "Endpoint reports Not Found",
      severity: "danger",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        "Shopify returned an errors: Not Found style response.",
      ],
    };
  }

  if (lower.includes("unavailable")) {
    return {
      key: "products",
      title: "Shopify endpoint",
      status: "Endpoint includes unavailable content",
      severity: "danger",
      details: [
        `HTTP ${snapshot.status} ${snapshot.statusText}`,
        "The endpoint response includes an unavailable signal.",
      ],
    };
  }

  return {
    key: "products",
    title: "Shopify endpoint",
    status: "Endpoint does not clearly confirm store status",
    severity: snapshot.ok ? "neutral" : "warning",
    details: [
      `HTTP ${snapshot.status} ${snapshot.statusText}`,
      snapshot.contentType
        ? `Content-Type: ${snapshot.contentType}`
        : "No Content-Type header.",
      snippet
        ? `First response snippet: ${snippet.slice(0, 180)}`
        : "The response is empty or the body could not be read.",
    ],
  };
}

function checkSsl(host: string): Promise<SslSnapshot> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
        timeout: SSL_CHECK_TIMEOUT_MS,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        resolve(buildSslSnapshotFromCertificate(certificate));
        socket.end();
      },
    );

    socket.once("timeout", () => {
      socket.destroy();
      resolve({
        ok: false,
        error: "TLS connection timeout",
      });
    });

    socket.once("error", (error: Error) => {
      resolve({
        ok: false,
        error: error.message,
      });
    });
  });
}

function getSslSnapshotFromSocket(socket: unknown): SslSnapshot | undefined {
  const tlsSocket = socket as { getPeerCertificate?: () => CertificateDetails } | undefined;

  if (typeof tlsSocket?.getPeerCertificate !== "function") {
    return undefined;
  }

  const certificate = tlsSocket.getPeerCertificate();

  if (!certificate || typeof certificate !== "object") {
    return undefined;
  }

  return buildSslSnapshotFromCertificate(certificate);
}

function buildSslSnapshotFromCertificate(certificate: CertificateDetails): SslSnapshot {
  const validToTime = certificate.valid_to
    ? new Date(certificate.valid_to).getTime()
    : NaN;
  const daysRemaining = Number.isFinite(validToTime)
    ? Math.ceil((validToTime - Date.now()) / 86_400_000)
    : undefined;

  return {
    ok:
      Boolean(certificate.valid_to) &&
      (daysRemaining === undefined || daysRemaining > 0),
    validFrom: certificate.valid_from,
    validTo: certificate.valid_to,
    subject: formatCertificateName(certificate.subject),
    issuer: formatCertificateName(certificate.issuer),
    fingerprint: certificate.fingerprint256,
    daysRemaining,
  };
}

function formatCertificateName(
  value?: Record<string, CertificateFieldValue>,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const parts = Object.values(value).flatMap((item) => {
    if (Array.isArray(item)) {
      return item;
    }

    return item ? [item] : [];
  });

  return parts.length ? parts.join(", ") : undefined;
}

function buildSslCheck(
  snapshot: SslSnapshot,
  host: string,
  viaProxy = false,
): CheckItem {
  if (!snapshot.ok) {
    if (viaProxy) {
      return {
        key: "ssl",
        title: "SSL certificate",
        status: "SSL cannot be read separately through proxy",
        severity: "neutral",
        details: [
          snapshot.error || "Could not read SSL certificate from proxy socket.",
          "If HTTP requests work through SOCKS5H, TLS completed for those requests.",
          `Host checked: ${host}`,
        ],
      };
    }

    return {
      key: "ssl",
      title: "SSL certificate",
      status: "SSL is invalid or cannot be checked",
      severity: "warning",
      details: [
        snapshot.error || "Could not read SSL certificate.",
        `Host checked: ${host}`,
      ],
    };
  }

  return {
    key: "ssl",
    title: "SSL certificate",
    status: "SSL is valid",
    severity:
      snapshot.daysRemaining !== undefined && snapshot.daysRemaining < 14
        ? "warning"
        : "ok",
    details: [
      snapshot.validFrom ? `Valid from: ${snapshot.validFrom}` : "No start date.",
      snapshot.validTo ? `Expires: ${snapshot.validTo}` : "No expiry date.",
      snapshot.daysRemaining !== undefined
        ? `About ${snapshot.daysRemaining} days remaining.`
        : "Could not calculate days remaining.",
      snapshot.issuer ? `Issuer: ${snapshot.issuer}` : "Issuer was not read.",
    ],
  };
}

function formatDnsDetails(snapshot: DnsSnapshot) {
  const details = [
    snapshot.a.length ? `A: ${snapshot.a.join(", ")}` : "No A record.",
    snapshot.aaaa.length
      ? `AAAA: ${snapshot.aaaa.join(", ")}`
      : "No AAAA record.",
    snapshot.cname.length
      ? `CNAME: ${snapshot.cname.join(", ")}`
      : "No CNAME record.",
    snapshot.ns.length ? `NS: ${snapshot.ns.join(", ")}` : "No NS record.",
  ];

  return snapshot.errors.length ? [...details, ...snapshot.errors] : details;
}

function getBlockedHostReason(host: string) {
  const normalizedHost = host
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost.endsWith(".local") ||
    normalizedHost.endsWith(".internal")
  ) {
    return "Only public domains can be checked; localhost and internal hostnames are blocked.";
  }

  if (isPrivateIp(normalizedHost)) {
    return "Only public domains can be checked; private, loopback, and link-local IPs are blocked.";
  }

  return "";
}

function getBlockedDnsReason(snapshot: DnsSnapshot) {
  const blockedA = snapshot.a.find((record) => isPrivateIp(record));
  const blockedAaaa = snapshot.aaaa.find((record) => isPrivateIp(record));
  const blockedCname = snapshot.cname.find((record) =>
    getBlockedHostReason(record),
  );

  if (blockedA || blockedAaaa) {
    return "The domain resolves to a private, loopback, or link-local IP, so the request was blocked.";
  }

  if (blockedCname) {
    return "The domain resolves to an internal hostname, so the request was blocked.";
  }

  return "";
}

function isPrivateIp(value: string) {
  const ipVersion = isIP(value);

  if (ipVersion === 4) {
    const octets = value.split(".").map(Number);
    const [a = 0, b = 0] = octets;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (ipVersion === 6) {
    const normalized = value.toLowerCase();

    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("2001:db8:")
    );
  }

  return false;
}




