<script setup lang="ts">
import {
  MapPin,
  PackageCheck,
  PauseCircle,
  RefreshCw,
  Route,
  Unlock,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useCommerceOpsStore } from "~/stores/commerceOps";
import type {
  FulfillmentOrderStatusFilter,
  FulfillmentOrderSummary,
  FulfillmentOrderSupportedAction,
} from "~~/types/shopify-operations";
import { fmtDateTime } from "~~/utils/order";

const store = useCommerceOpsStore();
const { storeId, token } = useActiveShopAuth();
const { t } = useLocalization();
const feedback = useStoreFeedback();
const { requestConfirmation } = useConfirmDialog();
const selectedIds = ref<string[]>([]);
const fulfillItem = ref<FulfillmentOrderSummary | null>(null);
const holdItem = ref<FulfillmentOrderSummary | null>(null);
const moveItem = ref<FulfillmentOrderSummary | null>(null);
const trackingItem = ref<FulfillmentOrderSummary | null>(null);
const bulkFailures = ref<string[]>([]);
const MAX_BULK_FULFILLMENTS = 25;

const statusOptions = computed(() => [
  {
    label: t("operations.fulfillment.statusActive"),
    value: "ACTIVE" as const,
  },
  { label: t("operations.fulfillment.statusOpen"), value: "OPEN" as const },
  {
    label: t("operations.fulfillment.statusInProgress"),
    value: "IN_PROGRESS" as const,
  },
  {
    label: t("operations.fulfillment.statusOnHold"),
    value: "ON_HOLD" as const,
  },
  {
    label: t("operations.fulfillment.statusScheduled"),
    value: "SCHEDULED" as const,
  },
  {
    label: t("operations.fulfillment.statusClosed"),
    value: "CLOSED" as const,
  },
  {
    label: t("operations.fulfillment.statusCancelled"),
    value: "CANCELLED" as const,
  },
  {
    label: t("operations.fulfillment.statusIncomplete"),
    value: "INCOMPLETE" as const,
  },
]);
const selectableOrders = computed(() =>
  store.fulfillmentOrders.filter(
    (item) =>
      supports(item, "CREATE_FULFILLMENT") &&
      (item.itemCount > 0 || item.lineItemsTruncated),
  ),
);
const bulkSelectableOrders = computed(() =>
  selectableOrders.value.slice(0, MAX_BULK_FULFILLMENTS),
);
const allSelectableSelected = computed(
  () =>
    bulkSelectableOrders.value.length > 0 &&
    bulkSelectableOrders.value.every((item) => selectedIds.value.includes(item.id)),
);

async function changeStatus(value: unknown) {
  const status = String(value || "ACTIVE") as FulfillmentOrderStatusFilter;
  selectedIds.value = [];
  bulkFailures.value = [];
  await store.setFulfillmentStatusFilter(storeId.value, token.value, status);
}

async function refresh() {
  selectedIds.value = [];
  bulkFailures.value = [];
  await store.refreshResource(storeId.value, token.value, "fulfillmentOrders");
}

function supports(
  item: FulfillmentOrderSummary,
  action: FulfillmentOrderSupportedAction,
) {
  return item.supportedActions.includes(action);
}

function appHoldIds(item: FulfillmentOrderSummary) {
  return item.holds.filter((hold) => hold.heldByRequestingApp).map((hold) => hold.id);
}

function hasRowAction(item: FulfillmentOrderSummary) {
  return (
    supports(item, "CREATE_FULFILLMENT") ||
    (supports(item, "HOLD") && !item.holds.length) ||
    (supports(item, "RELEASE_HOLD") && appHoldIds(item).length > 0) ||
    supports(item, "MOVE") ||
    item.fulfillments.length > 0
  );
}

function toggleSelected(id: string, selected: boolean) {
  if (
    selected &&
    !selectedIds.value.includes(id) &&
    selectedIds.value.length >= MAX_BULK_FULFILLMENTS
  ) {
    feedback.warning(t("operations.fulfillment.bulkLimit"));
    return;
  }
  if (selected && !selectedIds.value.includes(id)) {
    selectedIds.value = [...selectedIds.value, id];
  } else if (!selected) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id);
  }
}

