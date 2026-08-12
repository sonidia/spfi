import { isIP } from "node:net";

export class PublicProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicProxyError";
  }
}

export function parsePublicProxyUrl(proxyUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    throw new PublicProxyError("Invalid SOCKS5 proxy URL.");
  }

  if (parsed.protocol !== "socks5h:") {
    throw new PublicProxyError("Proxy must use SOCKS5H remote DNS.");
  }
  if (!parsed.hostname) {
    throw new PublicProxyError("Proxy hostname is required.");
  }

  validateProxyPort(parsed);
  validateProxyHostname(parsed);
  return parsed;
}

export function pinPublicProxyUrl(
  proxyUrl: URL,
  address: { address: string; family: 4 | 6 },
) {
  const pinned = new URL(proxyUrl);
  pinned.hostname =
    address.family === 6 ? `[${address.address}]` : address.address;
  return pinned.toString();
}

function validateProxyPort(proxyUrl: URL) {
  const port = Number(proxyUrl.port);
  if (
    !proxyUrl.port ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new PublicProxyError("Proxy port must be between 1 and 65535.");
  }
}

function validateProxyHostname(proxyUrl: URL) {
  if (isIP(proxyUrl.hostname.replace(/^\[|\]$/g, "")) !== 0) return;

  const labels = proxyUrl.hostname.replace(/\.$/, "").split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  ) {
    throw new PublicProxyError("Proxy hostname is invalid.");
  }
}
