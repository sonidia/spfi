import { getHeader, getRequestURL, type H3Event } from "h3";
import { callShopifyGraphql } from "./callShopifyGraphql";
import { createApiErrorFromMessage } from "./callShopifyApi";
import { SHOPIFY_WEBHOOK_TOPICS, type ShopifyWebhookTopic } from "~~/types/webhook";

interface ExistingSubscriptionsData {
  webhookSubscriptions: {
    edges: Array<{
      node: { id: string; topic: ShopifyWebhookTopic; uri: string };
    }>;
  };
}

interface MutationResult {
  webhookSubscription: {
    id: string;
    topic: ShopifyWebhookTopic;
    uri: string;
  } | null;
  userErrors: Array<{ field?: string[]; message: string }>;
}

export async function ensureShopifyWebhookSubscriptions(input: {
  event: H3Event;
  storeId: string;
  token: string;
  callbackUrl: string;
}) {
  const existing = await callShopifyGraphql<
    ExistingSubscriptionsData,
    {
      topics: ShopifyWebhookTopic[];
    }
  >({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    operationName: "SpfiWebhookSubscriptions",
    query: `
      query SpfiWebhookSubscriptions($topics: [WebhookSubscriptionTopic!]) {
        webhookSubscriptions(first: 100, topics: $topics) {
          edges { node { id topic uri } }
        }
      }
    `,
    variables: { topics: [...SHOPIFY_WEBHOOK_TOPICS] },
  });

  const activeTopics = new Set(
    existing.webhookSubscriptions.edges
      .map(({ node }) => node)
      .filter((node) => node.uri === input.callbackUrl)
      .map((node) => node.topic),
  );
  const missingTopics = SHOPIFY_WEBHOOK_TOPICS.filter(
    (topic) => !activeTopics.has(topic),
  );
  if (!missingTopics.length) {
    return { registeredTopics: [...activeTopics], warnings: [] };
  }

  const aliases = missingTopics
    .map(
      (topic, index) => `
        subscription${index}: webhookSubscriptionCreate(
          topic: ${topic}
          webhookSubscription: $subscription
        ) {
          webhookSubscription { id topic uri }
          userErrors { field message }
        }
      `,
    )
    .join("\n");
  const created = await callShopifyGraphql<
    Record<string, MutationResult>,
    { subscription: { uri: string } }
  >({
    event: input.event,
    storeId: input.storeId,
    token: input.token,
    operationName: "SpfiRegisterWebhooks",
    query: `
      mutation SpfiRegisterWebhooks($subscription: WebhookSubscriptionInput!) {
        ${aliases}
      }
    `,
    variables: { subscription: { uri: input.callbackUrl } },
  });

  const warnings: string[] = [];
  for (const result of Object.values(created)) {
    if (result.webhookSubscription) activeTopics.add(result.webhookSubscription.topic);
    warnings.push(...result.userErrors.map((error) => error.message));
  }

  if (!activeTopics.size) {
    throw createApiErrorFromMessage(
      warnings.join("; ") || "Shopify did not create any webhook subscriptions.",
      422,
    );
  }

  return { registeredTopics: [...activeTopics], warnings };
}

export function resolveWebhookCallbackUrl(event: H3Event, configuredUrl: unknown) {
  const configured = String(configuredUrl || "").trim();
  const origin = String(getHeader(event, "origin") || "").trim();
  const baseUrl = configured || origin || getRequestURL(event).origin;

  try {
    const url = new URL(baseUrl);
    const localDevelopmentHost = ["localhost", "127.0.0.1", "::1"].includes(
      url.hostname,
    );
    if (url.protocol !== "https:" && !localDevelopmentHost) throw new Error();
    url.pathname = "/api/webhooks/shopify";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    throw createApiErrorFromMessage(
      "NUXT_WEBHOOK_PUBLIC_URL must be a public HTTPS origin.",
      503,
    );
  }
}