function toggleAll(selected: boolean) {
  selectedIds.value = selected ? bulkSelectableOrders.value.map((item) => item.id) : [];
  if (selected && selectableOrders.value.length > MAX_BULK_FULFILLMENTS) {
    feedback.warning(t("operations.fulfillment.bulkLimit"));
  }
}

async function bulkFulfill() {
  const ids = [...selectedIds.value];
  const orderNames = new Map(
    store.fulfillmentOrders.map((item) => [item.id, item.orderName]),
  );
  if (!ids.length) return;
  if (
    !(await requestConfirmation({
      title: t("operations.fulfillment.bulkTitle"),
      message: t("operations.fulfillment.bulkConfirm", { count: ids.length }),
      confirmLabel: t("operations.fulfillment.bulkFulfill"),
      danger: false,
    }))
  ) {
    return;
  }
  const result = await store.bulkFulfill(storeId.value, token.value, ids, false);
  if (!result) {
    feedback.error(store.mutationError, t("operations.fulfillment.actionFailed"));
    return;
  }
  selectedIds.value = [];
  bulkFailures.value = result.results
    .filter((item) => !item.ok)
    .map(
      (item) =>
        `${orderNames.get(item.fulfillmentOrderId) || item.fulfillmentOrderId}: ${item.message}`,
    );
  if (result.failed) {
    feedback.warning(
      t("operations.fulfillment.bulkPartial", {
        succeeded: result.succeeded,
        failed: result.failed,
      }),
    );
  } else {
    feedback.success(
      t("operations.fulfillment.bulkSucceeded", { count: result.succeeded }),
    );
  }
}

async function releaseHold(item: FulfillmentOrderSummary) {
  const holdIds = appHoldIds(item);
  if (!holdIds.length) return;
  if (
    !(await requestConfirmation({
      title: t("operations.fulfillment.releaseTitle"),
      message: t("operations.fulfillment.releaseConfirm", {
        name: item.orderName,
      }),
      confirmLabel: t("operations.fulfillment.release"),
      danger: false,
    }))
  ) {
    return;
  }
  const result = await store.actOnFulfillmentOrder(
    storeId.value,
    token.value,
    item.id,
    "releaseHold",
    { holdIds },
  );
  if (result) feedback.success(t("operations.fulfillment.released"));
  else {
    feedback.error(store.mutationError, t("operations.fulfillment.actionFailed"));
  }
}

function orderNumericId(item: FulfillmentOrderSummary) {
  return item.orderId.split("/").at(-1) || item.orderId;
}

function latestTracking(item: FulfillmentOrderSummary) {
  return item.fulfillments[0]?.tracking[0] || null;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "open") return "is-open";
  if (normalized === "on_hold") return "is-hold";
  if (normalized === "closed") return "is-closed";
  if (normalized === "cancelled" || normalized === "incomplete") {
    return "is-warning";
  }
  return "is-progress";
}

function closeModals() {
  fulfillItem.value = null;
  holdItem.value = null;
  moveItem.value = null;
  trackingItem.value = null;
}
</script>

