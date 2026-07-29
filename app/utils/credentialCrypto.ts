import type { EncryptedPayload } from "~~/types/shopify";

const KEY_DERIVATION_ITERATIONS = 250_000;
const AES_KEY_LENGTH = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this browser.");
  }
  return globalThis.crypto;
}

export function createRandomSalt(): string {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export async function deriveCredentialKey(
  password: string,
  salt: string,
): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const material = await cryptoApi.subtle.importKey(
    "raw",
    bytesToArrayBuffer(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytesToArrayBuffer(base64ToBytes(salt)),
      iterations: KEY_DERIVATION_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson<T>(
  key: CryptoKey,
  value: T,
  additionalData: string,
): Promise<EncryptedPayload> {
  const cryptoApi = getCrypto();
  const iv = new Uint8Array(12);
  cryptoApi.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: bytesToArrayBuffer(iv),
      additionalData: bytesToArrayBuffer(new TextEncoder().encode(additionalData)),
    },
    key,
    bytesToArrayBuffer(plaintext),
  );

  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(
  key: CryptoKey,
  payload: EncryptedPayload,
  additionalData: string,
): Promise<T> {
  if (payload.version !== 1) {
    throw new Error("Unsupported encrypted credential version.");
  }

  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytesToArrayBuffer(base64ToBytes(payload.iv)),
      additionalData: bytesToArrayBuffer(new TextEncoder().encode(additionalData)),
    },
    key,
    bytesToArrayBuffer(base64ToBytes(payload.ciphertext)),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
