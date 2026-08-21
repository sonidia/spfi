export interface ShopifyPublicationChannelSummary {
  channels?: { nodes?: Array<{ handle?: string | null }> } | null;
}

export function isOnlineStorePublication(
  publication: ShopifyPublicationChannelSummary,
) {
  return Boolean(
    publication.channels?.nodes?.some(
      (channel) => String(channel.handle || "").trim() === "online_store",
    ),
  );
}
