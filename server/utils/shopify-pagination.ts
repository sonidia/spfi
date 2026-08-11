import { createError } from "h3";

export interface ShopifyPageInfo {
  nextCursor: string | null;
  previousCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ShopifyHeaderLike {
  get?: (name: string) => unknown;
  link?: unknown;
  Link?: unknown;
}

type ShopifyQueryParams = Record<string, unknown>;

export function buildShopifyCursorPageParams(
  initialParams: ShopifyQueryParams,
  pageInfo: string,
  limit = 250,
): ShopifyQueryParams {
  const fields = initialParams.fields;

  return {
    page_info: pageInfo,
    limit,
    ...(typeof fields === "string" && fields.trim() ? { fields } : {}),
  };
}

export function getShopifyPageInfo(headers: unknown): ShopifyPageInfo {
  const headerBag = (headers || {}) as ShopifyHeaderLike;
  const rawLink =
    typeof headerBag.get === "function"
      ? headerBag.get("link")
      : (headerBag.link ?? headerBag.Link);
  const linkHeader = Array.isArray(rawLink) ? rawLink.join(",") : String(rawLink || "");
  const cursors: Record<"next" | "previous", string | null> = {
    next: null,
    previous: null,
  };

  for (const part of linkHeader.split(/,\s*(?=<)/)) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([^";,\s]+)"?/i);
    const relation = match?.[2]?.toLowerCase();
    if (!match || (relation !== "next" && relation !== "previous")) continue;

    cursors[relation] = getCursorFromUrl(match[1] || "");
  }

  return {
    nextCursor: cursors.next,
    previousCursor: cursors.previous,
    hasNextPage: Boolean(cursors.next),
    hasPreviousPage: Boolean(cursors.previous),
  };
}

function getCursorFromUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Shopify returned an invalid pagination link.",
    });
  }

  const cursor = url.searchParams.get("page_info");
  if (!cursor) {
    throw createError({
      statusCode: 502,
      statusMessage: "Shopify pagination link is missing page_info.",
    });
  }

  return cursor;
}
