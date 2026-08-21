import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocationStore } from "~/stores/locations";
import type {
  ShopifyInventoryLevel,
  ShopifyMetafield,
  ShopifyNumericId,
  ShopifyProductImage,
  ShopifyProductOption,
  ShopifyVariant,
} from "~~/types/shopify";
import type {
  ShopifyProductImageInput,
  ShopifyMetafieldInput,
  ProductVariantBulkResult,
  ProductOptionsUpdateResult,
  ShopifyVariantInput,
  ProductImagesResponse,
  ProductVariantsResponse,
} from "~~/types/shopify-product";
import type {
  ShopifyInventoryBulkItemInput,
  ShopifyInventoryBulkMode,
  ShopifyInventoryBulkResult,
  ShopifyInventoryLevelResponse,
  ShopifyInventoryReservationItemInput,
  ShopifyInventoryReservationResult,
} from "~~/types/shopify-inventory";
import { getAppErrorMessage } from "~~/utils/error";
import { forgetStoreResource } from "~~/utils/store-resource-cache";

export function useProductOperations() {
  const { storeId, token, isReady } = useActiveShopAuth();
  const locationStore = useLocationStore();
  const variants = ref<ShopifyVariant[]>([]);
  const images = ref<ShopifyProductImage[]>([]);
  const metafields = ref<ShopifyMetafield[]>([]);
  const isLoading = ref(false);
  const error = ref("");
  let pendingOperationCount = 0;
  let operationSequence = 0;
  let loadSequence = 0;

  function authBody() {
    if (!isReady.value) {
      throw new Error("Store ID and Access Token are required.");
    }
    return { storeId: storeId.value, token: token.value };
  }

  async function run<T>(
    fallback: string,
    operation: () => Promise<T>,
  ): Promise<T | null> {
    const operationId = ++operationSequence;
    pendingOperationCount += 1;
    isLoading.value = true;
    error.value = "";
    try {
      return await operation();
    } catch (cause) {
      if (operationId === operationSequence) {
        error.value = getAppErrorMessage(cause, fallback);
      }
      return null;
    } finally {
      pendingOperationCount -= 1;
      isLoading.value = pendingOperationCount > 0;
    }
  }

  async function load(
    productId: string | number,
    presentmentCurrencies: string[] = [],
  ) {
    const loadId = ++loadSequence;
    const result = await run("Failed to load product operations.", async () => {
      const auth = authBody();
      return Promise.all([
        $fetch<ProductVariantsResponse>(`/api/product/${productId}/variant/all`, {
          method: "POST",
          body: {
            ...auth,
            query: {
              ...(presentmentCurrencies.length
                ? { presentment_currencies: presentmentCurrencies.join(",") }
                : {}),
            },
          },
        }),
        $fetch<ProductImagesResponse>(`/api/product/${productId}/image/all`, {
          method: "POST",
          body: auth,
        }),
        $fetch<{ metafields?: ShopifyMetafield[] }>(
          `/api/metafield/product/${productId}`,
          {
            query: { storeId: auth.storeId },
            headers: { "X-Shopify-Access-Token": auth.token },
          },
        ),
      ]);
    });
    if (!result || loadId !== loadSequence) return false;

    variants.value = result[0].variants || [];
    images.value = result[1].images || [];
    metafields.value = result[2].metafields || [];
    return true;
  }

  function bulkVariantRequest(
    productId: string | number,
    body:
      | {
          action: "create" | "update";
          variants: ShopifyVariantInput[];
          optionNames: string[];
        }
      | { action: "delete"; variantIds: ShopifyNumericId[] },
  ) {
    return run(`Failed to ${body.action} product variants in bulk.`, () =>
      $fetch<ProductVariantBulkResult>(`/api/product/${productId}/variant/bulk`, {
        method: "POST",
        body: { ...authBody(), ...body },
      }),
    );
  }

  function createVariantsBulk(
    productId: string | number,
    variants: ShopifyVariantInput[],
    optionNames: string[],
  ) {
    return bulkVariantRequest(productId, {
      action: "create",
      variants,
      optionNames,
    });
  }

  function updateVariantsBulk(
    productId: string | number,
    variants: ShopifyVariantInput[],
    optionNames: string[],
  ) {
    return bulkVariantRequest(productId, {
      action: "update",
      variants,
      optionNames,
    });
  }

  function deleteVariantsBulk(
    productId: string | number,
    variantIds: ShopifyNumericId[],
  ) {
    return bulkVariantRequest(productId, { action: "delete", variantIds });
  }

  function updateOptions(productId: string | number, options: ShopifyProductOption[]) {
    return run("Failed to update product options.", () =>
      $fetch<ProductOptionsUpdateResult>(`/api/product/${productId}/option/bulk`, {
        method: "POST",
        body: { ...authBody(), options },
      }),
    );
  }

  async function createImage(
    productId: string | number,
    image: ShopifyProductImageInput,
  ) {
    return run("Failed to create product image.", () =>
      $fetch<ProductImagesResponse>(`/api/product/${productId}/image/create`, {
        method: "POST",
        body: { ...authBody(), image },
      }),
    );
  }

  async function updateImage(
    productId: string | number,
    imageId: string | number,
    image: ShopifyProductImageInput,
  ) {
    const path: string = `/api/product/${productId}/image/${imageId}`;
    return run("Failed to update product image.", () =>
      $fetch<ProductImagesResponse>(path, {
        method: "PUT",
        body: { ...authBody(), image },
      }),
    );
  }

  async function deleteImage(productId: string | number, imageId: string | number) {
    const path: string = `/api/product/${productId}/image/${imageId}`;
    return run("Failed to delete product image.", () =>
      $fetch<unknown, string>(path, {
        method: "DELETE",
        body: authBody(),
      }),
    );
  }

  async function createMetafield(
    productId: string | number,
    metafield: ShopifyMetafieldInput,
  ) {
    return run("Failed to create product metafield.", () =>
      $fetch<{ metafield?: ShopifyMetafield }>(
        `/api/metafield/product/${productId}/create`,
        {
          method: "POST",
          body: { ...authBody(), metafield },
        },
      ),
    );
  }

  async function updateMetafield(
    productId: string | number,
    metafield: ShopifyMetafieldInput & { id: ShopifyNumericId },
  ) {
    return run("Failed to update product metafield.", () =>
      $fetch<{ metafield?: ShopifyMetafield }>(`/api/metafield/product/${productId}`, {
        method: "PUT",
        body: { ...authBody(), metafield },
      }),
    );
  }

  async function deleteMetafield(
    productId: string | number,
    metafieldId: string | number,
  ) {
    const path: string = `/api/metafield/product/${productId}/${metafieldId}`;
    return run("Failed to delete product metafield.", () =>
      $fetch<unknown, string>(path, {
        method: "DELETE",
        body: authBody(),
      }),
    );
  }

  async function setInventory(
    locationId: ShopifyNumericId,
    inventoryItemId: ShopifyNumericId,
    available: number,
  ) {
    return run("Failed to set inventory.", async () => {
      const response = await $fetch<ShopifyInventoryLevelResponse>(
        "/api/inventory/set",
        {
          method: "POST",
          body: {
            ...authBody(),
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available,
          },
        },
      );
      invalidateInventoryCache();
      return response;
    });
  }

  async function adjustInventory(
    locationId: ShopifyNumericId,
    inventoryItemId: ShopifyNumericId,
    adjustment: number,
  ) {
    return run("Failed to adjust inventory.", async () => {
      const response = await $fetch<ShopifyInventoryLevelResponse>(
        "/api/inventory/adjust",
        {
          method: "POST",
          body: {
            ...authBody(),
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available_adjustment: adjustment,
          },
        },
      );
      invalidateInventoryCache();
      return response;
    });
  }

  async function updateInventoryBulk(
    locationId: ShopifyNumericId,
    items: ShopifyInventoryBulkItemInput[],
    mode: ShopifyInventoryBulkMode,
    amount: number,
    options: { quantityName?: "available" | "on_hand"; reason?: string } = {},
  ) {
    return run("Failed to update inventory in bulk.", async () => {
      const response = await $fetch<ShopifyInventoryBulkResult>("/api/inventory/bulk", {
        method: "POST",
        body: {
          ...authBody(),
          location_id: locationId,
          items,
          mode,
          amount,
          quantity_name: options.quantityName || "available",
          reason: options.reason || "correction",
        },
      });
      invalidateInventoryCache();
      return response;
    });
  }

  async function moveInventoryReservations(
    locationId: ShopifyNumericId,
    items: ShopifyInventoryReservationItemInput[],
    direction: "RESERVE" | "RELEASE",
    quantity: number,
    reason = "correction",
  ) {
    return run("Failed to move reserved inventory.", async () => {
      const response = await $fetch<ShopifyInventoryReservationResult>(
        "/api/inventory/reservations",
        {
          method: "POST",
          body: {
            ...authBody(),
            location_id: locationId,
            items,
            direction,
            quantity,
            reason,
          },
        },
      );
      invalidateInventoryCache();
      return response;
    });
  }

  function invalidateInventoryCache() {
    const currentStoreId = storeId.value;
    if (!currentStoreId) return;
    locationStore.evictStore(currentStoreId);
    forgetStoreResource(currentStoreId, "locations");
  }

  function replaceInventoryLevel(
    levels: ShopifyInventoryLevel[],
    next: ShopifyInventoryLevel,
  ) {
    const index = levels.findIndex(
      (level) =>
        level.location_id === next.location_id &&
        level.inventory_item_id === next.inventory_item_id,
    );
    if (index === -1) levels.push(next);
    else levels[index] = next;
  }

  return {
    variants,
    images,
    metafields,
    isLoading,
    error,
    load,
    createVariantsBulk,
    updateVariantsBulk,
    deleteVariantsBulk,
    updateOptions,
    createImage,
    updateImage,
    deleteImage,
    createMetafield,
    updateMetafield,
    deleteMetafield,
    setInventory,
    adjustInventory,
    updateInventoryBulk,
    moveInventoryReservations,
    replaceInventoryLevel,
  };
}
