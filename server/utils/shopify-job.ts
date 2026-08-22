import type { H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql.ts";
import { createApiErrorFromMessage } from "./callShopifyApi.ts";
import type { CollectionJobReference } from "~~/types/shopify-collection";

export async function getShopifyJob(options: {
  event: H3Event;
  storeId: string;
  token: string;
  id: string;
}): Promise<CollectionJobReference> {
  const variables = { id: options.id };
  const data = await callShopifyGraphql<
    { job: CollectionJobReference | null },
    typeof variables
  >({
    event: options.event,
    storeId: options.storeId,
    token: options.token,
    operationName: "CollectionJobStatus",
    query: `
      query CollectionJobStatus($id: ID!) {
        job(id: $id) { id done }
      }
    `,
    variables,
  });
  if (!data.job) {
    throw createApiErrorFromMessage("Collection update job was not found.", 404);
  }
  return data.job;
}
