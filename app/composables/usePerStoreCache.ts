interface PerStoreCacheOptions<T> {
  capture: () => T;
  restore: (snapshot: T) => void;
  reset: () => void;
  onStoreChange?: () => void;
  canRemember?: (storeId: string) => boolean;
  maxEntries?: number;
}

export function usePerStoreCache<T>({
  capture,
  restore,
  reset,
  onStoreChange,
  canRemember,
  maxEntries = 6,
}: PerStoreCacheOptions<T>) {
  const entries = new Map<string, T>();
  const capacity = Math.max(1, Math.trunc(maxEntries));
  let activeStoreId = "";

  function get(storeId: string) {
    const snapshot = entries.get(storeId);
    if (snapshot === undefined) return undefined;
    entries.delete(storeId);
    entries.set(storeId, snapshot);
    return snapshot;
  }

  function set(storeId: string, snapshot: T) {
    if (!storeId) return;
    entries.delete(storeId);
    entries.set(storeId, snapshot);
    prune();
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

  function prune() {
    while (entries.size > capacity) {
      const oldestInactive = [...entries.keys()].find(
        (storeId) => storeId !== activeStoreId,
      );
      const oldest = oldestInactive || entries.keys().next().value;
      if (!oldest) return;
      entries.delete(oldest);
    }
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
