import { useFormStore } from "~/stores/form";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import type { ShopifyAccessTokenResponse } from "~~/types/shopify";
import { resolveTokenExpiresAt } from "~~/utils/token-lifecycle";

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type WindowWithIdleCallback = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadlineLike) => void,
      options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const TOKEN_ROTATION_MARGIN_MS = 30 * 60 * 1000;
const TOKEN_ROTATION_JITTER_MS = 5 * 60 * 1000;
const TOKEN_ROTATION_MAX_DELAY_MS = 60 * 60 * 1000;
const TOKEN_ROTATION_IDLE_TIMEOUT_MS = 30 * 1000;
const TOKEN_ROTATION_RETRY_DELAY_MS = 60 * 1000;
const TOKEN_ROTATION_LEASE_MS = 2 * 60 * 1000;
const TOKEN_ROTATION_LEASE_PREFIX = "spf_token_rotation_lease:";

export function useTokenRotation() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const rotatingIds = ref<Record<string, boolean>>({});
  let rotationTimer: ReturnType<typeof setTimeout> | null = null;
  let idleCallbackHandle: number | null = null;
  let stopKnownStoresWatch: (() => void) | null = null;
  let isDisposed = false;

  async function rotateToken(id: string) {
    const data = credentialVault.getStoreData(id);

    if (!data?.clientId || !data?.clientSecret) {
      console.warn(`Missing client ID or secret for store ${id}. Cannot rotate.`);
      return;
    }

    if (rotatingIds.value[id] || !acquireRotationLease(id)) return;

    rotatingIds.value[id] = true;
    try {
      console.log(`Rotating token for store: ${id}`);
      const res = await $fetch<ShopifyAccessTokenResponse>("/api/generate-token", {
        method: "POST",
        body: {
          storeId: id,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          sock: data.sock,
        },
      });

      if (res?.access_token) {
        await credentialVault.patchStoreData(id, {
          accessToken: res.access_token,
          expiresTime: resolveTokenExpiresAt(res),
        });
        console.log(`Successfully rotated token for store: ${id}`);
      } else {
        throw new Error("Failed to rotate token");
      }
    } catch (e) {
      console.error(`Rotate failed for store ${id}:`, e);
    } finally {
      rotatingIds.value[id] = false;
      releaseRotationLease(id);
    }
  }

  function isDocumentVisible() {
    return typeof document === "undefined" || document.visibilityState === "visible";
  }

  function clearScheduledRotation() {
    if (rotationTimer) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }

    if (idleCallbackHandle !== null && typeof window !== "undefined") {
      const idleWindow = window as WindowWithIdleCallback;
      idleWindow.cancelIdleCallback?.(idleCallbackHandle);
      idleCallbackHandle = null;
    }
  }

  function runWhenIdle(callback: () => void) {
    if (typeof window === "undefined") return;

    const idleWindow = window as WindowWithIdleCallback;
    if (typeof idleWindow.requestIdleCallback === "function") {
      idleCallbackHandle = idleWindow.requestIdleCallback(
        () => {
          idleCallbackHandle = null;
          callback();
        },
        { timeout: TOKEN_ROTATION_IDLE_TIMEOUT_MS },
      );
      return;
    }

    callback();
  }

  function getNextRotationDelay(now = Date.now()) {
    let nextDelay = TOKEN_ROTATION_MAX_DELAY_MS;

    if (formStore.knownStores.length === 0) {
      formStore.loadKnownStores();
    }

    formStore.knownStores.forEach((id) => {
      const data = credentialVault.getStoreData(id);

      if (!data || typeof data !== "object" || !data.accessToken) {
        return;
      }

      if (!data.expiresTime) {
        if (isExpiringShopifyToken(data.accessToken) && data.clientSecret) {
          nextDelay = 0;
        }
        return;
      }

      const dueIn =
        data.expiresTime - TOKEN_ROTATION_MARGIN_MS - getStoreRotationJitter(id) - now;
      if (dueIn <= 0 && !rotatingIds.value[id]) {
        nextDelay = 0;
        return;
      }

      if (dueIn > 0) {
        nextDelay = Math.min(nextDelay, dueIn);
      }
    });

    return Math.min(Math.max(nextDelay, 0), TOKEN_ROTATION_MAX_DELAY_MS);
  }

  function scheduleNextCheck(delayMs = 0) {
    if (typeof window === "undefined" || isDisposed) return;

    clearScheduledRotation();

    if (!isDocumentVisible()) {
      return;
    }

    rotationTimer = setTimeout(() => {
      rotationTimer = null;
      runWhenIdle(() => {
        void checkAndRotate();
      });
    }, delayMs);
  }

  async function checkAndRotate() {
    if (typeof window === "undefined") return;
    if (!isDocumentVisible()) return;

    if (formStore.knownStores.length === 0) {
      formStore.loadKnownStores();
    }

    const now = Date.now();
    const rotationTasks: Promise<void>[] = [];

    formStore.knownStores.forEach((id) => {
      const data = credentialVault.getStoreData(id);

      if (data && typeof data === "object" && data.accessToken) {
        const expired = data.expiresTime
          ? now >=
            data.expiresTime - TOKEN_ROTATION_MARGIN_MS - getStoreRotationJitter(id)
          : isExpiringShopifyToken(data.accessToken) && Boolean(data.clientSecret);
        if (expired && !rotatingIds.value[id]) {
          rotationTasks.push(rotateToken(id));
        }
      }
    });

    if (rotationTasks.length) {
      await Promise.allSettled(rotationTasks);
    }

    const nextDelay = getNextRotationDelay(Date.now());
    scheduleNextCheck(
      rotationTasks.length && nextDelay === 0
        ? TOKEN_ROTATION_RETRY_DELAY_MS
        : nextDelay,
    );
  }

  function handleVisibilityChange() {
    if (isDocumentVisible()) {
      scheduleNextCheck(0);
      return;
    }

    clearScheduledRotation();
  }

  function handleStorageChange(event: StorageEvent) {
    if (!event.key || formStore.knownStores.includes(event.key)) {
      scheduleNextCheck(0);
    }
  }

  onMounted(() => {
    credentialVault.initialize();
    stopKnownStoresWatch = watch(
      () => [formStore.knownStores.join("|"), credentialVault.storeDataRevision],
      () => scheduleNextCheck(0),
    );
    scheduleNextCheck(0);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("storage", handleStorageChange);
    }

    onUnmounted(() => {
      isDisposed = true;
      stopKnownStoresWatch?.();
      clearScheduledRotation();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("storage", handleStorageChange);
      }
    });
  });

  return {
    checkAndRotate,
    rotatingIds,
  };
}

