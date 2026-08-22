<script setup lang="ts">
import { Copy, LoaderCircle, Trash2, X } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
import { useConfirmDialog } from "~/composables/useConfirmDialog";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useCollectionStore } from "~/stores/collection";
import type {
  CollectionCreateDto,
  CollectionConditionsSourceView,
  CollectionProductSortOrder,
  CollectionSourceView,
  ShopifyCollectionDetail,
} from "~~/types/shopify-collection";
import CollectionLocalizationPanel from "./CollectionLocalizationPanel.vue";
import CollectionMetafieldsPanel from "./CollectionMetafieldsPanel.vue";
import CollectionProductPicker from "./CollectionProductPicker.vue";
import CollectionSourceCard from "./CollectionSourceCard.vue";

const props = defineProps<{
  open: boolean;
  detail: ShopifyCollectionDetail | null;
  creating: boolean;
  storeId: string;
  token: string;
}>();
const emit = defineEmits<{
  close: [];
  saved: [detail: ShopifyCollectionDetail];
  deleted: [];
}>();
const collectionStore = useCollectionStore();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const { t } = useLocalization();
const activePanel = ref<
  "details" | "membership" | "publishing" | "metafields" | "localization" | "duplicate"
>("details");
const selectedProductIds = ref<string[]>([]);
const selectedPublicationIds = ref<string[]>([]);
const activeEditableSourceId = ref("");
const form = reactive({
  title: "",
  handle: "",
  descriptionHtml: "",
  imageUrl: "",
  imageAlt: "",
  seoTitle: "",
  seoDescription: "",
  templateSuffix: "",
  sortOrder: "MANUAL" as CollectionProductSortOrder,
  redirectNewHandle: true,
  sourceTitle: "",
  duplicateTitle: "",
  copyPublications: true,
});

const sortOptions: Array<{ value: CollectionProductSortOrder; label: string }> = (
  [
    "MANUAL",
    "MOST_RELEVANT",
    "BEST_SELLING",
    "ALPHA_ASC",
    "ALPHA_DESC",
    "PRICE_ASC",
    "PRICE_DESC",
    "CREATED",
    "CREATED_DESC",
  ] as CollectionProductSortOrder[]
).map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));
const editableSources = computed(
  () =>
    props.detail?.sources.filter(
      (source): source is CollectionConditionsSourceView =>
        source.type === "conditions" && !source.readOnly,
    ) || [],
);
const editableSource = computed(
  () =>
    editableSources.value.find(
      (source) => source.id === activeEditableSourceId.value,
    ) || editableSources.value[0],
);
const editableSourceOptions = computed(() =>
  editableSources.value.map((source) => ({
    value: source.id,
    label: source.title,
    description: source.id,
  })),
);
const baselineSelectionIds = computed(() => {
  const source = editableSource.value;
  return source?.type === "conditions"
    ? source.inclusion.selections.map((selection) => selection.product.id)
    : [];
});
const currentPublishedIds = computed(
  () =>
    props.detail?.publications
      .filter((publication) => publication.isPublished)
      .map((publication) => publication.id) || [],
);

watch(
  [() => props.open, () => props.detail, () => props.creating],
  ([open]) => {
    if (open) resetForm();
  },
  { immediate: true },
);

function resetForm() {
  const detail = props.detail;
  activePanel.value = "details";
  form.title = detail?.title || "";
  form.handle = detail?.handle || "";
  form.descriptionHtml = detail?.descriptionHtml || "";
  form.imageUrl = detail?.image?.url || "";
  form.imageAlt = detail?.image?.altText || "";
  form.seoTitle = detail?.seo.title || "";
  form.seoDescription = detail?.seo.description || "";
  form.templateSuffix = detail?.templateSuffix || "";
  form.sortOrder = detail?.sortOrder || "MANUAL";
  form.redirectNewHandle = true;
  form.sourceTitle = detail ? "" : t("collection.defaultSourceTitle");
  form.duplicateTitle = detail
    ? t("collection.duplicateDefaultTitle", { title: detail.title })
    : "";
  form.copyPublications = true;
  activeEditableSourceId.value = editableSources.value[0]?.id || "";
  selectedProductIds.value = detail ? baselineSelectionIds.value : [];
  selectedPublicationIds.value = detail ? currentPublishedIds.value : [];
}

