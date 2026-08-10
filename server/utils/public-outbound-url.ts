import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const BLOCKED_IPV6_RANGES: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of BLOCKED_IPV4_RANGES) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of BLOCKED_IPV6_RANGES) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export interface PublicUrlResolution {
  url: URL;
  addresses: PublicAddress[];
}

export interface PublicAddress {
  address: string;
  family: 4 | 6;
}

interface ResolvePublicUrlOptions {
  allowedHosts?: Iterable<string>;
  allowedProtocols?: Iterable<"https:">;
  allowedPorts?: Iterable<number>;
}

export class PublicUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicUrlError";
  }
}

export async function resolvePublicUrl(
  input: string | URL,
  options: ResolvePublicUrlOptions = {},
): Promise<PublicUrlResolution> {
  const url = parseUrl(input);
  const allowedProtocols = new Set(options.allowedProtocols || ["https:"]);

  if (!allowedProtocols.has(url.protocol as "https:")) {
    throw new PublicUrlError("Only HTTPS destinations are allowed.");
  }

  if (url.username || url.password) {
    throw new PublicUrlError("Destination URLs cannot contain credentials.");
  }

  const effectivePort = url.port ? Number(url.port) : 443;
  const allowedPorts = new Set(options.allowedPorts || [443]);
  if (!allowedPorts.has(effectivePort)) {
    throw new PublicUrlError("Only the standard HTTPS port is allowed.");
  }

  const hostname = normalizeHostname(url.hostname);

  const allowedHosts = normalizeAllowedHosts(options.allowedHosts);
  if (allowedHosts && !allowedHosts.has(hostname)) {
    throw new PublicUrlError("The destination host is not allowlisted.");
  }

  const addresses = await resolvePublicHostname(hostname);

  return { url, addresses };
}

export async function resolvePublicHostname(
  hostname: string,
): Promise<PublicAddress[]> {
  const normalized = normalizeHostname(hostname);
  const unsafeReason = getUnsafeHostnameReason(normalized);
  if (unsafeReason) {
    throw new PublicUrlError(unsafeReason);
  }

  const addresses = await resolveAddresses(normalized);
  const unsafeAddress = addresses.find(
    ({ address }) => !isPublicIpAddress(address),
  );

  if (unsafeAddress) {
    throw new PublicUrlError(
      "The destination resolves to a private, loopback, reserved, or link-local address.",
    );
  }

  return addresses;
}

export function getUnsafeHostnameReason(hostname: string): string {
  const normalized = normalizeHostname(hostname);

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return "Localhost and internal hostnames are not allowed.";
  }

  if (isIP(normalized) && !isPublicIpAddress(normalized)) {
    return "Private, loopback, reserved, and link-local addresses are not allowed.";
  }

  return "";
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) {
    return !blockedIpv4Addresses.check(normalized, "ipv4");
  }

  if (family === 6) {
    return (
      /^[23]/.test(normalized) &&
      !blockedIpv6Addresses.check(normalized, "ipv6")
    );
  }

  return false;
}

function parseUrl(input: string | URL): URL {
  try {
    return new URL(input.toString());
  } catch {
    throw new PublicUrlError("Invalid destination URL.");
  }
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

function normalizeAllowedHosts(hosts?: Iterable<string>) {
  if (!hosts) return null;
  return new Set(Array.from(hosts, normalizeHostname).filter(Boolean));
}

async function resolveAddresses(hostname: string) {
  const family = isIP(hostname);
  if (family) {
    return [{ address: hostname, family: family as 4 | 6 }];
  }

  try {
    const addresses = await lookup(hostname, { all: true, order: "verbatim" });
    if (!addresses.length) {
      throw new PublicUrlError("The destination hostname has no IP address.");
    }

    return addresses.map(({ address, family }) => ({
      address,
      family: family as 4 | 6,
    }));
  } catch (error) {
    if (error instanceof PublicUrlError) throw error;
    throw new PublicUrlError("The destination hostname could not be resolved.");
  }
}
