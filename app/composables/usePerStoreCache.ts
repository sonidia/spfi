import type { Ref } from "vue";

interface PerStoreCacheOptions<T> {
  activeStoreId: Ref<string>;
  capture: () => T;
  restore: (snapshot: T) => void;
  reset: () => void;
  onStoreChange?: () => void;
  canRemember?: (storeId: string) => boolean;
}

export function usePerStoreCache<T>({
  activeStoreId,
  capture,
  restore,
  reset,
  onStoreChange,
  canRemember,
}: PerStoreCacheOptions<T>) {
  const entries = new Map<string, T>();

  function get(storeId: string) {
    return entries.get(storeId);
  }

  function set(storeId: string, snapshot: T) {
    if (storeId) entries.set(storeId, snapshot);
  }

  function remember(storeId = activeStoreId.value) {
    if (!storeId || (canRemember && !canRemember(storeId))) return;
    set(storeId, capture());
  }

  function hydrate(storeId: string): boolean {
    activeStoreId.value = storeId;
    onStoreChange?.();

    const snapshot = get(storeId);
    if (!snapshot) {
      reset();
      return false;
    }

    restore(snapshot);
    return true;
  }

  function activate(storeId: string): boolean {
    return activeStoreId.value === storeId ? true : hydrate(storeId);
  }

  function evict(storeId: string) {
    entries.delete(storeId);
    if (activeStoreId.value === storeId) {
      onStoreChange?.();
      reset();
    }
  }

  return {
    activate,
    evict,
    get,
    hydrate,
    remember,
    set,
  };
}