async function saveCreate() {
  if (!form.title.trim()) {
    feedback.warning(t("collection.titleRequired"));
    return;
  }
  const input: CollectionCreateDto = {
    title: form.title,
    descriptionHtml: form.descriptionHtml,
    handle: form.handle,
    sortOrder: form.sortOrder,
    templateSuffix: form.templateSuffix || null,
    seo: { title: form.seoTitle, description: form.seoDescription },
    ...(form.imageUrl ? { image: { src: form.imageUrl, altText: form.imageAlt } } : {}),
    sourceTitle: form.sourceTitle || undefined,
    productIds: selectedProductIds.value,
    publicationIds: selectedPublicationIds.value,
  };
  const result = await collectionStore.createCollection(
    props.storeId,
    props.token,
    input,
  );
  if (!result?.collection) {
    feedback.error(collectionStore.mutationError, t("collection.createFailed"));
    return;
  }
  if (result.publishing && !result.publishing.succeeded) {
    feedback.warning(
      t("collection.createdPublishFailed", { error: result.publishing.error || "" }),
    );
  } else feedback.success(t("collection.created"));
  emit("saved", result.collection);
}

async function saveDetails() {
  if (!props.detail) return;
  const result = await collectionStore.updateCollection(
    props.storeId,
    props.token,
    props.detail.id,
    {
      title: form.title,
      handle: form.handle,
      descriptionHtml: form.descriptionHtml,
      image: form.imageUrl ? { src: form.imageUrl, altText: form.imageAlt } : null,
      seo: { title: form.seoTitle, description: form.seoDescription },
      sortOrder: form.sortOrder,
      templateSuffix: form.templateSuffix || null,
      redirectNewHandle: form.handle !== props.detail.handle && form.redirectNewHandle,
      updatedAt: props.detail.updatedAt,
    },
  );
  if (!result?.collection) {
    feedback.error(collectionStore.mutationError, t("collection.updateFailed"));
    return;
  }
  if (result.job && !result.job.done) {
    feedback.warning(t("collection.updateQueued"));
    return;
  }
  feedback.success(t("collection.detailsUpdated"));
  emit("saved", result.collection);
}

async function saveMembership() {
  if (!props.detail || !editableSource.value) return;
  const baseline = new Set(baselineSelectionIds.value);
  const selected = new Set(selectedProductIds.value);
  const productIdsToAdd = [...selected].filter((id) => !baseline.has(id));
  const productIdsToRemove = [...baseline].filter((id) => !selected.has(id));
  if (!productIdsToAdd.length && !productIdsToRemove.length) {
    feedback.warning(t("collection.noMembershipChanges"));
    return;
  }
  const result = await collectionStore.updateSelections(
    props.storeId,
    props.token,
    props.detail.id,
    { sourceId: editableSource.value.id, productIdsToAdd, productIdsToRemove },
  );
  if (!result?.collection) {
    feedback.error(collectionStore.mutationError, t("collection.selectionsFailed"));
    return;
  }
  if (result.job && !result.job.done) {
    feedback.warning(t("collection.updateQueued"));
    return;
  }
  feedback.success(t("collection.membershipUpdated"));
  emit("saved", result.collection);
}

