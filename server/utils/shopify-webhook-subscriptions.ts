import { getHeader, getRequestURL, type H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { getAppErrorMessage } from "~~/utils/error";
import {
  SHOPIFY_WEBHOOK_TOPICS,
  type ShopifyWebhookSubscription,
  type ShopifyWebhookTopic,
} from "~~/types/webhook";

interface SubscriptionNode {
  id: string;
  topic: ShopifyWebhookTopic;
  uri: string;
  updatedAt: string;
}

interface ExistingSubscriptionsData {
  webhookSubscriptions: {
    edges: Array<{ node: SubscriptionNode }>;
  };
}

interface MutationResult {
  webhookSubscription: SubscriptionNode | null;
  userErrors: Array<{ field?: string[]; message: string }>;
}

interface DeleteMutationResult {
  deletedWebhookSubscriptionId: string | null;
  userErrors: Array<{ field?: string[]; message: string }>;
}

export interface WebhookCallbackConfiguration {
  callbackUrl: string;
  publicUrlConfigured: boolean;
  usesRequestOrigin: boolean;
  explicitPublicUrlRecommended: boolean;
}

export interface WebhookCallbackInspection {
  configuration: WebhookCallbackConfiguration | null;
  error: string | null;
}

export async function ensureShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
}) {
  const existing = await queryShopifyWebhookSubscriptions(input);
  const warnings: string[] = [];
  const activeByTopic = groupSubscriptionsByTopic(
    existing.filter((node) => node.uri === input.callbackUrl),
  );
  const staleManagedByTopic = groupSubscriptionsByTopic(
    existing.filter(
      (node) => node.uri !== input.callbackUrl && isSpfiWebhookCallback(node.uri),
    ),
  );

  const updates: SubscriptionNode[] = [];
  const creates: ShopifyWebhookTopic[] = [];
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    if (activeByTopic.get(topic)?.length) continue;
    const stale = staleManagedByTopic.get(topic)?.sort(byMostRecentlyUpdated)[0];
    if (stale) updates.push(stale);
    else creates.push(topic);
  }

  if (updates.length || creates.length) {
    const synchronized = await synchronizeSubscriptions({
      ...input,
      updates,
      creates,
    });
    warnings.push(...synchronized.warnings);
    for (const subscription of synchronized.subscriptions) {
      const list = activeByTopic.get(subscription.topic) || [];
      list.push(subscription);
      activeByTopic.set(subscription.topic, list);
    }
  }

  const staleDuplicates = existing.filter((node) => {
    if (node.uri === input.callbackUrl || !isSpfiWebhookCallback(node.uri)) {
      return false;
    }
    return (
      Boolean(activeByTopic.get(node.topic)?.length) &&
      !updates.some((updated) => updated.id === node.id)
    );
  });
  if (staleDuplicates.length) {
    const cleanup = await deleteShopifyWebhookSubscriptions({
      event: input.event,
      storeId: input.storeId,
      token: input.token,
      subscriptionIds: staleDuplicates.map(({ id }) => id),
      operationName: "SpfiCleanupStaleWebhooks",
    });
    warnings.push(...cleanup.warnings);
  }

  const registeredTopics = SHOPIFY_WEBHOOK_TOPICS.filter(
    (topic) => activeByTopic.get(topic)?.length,
  );
  if (!registeredTopics.length) {
    throw createApiErrorFromMessage(
      warnings.join("; ") || "Shopify did not create any webhook subscriptions.",
      422,
    );
  }

  return { registeredTopics, warnings };
}

export async function listShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
}): Promise<ShopifyWebhookSubscription[]> {
  const subscriptions = await queryShopifyWebhookSubscriptions(input);
  return subscriptions
    .map((subscription) => ({
      ...subscription,
      isCurrentCallback: subscription.uri === input.callbackUrl,
    }))
    .sort((left, right) => left.topic.localeCompare(right.topic));
}

export async function inspectShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
}) {
  try {
    return {
      subscriptions: await listShopifyWebhookSubscriptions(input),
      error: null,
    };
  } catch (error) {
    return {
      subscriptions: [] as ShopifyWebhookSubscription[],
      error: getWebhookOperationError(error),
    };
  }
}

export async function synchronizeShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
}) {
  try {
    return {
      ...(await ensureShopifyWebhookSubscriptions(input)),
      error: null,
    };
  } catch (error) {
    return {
      registeredTopics: [] as ShopifyWebhookTopic[],
      warnings: [] as string[],
      error: getWebhookOperationError(error),
    };
  }
}

export async function deleteShopifyWebhookSubscription(input: {
  event: H3Event;
  storeId: string;
  token: string;
  subscriptionId: string;
}) {
  const result = await deleteShopifyWebhookSubscriptions({
    ...input,
    subscriptionIds: [input.subscriptionId],
    operationName: "SpfiDeleteWebhook",
  });
  if (!result.deletedIds.length) {
    throw createApiErrorFromMessage(
      result.warnings.join("; ") || "Shopify did not delete the webhook subscription.",
      422,
    );
  }
  return { deletedSubscriptionId: result.deletedIds[0] as string };
}

