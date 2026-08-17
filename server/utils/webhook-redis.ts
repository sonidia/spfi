import type { Cluster, Redis } from "ioredis";

interface StoredRedisDeliveryClaim {
  status: "processing" | "complete";
  owner: string;
  claimedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

type RedisClient = Redis | Cluster;
type RedisClaimResult = "claimed" | "duplicate" | "busy";

const REPLACE_PROCESSING_CLAIM = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
  return 1
end
return 0
`;

const COMPLETE_IF_UNCHANGED = `
local current = redis.call("GET", KEYS[1])
if not current then
  return redis.call("SET", KEYS[1], ARGV[2], "NX") and 1 or 0
end
if current == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2])
  return 1
end
return 0
`;

const DELETE_IF_UNCHANGED = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

let redisClient: RedisClient | null = null;
let redisPrefix = "";

export function configureWebhookRedis(client: RedisClient, prefix: string) {
  redisClient = client;
  redisPrefix = prefix.replace(/:+$/, "");
}

export async function claimRedisWebhookDelivery(input: {
  key: string;
  claim: StoredRedisDeliveryClaim;
  nowMs: number;
  ttlMs: number;
}): Promise<RedisClaimResult | null> {
  if (!redisClient) return null;

  const key = prefixedKey(input.key);
  const nextRaw = JSON.stringify(input.claim);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentRaw = await redisClient.get(key);
    if (!currentRaw) {
      const result = await redisClient.set(key, nextRaw, "PX", input.ttlMs, "NX");
      if (result === "OK") return "claimed";
      continue;
    }

    const current = parseClaim(currentRaw);
    if (!current) return "busy";
    if (current.status === "complete") return "duplicate";
    if (Date.parse(current.expiresAt || "") > input.nowMs) return "busy";

    const replaced = await redisClient.eval(
      REPLACE_PROCESSING_CLAIM,
      1,
      key,
      currentRaw,
      nextRaw,
      String(input.ttlMs),
    );
    if (Number(replaced) === 1) return "claimed";
  }

  return "busy";
}

export async function completeRedisWebhookDelivery(input: {
  key: string;
  owner: string;
  completedAt: string;
}): Promise<boolean | null> {
  if (!redisClient) return null;

  const key = prefixedKey(input.key);
  const currentRaw = await redisClient.get(key);
  const current = currentRaw ? parseClaim(currentRaw) : null;
  if (currentRaw && (!current || current.status !== "processing")) return false;
  if (current && current.owner !== input.owner) return false;

  const completed: StoredRedisDeliveryClaim = {
    status: "complete",
    owner: input.owner,
    claimedAt: current?.claimedAt || input.completedAt,
    expiresAt: null,
    completedAt: input.completedAt,
  };
  const result = await redisClient.eval(
    COMPLETE_IF_UNCHANGED,
    1,
    key,
    currentRaw || "",
    JSON.stringify(completed),
  );
  return Number(result) === 1;
}

export async function releaseRedisWebhookDelivery(input: {
  key: string;
  owner: string;
}): Promise<boolean | null> {
  if (!redisClient) return null;

  const key = prefixedKey(input.key);
  const currentRaw = await redisClient.get(key);
  const current = currentRaw ? parseClaim(currentRaw) : null;
  if (!currentRaw || !current) return false;
  if (current.status !== "processing" || current.owner !== input.owner) return false;

  const result = await redisClient.eval(DELETE_IF_UNCHANGED, 1, key, currentRaw);
  return Number(result) === 1;
}

function prefixedKey(key: string) {
  return redisPrefix ? `${redisPrefix}:${key}` : key;
}

function parseClaim(value: string): StoredRedisDeliveryClaim | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredRedisDeliveryClaim>;
    if (parsed.status !== "processing" && parsed.status !== "complete") return null;
    if (typeof parsed.owner !== "string" || typeof parsed.claimedAt !== "string") {
      return null;
    }
    return parsed as StoredRedisDeliveryClaim;
  } catch {
    return null;
  }
}
