export function isSocks5ProxyInput(proxy: string) {
  const trimmed = proxy.trim();

  if (
    !trimmed ||
    /^https?:\/\//i.test(trimmed) ||
    /^socks(4|4a):\/\//i.test(trimmed)
  ) {
    return false;
  }

  if (/^socks5h?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);

      return Boolean(url.hostname && url.port);
    } catch {
      return false;
    }
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return false;
  }

  const [host = "", port = ""] = trimmed.split(":");

  return Boolean(host.trim() && /^\d{1,5}$/.test(port.trim()));
}

export function getSocks5ProxyInputError(proxy: string) {
  const trimmed = proxy.trim();

  if (!trimmed) {
    return "Enter SOCKS5 proxy as host:port or host:port:user:pass.";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return "Only SOCKS5 proxy is supported, not HTTP/HTTPS proxy.";
  }

  if (/^socks(4|4a):\/\//i.test(trimmed)) {
    return "Only SOCKS5 proxy is supported, not SOCKS4/SOCKS4A.";
  }

  if (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) &&
    !/^socks5h?:\/\//i.test(trimmed)
  ) {
    return "Only SOCKS5 proxy is supported; host:port without protocol is accepted.";
  }

  return "";
}