async function savePublications() {
  if (!props.detail) return;
  const before = new Set(currentPublishedIds.value);
  const after = new Set(selectedPublicationIds.value);
  const toPublish = [...after].filter((id) => !before.has(id));
  const toUnpublish = [...before].filter((id) => !after.has(id));
  let detail: ShopifyCollectionDetail | null = props.detail;
  let changed = false;
  if (toPublish.length) {
    detail = await collectionStore.setPublications(
      props.storeId,
      props.token,
      props.detail.id,
      { publicationIds: toPublish, publish: true },
    );
    if (detail) changed = true;
  }
  if (detail && toUnpublish.length) {
    const unpublishedDetail = await collectionStore.setPublications(
      props.storeId,
      props.token,
      props.detail.id,
      { publicationIds: toUnpublish, publish: false },
    );
    if (!unpublishedDetail && changed) {
      const canonical = await collectionStore.fetchDetail(
        props.storeId,
        props.token,
        props.detail.id,
        true,
      );
      feedback.warning(
        t("collection.publicationUpdatePartial", {
          error: collectionStore.mutationError || "",
        }),
      );
      if (canonical) emit("saved", canonical);
      return;
    }
    detail = unpublishedDetail;
  }
  if (!detail) {
    feedback.error(
      collectionStore.mutationError,
      t("collection.publicationUpdateFailed"),
    );
    return;
  }
  if (!toPublish.length && !toUnpublish.length) {
    feedback.warning(t("collection.noPublicationChanges"));
    return;
  }
  feedback.success(t("collection.publicationsUpdated"));
  emit("saved", detail);
}

async function duplicateCollection() {
  if (!props.detail || !form.duplicateTitle.trim()) {
    feedback.warning(t("collection.titleRequired"));
    return;
  }
  const result = await collectionStore.duplicateCollection(
    props.storeId,
    props.token,
    props.detail.id,
    {
      newTitle: form.duplicateTitle,
      copyPublications: form.copyPublications,
    },
  );
  if (!result?.collection) {
    feedback.error(collectionStore.mutationError, t("collection.duplicateFailed"));
    return;
  }
  if (result.job && !result.job.done) {
    feedback.warning(t("collection.duplicateQueued"));
  } else {
    feedback.success(t("collection.duplicated"));
  }
  emit("saved", result.collection);
}

async function deleteCollection() {
  if (!props.detail) return;
  const confirmed = await requestConfirmation({
    title: t("collection.deleteTitle"),
    message: t("collection.deleteMessage", { title: props.detail.title }),
    confirmLabel: t("common.delete"),
  });
  if (!confirmed) return;
  const deleted = await collectionStore.deleteCollection(
    props.storeId,
    props.token,
    props.detail.id,
  );
  if (!deleted) {
    feedback.error(collectionStore.mutationError, t("collection.deleteFailed"));
    return;
  }
  feedback.success(t("collection.deleted"));
  emit("deleted");
}

function removeManualSelection(productId: string, source: CollectionSourceView) {
  if (source.id !== editableSource.value?.id) return;
  selectedProductIds.value = selectedProductIds.value.filter((id) => id !== productId);
}

function selectEditableSource(value: unknown) {
  activeEditableSourceId.value = String(value || "");
  selectedProductIds.value = baselineSelectionIds.value;
}

function togglePublication(publicationId: string) {
  const next = new Set(selectedPublicationIds.value);
  if (next.has(publicationId)) next.delete(publicationId);
  else next.add(publicationId);
  selectedPublicationIds.value = [...next];
}

function detailWarningLabel(warning: string) {
  if (warning === "publications_truncated") {
    return t("collection.warning.publications_truncated");
  }
  if (warning === "metafields_truncated") {
    return t("collection.warning.metafields_truncated");
  }
  if (warning === "products_truncated") {
    return t("collection.warning.products_truncated");
  }
  if (warning === "selections_truncated") {
    return t("collection.warning.selections_truncated");
  }
  return t("collection.warning.publications_unavailable");
}
</script>

