import redisDriver from "unstorage/drivers/redis";
import { configureWebhookRedis } from "../utils/webhook-redis.ts";

export default defineNitroPlugin(async () => {
  const redisUrl = String(process.env.NITRO_WEBHOOK_REDIS_URL || "").trim();
  if (!redisUrl) return;

  const prefix =
    String(process.env.NITRO_WEBHOOK_REDIS_PREFIX || "").trim() || "spf:webhooks";
  const driver = redisDriver({
    url: redisUrl,
    base: prefix,
    preConnect: true,
  });
  const storage = useStorage();
  await storage.unmount("webhooks");
  storage.mount("webhooks", driver);

  const client = driver.getInstance?.();
  if (client) configureWebhookRedis(client, prefix);
});
