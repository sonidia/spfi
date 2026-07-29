import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  createRandomSalt,
  decryptJson,
  deriveCredentialKey,
  encryptJson,
} from "~/utils/credentialCrypto";
import type {
  CredentialVaultMetadata,
  StoreCredentials,
  StoreLocalData,
} from "~~/types/shopify";

const VAULT_STORAGE_KEY = "shopify_credential_vault";
const KNOWN_STORES_KEY = "shopify_known_stores";
const VAULT_VERIFIER = "spf-credential-vault-v1";
const STORE_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

interface StorageValue<T> {
  value: T;
  expiresAt?: number;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readKnownStores(): string[] {
  const value = readJson<unknown>(KNOWN_STORES_KEY);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readStoredShop(storeId: string): StoreLocalData {
  const wrapper = readJson<StorageValue<StoreLocalData>>(storeId);
  if (!wrapper?.value || typeof wrapper.value !== "object") return {};
  if (wrapper.expiresAt && Date.now() > wrapper.expiresAt) {
    localStorage.removeItem(storeId);
    return {};
  }
  return wrapper.value;
}

function writeStoredShop(storeId: string, data: StoreLocalData) {
  const wrapper: StorageValue<StoreLocalData> = {
    value: data,
    expiresAt: Date.now() + STORE_TTL_MS,
  };
  localStorage.setItem(storeId, JSON.stringify(wrapper));
}

function publicStoreData(data: StoreLocalData): StoreLocalData {
  return {
    domain: data.domain,
    sock: data.sock,
    clientId: data.clientId,
    expiresTime: data.expiresTime,
    encryptedCredentials: data.encryptedCredentials,
  };
}

export const useCredentialVaultStore = defineStore("credentialVault", () => {
  const isInitialized = ref(false);
  const isUnlocked = ref(false);
  const isBusy = ref(false);
  const error = ref<string | null>(null);
  const vaultExists = ref(false);
  const credentialsByStore = ref<Record<string, StoreCredentials>>({});
  let encryptionKey: CryptoKey | null = null;

  const hasVault = computed(() => vaultExists.value);

  const needsSetup = computed(() => isInitialized.value && !hasVault.value);

  function initialize() {
    if (typeof window === "undefined") return;
    vaultExists.value = Boolean(localStorage.getItem(VAULT_STORAGE_KEY));
    isInitialized.value = true;
  }

  function getPublicStoreData(storeId: string): StoreLocalData {
    return readStoredShop(storeId);
  }

  function getStoreData(storeId: string): StoreLocalData {
    const stored = readStoredShop(storeId);
    const credentials = credentialsByStore.value[storeId] || {};
    return {
      ...publicStoreData(stored),
      ...credentials,
    };
  }

  function requireKey(): CryptoKey {
    if (!encryptionKey || !isUnlocked.value) {
      throw new Error("Credential vault is locked. Enter your PIN to continue.");
    }
    return encryptionKey;
  }

  async function persistStoreData(storeId: string, data: StoreLocalData) {
    const key = requireKey();
    const credentials: StoreCredentials = {
      clientSecret: data.clientSecret,
      accessToken: data.accessToken,
    };
    const encryptedCredentials = await encryptJson(
      key,
      credentials,
      `store:${storeId}`,
    );

    credentialsByStore.value[storeId] = credentials;
    writeStoredShop(storeId, {
      domain: data.domain,
      sock: data.sock,
      clientId: data.clientId,
      expiresTime: data.expiresTime,
      encryptedCredentials,
    });
  }

  async function unlock(password: string) {
    if (typeof window === "undefined") return false;
    if (password.length < 4) {
      error.value = "PIN/password must contain at least 4 characters.";
      return false;
    }

    isBusy.value = true;
    error.value = null;

    try {
      let metadata = readJson<CredentialVaultMetadata>(VAULT_STORAGE_KEY);
      const isNewVault = !metadata;

      if (!metadata) {
        const salt = createRandomSalt();
        const key = await deriveCredentialKey(password, salt);
        metadata = {
          version: 1,
          salt,
          verifier: await encryptJson(
            key,
            VAULT_VERIFIER,
            VAULT_STORAGE_KEY,
          ),
        };
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(metadata));
        vaultExists.value = true;
      }

      if (metadata.version !== 1) {
        throw new Error("Unsupported credential vault version.");
      }

      const key = await deriveCredentialKey(password, metadata.salt);
      const verifier = await decryptJson<string>(
        key,
        metadata.verifier,
        VAULT_STORAGE_KEY,
      );
      if (verifier !== VAULT_VERIFIER) {
        throw new Error("Invalid PIN/password.");
      }

      encryptionKey = key;
      isUnlocked.value = true;
      credentialsByStore.value = {};

      for (const storeId of readKnownStores()) {
        const stored = readStoredShop(storeId);
        let credentials: StoreCredentials = {};

        if (stored.encryptedCredentials) {
          credentials = await decryptJson<StoreCredentials>(
            key,
            stored.encryptedCredentials,
            `store:${storeId}`,
          );
        } else if (stored.clientSecret || stored.accessToken) {
          credentials = {
            clientSecret: stored.clientSecret,
            accessToken: stored.accessToken,
          };
        }

        credentialsByStore.value[storeId] = credentials;

        if (
          isNewVault ||
          !stored.encryptedCredentials ||
          "clientSecret" in stored ||
          "accessToken" in stored
        ) {
          await persistStoreData(storeId, { ...stored, ...credentials });
        }
      }

      return true;
    } catch {
      lock();
      error.value =
        "Unable to unlock credentials. Check the PIN/password and try again.";
      return false;
    } finally {
      isBusy.value = false;
    }
  }

  function lock() {
    encryptionKey = null;
    credentialsByStore.value = {};
    isUnlocked.value = false;
  }

  async function saveStoreData(storeId: string, data: StoreLocalData) {
    await persistStoreData(storeId, data);
  }

  async function patchStoreData(
    storeId: string,
    patch: Partial<StoreLocalData>,
  ) {
    await persistStoreData(storeId, {
      ...getStoreData(storeId),
      ...patch,
    });
  }

  function removeStoreData(storeId: string) {
    delete credentialsByStore.value[storeId];
    if (typeof window !== "undefined") {
      localStorage.removeItem(storeId);
    }
  }

  return {
    isInitialized,
    isUnlocked,
    isBusy,
    error,
    hasVault,
    needsSetup,
    initialize,
    unlock,
    lock,
    getPublicStoreData,
    getStoreData,
    saveStoreData,
    patchStoreData,
    removeStoreData,
  };
});
