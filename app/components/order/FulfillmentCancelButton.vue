<script setup lang="ts">
import { Ban } from "@lucide/vue";
import { computed } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useOrderStore } from "~/stores/order";
import { useToastStore } from "~/stores/toast";
import type { ShopifyFulfillment } from "~~/types/shopify";

const props = defineProps<{
  orderId: string | number;
  fulfillment: ShopifyFulfillment;
}>();
const orderStore = useOrderStore();
const toast = useToastStore();
const { storeId, token, isReady } = useActiveShopAuth();
const { t } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const canCancel = computed(
  () =>
    Boolean(props.fulfillment.id) &&
    !["cancelled", "failure"].includes(
      String(props.fulfillment.status || "").toLowerCase(),
    ),
);

async function cancelFulfillment() {
  if (!isReady.value || !props.fulfillment.id || !canCancel.value) return;
  if (
    !(await requestConfirmation({
      title: t("confirm.actionTitle"),
      message: t("order.cancelFulfillmentConfirm"),
      confirmLabel: t("order.cancelFulfillment"),
    }))
  ) {
    return;
  }
  const updated = await orderStore.cancelFulfillment(
    storeId.value,
    token.value,
    props.orderId,
    props.fulfillment.id,
  );
  if (updated) toast.success(t("order.fulfillmentCancelled"));
}
</script>

<template>
  <BaseButton
    v-if="canCancel"
    variant="danger-ghost"
    :loading="orderStore.isMutating"
    @click="cancelFulfillment"
  >
    <template #icon><Ban /></template>
    {{ t("order.cancelFulfillment") }}
  </BaseButton>
</template>
