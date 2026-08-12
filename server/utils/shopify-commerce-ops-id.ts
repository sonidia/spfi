import { createApiErrorFromMessage } from "./callShopifyApi";

export function requireShopifyGid(value: unknown, resource: string) {
  const id = String(value || "").trim();
  const prefix = `gid://shopify/${resource}/`;
  if (!id.startsWith(prefix) || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw createApiErrorFromMessage(`A valid ${resource} ID is required.`, 400);
  }
  return id;
}
