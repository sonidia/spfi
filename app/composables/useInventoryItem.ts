import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import type { ShopifyNumericId } from "~~/types/shopify";
import type {
  ShopifyInventoryItemDetails,
  ShopifyInventoryItemUpdateInput,
} from "~~/types/shopify-inventory";
import { getAppErrorMessage } from "~~/utils/error";

export function useInventoryItem() {
  const { storeId, token, isReady } = useActiveShopAuth();
  const item = ref<ShopifyInventoryItemDetails | null>(null);
  const isLoading = ref(false);
  const error = ref("");
  let requestSequence = 0;

  async function load(inventoryItemId: ShopifyNumericId) {
    if (!isReady.value) return null;
    const sequence = ++requestSequence;
    isLoading.value = true;
    error.value = "";
    try {
      const response = await $fetch<{
        inventoryItem: ShopifyInventoryItemDetails;
      }>("/api/inventory/item/get", {
        method: "POST",
        body: {
          storeId: storeId.value,
          token: token.value,
          inventory_item_id: inventoryItemId,
        },
      });
      if (sequence === requestSequence) item.value = response.inventoryItem;
      return response.inventoryItem;
    } catch (cause) {
      if (sequence === requestSequence) {
        item.value = null;
        error.value = getAppErrorMessage(cause, "Failed to load inventory item.");
      }
      return null;
    } finally {
      if (sequence === requestSequence) isLoading.value = false;
    }
  }

  async function update(
    inventoryItemId: ShopifyNumericId,
    input: ShopifyInventoryItemUpdateInput,
  ) {
    if (!isReady.value) return null;
    const sequence = ++requestSequence;
    isLoading.value = true;
    error.value = "";
    try {
      const response = await $fetch<{
        inventoryItem: ShopifyInventoryItemDetails;
      }>("/api/inventory/item/update", {
        method: "POST",
        body: {
          storeId: storeId.value,
          token: token.value,
          inventory_item_id: inventoryItemId,
          ...input,
        },
      });
      if (sequence === requestSequence) item.value = response.inventoryItem;
      return response.inventoryItem;
    } catch (cause) {
      if (sequence === requestSequence) {
        error.value = getAppErrorMessage(cause, "Failed to update inventory item.");
      }
      return null;
    } finally {
      if (sequence === requestSequence) isLoading.value = false;
    }
  }

  return { item, isLoading, error, load, update };
}
