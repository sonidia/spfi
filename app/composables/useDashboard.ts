import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useDashboardStore } from "~/stores/dashboard";
import { aggregateDashboardSnapshots } from "~~/utils/dashboard-aggregate";

export function useDashboard() {
  const dashboardStore = useDashboardStore();
  const {
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    lastUpdated,
    hasLoaded,
    progress,
  } = storeToRefs(dashboardStore);

  const aggregate = computed(() =>
    aggregateDashboardSnapshots(stores.value, failures.value),
  );

  return {
    aggregate,
    stores,
    failures,
    isLoading,
    completedStores,
    totalStores,
    progress,
    lastUpdated,
    hasLoaded,
    ensureLoaded: () => dashboardStore.load(false),
    refresh: () => dashboardStore.load(true),
    invalidate: dashboardStore.invalidate,
  };
}
