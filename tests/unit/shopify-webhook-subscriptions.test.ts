import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureShopifyWebhookSubscriptions,
  inspectWebhookCallbackConfiguration,
  inspectShopifyWebhookSubscriptions,
  resolveWebhookCallbackConfiguration,
  synchronizeShopifyWebhookSubscriptions,
} from "~~/server/utils/shopify-webhook-subscriptions";
import { SHOPIFY_WEBHOOK_TOPICS } from "~~/types/webhook";

const graphql = vi.hoisted(() => vi.fn());

vi.mock("~~/server/utils/callShopifyGraphql", () => ({
  callShopifyGraphql: graphql,
}));

describe("Shopify webhook subscription synchronization", () => {
  beforeEach(() => graphql.mockReset());

  it("updates a managed stale callback instead of creating a duplicate", async () => {
    const callbackUrl = "https://new.example/api/webhooks/shopify";
    graphql
      .mockResolvedValueOnce({
        webhookSubscriptions: {
          edges: SHOPIFY_WEBHOOK_TOPICS.map((topic) => ({
            node: {
              id: `gid://shopify/WebhookSubscription/${topic.length}`,
              topic,
              uri:
                topic === "ORDERS_CREATE"
                  ? "https://old.example/api/webhooks/shopify"
                  : callbackUrl,
              updatedAt: "2026-08-17T02:00:00Z",
            },
          })),
        },
      })
      .mockResolvedValueOnce({
        update0: {
          webhookSubscription: {
            id: "gid://shopify/WebhookSubscription/13",
            topic: "ORDERS_CREATE",
            uri: callbackUrl,
            updatedAt: "2026-08-17T02:01:00Z",
          },
          userErrors: [],
        },
      });

    const result = await ensureShopifyWebhookSubscriptions({
      event: {} as never,
      storeId: "shop",
      token: "token",
      callbackUrl,
    });

    expect(result.registeredTopics).toEqual(SHOPIFY_WEBHOOK_TOPICS);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[1]?.[0].query).toContain("webhookSubscriptionUpdate");
    expect(graphql.mock.calls[1]?.[0].query).not.toContain("webhookSubscriptionCreate");
  });

  it("recommends an explicit URL for a public request-origin fallback", () => {
    const event = {
      node: {
        req: {
          headers: { origin: "https://ops.example", host: "ops.example" },
          url: "/api/webhooks/config",
        },
      },
      path: "/api/webhooks/config",
    } as never;
    expect(resolveWebhookCallbackConfiguration(event, "")).toMatchObject({
      callbackUrl: "https://ops.example/api/webhooks/shopify",
      publicUrlConfigured: false,
      usesRequestOrigin: true,
      explicitPublicUrlRecommended: true,
    });
  });

  it("returns invalid callback configuration as a diagnostic", () => {
    expect(
      inspectWebhookCallbackConfiguration({} as never, "http://public.example"),
    ).toEqual({
      configuration: null,
      error: "NUXT_WEBHOOK_PUBLIC_URL must be a public HTTPS origin.",
    });
  });

  it("returns operational query failures as status diagnostics", async () => {
    graphql.mockRejectedValueOnce(new Error("Shopify unavailable"));

    await expect(
      inspectShopifyWebhookSubscriptions({
        event: {} as never,
        storeId: "shop",
        token: "token",
        callbackUrl: "https://example.test/api/webhooks/shopify",
      }),
    ).resolves.toEqual({ subscriptions: [], error: "Shopify unavailable" });
  });

  it("returns synchronization failures without throwing from registration", async () => {
    graphql.mockRejectedValueOnce(new Error("Missing proxy"));

    await expect(
      synchronizeShopifyWebhookSubscriptions({
        event: {} as never,
        storeId: "shop",
        token: "token",
        callbackUrl: "https://example.test/api/webhooks/shopify",
      }),
    ).resolves.toEqual({
      registeredTopics: [],
      warnings: [],
      error: "Missing proxy",
    });
  });
});
