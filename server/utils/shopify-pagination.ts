import { createStandardApiErrorFromMessage } from "./api-error.ts";

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

  // Shopify carries the original filters in the opaque cursor. Requests with
  // page_info may only include limit and fields; resending filters can fail.
  // https://shopify.dev/docs/api/admin-rest/usage/pagination#limitations-and-considerations
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
    throw createStandardApiErrorFromMessage(
      "Shopify returned an invalid pagination link.",
      502,
    );
  }

  const cursor = url.searchParams.get("page_info");
  if (!cursor) {
    throw createStandardApiErrorFromMessage(
      "Shopify pagination link is missing page_info.",
      502,
    );
  }

  return cursor;
}
