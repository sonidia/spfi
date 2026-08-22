import type { H3Event } from "h3";
import { assertNoGraphqlUserErrors, callShopifyGraphql } from "./callShopifyGraphql.ts";
import { createApiErrorFromMessage } from "./callShopifyApi.ts";
import { getShopifyCollectionDetail } from "./shopify-collection-detail.ts";
import {
  buildCollectionSelectionUpdateInput,
  toCollectionCreateInput,
  toCollectionUpdateInput,
} from "./shopify-collection-validation.ts";
import { setShopifyPublishablePublications } from "./shopify-publishable.ts";
import type {
  CollectionCreateDto,
  CollectionDuplicateDto,
  CollectionJobReference,
  CollectionMutationResult,
  CollectionSelectionDelta,
  CollectionUpdateDto,
} from "~~/types/shopify-collection";

interface UserError {
  field?: string[] | null;
  message: string;
}

export async function createShopifyCollection(options: {
  event: H3Event;
  storeId: string;
  token: string;
  input: CollectionCreateDto;
}): Promise<CollectionMutationResult> {
  const collectionInput = toCollectionCreateInput(options.input);
  const variables = { collection: collectionInput };
  const data = await callShopifyGraphql<
    {
      collectionCreate: {
        collection: { id: string } | null;
        userErrors: UserError[];
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionCreate",
    query: `
      mutation CollectionCreate($collection: CollectionCreateInput!) {
        collectionCreate(collection: $collection) {
          collection { id }
          userErrors { field message }
        }
      }
    `,
    variables,
    retryTransport: false,
  });
  assertNoGraphqlUserErrors(
    data.collectionCreate.userErrors,
    "Collection creation failed.",
  );
  const id = data.collectionCreate.collection?.id;
  if (!id) {
    throw createApiErrorFromMessage(
      "Shopify did not return the created collection.",
      502,
    );
  }

  let publishing: CollectionMutationResult["publishing"];
  if (options.input.publicationIds?.length) {
    try {
      await setShopifyPublishablePublications({
        ...options,
        publishableId: id,
        publicationIds: options.input.publicationIds,
        publish: true,
      });
      publishing = {
        requested: options.input.publicationIds.length,
        succeeded: true,
        error: null,
      };
    } catch (error) {
      publishing = {
        requested: options.input.publicationIds.length,
        succeeded: false,
        error: getErrorMessage(error),
      };
    }
  }

  return {
    collection: await getShopifyCollectionDetail({ ...options, id }),
    ...(publishing ? { publishing } : {}),
  };
}

export async function updateShopifyCollection(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
  input: CollectionUpdateDto;
}): Promise<CollectionMutationResult> {
  if (options.input.updatedAt) await assertCollectionNotStale(options);
  const collection = toCollectionUpdateInput(options.id, options.input);
  const variables = { collection };
  const data = await callShopifyGraphql<
    {
      collectionUpdate: {
        collection: { id: string } | null;
        job: CollectionJobReference | null;
        userErrors: UserError[];
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionUpdate",
    query: `
      mutation CollectionUpdate($collection: CollectionUpdateInput!) {
        collectionUpdate(collection: $collection) {
          collection { id }
          job { id done }
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.collectionUpdate.userErrors,
    "Collection update failed.",
  );
  const job = data.collectionUpdate.job;
  return {
    collection: await getShopifyCollectionDetail({ ...options, id: options.id }),
    ...(job ? { job } : {}),
  };
}

export async function duplicateShopifyCollection(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
  input: CollectionDuplicateDto;
}): Promise<CollectionMutationResult> {
  const variables = {
    input: {
      collectionId: options.id,
      newTitle: options.input.newTitle,
      copyPublications: options.input.copyPublications,
    },
  };
  const data = await callShopifyGraphql<
    {
      collectionDuplicate: {
        collection: { id: string } | null;
        job: CollectionJobReference | null;
        userErrors: UserError[];
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionDuplicate",
    query: `
      mutation CollectionDuplicate($input: CollectionDuplicateInput!) {
        collectionDuplicate(input: $input) {
          collection { id }
          job { id done }
          userErrors { field message }
        }
      }
    `,
    variables,
    retryTransport: false,
  });
  assertNoGraphqlUserErrors(
    data.collectionDuplicate.userErrors,
    "Collection duplication failed.",
  );
  const duplicatedId = data.collectionDuplicate.collection?.id;
  if (!duplicatedId) {
    throw createApiErrorFromMessage(
      "Shopify did not return the duplicated collection.",
      502,
    );
  }
  const job = data.collectionDuplicate.job;
  return {
    collection: await getShopifyCollectionDetail({ ...options, id: duplicatedId }),
    ...(job ? { job } : {}),
  };
}

export async function updateShopifyCollectionSelections(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
  delta: CollectionSelectionDelta;
}): Promise<CollectionMutationResult> {
  const detail = await getShopifyCollectionDetail(options);
  const source = detail.sources.find(
    (candidate) => candidate.id === options.delta.sourceId,
  );
  if (!source || source.type !== "conditions") {
    throw createApiErrorFromMessage(
      "The collection conditions source was not found on this collection.",
      404,
    );
  }
  if (source.readOnly) {
    throw createApiErrorFromMessage(
      "This source is shareable, variant-targeted, or otherwise read-only in this workspace.",
      422,
    );
  }

  const variables = {
    collection: buildCollectionSelectionUpdateInput(options.id, options.delta),
  };
  const data = await callShopifyGraphql<
    {
      collectionUpdate: {
        collection: { id: string } | null;
        job: CollectionJobReference | null;
        userErrors: UserError[];
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionSelectionsUpdate",
    query: `
      mutation CollectionSelectionsUpdate($collection: CollectionUpdateInput!) {
        collectionUpdate(collection: $collection) {
          collection { id }
          job { id done }
          userErrors { field message }
        }
      }
    `,
    variables,
  });
  assertNoGraphqlUserErrors(
    data.collectionUpdate.userErrors,
    "Collection selections update failed.",
  );
  const job = data.collectionUpdate.job;
  return {
    collection:
      job && !job.done
        ? detail
        : await getShopifyCollectionDetail({ ...options, id: options.id }),
    ...(job ? { job } : {}),
  };
}

export async function deleteShopifyCollection(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}) {
  const variables = { input: { id: options.id } };
  const data = await callShopifyGraphql<
    {
      collectionDelete: {
        deletedCollectionId: string | null;
        userErrors: UserError[];
      };
    },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionDelete",
    query: `
      mutation CollectionDelete($input: CollectionDeleteInput!) {
        collectionDelete(input: $input) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `,
    variables,
    retryTransport: false,
  });
  assertNoGraphqlUserErrors(
    data.collectionDelete.userErrors,
    "Collection deletion failed.",
  );
  return { deletedCollectionId: data.collectionDelete.deletedCollectionId };
}

async function assertCollectionNotStale(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
  input: CollectionUpdateDto;
}) {
  const current = await getShopifyCollectionDetail(options);
  if (current.updatedAt !== options.input.updatedAt) {
    throw createApiErrorFromMessage(
      "This collection changed in Shopify after it was opened. Refresh before saving.",
      409,
    );
  }
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as { statusMessage?: unknown; message?: unknown };
    return String(candidate.statusMessage || candidate.message || "Publishing failed.");
  }
  return String(error || "Publishing failed.");
}
