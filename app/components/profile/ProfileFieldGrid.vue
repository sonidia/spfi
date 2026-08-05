<script setup lang="ts">
import type { ProfileFieldRow } from "~~/utils/shop-profile";

defineProps<{
  title: string;
  rows: ProfileFieldRow[];
}>();
</script>

<template>
  <section class="profile-card">
    <div class="profile-card-head">
      <h2>{{ title }}</h2>
      <span class="field-count">{{ rows.length }}</span>
    </div>

    <div v-if="rows.length" class="field-grid">
      <div
        v-for="row in rows"
        :key="row.key"
        class="field-item"
        :class="{ 'is-wide': row.isMultiline }"
      >
        <span class="field-label">{{ row.label }}</span>
        <pre v-if="row.isMultiline" class="field-value is-code">{{
          row.value
        }}</pre>
        <span v-else class="field-value">{{ row.value }}</span>
      </div>
    </div>

    <div v-else class="empty-state">No information available.</div>
  </section>
</template>

<style scoped>
.profile-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.profile-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.profile-card-head h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.field-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 22px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 800;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field-item {
  min-width: 0;
  display: grid;
  gap: 5px;
  padding: 13px 16px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.field-item.is-wide {
  grid-column: 1 / -1;
}

.field-label {
  color: var(--text-sub);
  font-size: 10px;
  font-weight: 800;
}

.field-value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.field-value.is-code {
  max-height: 240px;
  overflow: auto;
  margin: 0;
  border-radius: 6px;
  background: var(--bg);
  padding: 10px;
  color: var(--text-primary);
  font-family: "DM Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  font-weight: 500;
  white-space: pre-wrap;
}

.empty-state {
  padding: 30px 16px;
  color: var(--text-sub);
  text-align: center;
  font-size: 13px;
}

@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }

  .field-item {
    border-right: none;
  }
}
</style>
