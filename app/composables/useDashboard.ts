import { computed, ref } from "vue";
import { useCredentialVaultStore } from "~/stores/credentialVault";
import { useFormStore } from "~/stores/form";
import type { DashboardStoreFailure, StoreDashboardSnapshot } from "~~/types/dashboard";
import { aggregateDashboardSnapshots } from "~~/utils/dashboard-aggregate";
import { getAppErrorMessage } from "~~/utils/error";
import { getStoreTokenState, resolveStoreAccessToken } from "~~/utils/shop-auth";

const DASHBOARD_REQUEST_CONCURRENCY = 2;

export function useDashboard() {
  const formStore = useFormStore();
  const credentialVault = useCredentialVaultStore();
  const stores = ref<StoreDashboardSnapshot[]>([]);
  const failures = ref<DashboardStoreFailure[]>([]);
  const isLoading = ref(false);
  const completedStores = ref(0);
  const totalStores = ref(0);
  const lastUpdated = ref<Date | null>(null);
  let refreshSequence = 0;

  const aggregate = computed(() =>
    aggregateDashboardSnapshots(stores.value, failures.value),
  );
  const progress = computed(() =>
    totalStores.value
      ? Math.round((completedStores.value / totalStores.value) * 100)
      : 0,
  );

  async function refresh() {
    const sequence = ++refreshSequence;
    formStore.loadKnownStores();
    credentialVault.initialize();
    isLoading.value = true;
    completedStores.value = 0;
    totalStores.value = formStore.knownStores.length;

    const nextFailures: DashboardStoreFailure[] = [];
    const requests: Array<{ storeId: string; token: string }> = [];

    for (const storeId of formStore.knownStores) {
      const storeData = credentialVault.getStoreData(storeId);
      const tokenState = getStoreTokenState(storeData);
      const label = storeData.domain || storeId;

      if (tokenState !== "valid") {
        nextFailures.push({
          storeId,
          label,
          reason: tokenState === "expired" ? "expired-token" : "missing-token",
          message:
            tokenState === "expired"
              ? "Access token expired. Rotate it in Manager."
              : "No active access token is saved for this store.",
        });
        completedStores.value += 1;
        continue;
      }

      requests.push({ storeId, token: resolveStoreAccessToken(storeData) });
    }

    const nextStores = await mapWithConcurrency(
      requests,
      DASHBOARD_REQUEST_CONCURRENCY,
      async ({ storeId, token }) => {
        try {
          return await $fetch<StoreDashboardSnapshot>("/api/dashboard", {
            method: "POST",
            body: {
              storeId,
              token,
              timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            },
          });
        } catch (error) {
          const storeData = credentialVault.getStoreData(storeId);
          nextFailures.push({
            storeId,
            label: storeData.domain || storeId,
            reason: "request-failed",
            message: getAppErrorMessage(
              error,
              "Dashboard data could not be loaded for this store.",
            ),
          });
          return null;
        } finally {
          if (sequence === refreshSequence) completedStores.value += 1;
        }
      },
    );

    if (sequence !== refreshSequence) return;
    stores.value = nextStores.filter((snapshot): snapshot is StoreDashboardSnapshot =>
      Boolean(snapshot),
    );
    failures.value = nextFailures;
    lastUpdated.value = new Date();
    isLoading.value = false;
  }

  return {
    aggregate,
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    progress,
    lastUpdated,
    refresh,
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
) {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex] as TInput);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, runWorker),
  );
  return results;
}
