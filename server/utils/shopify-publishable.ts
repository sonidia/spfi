import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql.ts";
import { createApiErrorFromMessage } from "./callShopifyApi.ts";
import { requirePublicationGids } from "./shopify-collection-validation.ts";

interface PublicationMutationPayload {
  userErrors: Array<{ field?: string[] | null; message: string }>;
}

export async function setShopifyPublishablePublications(options: {
  event: H3Event;
  storeId: string;
  token: string;
  publishableId: string;
  publicationIds: unknown;
  publish: boolean;
}) {
  const publicationIds = requirePublicationGids(options.publicationIds);
  if (!publicationIds.length) {
    throw createApiErrorFromMessage("At least one publication is required.", 400);
  }
  await assertPublicationsBelongToStore({ ...options, publicationIds });

  const field = options.publish ? "publishablePublish" : "publishableUnpublish";
  const variables = {
    id: options.publishableId,
    input: publicationIds.map((publicationId) => ({ publicationId })),
  };
  const data = await callShopifyGraphql<
    Record<typeof field, PublicationMutationPayload>,
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: options.publish ? "PublishCollection" : "UnpublishCollection",
    query: `
      mutation ${options.publish ? "PublishCollection" : "UnpublishCollection"}(
        $id: ID!
        $input: [PublicationInput!]!
      ) {
        ${field}(id: $id, input: $input) {
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data[field].userErrors,
    options.publish
      ? "Collection publishing failed."
      : "Collection unpublishing failed.",
  );
}

async function assertPublicationsBelongToStore(options: {
  event: H3Event;
  storeId: string;
  token: string;
  publicationIds: string[];
}) {
  const variables = { ids: options.publicationIds };
  const data = await callShopifyGraphql<
    { nodes: Array<{ __typename: string; id: string } | null> },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "ValidateCollectionPublications",
    query: `
      query ValidateCollectionPublications($ids: [ID!]!) {
        nodes(ids: $ids) { __typename id }
      }
    `,
    variables,
  });
  const validIds = new Set(
    data.nodes
      .filter((node) => node?.__typename === "Publication")
      .map((node) => node?.id),
  );
  if (options.publicationIds.some((id) => !validIds.has(id))) {
    throw createApiErrorFromMessage(
      "One or more publications do not belong to this store.",
      400,
    );
  }
}
