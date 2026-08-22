import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql";
import type { prepareShopifyMetafieldsSetInputs } from "./shopify-metafields-set-input";

export interface ShopifyMetafieldSetInput {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
  compareDigest?: string | null;
}

export async function setShopifyMetafields(options: {
  event: H3Event;
  storeId: string;
  token: string;
  inputs:
    ReturnType<typeof prepareShopifyMetafieldsSetInputs> | ShopifyMetafieldSetInput[];
  operationName?: string;
  fallbackMessage?: string;
}) {
  if (!options.inputs.length) return [];
  const data = await callShopifyGraphql<
    {
      metafieldsSet: {
        metafields: Array<{
          id: string;
          namespace: string;
          key: string;
          value: string;
          type: string;
        }> | null;
        userErrors: Array<{
          field?: string[] | null;
          message: string;
          code?: string;
        }>;
      };
    },
    { metafields: typeof options.inputs }
  >({
    ...options,
    operationName: options.operationName || "SetMetafields",
    retryTransport: false,
    query: `#graphql
      mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id namespace key value type }
          userErrors { field message code }
        }
      }
    `,
    variables: { metafields: options.inputs },
  });
  assertNoGraphqlUserErrors(
    data.metafieldsSet.userErrors,
    options.fallbackMessage || "Failed to update metafields.",
  );
  return data.metafieldsSet.metafields || [];
}
