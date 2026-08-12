export interface StorageEnvelope<T> {
  value: T;
  expiresAt?: number;
}

export interface ReadStorageOptions<T> {
  allowLegacyValue?: boolean;
  validate?: (value: unknown) => value is T;
}

export function readBrowserJson(key: string): unknown | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function readStorageValue<T>(
  key: string,
  fallback: T,
  options: ReadStorageOptions<T> = {},
): T {
  const parsed = readBrowserJson(key);
  if (parsed === null) return fallback;

  const envelope = isStorageEnvelope(parsed) ? parsed : null;
  if (envelope?.expiresAt && Date.now() > envelope.expiresAt) {
    localStorage.removeItem(key);
    return fallback;
  }

  const value = envelope
    ? envelope.value
    : options.allowLegacyValue
      ? parsed
      : undefined;

  if (value === undefined) return fallback;
  if (options.validate && !options.validate(value)) return fallback;
  return value as T;
}

export function writeStorageValue<T>(key: string, value: T, ttl?: number) {
  if (typeof window === "undefined") return;

  const envelope: StorageEnvelope<T> = {
    value,
    expiresAt: ttl ? Date.now() + ttl : undefined,
  };
  localStorage.setItem(key, JSON.stringify(envelope));
}

export function isStorageEnvelope(value: unknown): value is StorageEnvelope<unknown> {
  return isRecord(value) && Object.hasOwn(value, "value");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
