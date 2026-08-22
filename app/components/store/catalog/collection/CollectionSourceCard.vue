<script setup lang="ts">
import { Boxes, LockKeyhole, PackageCheck, X } from "@lucide/vue";
import type { CollectionSourceView } from "~~/types/shopify-collection";

withDefaults(
  defineProps<{ source: CollectionSourceView; canEditSelections?: boolean }>(),
  { canEditSelections: false },
);
const emit = defineEmits<{ removeSelection: [productId: string] }>();
const { t } = useLocalization();

function conditionLabel(typename: string) {
  return typename
    .replace(/^CollectionSource(Inclusion|Exclusion)Condition/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}
</script>

<template>
  <article class="collection-source-card">
    <header>
      <span class="source-icon">
        <Boxes v-if="source.type === 'subCollections'" aria-hidden="true" />
        <PackageCheck v-else aria-hidden="true" />
      </span>
      <span>
        <strong>{{ source.title }}</strong>
        <small>{{ source.typename }}</small>
      </span>
      <span v-if="source.readOnly" class="read-only-badge">
        <LockKeyhole aria-hidden="true" />
        {{ t("collection.readOnly") }}
      </span>
    </header>
    <p v-if="source.description">{{ source.description }}</p>

    <template v-if="source.type === 'conditions'">
      <dl class="source-facts">
        <div>
          <dt>{{ t("collection.target") }}</dt>
          <dd>{{ source.targetType }}</dd>
        </div>
        <div>
          <dt>{{ t("collection.match") }}</dt>
          <dd>{{ source.inclusion.matchType || "—" }}</dd>
        </div>
        <div>
          <dt>{{ t("collection.conditions") }}</dt>
          <dd>{{ source.inclusion.conditions.length }}</dd>
        </div>
        <div>
          <dt>{{ t("collection.manualSelections") }}</dt>
          <dd>{{ source.inclusion.selections.length }}</dd>
        </div>
      </dl>
      <div v-if="source.inclusion.conditions.length" class="condition-list">
        <span
          v-for="condition in source.inclusion.conditions"
          :key="condition.id"
          :title="condition.typename"
        >
          {{ conditionLabel(condition.typename) }}
          <template v-if="condition.relation"> · {{ condition.relation }}</template>
          <template v-if="condition.values.length">
            · {{ condition.values.join(", ") }}
          </template>
        </span>
      </div>
      <div v-if="source.inclusion.selections.length" class="selection-list">
        <span
          v-for="selection in source.inclusion.selections"
          :key="selection.product.id"
        >
          {{ selection.product.title }}
          <BaseButton
            v-if="canEditSelections"
            class="selection-remove"
            variant="ghost"
            icon-only
            :aria-label="
              t('collection.removeProduct', { title: selection.product.title })
            "
            @click="emit('removeSelection', selection.product.id)"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
        </span>
      </div>
      <p v-if="source.inclusion.selectionsPageInfo.hasNextPage" class="source-warning">
        {{ t("collection.selectionsTruncated") }}
      </p>
      <p v-if="source.exclusion" class="source-exclusion">
        {{
          t("collection.exclusionSummary", {
            conditions: source.exclusion.conditions.length,
            selections: source.exclusion.selections.length,
          })
        }}
      </p>
    </template>

    <div v-else-if="source.type === 'subCollections'" class="selection-list">
      <span v-for="collection in source.collections" :key="collection.id">
        {{ collection.title }}
      </span>
    </div>

    <p v-else class="source-warning">
      {{ t("collection.unknownSourcePreserved") }}
    </p>
  </article>
</template>

<style scoped>
.collection-source-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
}

.collection-source-card header {
  min-width: 0;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
}

.collection-source-card header > span:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.collection-source-card small {
  color: var(--text-muted);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--green-soft);
  color: var(--green);
}

.source-icon svg,
.read-only-badge svg {
  width: 14px;
  height: 14px;
}

.read-only-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 10px;
}

.collection-source-card > p,
.source-exclusion,
.source-warning {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.source-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  margin: 0;
}

.source-facts div {
  min-width: 0;
  padding: 8px;
  border-radius: 7px;
  background: var(--surface-soft);
}

.source-facts dt {
  color: var(--text-muted);
  font-size: 9px;
  text-transform: uppercase;
}

.source-facts dd {
  margin: 3px 0 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.condition-list,
.selection-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.condition-list > span,
.selection-list > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--blue-soft);
  font-size: 11px;
}

.selection-list :deep(.selection-remove) {
  width: 22px;
  min-height: 22px;
  color: inherit;
}

.source-warning {
  color: var(--amber);
}

@media (max-width: 700px) {
  .source-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
