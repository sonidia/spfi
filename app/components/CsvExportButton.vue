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
    label: "",
  },
);

const { storeId, token, isReady } = useActiveShopAuth();
const { error, exportCsv, isExporting } = useDataExport();
const feedback = useStoreFeedback();
const { t } = useLocalization();
const visibleLabel = computed(() => props.label || t("export.csv"));

async function download() {
  if (!isReady.value) {
    feedback.warning(t("export.credentialsRequired"));
    return;
  }

  const succeeded = await exportCsv(
    props.resource,
    storeId.value,
    token.value,
    props.filters,
  );
  if (succeeded) {
    feedback.success(t("export.downloaded", { label: visibleLabel.value }));
  } else {
    feedback.error(error.value, t("export.failed", { resource: props.resource }));
  }
}
</script>

<template>
  <BaseButton :loading="isExporting" :disabled="!isReady" @click="download">
    <template #icon><Download /></template>
    {{ isExporting ? t("export.exporting") : visibleLabel }}
  </BaseButton>
</template>