<template>
  <div class="ops-panel fulfillment-ops-panel">
    <div class="ops-panel-toolbar">
      <div>
        <h3>{{ t("operations.fulfillment.title") }}</h3>
        <p>{{ t("operations.fulfillment.description") }}</p>
      </div>
      <div class="fulfillment-toolbar-actions">
        <BaseSelect
          :model-value="store.fulfillmentStatusFilter"
          :options="statusOptions"
          :disabled="store.loadingResources.includes('fulfillmentOrders')"
          :aria-label="t('operations.fulfillment.filterAria')"
          @update:model-value="changeStatus"
        />
        <BaseButton
          icon-only
          :loading="store.loadingResources.includes('fulfillmentOrders')"
          :aria-label="t('common.refresh')"
          @click="refresh"
        >
          <template #icon><RefreshCw /></template>
        </BaseButton>
      </div>
    </div>

    <div v-if="selectedIds.length" class="fulfillment-bulk-bar">
      <strong>
        {{ t("operations.fulfillment.selected", { count: selectedIds.length }) }}
      </strong>
      <BaseButton variant="primary" :loading="store.isMutating" @click="bulkFulfill">
        <template #icon><PackageCheck /></template>
        {{ t("operations.fulfillment.bulkFulfill") }}
      </BaseButton>
    </div>

    <div v-if="bulkFailures.length" class="fulfillment-bulk-errors" role="alert">
      <strong>{{ t("operations.fulfillment.actionFailed") }}</strong>
      <span v-for="(message, index) in bulkFailures.slice(0, 5)" :key="index">
        {{ message }}
      </span>
    </div>

    <div v-if="store.errors.fulfillmentOrders" class="ops-resource-error" role="alert">
      <strong>{{ t("operations.fulfillment.unavailable") }}</strong>
      <span>{{ store.errors.fulfillmentOrders }}</span>
      <small>{{ t("operations.fulfillment.scopeRequired") }}</small>
    </div>
    <div
      v-else-if="
        store.loadingResources.includes('fulfillmentOrders') &&
        !store.fulfillmentOrders.length
      "
      class="ops-empty"
      role="status"
    >
      {{ t("operations.fulfillment.loading") }}
    </div>
    <template v-else-if="store.fulfillmentOrders.length">
      <div class="ops-table-scroll">
        <table class="ops-table fulfillment-table">
          <thead>
            <tr>
              <th class="fulfillment-select-column">
                <BaseCheckbox
                  compact
                  :model-value="allSelectableSelected"
                  :disabled="!selectableOrders.length || store.isMutating"
                  :aria-label="t('operations.fulfillment.selectAll')"
                  @update:model-value="toggleAll"
                />
              </th>
              <th>{{ t("operations.fulfillment.columnOrder") }}</th>
              <th>{{ t("operations.columnStatus") }}</th>
              <th>{{ t("operations.fulfillment.columnLocation") }}</th>
              <th>{{ t("operations.columnItems") }}</th>
              <th>{{ t("operations.fulfillment.columnDue") }}</th>
              <th>{{ t("operations.fulfillment.columnTracking") }}</th>
              <th class="ops-actions-column">{{ t("operations.columnActions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in store.fulfillmentOrders" :key="item.id">
              <td class="fulfillment-select-column">
                <BaseCheckbox
                  compact
                  :model-value="selectedIds.includes(item.id)"
                  :disabled="
                    !supports(item, 'CREATE_FULFILLMENT') ||
                    (!item.itemCount && !item.lineItemsTruncated) ||
                    store.isMutating
                  "
                  :aria-label="
                    t('operations.fulfillment.selectRow', { name: item.orderName })
                  "
                  @update:model-value="toggleSelected(item.id, $event)"
                />
              </td>
              <td>
                <NuxtLink
                  :to="{
                    path: `/order/${orderNumericId(item)}`,
                    query: { shop: storeId },
                  }"
                  class="ops-text-link"
                >
                  {{ item.orderName }}
                </NuxtLink>
                <small>{{ fmtDateTime(item.createdAt) }}</small>
              </td>
              <td>
                <span class="ops-status" :class="statusClass(item.status)">
                  {{ item.status }}
                </span>
                <small>{{ item.requestStatus }}</small>
              </td>
              <td>
                <strong>{{ item.assignedLocation.name }}</strong>
              </td>
              <td>
                <span>{{ t("operations.unitCount", { count: item.itemCount }) }}</span>
                <small>
                  {{
                    item.lineItems
                      .slice(0, 2)
                      .map((lineItem) => lineItem.title)
                      .join(", ")
                  }}
                </small>
                <small v-if="item.lineItemsTruncated">
                  {{ t("operations.fulfillment.moreItems") }}
                </small>
              </td>
              <td>
                <span v-if="item.fulfillBy">{{ fmtDateTime(item.fulfillBy) }}</span>
                <span v-else>{{ t("operations.fulfillment.noDeadline") }}</span>
              </td>
              <td>
                <template v-if="latestTracking(item)">
                  <strong>{{ latestTracking(item)?.number || "—" }}</strong>
                  <small>{{ latestTracking(item)?.company || "—" }}</small>
                </template>
                <span v-else>{{ t("operations.fulfillment.noTracking") }}</span>
              </td>
              <td>
                <div class="ops-row-actions fulfillment-row-actions">
                  <BaseButton
                    v-if="supports(item, 'CREATE_FULFILLMENT')"
                    variant="primary"
                    :disabled="store.isMutating"
                    @click="fulfillItem = item"
                  >
                    <template #icon><PackageCheck /></template>
                    {{ t("operations.fulfillment.fulfill") }}
                  </BaseButton>
                  <BaseButton
                    v-if="supports(item, 'HOLD') && !item.holds.length"
                    :disabled="store.isMutating"
                    @click="holdItem = item"
                  >
                    <template #icon><PauseCircle /></template>
                    {{ t("operations.fulfillment.hold") }}
                  </BaseButton>
                  <BaseButton
                    v-if="supports(item, 'RELEASE_HOLD') && appHoldIds(item).length"
                    :disabled="store.isMutating"
                    @click="releaseHold(item)"
                  >
                    <template #icon><Unlock /></template>
                    {{ t("operations.fulfillment.release") }}
                  </BaseButton>
                  <BaseButton
                    v-if="supports(item, 'MOVE')"
                    icon-only
                    :disabled="store.isMutating"
                    :aria-label="t('operations.fulfillment.move')"
                    @click="moveItem = item"
                  >
                    <template #icon><MapPin /></template>
                  </BaseButton>
                  <BaseButton
                    v-if="item.fulfillments.length"
                    icon-only
                    :disabled="store.isMutating"
                    :aria-label="t('operations.fulfillment.updateTracking')"
                    @click="trackingItem = item"
                  >
                    <template #icon><Route /></template>
                  </BaseButton>
                  <small v-if="!hasRowAction(item)">
                    {{ t("operations.fulfillment.noAction") }}
                  </small>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="store.fulfillmentPageInfo.hasNextPage" class="fulfillment-load-more">
        <BaseButton
          :loading="store.loadingResources.includes('fulfillmentOrders')"
          @click="store.loadMoreFulfillmentOrders(storeId, token)"
        >
          {{ t("operations.fulfillment.loadMore") }}
        </BaseButton>
      </div>
    </template>
    <div v-else class="ops-empty">
      {{ t("operations.fulfillment.empty") }}
    </div>

    <OperationsFulfillmentCreateModal
      v-if="fulfillItem"
      :item="fulfillItem"
      @close="fulfillItem = null"
      @succeeded="closeModals"
    />
    <OperationsFulfillmentHoldModal
      v-if="holdItem"
      :item="holdItem"
      @close="holdItem = null"
      @succeeded="closeModals"
    />
    <OperationsFulfillmentMoveModal
      v-if="moveItem"
      :item="moveItem"
      @close="moveItem = null"
      @succeeded="closeModals"
    />
    <OperationsFulfillmentTrackingModal
      v-if="trackingItem"
      :item="trackingItem"
      @close="trackingItem = null"
      @succeeded="closeModals"
    />
  </div>
</template>

<style scoped>
.fulfillment-toolbar-actions,
.fulfillment-bulk-bar,
.fulfillment-load-more {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fulfillment-toolbar-actions {
  width: min(250px, 100%);
}

.fulfillment-bulk-bar {
  justify-content: space-between;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--green-soft);
  color: var(--green);
  font-size: 12px;
}

.fulfillment-bulk-errors {
  display: grid;
  gap: 3px;
  padding: 10px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--red) 25%, var(--border));
  background: var(--red-soft);
  color: var(--red);
  font-size: 11px;
}

.fulfillment-table {
  min-width: 1280px;
}

.fulfillment-select-column {
  width: 42px;
  padding-inline: 10px !important;
}

.fulfillment-row-actions {
  min-width: 250px;
}

.fulfillment-load-more {
  justify-content: center;
  padding: 12px;
  border-top: 1px solid var(--border);
}

.ops-status.is-open {
  background: var(--green-soft);
  color: var(--green);
}

.ops-status.is-hold,
.ops-status.is-warning {
  background: color-mix(in srgb, var(--red) 10%, var(--surface));
  color: var(--red);
}

.ops-status.is-progress {
  color: var(--blue, var(--green));
}

@media (max-width: 720px) {
  .fulfillment-toolbar-actions {
    width: 100%;
  }
}
</style>
