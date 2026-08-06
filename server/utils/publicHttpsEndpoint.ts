import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];
const NON_PUBLIC_IPS = createNonPublicBlockList();

export async function resolvePublicHttpsEndpoint(value: string) {
  let endpoint: URL;

  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("The tracking API endpoint is not a valid URL.");
  }

  if (endpoint.protocol !== "https:") {
    throw new Error("The tracking API endpoint must use HTTPS.");
  }

  if (endpoint.username || endpoint.password) {
    throw new Error("The tracking API endpoint cannot contain credentials.");
  }

  if (endpoint.port && endpoint.port !== "443") {
    throw new Error(
      "The tracking API endpoint must use the standard HTTPS port.",
    );
  }

  const hostname = endpoint.hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("The tracking API endpoint must use a public hostname.");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (isNonPublicIp(hostname)) {
      throw new Error("The tracking API endpoint cannot use a private IP.");
    }
  } else {
    let addresses: string[] = [];

    try {
      addresses = (
        await lookup(hostname, {
          all: true,
          verbatim: true,
        })
      ).map((result) => result.address);
    } catch {
      // The user-facing resolution error is handled below.
    }

    if (!addresses.length) {
      throw new Error("The tracking API hostname could not be resolved.");
    }

    if (addresses.some(isNonPublicIp)) {
      throw new Error(
        "The tracking API hostname resolves to a private or reserved IP.",
      );
    }
  }

  endpoint.hash = "";
  return endpoint.toString();
}

function isNonPublicIp(value: string) {
  const version = isIP(value);
  if (version === 4) return NON_PUBLIC_IPS.check(value, "ipv4");
  if (version === 6) return NON_PUBLIC_IPS.check(value, "ipv6");
  return true;
}

function createNonPublicBlockList() {
  const blockList = new BlockList();

  const ipv4Subnets: Array<[string, number]> = [
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

  const ipv6Subnets: Array<[string, number]> = [
    ["::", 128],
    ["::1", 128],
    ["::", 96],
    ["::ffff:0:0", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 32],
    ["2001:2::", 48],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
  ];

  for (const [network, prefix] of ipv4Subnets) {
    blockList.addSubnet(network, prefix, "ipv4");
  }
  for (const [network, prefix] of ipv6Subnets) {
    blockList.addSubnet(network, prefix, "ipv6");
  }

  return blockList;
}
