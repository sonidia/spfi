interface PerStoreCacheOptions<T> {
  capture: () => T;
  restore: (snapshot: T) => void;
  reset: () => void;
  onStoreChange?: () => void;
  canRemember?: (storeId: string) => boolean;
}

export function usePerStoreCache<T>({
  capture,
  restore,
  reset,
  onStoreChange,
  canRemember,
}: PerStoreCacheOptions<T>) {
  const entries = new Map<string, T>();
  let activeStoreId = "";

  function get(storeId: string) {
    return entries.get(storeId);
  }

  function set(storeId: string, snapshot: T) {
    if (storeId) entries.set(storeId, snapshot);
  }

  function remember(storeId = activeStoreId) {
    if (!storeId || (canRemember && !canRemember(storeId))) return;
    set(storeId, capture());
  }

  function hydrate(storeId: string): boolean {
    activeStoreId = storeId;
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
    return activeStoreId === storeId ? true : hydrate(storeId);
  }

  function evict(storeId: string) {
    entries.delete(storeId);
    if (activeStoreId === storeId) {
      onStoreChange?.();
      reset();
    }
  }

  function isActive(storeId: string) {
    return Boolean(storeId) && activeStoreId === storeId;
  }

  return {
    activate,
    evict,
    get,
    hydrate,
    isActive,
    remember,
    set,
  };
}
