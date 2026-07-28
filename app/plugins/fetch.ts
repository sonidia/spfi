import { defineNuxtPlugin } from "#imports";
import type { StoreLocalData } from "~~/types/shopify";

function readStoreId(source: unknown): string | null {
  if (!source || typeof source !== "object" || !("storeId" in source)) {
    return null;
  }

  const value = (source as { storeId?: unknown }).storeId;
  return typeof value === "string" && value ? value : null;
}

export default defineNuxtPlugin(() => {
  const customFetch = $fetch.create({
    onRequest({ request, options }) {
      if (typeof window === "undefined") return;

      const url = request.toString();
      if (!url.startsWith("/api")) return;

      let storeId =
        readStoreId(options.body) ||
        readStoreId(options.query) ||
        readStoreId(options.params);

      if (!storeId) {
        storeId = useLocalStorage("active_store_id", "").state.value;
      }

      if (storeId) {
        const cookieData = useLocalStorage<StoreLocalData>(storeId, {}).state.value;
        if (cookieData && Object.keys(cookieData).length > 0) {
          options.headers = new Headers(options.headers || {});
          options.headers.set(
            "x-store-data",
            encodeURIComponent(JSON.stringify(cookieData)),
          );
        }
      }
    },
  });

  globalThis.$fetch = customFetch;

  return {
    provide: {
      fetch: customFetch,
    },
  };
});
