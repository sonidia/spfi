import { ref, watch, type Ref } from "vue";
import { readStorageValue, writeStorageValue } from "~~/utils/browser-storage";

interface Options {
  ttl?: number;
  deep?: boolean;
}

interface ClientStorageEntry {
  state: Ref<unknown>;
}

const clientEntries = new Map<string, ClientStorageEntry>();

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: Options = {},
) {
  const { ttl, deep = false } = options;
  const state = getSharedState(key, defaultValue, ttl, deep);

  const set = (value: T) => {
    state.value = value;
  };

  const remove = () => {
    state.value = defaultValue;
    if (typeof window !== "undefined") localStorage.removeItem(key);
  };

  return {
    state,
    set,
    remove,
  };
}

function getSharedState<T>(
  key: string,
  defaultValue: T,
  ttl: number | undefined,
  deep: boolean,
): Ref<T> {
  if (typeof window === "undefined") return ref(defaultValue) as Ref<T>;

  const existing = clientEntries.get(key);
  if (existing) return existing.state as Ref<T>;

  const state = ref(
    readStorageValue(key, defaultValue, { allowLegacyValue: false }),
  ) as Ref<T>;

  clientEntries.set(key, { state });
  watch(
    state,
    (value) => {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        writeStorageValue(key, value, ttl);
      }
    },
    { deep, flush: "sync" },
  );

  return state;
}
