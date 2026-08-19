import { buildShopifyGid } from "./shopify-gid.ts";
import type { ShopifyNumericId } from "~~/types/shopify";

export function buildPublicationMutation(
  productIds: ShopifyNumericId[],
  publicationIds: string | string[],
  publish: boolean,
) {
  const definitions = productIds.map((_, index) => `$product${index}: ID!`);
  definitions.push("$publicationInput: [PublicationInput!]!");
  const fields = productIds.flatMap((_, index) => {
    const publicationField = publish ? "publishablePublish" : "publishableUnpublish";
    return [
      `publication${index}: ${publicationField}(id: $product${index}, input: $publicationInput) { userErrors { field message } }`,
    ];
  });
  const operationName = publish ? "BulkPublishProducts" : "BulkUnpublishProducts";

  return {
    query: `mutation ${operationName}(${definitions.join(", ")}) { ${fields.join("\n")} }`,
    variables: {
      ...Object.fromEntries(
        productIds.map((productId, index) => [
          `product${index}`,
          buildShopifyGid("Product", productId),
        ]),
      ),
      publicationInput: (Array.isArray(publicationIds)
        ? publicationIds
        : [publicationIds]
      ).map((publicationId) => ({ publicationId })),
    },
  };
}
