import assert from "node:assert/strict";
import test from "node:test";
import {
  claimRedisWebhookDelivery,
  completeRedisWebhookDelivery,
  configureWebhookRedis,
  releaseRedisWebhookDelivery,
} from "../server/utils/webhook-redis.ts";

const values = new Map<string, string>();
const redis = {
  async get(key: string) {
    return values.get(key) ?? null;
  },
  async set(key: string, value: string, ...args: Array<string | number>) {
    if (args.includes("NX") && values.has(key)) return null;
    values.set(key, value);
    return "OK";
  },
  async eval(script: string, _keyCount: number, key: string, ...args: string[]) {
    const current = values.get(key);
    if (script.includes('redis.call("DEL"')) {
      if (current !== args[0]) return 0;
      values.delete(key);
      return 1;
    }
    if (script.includes('redis.call("SET", KEYS[1], ARGV[2], "NX")')) {
      if (current === undefined) {
        values.set(key, args[1] || "");
        return 1;
      }
      if (current !== args[0]) return 0;
      values.set(key, args[1] || "");
      return 1;
    }
    if (current !== args[0]) return 0;
    values.set(key, args[1] || "");
    return 1;
  },
};

configureWebhookRedis(redis as never, "test:webhooks:");

test("Redis claims use atomic ownership transitions", async () => {
  const key = "deliveries:shop:delivery-1";
  const now = Date.parse("2026-08-17T02:00:00.000Z");
  const claim = {
    status: "processing" as const,
    owner: "owner-a",
    claimedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    completedAt: null,
  };

  assert.equal(
    await claimRedisWebhookDelivery({ key, claim, nowMs: now, ttlMs: 120_000 }),
    "claimed",
  );
  assert.ok(values.has(`test:webhooks:${key}`));
  assert.equal(
    await claimRedisWebhookDelivery({ key, claim, nowMs: now, ttlMs: 120_000 }),
    "busy",
  );
  assert.equal(
    await completeRedisWebhookDelivery({
      key,
      owner: "owner-b",
      completedAt: new Date(now + 1_000).toISOString(),
    }),
    false,
  );
  assert.equal(
    await completeRedisWebhookDelivery({
      key,
      owner: "owner-a",
      completedAt: new Date(now + 1_000).toISOString(),
    }),
    true,
  );
  assert.equal(
    await claimRedisWebhookDelivery({ key, claim, nowMs: now, ttlMs: 120_000 }),
    "duplicate",
  );
});

test("Redis releases only the current processing owner", async () => {
  const key = "deliveries:shop:delivery-2";
  const now = Date.parse("2026-08-17T02:00:00.000Z");
  const claim = {
    status: "processing" as const,
    owner: "owner-a",
    claimedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 120_000).toISOString(),
    completedAt: null,
  };
  await claimRedisWebhookDelivery({ key, claim, nowMs: now, ttlMs: 120_000 });

  assert.equal(await releaseRedisWebhookDelivery({ key, owner: "owner-b" }), false);
  assert.equal(await releaseRedisWebhookDelivery({ key, owner: "owner-a" }), true);
  assert.equal(values.has(`test:webhooks:${key}`), false);
});
