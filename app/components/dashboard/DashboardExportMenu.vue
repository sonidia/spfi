<script setup lang="ts">
import { Braces, ChevronDown, CodeXml, Download, FileSpreadsheet } from "@lucide/vue";
import type { DashboardAggregate } from "~~/types/dashboard";
import {
  useDashboardExport,
  type DashboardExportFormat,
} from "~/composables/useDashboardExport";

const props = defineProps<{
  dashboard: DashboardAggregate;
  filterDescription: string;
}>();

const { exportDashboard } = useDashboardExport();
const options: Array<{
  format: DashboardExportFormat;
  label: string;
  detail: string;
  icon: typeof FileSpreadsheet;
}> = [
  {
    format: "csv",
    label: "Overview CSV",
    detail: "Spreadsheet-ready store summary",
    icon: FileSpreadsheet,
  },
  {
    format: "tsv",
    label: "Excel TSV",
    detail: "Tab-separated UTF-8 workbook data",
    icon: FileSpreadsheet,
  },
  {
    format: "json",
    label: "Full JSON",
    detail: "Complete filtered dashboard payload",
    icon: Braces,
  },
  {
    format: "html",
    label: "HTML report",
    detail: "Printable standalone report",
    icon: CodeXml,
  },
];
</script>

<template>
  <BasePopover align="right">
    <template #trigger="{ triggerProps }">
      <button v-bind="triggerProps" class="dashboard-export-trigger" type="button">
        <Download /> Export <ChevronDown />
      </button>
    </template>
    <template #default="{ close }">
      <div class="dashboard-export-menu">
        <button
          v-for="option in options"
          :key="option.format"
          type="button"
          role="menuitem"
          @click="
            exportDashboard(props.dashboard, option.format, filterDescription);
            close();
          "
        >
          <span><component :is="option.icon" /></span>
          <span
            ><strong>{{ option.label }}</strong
            ><small>{{ option.detail }}</small></span
          >
        </button>
      </div>
    </template>
  </BasePopover>
</template>

<style scoped>
.dashboard-export-trigger {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
}

.dashboard-export-trigger:hover {
  border-color: color-mix(in srgb, var(--green) 40%, var(--border));
  color: var(--green);
}

.dashboard-export-trigger svg {
  width: 14px;
  height: 14px;
}

.dashboard-export-trigger svg:last-child {
  width: 11px;
}

.dashboard-export-menu {
  display: grid;
  width: 268px;
  padding: 6px;
}

.dashboard-export-menu button {
  display: grid;
  grid-template-columns: 32px 1fr;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.dashboard-export-menu button:hover,
.dashboard-export-menu button:focus-visible {
  background: var(--surface-soft);
  outline: none;
}

.dashboard-export-menu button > span:first-child {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
  background: var(--green-soft);
  color: var(--green);
}

.dashboard-export-menu svg {
  width: 15px;
  height: 15px;
}

.dashboard-export-menu button > span:last-child {
  display: grid;
}

.dashboard-export-menu strong {
  font-size: 11px;
}

.dashboard-export-menu small {
  color: var(--muted);
  font-size: 9px;
}
</style>
