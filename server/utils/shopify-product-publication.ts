import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { buildPublicationMutation } from "./shopify-product-publication-input.ts";
import type { ShopifyNumericId } from "~~/types/shopify";

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
}

interface PublicationListData {
  publications: {
    nodes: Array<{
      id: string;
      name: string;
      catalog: { title: string } | null;
    }>;
  };
}

interface MutationPayload {
  userErrors?: GraphqlUserError[];
}

const PUBLICATION_BATCH_SIZE = 50;

export async function setShopifyProductsPublished(options: {
  event: H3Event;
  storeId: string;
  token: string;
  productIds: ShopifyNumericId[];
  publish: boolean;
}) {
  const publicationId = await resolveOnlineStorePublicationId(options);
  const failedIds: ShopifyNumericId[] = [];

  for (
    let offset = 0;
    offset < options.productIds.length;
    offset += PUBLICATION_BATCH_SIZE
  ) {
    const productIds = options.productIds.slice(
      offset,
      offset + PUBLICATION_BATCH_SIZE,
    );
    const { query, variables } = buildPublicationMutation(
      productIds,
      publicationId,
      options.publish,
    );
    const data = await callShopifyGraphql<Record<string, MutationPayload>>({
      event: options.event,
      storeId: options.storeId,
      token: options.token,
      query,
      variables,
      operationName: options.publish ? "BulkPublishProducts" : "BulkUnpublishProducts",
    });

    productIds.forEach((productId, index) => {
      const publicationErrors = data[`publication${index}`]?.userErrors || [];
      const activationErrors = options.publish
        ? data[`activation${index}`]?.userErrors || []
        : [];
      if (publicationErrors.length || activationErrors.length)
        failedIds.push(productId);
    });
  }

  return {
    total: options.productIds.length,
    succeeded: options.productIds.length - failedIds.length,
    failedIds,
  };
}

async function resolveOnlineStorePublicationId(options: {
  event: H3Event;
  storeId: string;
  token: string;
}) {
  const data = await callShopifyGraphql<PublicationListData>({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    query: `
      query ProductPublications {
        publications(first: 250) {
          nodes {
            id
            name
            catalog { title }
          }
        }
      }
    `,
    operationName: "ProductPublications",
  });
  const publication = data.publications.nodes.find((candidate) =>
    [candidate.name, candidate.catalog?.title]
      .filter(Boolean)
      .some((name) => String(name).trim().toLowerCase() === "online store"),
  );

  if (!publication) {
    throw createApiErrorFromMessage(
      "The Online Store publication was not found. Verify read_publications and write_publications scopes.",
      422,
    );
  }
  return publication.id;
}