export function resolveWebhookCallbackConfiguration(
  event: H3Event,
  configuredUrl: unknown,
): WebhookCallbackConfiguration {
  const configured = String(configuredUrl || "").trim();
  const requestOrigin = configured
    ? ""
    : String(getHeader(event, "origin") || "").trim();
  const requestUrlOrigin =
    configured || requestOrigin ? "" : getRequestURL(event).origin;
  const baseUrl = configured || requestOrigin || requestUrlOrigin;

  try {
    const url = new URL(baseUrl);
    const localDevelopmentHost = isLocalDevelopmentHost(url.hostname);
    if (url.protocol !== "https:" && !localDevelopmentHost) throw new Error();
    url.pathname = "/api/webhooks/shopify";
    url.search = "";
    url.hash = "";
    return {
      callbackUrl: url.toString(),
      publicUrlConfigured: Boolean(configured),
      usesRequestOrigin: !configured,
      explicitPublicUrlRecommended: !configured && !localDevelopmentHost,
    };
  } catch {
    throw createApiErrorFromMessage(
      "NUXT_WEBHOOK_PUBLIC_URL must be a public HTTPS origin.",
      503,
    );
  }
}

export function resolveWebhookCallbackUrl(event: H3Event, configuredUrl: unknown) {
  return resolveWebhookCallbackConfiguration(event, configuredUrl).callbackUrl;
}

export function inspectWebhookCallbackConfiguration(
  event: H3Event,
  configuredUrl: unknown,
): WebhookCallbackInspection {
  try {
    return {
      configuration: resolveWebhookCallbackConfiguration(event, configuredUrl),
      error: null,
    };
  } catch (error) {
    return {
      configuration: null,
      error: getWebhookOperationError(error),
    };
  }
}

async function queryShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
}) {
  const existing = await callShopifyGraphql<
    ExistingSubscriptionsData,
    { topics: ShopifyWebhookTopic[] }
  >({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    operationName: "SpfiWebhookSubscriptions",
    query: `
      query SpfiWebhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
        webhookSubscriptions(first: 100, topics: $topics) {
          edges { node { id topic uri updatedAt } }
        }
      }
    `,
    variables: { topics: [...SHOPIFY_WEBHOOK_TOPICS] },
  });
  return existing.webhookSubscriptions.edges.map(({ node }) => node);
}

async function synchronizeSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
  updates: SubscriptionNode[];
  creates: ShopifyWebhookTopic[];
}) {
  const variableDefinitions = ["$subscription: WebhookSubscriptionInput!"];
  const variables: Record<string, unknown> = {
    subscription: { uri: input.callbackUrl },
  };
  const fields: string[] = [];

  input.updates.forEach((subscription, index) => {
    const variableName = `updateId${index}`;
    variableDefinitions.push(`$${variableName}: ID!`);
    variables[variableName] = subscription.id;
    fields.push(`
      update${index}: webhookSubscriptionUpdate(
        id: $${variableName}
        webhookSubscription: $subscription
      ) {
        webhookSubscription { id topic uri updatedAt }
        userErrors { field message }
      }
    `);
  });
  input.creates.forEach((topic, index) => {
    fields.push(`
      create${index}: webhookSubscriptionCreate(
        topic: ${topic}
        webhookSubscription: $subscription
      ) {
        webhookSubscription { id topic uri updatedAt }
        userErrors { field message }
      }
    `);
  });

  const result = await callShopifyGraphql<
    Record<string, MutationResult>,
    Record<string, unknown>
  >({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    operationName: "SpfiSynchronizeWebhooks",
    query: `
      mutation SpfiSynchronizeWebhooks(${variableDefinitions.join(", ")}) {
        ${fields.join("\n")}
      }
    `,
    variables,
  });

  return collectMutationResults(result);
}

async function deleteShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  subscriptionIds: string[];
  operationName: string;
}) {
  if (!input.subscriptionIds.length) return { deletedIds: [], warnings: [] };

  const variableDefinitions: string[] = [];
  const variables: Record<string, unknown> = {};
  const fields = input.subscriptionIds.map((id, index) => {
    const variableName = `subscriptionId${index}`;
    variableDefinitions.push(`$${variableName}: ID!`);
    variables[variableName] = id;
    return `
      delete${index}: webhookSubscriptionDelete(id: $${variableName}) {
        deletedWebhookSubscriptionId
        userErrors { field message }
      }
    `;
  });
  const result = await callShopifyGraphql<
    Record<string, DeleteMutationResult>,
    Record<string, unknown>
  >({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    operationName: input.operationName,
    query: `
      mutation ${input.operationName}(${variableDefinitions.join(", ")}) {
        ${fields.join("\n")}
      }
    `,
    variables,
  });

  const deletedIds: string[] = [];
  const warnings: string[] = [];
  for (const mutation of Object.values(result)) {
    if (mutation.deletedWebhookSubscriptionId) {
      deletedIds.push(mutation.deletedWebhookSubscriptionId);
    }
    warnings.push(...mutation.userErrors.map((error) => error.message));
  }
  return { deletedIds, warnings };
}

function collectMutationResults(results: Record<string, MutationResult>) {
  const subscriptions: SubscriptionNode[] = [];
  const warnings: string[] = [];
  for (const result of Object.values(results)) {
    if (result.webhookSubscription) subscriptions.push(result.webhookSubscription);
    warnings.push(...result.userErrors.map((error) => error.message));
  }
  return { subscriptions, warnings };
}

function groupSubscriptionsByTopic(subscriptions: SubscriptionNode[]) {
  const grouped = new Map<ShopifyWebhookTopic, SubscriptionNode[]>();
  for (const subscription of subscriptions) {
    const list = grouped.get(subscription.topic) || [];
    list.push(subscription);
    grouped.set(subscription.topic, list);
  }
  return grouped;
}

function isSpfiWebhookCallback(value: string) {
  try {
    return new URL(value).pathname === "/api/webhooks/shopify";
  } catch {
    return false;
  }
}

function byMostRecentlyUpdated(left: SubscriptionNode, right: SubscriptionNode) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function getWebhookOperationError(error: unknown) {
  return getAppErrorMessage(error, "Shopify webhook request failed.");
}

function isLocalDevelopmentHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}
