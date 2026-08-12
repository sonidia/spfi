import {
  PublicUrlError,
  resolvePublicHostname,
  type PublicAddress,
} from "./public-outbound-url";
import {
  parsePublicProxyUrl,
  pinPublicProxyUrl,
  PublicProxyError,
} from "./proxy-endpoint";

const MAX_PROXY_ADDRESSES = 8;

export interface PublicProxyOptions {
  allowPrivateHosts?: boolean;
}

/**
 * Validates every proxy endpoint and pins hostnames to the public IPs that were
 * checked. Pinning closes the DNS-rebinding gap between validation and connect.
 */
export async function resolvePublicProxyUrls(
  proxyUrls: Iterable<string>,
  options: PublicProxyOptions = {},
): Promise<string[]> {
  const resolved: string[] = [];

  for (const proxyUrl of proxyUrls) {
    const parsed = parsePublicProxyUrl(proxyUrl);

    if (options.allowPrivateHosts) {
      resolved.push(parsed.toString());
      continue;
    }

    let addresses: PublicAddress[];
    try {
      addresses = await resolvePublicHostname(parsed.hostname);
    } catch (error) {
      throw new PublicProxyError(
        error instanceof PublicUrlError
          ? `Proxy host rejected: ${error.message}`
          : "Proxy hostname could not be validated.",
      );
    }

    for (const address of addresses.slice(0, MAX_PROXY_ADDRESSES)) {
      resolved.push(pinPublicProxyUrl(parsed, address));
    }
  }

  return Array.from(new Set(resolved));
}
