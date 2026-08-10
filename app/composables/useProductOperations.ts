import { ref } from "vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useLocationStore } from "~/stores/locations";
import type {
  ShopifyInventoryLevel,
  ShopifyProductImage,
  ShopifyVariant,
} from "~~/types/shopify";
import type {
  ShopifyProductImageInput,
  ShopifyVariantInput,
  ProductImagesResponse,
  ProductVariantsResponse,
} from "~~/types/shopify-product";
import type { ShopifyInventoryLevelResponse } from "~~/types/shopify-inventory";
import { getAppErrorMessage } from "~~/utils/error";
import { forgetStoreResource } from "~~/utils/store-resource-cache";

export function useProductOperations() {
  const { storeId, token, isReady } = useActiveShopAuth();
  const locationStore = useLocationStore();
  const variants = ref<ShopifyVariant[]>([]);
  const images = ref<ShopifyProductImage[]>([]);
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

  async function load(productId: string | number) {
    const loadId = ++loadSequence;
    const result = await run("Failed to load product operations.", async () => {
      const auth = authBody();
      return Promise.all([
        $fetch<ProductVariantsResponse>(
          `/api/product/${productId}/variant/all`,
          { method: "POST", body: auth },
        ),
        $fetch<ProductImagesResponse>(`/api/product/${productId}/image/all`, {
          method: "POST",
          body: auth,
        }),
      ]);
    });
    if (!result || loadId !== loadSequence) return false;

    variants.value = result[0].variants || [];
    images.value = result[1].images || [];
    return true;
  }

  async function createVariant(
    productId: string | number,
    variant: ShopifyVariantInput,
  ) {
    return run("Failed to create variant.", () =>
      $fetch<ProductVariantsResponse>(
        `/api/product/${productId}/variant/create`,
        { method: "POST", body: { ...authBody(), variant } },
      ),
    );
  }

  async function updateVariant(
    productId: string | number,
    variantId: string | number,
    variant: ShopifyVariantInput,
  ) {
    const path: string = `/api/product/${productId}/variant/${variantId}`;
    return run("Failed to update variant.", () =>
      $fetch<ProductVariantsResponse>(
        path,
        { method: "PUT", body: { ...authBody(), variant } },
      ),
    );
  }

  async function deleteVariant(
    productId: string | number,
    variantId: string | number,
  ) {
    const path: string = `/api/product/${productId}/variant/${variantId}`;
    return run("Failed to delete variant.", () =>
      $fetch<unknown, string>(path, {
        method: "DELETE",
        body: authBody(),
      }),
    );
  }

  async function createImage(
    productId: string | number,
    image: ShopifyProductImageInput,
  ) {
    return run("Failed to create product image.", () =>
      $fetch<ProductImagesResponse>(
        `/api/product/${productId}/image/create`,
        { method: "POST", body: { ...authBody(), image } },
      ),
    );
  }

  async function updateImage(
    productId: string | number,
    imageId: string | number,
    image: ShopifyProductImageInput,
  ) {
    const path: string = `/api/product/${productId}/image/${imageId}`;
    return run("Failed to update product image.", () =>
      $fetch<ProductImagesResponse>(
        path,
        { method: "PUT", body: { ...authBody(), image } },
      ),
    );
  }

  async function deleteImage(
    productId: string | number,
    imageId: string | number,
  ) {
    const path: string = `/api/product/${productId}/image/${imageId}`;
    return run("Failed to delete product image.", () =>
      $fetch<unknown, string>(path, {
        method: "DELETE",
        body: authBody(),
      }),
    );
  }

  async function setInventory(
    locationId: number,
    inventoryItemId: number,
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
    locationId: number,
    inventoryItemId: number,
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
    isLoading,
    error,
    load,
    createVariant,
    updateVariant,
    deleteVariant,
    createImage,
    updateImage,
    deleteImage,
    setInventory,
    adjustInventory,
    replaceInventoryLevel,
  };
}
