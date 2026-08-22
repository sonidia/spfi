<script setup lang="ts">
import { Plus, Save, Trash2 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useCollectionStore } from "~/stores/collection";
import type {
  CollectionMetafieldInput,
  CollectionMetafieldView,
  ShopifyCollectionDetail,
} from "~~/types/shopify-collection";

interface MetafieldRow extends CollectionMetafieldInput {
  id: string;
  isNew: boolean;
  originalSignature: string;
}

const props = defineProps<{
  detail: ShopifyCollectionDetail;
  storeId: string;
  token: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ saved: [detail: ShopifyCollectionDetail] }>();
const collectionStore = useCollectionStore();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const rows = ref<MetafieldRow[]>([]);
const changedRows = computed(() =>
  rows.value.filter(
    (row) => row.isNew || metafieldSignature(row) !== row.originalSignature,
  ),
);

watch(
  () => props.detail.metafields,
  (metafields) => {
    rows.value = metafields.map(toRow);
  },
  { immediate: true },
);

function toRow(metafield: CollectionMetafieldView): MetafieldRow {
  return {
    ...metafield,
    isNew: false,
    originalSignature: metafieldSignature(metafield),
  };
}

function metafieldSignature(metafield: CollectionMetafieldInput) {
  return JSON.stringify([
    metafield.namespace,
    metafield.key,
    metafield.type,
    metafield.value,
  ]);
}

function addMetafield() {
  rows.value.push({
    id: `new-${crypto.randomUUID()}`,
    namespace: "custom",
    key: "",
    type: "single_line_text_field",
    value: "",
    compareDigest: null,
    isNew: true,
    originalSignature: "",
  });
}

async function save() {
  if (!changedRows.value.length) {
    feedback.warning(t("collection.noMetafieldChanges"));
    return;
  }
  if (changedRows.value.length > 25) {
    feedback.warning(t("collection.metafieldBatchLimit"));
    return;
  }
  const detail = await collectionStore.setMetafields(
    props.storeId,
    props.token,
    props.detail.id,
    changedRows.value.map(({ namespace, key, type, value, compareDigest }) => ({
      namespace,
      key,
      type,
      value,
      compareDigest,
    })),
  );
  if (!detail) {
    feedback.error(collectionStore.mutationError, t("collection.metafieldsFailed"));
    return;
  }
  feedback.success(t("collection.metafieldsUpdated"));
  emit("saved", detail);
}

async function removeMetafield(row: MetafieldRow) {
  if (row.isNew) {
    rows.value = rows.value.filter((candidate) => candidate.id !== row.id);
    return;
  }
  const confirmed = await requestConfirmation({
    title: t("collection.deleteMetafieldTitle"),
    message: t("collection.deleteMetafieldMessage", {
      metafield: `${row.namespace}.${row.key}`,
    }),
    confirmLabel: t("common.delete"),
  });
  if (!confirmed) return;
  const detail = await collectionStore.deleteMetafields(
    props.storeId,
    props.token,
    props.detail.id,
    [{ namespace: row.namespace, key: row.key }],
  );
  if (!detail) {
    feedback.error(collectionStore.mutationError, t("collection.metafieldsFailed"));
    return;
  }
  feedback.success(t("collection.metafieldDeleted"));
  emit("saved", detail);
}
</script>

<template>
  <section class="collection-metafields-panel">
    <header>
      <span>
        <h3>{{ t("collection.metafields") }}</h3>
        <p>{{ t("collection.metafieldsHint") }}</p>
      </span>
      <BaseButton :disabled="disabled" @click="addMetafield">
        <template #icon><Plus aria-hidden="true" /></template>
        {{ t("collection.addMetafield") }}
      </BaseButton>
    </header>

    <article v-for="row in rows" :key="row.id" class="metafield-row">
      <label class="field">
        <span>{{ t("collection.metafieldNamespace") }}</span>
        <BaseTextField v-model="row.namespace" :disabled="disabled || !row.isNew" />
      </label>
      <label class="field">
        <span>{{ t("collection.metafieldKey") }}</span>
        <BaseTextField v-model="row.key" :disabled="disabled || !row.isNew" />
      </label>
      <label class="field">
        <span>{{ t("collection.metafieldType") }}</span>
        <BaseTextField v-model="row.type" :disabled="disabled || !row.isNew" />
      </label>
      <label class="field metafield-value">
        <span>{{ t("collection.metafieldValue") }}</span>
        <BaseTextField v-model="row.value" multiline :rows="2" :disabled="disabled" />
      </label>
      <BaseButton
        class="metafield-delete"
        variant="danger-ghost"
        icon-only
        :disabled="disabled"
        :aria-label="t('common.delete')"
        @click="removeMetafield(row)"
      >
        <template #icon><Trash2 aria-hidden="true" /></template>
      </BaseButton>
    </article>

    <p v-if="!rows.length" class="metafield-empty">
      {{ t("collection.noMetafields") }}
    </p>
    <footer>
      <span>{{ t("collection.metafieldChanges", { count: changedRows.length }) }}</span>
      <BaseButton
        variant="primary"
        :loading="collectionStore.isMutating"
        :disabled="disabled || !changedRows.length"
        @click="save"
      >
        <template #icon><Save aria-hidden="true" /></template>
        {{ t("common.save") }}
      </BaseButton>
    </footer>
  </section>
</template>

<style scoped>
.collection-metafields-panel {
  display: grid;
  gap: 12px;
}

.collection-metafields-panel > header,
.collection-metafields-panel > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.collection-metafields-panel h3,
.collection-metafields-panel p {
  margin: 0;
}

.collection-metafields-panel h3 {
  font-size: 14px;
}

.collection-metafields-panel p,
.collection-metafields-panel footer {
  color: var(--text-muted);
  font-size: 11px;
}

.collection-metafields-panel header > span {
  display: grid;
  gap: 3px;
}

.metafield-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(
      170px,
      1fr
    ) minmax(220px, 1.5fr) auto;
  align-items: end;
  gap: 9px;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}

.field {
  min-width: 0;
  display: grid;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
}

.metafield-delete {
  margin-bottom: 2px;
}

.metafield-empty {
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 9px;
  text-align: center;
}

@media (max-width: 900px) {
  .metafield-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metafield-value {
    grid-column: 1 / -1;
  }
}
</style>
