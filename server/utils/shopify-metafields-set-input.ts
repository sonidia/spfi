import { buildShopifyGid } from "./shopify-gid.ts";
import { normalizeShopifyMetafieldInput } from "./shopify-metafield-input.ts";
import type { ShopifyNumericId } from "../../types/shopify.ts";
import type { ShopifyMetafieldInput } from "../../types/shopify-product.ts";

const MAX_METAFIELDS_SET = 25;

export function prepareShopifyMetafieldsSetInputs(
  ownerType: string,
  ownerId: ShopifyNumericId,
  inputs: ShopifyMetafieldInput[],
) {
  if (inputs.length > MAX_METAFIELDS_SET) {
    throw new Error(
      `Shopify accepts at most ${MAX_METAFIELDS_SET} metafields per update.`,
    );
  }

  const ownerGid = buildShopifyGid(ownerType, ownerId);
  const seenKeys = new Set<string>();
  return inputs.map((input, index) => {
    const normalized = normalizeShopifyMetafieldInput(input);
    if (!normalized) {
      throw new Error(
        `Metafield at index ${index} requires namespace, key, type, and value.`,
      );
    }
    const identity = `${normalized.namespace}\u0000${normalized.key}`;
    if (seenKeys.has(identity)) {
      throw new Error(`Duplicate metafield ${normalized.namespace}.${normalized.key}.`);
    }
    seenKeys.add(identity);
    return {
      ownerId: ownerGid,
      namespace: normalized.namespace,
      key: normalized.key,
      type: normalized.type,
      value: normalized.value,
    };
  });
}