<template>
  <div v-if="open" class="collection-modal-backdrop" @click.self="emit('close')">
    <section
      class="collection-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="'collection-editor-title'"
    >
      <header class="collection-modal-head">
        <span>
          <small>{{ creating ? t("collection.create") : t("collection.edit") }}</small>
          <h2 id="collection-editor-title">
            {{ creating ? t("collection.newCollection") : detail?.title }}
          </h2>
        </span>
        <BaseButton
          variant="ghost"
          icon-only
          :aria-label="t('common.close')"
          :disabled="collectionStore.isMutating"
          @click="emit('close')"
        >
          <template #icon><X aria-hidden="true" /></template>
        </BaseButton>
      </header>

      <nav class="collection-modal-nav" role="tablist">
        <button
          type="button"
          role="tab"
          :class="{ active: activePanel === 'details' }"
          :aria-selected="activePanel === 'details'"
          @click="activePanel = 'details'"
        >
          {{ t("collection.details") }}
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: activePanel === 'membership' }"
          :aria-selected="activePanel === 'membership'"
          @click="activePanel = 'membership'"
        >
          {{ t("collection.membership") }}
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: activePanel === 'publishing' }"
          :aria-selected="activePanel === 'publishing'"
          @click="activePanel = 'publishing'"
        >
          {{ t("collection.publishing") }}
        </button>
        <button
          v-if="!creating"
          type="button"
          role="tab"
          :class="{ active: activePanel === 'metafields' }"
          :aria-selected="activePanel === 'metafields'"
          @click="activePanel = 'metafields'"
        >
          {{ t("collection.metafields") }}
        </button>
        <button
          v-if="!creating"
          type="button"
          role="tab"
          :class="{ active: activePanel === 'localization' }"
          :aria-selected="activePanel === 'localization'"
          @click="activePanel = 'localization'"
        >
          {{ t("collection.localization") }}
        </button>
      </nav>

      <div class="collection-modal-body">
        <p
          v-for="warning in detail?.warnings || []"
          :key="warning"
          class="read-only-notice"
          role="status"
        >
          {{ detailWarningLabel(warning) }}
        </p>
        <form
          v-if="activePanel === 'details'"
          id="collection-details-form"
          class="collection-form"
          @submit.prevent="creating ? saveCreate() : saveDetails()"
        >
          <label class="field field-wide">
            <span>{{ t("collection.title") }}</span>
            <BaseTextField v-model="form.title" required maxlength="255" />
          </label>
          <label class="field">
            <span>{{ t("collection.handle") }}</span>
            <BaseTextField v-model="form.handle" maxlength="255" />
          </label>
          <div class="field">
            <span>{{ t("collection.sortOrder") }}</span>
            <BaseSelect
              :model-value="form.sortOrder"
              :options="sortOptions"
              :aria-label="t('collection.sortOrder')"
              @update:model-value="
                form.sortOrder = String(
                  $event || 'MANUAL',
                ) as CollectionProductSortOrder
              "
            />
          </div>
          <label class="field field-wide">
            <span>{{ t("collection.descriptionHtml") }}</span>
            <BaseTextField v-model="form.descriptionHtml" multiline :rows="6" />
            <small>{{ t("collection.descriptionHint") }}</small>
          </label>
          <label class="field">
            <span>{{ t("collection.imageUrl") }}</span>
            <BaseTextField v-model="form.imageUrl" type="url" placeholder="https://" />
          </label>
          <label class="field">
            <span>{{ t("collection.imageAlt") }}</span>
            <BaseTextField v-model="form.imageAlt" maxlength="512" />
          </label>
          <label class="field">
            <span>{{ t("collection.seoTitle") }}</span>
            <BaseTextField v-model="form.seoTitle" maxlength="255" />
          </label>
          <label class="field">
            <span>{{ t("collection.seoDescription") }}</span>
            <BaseTextField
              v-model="form.seoDescription"
              multiline
              :rows="3"
              maxlength="500"
            />
          </label>
          <label class="field">
            <span>{{ t("collection.templateSuffix") }}</span>
            <BaseTextField v-model="form.templateSuffix" maxlength="255" />
          </label>
          <BaseCheckbox
            v-if="!creating && form.handle !== detail?.handle"
            class="checkbox-field"
            v-model="form.redirectNewHandle"
            :label="t('collection.redirectOldHandle')"
          />
        </form>

        <div v-else-if="activePanel === 'membership'" class="membership-panel">
          <template v-if="creating">
            <label class="field">
              <span>{{ t("collection.sourceTitle") }}</span>
              <BaseTextField v-model="form.sourceTitle" maxlength="255" />
            </label>
            <p>{{ t("collection.manualSourceHint") }}</p>
            <CollectionProductPicker
              v-model="selectedProductIds"
              :store-id="storeId"
              :token="token"
              :disabled="collectionStore.isMutating"
            />
          </template>
          <template v-else-if="detail">
            <p class="membership-summary">
              {{
                t("collection.resolvedProducts", {
                  count: detail.productsCount.count,
                })
              }}
            </p>
            <div v-if="editableSources.length > 1" class="field membership-source">
              <span>{{ t("collection.membershipSource") }}</span>
              <BaseSelect
                :model-value="editableSource?.id || ''"
                :options="editableSourceOptions"
                :aria-label="t('collection.membershipSource')"
                @update:model-value="selectEditableSource"
              />
            </div>
            <CollectionSourceCard
              v-for="source in detail.sources"
              :key="source.id"
              :source="source"
              :can-edit-selections="source.id === editableSource?.id"
              @remove-selection="removeManualSelection($event, source)"
            />
            <div v-if="editableSource" class="membership-picker">
              <h3>{{ t("collection.editManualSelections") }}</h3>
              <CollectionProductPicker
                v-model="selectedProductIds"
                :store-id="storeId"
                :token="token"
                :disabled="collectionStore.isMutating"
              />
            </div>
            <p v-else class="read-only-notice">
              {{ t("collection.noEditableSource") }}
            </p>
          </template>
        </div>

        <CollectionMetafieldsPanel
          v-else-if="activePanel === 'metafields' && detail"
          :detail="detail"
          :store-id="storeId"
          :token="token"
          :disabled="collectionStore.isMutating"
          @saved="emit('saved', $event)"
        />

        <CollectionLocalizationPanel
          v-else-if="activePanel === 'localization' && detail"
          :detail="detail"
          :store-id="storeId"
          :token="token"
          :disabled="collectionStore.isMutating"
        />

        <div v-else-if="activePanel === 'publishing'" class="publishing-panel">
          <p>{{ t("collection.publishingHint") }}</p>
          <p v-if="collectionStore.contextError" class="read-only-notice" role="alert">
            {{ collectionStore.contextError }}
          </p>
          <p
            v-else-if="
              collectionStore.managementContext?.warnings.includes(
                'publications_unavailable',
              )
            "
            class="read-only-notice"
            role="alert"
          >
            {{ t("collection.warning.publications_unavailable") }}
          </p>
          <p
            v-else-if="
              collectionStore.managementContext?.warnings.includes(
                'publications_truncated',
              )
            "
            class="read-only-notice"
            role="status"
          >
            {{ t("collection.warning.publications_truncated") }}
          </p>
          <BaseCheckbox
            v-for="publication in collectionStore.managementContext?.publications || []"
            :key="publication.id"
            class="publication-option"
            :model-value="selectedPublicationIds.includes(publication.id)"
            :disabled="collectionStore.isMutating"
            :label="publication.name"
            :description="publication.catalogTitle || ''"
            @change="togglePublication(publication.id)"
          />
          <p v-if="!collectionStore.managementContext?.publications.length">
            {{ t("collection.noPublications") }}
          </p>
        </div>

        <div v-else class="duplicate-panel">
          <h3>{{ t("collection.duplicateTitle") }}</h3>
          <p>{{ t("collection.duplicateHint") }}</p>
          <label class="field">
            <span>{{ t("collection.title") }}</span>
            <BaseTextField v-model="form.duplicateTitle" required maxlength="255" />
          </label>
          <BaseCheckbox
            v-model="form.copyPublications"
            :label="t('collection.copyPublications')"
            :description="t('collection.copyPublicationsHint')"
          />
        </div>
      </div>

      <footer class="collection-modal-actions">
        <BaseButton
          v-if="!creating"
          variant="danger-ghost"
          :disabled="collectionStore.isMutating"
          @click="deleteCollection"
        >
          <template #icon><Trash2 aria-hidden="true" /></template>
          {{ t("common.delete") }}
        </BaseButton>
        <BaseButton
          v-if="!creating && activePanel !== 'duplicate'"
          variant="ghost"
          :disabled="collectionStore.isMutating"
          @click="activePanel = 'duplicate'"
        >
          <template #icon><Copy aria-hidden="true" /></template>
          {{ t("collection.duplicate") }}
        </BaseButton>
        <span class="action-spacer" />
        <BaseButton :disabled="collectionStore.isMutating" @click="emit('close')">
          {{ t("common.cancel") }}
        </BaseButton>
        <BaseButton
          v-if="activePanel === 'details'"
          variant="primary"
          type="submit"
          form="collection-details-form"
          :disabled="collectionStore.isMutating"
        >
          <template #icon>
            <LoaderCircle v-if="collectionStore.isMutating" class="spin" />
          </template>
          {{ creating ? t("collection.create") : t("common.save") }}
        </BaseButton>
        <BaseButton
          v-else-if="activePanel === 'membership' && !creating"
          variant="primary"
          :disabled="collectionStore.isMutating || !editableSource"
          @click="saveMembership"
        >
          {{ t("collection.saveMembership") }}
        </BaseButton>
        <BaseButton
          v-else-if="activePanel === 'duplicate' && !creating"
          variant="primary"
          :disabled="collectionStore.isMutating"
          @click="duplicateCollection"
        >
          <template #icon><Copy aria-hidden="true" /></template>
          {{ t("collection.duplicate") }}
        </BaseButton>
        <BaseButton
          v-else-if="activePanel === 'publishing' && !creating"
          variant="primary"
          :disabled="collectionStore.isMutating"
          @click="savePublications"
        >
          {{ t("collection.savePublishing") }}
        </BaseButton>
        <BaseButton
          v-else-if="creating"
          variant="primary"
          :disabled="collectionStore.isMutating"
          @click="saveCreate"
        >
          {{ t("collection.create") }}
        </BaseButton>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.collection-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(12, 20, 16, 0.58);
  backdrop-filter: blur(3px);
}

