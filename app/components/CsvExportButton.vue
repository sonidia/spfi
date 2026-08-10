<script setup lang="ts">
import { Download } from "@lucide/vue";
import type { CsvExportResource } from "~/composables/useDataExport";

const props = withDefaults(
  defineProps<{
    resource: CsvExportResource;
    filters?: Record<string, unknown>;
    label?: string;
  }>(),
  {
    filters: () => ({}),
    label: "Export CSV",
  },
);

const { storeId, token, isReady } = useActiveShopAuth();
const { error, exportCsv, isExporting } = useDataExport();
const feedback = useStoreFeedback();

async function download() {
  if (!isReady.value) {
    feedback.warning("Select a store with valid credentials before exporting.");
    return;
  }

  const succeeded = await exportCsv(
    props.resource,
    storeId.value,
    token.value,
    props.filters,
  );
  if (succeeded) feedback.success(`${props.label} downloaded.`);
  else feedback.error(error.value, `Failed to export ${props.resource}.`);
}
</script>

<template>
  <BaseButton :loading="isExporting" :disabled="!isReady" @click="download">
    <template #icon><Download /></template>
    {{ isExporting ? "Exporting…" : label }}
  </BaseButton>
</template>
