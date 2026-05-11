import { useFormStore } from "~/stores/form";

export function useTokenRotation() {
  const formStore = useFormStore();
  const rotatingIds = ref<Record<string, boolean>>({});

  async function rotateToken(id: string) {
    const cookie = useLocalStorage<any>(id, {}, { ttl: (60 * 60 * 24 * 365 * 10 ) * 1000 }).state;
    const data = cookie.value;

    if (!data?.clientId || !data?.clientSecret) {
      console.warn(
        `Missing client ID or secret for store ${id}. Cannot rotate.`,
      );
      return;
    }

    if (rotatingIds.value[id]) return;

    rotatingIds.value[id] = true;
    try {
      console.log(`Rotating token for store: ${id}`);
      const res: any = await $fetch("/api/generate-token", {
        method: "POST",
        body: {
          storeId: id,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          sock: data.sock,
        },
      });

      if (res?.access_token) {
        const now = Date.now();
        const expiresTime = now + 24 * 60 * 60 * 1000;
        cookie.value = {
          ...data,
          accessToken: res.access_token,
          expiresTime,
        };
        console.log(`Successfully rotated token for store: ${id}`);
      } else {
        throw new Error("Failed to rotate token");
      }
    } catch (e) {
      console.error(`Rotate failed for store ${id}:`, e);
    } finally {
      rotatingIds.value[id] = false;
    }
  }

  function checkAndRotate() {
    if (typeof window === "undefined") return;

    // Ensure known stores are loaded
    if (formStore.knownStores.length === 0) {
      formStore.loadKnownStores();
    }

    const now = Date.now();
    const MARGIN = 5 * 60 * 1000; // 5 minutes margin

    formStore.knownStores.forEach((id) => {
      const cookie = useLocalStorage<any>(id, {}).state;
      const data = cookie.value;

      if (data && typeof data === "object" && data.accessToken) {
        const expired = !!data.expiresTime && now >= data.expiresTime - MARGIN;
        if (expired && !rotatingIds.value[id]) {
          rotateToken(id);
        }
      }
    });
  }

  onMounted(() => {
    checkAndRotate();
    const interval = setInterval(checkAndRotate, 1000);

    onUnmounted(() => {
      clearInterval(interval);
    });
  });

  return {
    checkAndRotate,
    rotatingIds,
  };
}
