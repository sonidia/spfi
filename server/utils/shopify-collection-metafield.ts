import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import { getShopifyCollectionDetail } from "./shopify-collection-detail";
import { setShopifyMetafields } from "./shopify-metafields-set";
import type {
  CollectionMetafieldIdentifier,
  CollectionMetafieldInput,
} from "~~/types/shopify-collection";

interface CollectionMetafieldOptions {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}

export async function setCollectionMetafields(
  options: CollectionMetafieldOptions & { inputs: CollectionMetafieldInput[] },
) {
  await setShopifyMetafields({
    ...options,
    operationName: "SetCollectionMetafields",
    fallbackMessage: "Failed to update collection metafields.",
    inputs: options.inputs.map((input) => ({ ...input, ownerId: options.id })),
  });
  return getShopifyCollectionDetail(options);
}

export async function deleteCollectionMetafields(
  options: CollectionMetafieldOptions & {
    identifiers: CollectionMetafieldIdentifier[];
  },
) {
  const variables = {
    metafields: options.identifiers.map((identifier) => ({
      ...identifier,
      ownerId: options.id,
    })),
  };
  const data = await callShopifyGraphql<
    {
      metafieldsDelete: {
        deletedMetafields: Array<{
          ownerId: string;
          namespace: string;
          key: string;
        } | null>;
        userErrors: Array<{ field?: string[] | null; message: string }>;
      };
    },
    typeof variables
  >({
    ...options,
    operationName: "DeleteCollectionMetafields",
    retryTransport: false,
    query: `
      mutation DeleteCollectionMetafields(
        $metafields: [MetafieldIdentifierInput!]!
      ) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields { ownerId namespace key }
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.metafieldsDelete.userErrors,
    "Failed to delete collection metafields.",
  );
  return getShopifyCollectionDetail(options);
}
