import { beforeEach, describe, expect, it, vi } from "vitest";
import streamHandler from "~~/server/api/webhooks/stream.post";
import type { WebhookNotification } from "~~/types/webhook";

const registry = vi.hoisted(() => ({
  getWebhookNotifications: vi.fn(),
  getWebhookShop: vi.fn(),
  matchesWebhookStreamToken: vi.fn(),
  subscribeToWebhookNotifications: vi.fn(),
}));
const streamState = vi.hoisted(() => ({
  pushes: [] as Array<Record<string, string>>,
  close: () => {},
}));

vi.mock("~~/server/utils/webhook-registry", () => registry);
vi.mock("#imports", () => ({ useRuntimeConfig: () => ({}) }));
vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  createEventStream: () => ({
    push: vi.fn(async (event: Record<string, string>) => {
      streamState.pushes.push(event);
    }),
    onClosed: vi.fn((callback: () => void) => {
      streamState.close = callback;
    }),
    send: vi.fn(() => ({ streamed: true })),
  }),
  defineEventHandler: <T>(handler: T) => handler,
  readBody: (event: { body?: unknown }) => Promise.resolve(event.body),
  setResponseHeader: vi.fn(),
}));

describe("webhook SSE stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    streamState.pushes = [];
    registry.getWebhookShop.mockImplementation(async (domain: string) =>
      domain === "stream-shop.myshopify.com"
        ? {
            storeId: "stream-shop",
            shopDomain: domain,
            clientSecret: "secret",
            streamToken: "stream-token",
          }
        : null,
    );
    registry.matchesWebhookStreamToken.mockReturnValue(true);
    registry.getWebhookNotifications.mockResolvedValue([notification]);
  });

  it("replays cached notifications once and suppresses local-publish duplicates", async () => {
    let publish: ((value: WebhookNotification) => Promise<void>) | undefined;
    registry.subscribeToWebhookNotifications.mockImplementation(
      ({ publish: callback }: { publish: typeof publish }) => {
        publish = callback;
        return vi.fn();
      },
    );

    await expect(
      streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "stream-token" }],
        },
      } as never),
    ).resolves.toEqual({ streamed: true });

    await publish?.(notification);
    expect(
      streamState.pushes.filter(({ event }) => event === "notification"),
    ).toHaveLength(1);
    expect(streamState.pushes[0]).toMatchObject({ event: "connected" });
    streamState.close();
  });

  it("rejects a stream with no valid signed subscription", async () => {
    registry.matchesWebhookStreamToken.mockReturnValue(false);
    await expect(
      streamHandler({
        body: {
          subscriptions: [{ storeId: "stream-shop", token: "wrong" }],
        },
      } as never),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

const notification: WebhookNotification = {
  id: "delivery-1",
  webhookId: "delivery-1",
  eventId: null,
  storeId: "stream-shop",
  shopDomain: "stream-shop.myshopify.com",
  topic: "ORDERS_UPDATED",
  kind: "order",
  resourceId: "1001",
  orderId: "1001",
  orderName: "#1001",
  status: "updated",
  occurredAt: "2026-08-17T02:00:00.000Z",
  receivedAt: "2026-08-17T02:00:01.000Z",
};