function isExpiringShopifyToken(token: string | undefined) {
  return String(token || "").startsWith("shpss_");
}

function getStoreRotationJitter(storeId: string) {
  let hash = 0;
  for (const character of storeId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % TOKEN_ROTATION_JITTER_MS;
}

function acquireRotationLease(storeId: string) {
  if (typeof window === "undefined") return false;
  const key = `${TOKEN_ROTATION_LEASE_PREFIX}${storeId}`;
  const now = Date.now();

  try {
    const existing = JSON.parse(localStorage.getItem(key) || "null") as {
      owner?: string;
      expiresAt?: number;
    } | null;
    if (
      existing?.owner &&
      existing.owner !== leaseOwnerForRead() &&
      Number(existing.expiresAt) > now
    ) {
      return false;
    }
  } catch {
    // A malformed or expired lease is safe to replace.
  }

  const owner = leaseOwnerForRead();
  localStorage.setItem(
    key,
    JSON.stringify({ owner, expiresAt: now + TOKEN_ROTATION_LEASE_MS }),
  );
  try {
    return JSON.parse(localStorage.getItem(key) || "null")?.owner === owner;
  } catch {
    return false;
  }
}

function releaseRotationLease(storeId: string) {
  if (typeof window === "undefined") return;
  const key = `${TOKEN_ROTATION_LEASE_PREFIX}${storeId}`;
  try {
    const current = JSON.parse(localStorage.getItem(key) || "null") as {
      owner?: string;
    } | null;
    if (current?.owner === leaseOwnerForRead()) localStorage.removeItem(key);
  } catch {
    localStorage.removeItem(key);
  }
}

let rotationLeaseOwner = "";

function leaseOwnerForRead() {
  if (!rotationLeaseOwner) {
    rotationLeaseOwner =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return rotationLeaseOwner;
}
