import { ref, watch, type Ref } from "vue";

type StorageValue<T> = {
  value: T;
  expiresAt?: number;
};

interface Options {
  ttl?: number;
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: Options = {},
) {
  const { ttl } = options;

  const getStored = (): T => {
    if (typeof window === "undefined") return defaultValue;

    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    try {
      const parsed: StorageValue<T> = JSON.parse(raw);

      // check TTL
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(key);
        return defaultValue;
      }

      return parsed.value;
    } catch {
      return defaultValue;
    }
  };

  const state = ref(getStored()) as Ref<T>;

  const save = (value: T) => {
    const data: StorageValue<T> = {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };

    localStorage.setItem(key, JSON.stringify(data));
  };

  watch(
    state,
    (val) => {
      if (val === null || val === undefined) {
        localStorage.removeItem(key);
      } else {
        save(val);
      }
    },
    { deep: true },
  );

  const set = (value: T) => {
    state.value = value;
  };

  const remove = () => {
    state.value = defaultValue;
    localStorage.removeItem(key);
  };

  const isExpired = (): boolean => {
    const raw = localStorage.getItem(key);
    if (!raw) return true;

    try {
      const parsed: StorageValue<T> = JSON.parse(raw);
      return !!parsed.expiresAt && Date.now() > parsed.expiresAt;
    } catch {
      return true;
    }
  };

  return {
    state,
    set,
    remove,
    isExpired,
  };
}

// const { state: token, set, remove } = useLocalStorage<string>(
//   "token",
//   "",
//   { ttl: 1000 * 60 * 30 } // 30 phút
// );

// function login() {
//   set("abc123");
// }

// function logout() {
//   remove();
// }