.collection-modal {
  width: min(920px, 100%);
  max-height: min(900px, 92dvh);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 24px 70px rgba(10, 24, 16, 0.24);
}

.collection-modal-head,
.collection-modal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
}

.collection-modal-head {
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.collection-modal-head > span {
  min-width: 0;
}

.collection-modal-head small {
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
}

.collection-modal-head h2 {
  margin: 2px 0 0;
  font-size: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-modal-nav {
  display: flex;
  gap: 2px;
  padding: 8px 18px 0;
  border-bottom: 1px solid var(--border);
}

.collection-modal-nav button {
  padding: 9px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.collection-modal-nav button.active {
  border-color: var(--green);
  color: var(--green);
}

.collection-modal-body {
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
}

.collection-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.collection-modal-body > .read-only-notice {
  margin: 0 0 14px;
}

.field {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.field-wide {
  grid-column: 1 / -1;
}

.field small {
  color: var(--text-muted);
  font-weight: 400;
}

.checkbox-field {
  align-self: end;
}

.membership-panel,
.publishing-panel,
.duplicate-panel {
  display: grid;
  gap: 12px;
}

.membership-panel > p,
.publishing-panel > p,
.duplicate-panel > p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.duplicate-panel {
  max-width: 560px;
}

.duplicate-panel h3 {
  margin: 0;
  font-size: 15px;
}

.membership-picker {
  display: grid;
  gap: 10px;
  margin-top: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.membership-picker h3 {
  margin: 0;
  font-size: 13px;
}

.read-only-notice {
  padding: 11px;
  border-radius: 8px;
  background: var(--amber-soft);
  color: var(--amber) !important;
}

.publishing-panel :deep(.publication-option) {
  width: 100%;
  justify-content: flex-start;
}

.membership-source {
  max-width: 460px;
}

.collection-modal-actions {
  border-top: 1px solid var(--border);
}

.action-spacer {
  flex: 1;
}

.spin {
  animation: collection-spin 0.8s linear infinite;
}

@keyframes collection-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 700px) {
  .collection-modal-backdrop {
    align-items: end;
    padding: 0;
  }

  .collection-modal {
    max-height: 95dvh;
    border-radius: 14px 14px 0 0;
  }

  .collection-form {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: 1;
  }

  .collection-modal-actions {
    flex-wrap: wrap;
  }
}
</style>
