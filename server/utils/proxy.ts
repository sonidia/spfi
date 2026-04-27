function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const INVISIBLE_OR_CONTROL_CHARS =
  /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g;

function sanitizePart(value: string) {
  return String(value || "")
    .replace(INVISIBLE_OR_CONTROL_CHARS, "")
    .trim();
}

function normalizeCredential(value: string) {
  return encodeURIComponent(safeDecode(value));
}

export function hasInvisibleOrControlChars(value: string): boolean {
  return INVISIBLE_OR_CONTROL_CHARS.test(String(value || ""));
}

export type ProxyInputMeta = {
  hasScheme: boolean;
  segmentCount: number;
  usernameLength: number;
  passwordLength: number;
  hasInvisibleChars: boolean;
};

export function inspectProxyInput(input: string): ProxyInputMeta {
  const raw = String(input || "");
  const hasScheme =
    /^socks(4|4a|5|5h)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw);

  if (hasScheme) {
    try {
      const parsed = new URL(raw);
      const username = safeDecode(parsed.username || "");
      const password = safeDecode(parsed.password || "");
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: username.length,
        passwordLength: password.length,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    } catch {
      return {
        hasScheme: true,
        segmentCount: 0,
        usernameLength: 0,
        passwordLength: 0,
        hasInvisibleChars: hasInvisibleOrControlChars(raw),
      };
    }
  }

  const parts = raw.split(":");
  const username = sanitizePart(parts[2] || "");
  const password = sanitizePart(parts.slice(3).join(":") || "");
  return {
    hasScheme: false,
    segmentCount: parts.length,
    usernameLength: username.length,
    passwordLength: password.length,
    hasInvisibleChars: hasInvisibleOrControlChars(raw),
  };
}

export function normalizeProxyUrl(input: string): string {
  const raw = sanitizePart(input || "");
  if (!raw) {
    throw new Error("Proxy is empty.");
  }

  if (/^socks(4|4a|5|5h)?:\/\//i.test(raw) || /^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (parsed.username) {
      parsed.username = normalizeCredential(sanitizePart(parsed.username));
    }
    if (parsed.password) {
      parsed.password = normalizeCredential(sanitizePart(parsed.password));
    }
    parsed.hostname = sanitizePart(parsed.hostname);
    if (parsed.port) parsed.port = sanitizePart(parsed.port);
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
    return `socks5://${host}:${port}`;
  }

  const username = sanitizePart(credentials.shift() || "");
  const password = sanitizePart(credentials.join(":") || "");
  if (!username || !password) {
    throw new Error(
      "Invalid proxy credentials. Use ip:port:user:pass when auth is required.",
    );
  }

  return `socks5h://${normalizeCredential(username)}:${normalizeCredential(password)}@${host}:${port}`;
}

export function maskProxyUrl(proxyUrl: string): string {
  return proxyUrl.replace(/:([^:@/]+)@/, ":****@");
}
