<script setup lang="ts">
import { BadgePercent, FileText, RotateCcw, ShoppingCart } from "@lucide/vue";
import { computed, ref } from "vue";
import { useCommerceOpsStore } from "~/stores/commerceOps";

type View = "drafts" | "discounts" | "checkouts" | "returns";

const store = useCommerceOpsStore();
const activeView = ref<View>("drafts");
const views = computed(() => [
  {
    id: "drafts" as const,
    label: "Draft orders",
    count: store.draftOrders.length,
    error: store.errors.draftOrders,
    icon: FileText,
  },
  {
    id: "discounts" as const,
    label: "Discounts",
    count: store.discounts.length,
    error: store.errors.discounts,
    icon: BadgePercent,
  },
  {
    id: "checkouts" as const,
    label: "Abandoned",
    count: store.abandonedCheckouts.length,
    error: store.errors.abandonedCheckouts,
    icon: ShoppingCart,
  },
  {
    id: "returns" as const,
    label: "Returns",
    count: store.returns.length,
    error: store.errors.returns,
    icon: RotateCcw,
  },
]);
</script>

<template>
  <section class="ops-workspace">
    <!--<header class="ops-intro">
      <div>
        <p class="ops-eyebrow">Commerce operations</p>
        <h2>One queue for work outside the order detail</h2>
        <p>
          Draft conversion, promotions, checkout recovery and the returns lifecycle stay
          scoped to the selected store.
        </p>
      </div>
      <span class="ops-availability">
        {{ store.availableResourceCount }}/4 resources available
      </span>
    </header>-->

    <div class="ops-view-tabs" role="tablist" aria-label="Commerce operations views">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="activeView === view.id"
        :class="{ active: activeView === view.id, error: view.error }"
        @click="activeView = view.id"
      >
        <component :is="view.icon" :size="15" aria-hidden="true" />
        <span>{{ view.label }}</span>
        <b>{{ view.error ? "!" : view.count }}</b>
      </button>
    </div>

    <OperationsDraftOrdersPanel v-if="activeView === 'drafts'" />
    <OperationsDiscountsPanel v-else-if="activeView === 'discounts'" />
    <OperationsAbandonedCheckoutsPanel v-else-if="activeView === 'checkouts'" />
    <OperationsReturnsPanel v-else />
  </section>
</template>

<style src="../../assets/styles/pages/operations.css"></style>
