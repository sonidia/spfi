import { SocksProxyAgent } from "socks-proxy-agent";
import { StoreStatusInputError } from "./status-checker-errors";

const INVISIBLE_OR_CONTROL_CHARS =
  /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g;
const PROXY_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SOCKS5_PROTOCOL_PATTERN = /^socks5h?:\/\//i;
const SOCKS5H_PROTOCOL = "socks5h:";

interface SocksProxyAgentInternals {
  proxyUrl?: string;
  shouldLookup?: boolean;
}

export function createSocksProxyAgents(proxy?: string) {
  const proxyVariants = buildProxyVariants(proxy);

  if (!proxyVariants.length) {
    return [];
  }

  const agents: SocksProxyAgent[] = [];

  for (const proxyUrl of proxyVariants) {
    try {
      const agent = new SocksProxyAgent(proxyUrl);

      assertRemoteDnsSocks5hAgent(agent, proxyUrl);
      agents.push(agent);
    } catch (error) {
      const isLastVariant =
        proxyVariants.indexOf(proxyUrl) === proxyVariants.length - 1;

      if (!agents.length && isLastVariant) {
        throw new StoreStatusInputError(
          error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
        );
      }
    }
  }

  return agents;
}

export function buildProxyVariants(proxy?: string) {
  const rawProxy = sanitizePart(proxy || "");

  if (!rawProxy) {
    return [];
  }

  const variants: string[] = [];

  try {
    variants.push(normalizeProxyUrl(rawProxy));
  } catch (error) {
    throw new StoreStatusInputError(
      error instanceof Error ? error.message : "Invalid SOCKS5 proxy.",
    );
  }

  const rawVariant = toRawProxyVariant(rawProxy);
  if (rawVariant) {
    variants.push(rawVariant);
  }

  return variants.filter(
    (variant, index) =>
      variants.findIndex((candidate) => candidate === variant) === index,
  );
}

function toRawProxyVariant(input: string): string | null {
  const raw = sanitizePart(input);

  if (!raw) {
    return null;
  }

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    return raw.replace(/^socks5:\/\//i, "socks5h://");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw)) {
    return null;
  }

  const parts = raw.split(":").map((part) => sanitizePart(part));
  const [host, port, ...credentials] = parts;

  if (!host || !port) {
    return null;
  }

  if (!credentials.length) {
    return `socks5h://${host}:${port}`;
  }

  const username = credentials.shift() || "";
  const password = credentials.join(":");

  if (!username || !password) {
    return null;
  }

  return `socks5h://${username}:${password}@${host}:${port}`;
}

export function normalizeProxyUrl(input: string): string {
  const raw = sanitizePart(input);

  if (!raw) {
    throw new Error("Proxy is empty.");
  }

  if (PROXY_PROTOCOL_PATTERN.test(raw) && !SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    throw new Error(
      "Only SOCKS5 proxy is supported. Use host:port or host:port:user:pass.",
    );
  }

  if (SOCKS5_PROTOCOL_PATTERN.test(raw)) {
    const parsed = new URL(raw);

    if (parsed.username) {
      parsed.username = normalizeCredential(parsed.username);
    }

    if (parsed.password) {
      parsed.password = normalizeCredential(parsed.password);
    }

    parsed.hostname = sanitizePart(parsed.hostname);
    if (parsed.port) {
      parsed.port = sanitizePart(parsed.port);
    }

    parsed.protocol = SOCKS5H_PROTOCOL;

    return parsed.toString();
  }

  const parts = raw.split(":").map((part) => sanitizePart(part));

  if (parts.length < 2) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  const [host, port, ...credentials] = parts;

  if (!host || !port) {
    throw new Error("Invalid proxy format. Use ip:port or ip:port:user:pass.");
  }

  if (credentials.length === 0) {
    return `socks5h://${host}:${port}`;
  }

  const username = credentials.shift() || "";
  const password = credentials.join(":");

  if (!username || !password) {
    throw new Error(
      "Invalid proxy credentials. Use ip:port:user:pass when auth is required.",
    );
  }

  return `socks5h://${normalizeCredential(username)}:${normalizeCredential(
    password,
  )}@${host}:${port}`;
}

export function describeSocksProxyRoute(agent: SocksProxyAgent) {
  const internals = agent as SocksProxyAgentInternals;
  const proxyUrl = internals.proxyUrl || "";
  const protocol = getProxyProtocol(proxyUrl);
  const dnsMode = internals.shouldLookup === false ? "remote DNS" : "local DNS";

  return `${protocol.toUpperCase()} (${dnsMode}) via ${maskProxyUrl(proxyUrl)}`;
}

export function getSocksProxyUrl(agent: SocksProxyAgent) {
  return (agent as SocksProxyAgentInternals).proxyUrl || "";
}

function assertRemoteDnsSocks5hAgent(
  agent: SocksProxyAgent,
  proxyUrl: string,
) {
  const internals = agent as SocksProxyAgentInternals;
  const protocol = getProxyProtocol(internals.proxyUrl || proxyUrl);

  if (protocol !== "socks5h" || internals.shouldLookup !== false) {
    throw new StoreStatusInputError(
      "Proxy must use SOCKS5H remote DNS for every request.",
    );
  }
}

function getProxyProtocol(proxyUrl: string) {
  try {
    return new URL(proxyUrl).protocol.replace(/:$/, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function maskProxyUrl(proxyUrl: string) {
  return proxyUrl.replace(/\/\/([^:/@]+):([^@]+)@/, "//****:****@");
}

function sanitizePart(value: string) {
  return String(value || "").replace(INVISIBLE_OR_CONTROL_CHARS, "").trim();
}

function normalizeCredential(value: string) {
  return encodeURIComponent(safeDecode(sanitizePart(value)));
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
