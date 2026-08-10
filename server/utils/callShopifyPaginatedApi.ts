import type { H3Event } from "h3";
import {
  callShopifyApiWithResponse,
  createApiErrorFromMessage,
  type ShopifyApiResponse,
} from "./callShopifyApi";

type ShopifyQueryParams = Record<string, unknown>;

interface CallShopifyPaginatedApiOptions<TItem> {
  event: H3Event;
  storeId: string;
  token?: string;
  path: string;
  resourceKey: string;
  params?: ShopifyQueryParams;
  missingProxyMessage?: string;
  mapItem?: (item: unknown) => TItem;
  preserveUnsafeIntegers?: boolean;
}

const MAX_PAGE_SIZE = 250;

export async function callShopifyPaginatedApi<TItem>({
  event,
  storeId,
  token,
  path,
  resourceKey,
  params = {},
  missingProxyMessage,
  mapItem = (item) => item as TItem,
  preserveUnsafeIntegers = false,
}: CallShopifyPaginatedApiOptions<TItem>): Promise<TItem[]> {
  const items: TItem[] = [];
  const visitedPageUrls = new Set<string>();
  let requestParams: ShopifyQueryParams = {
    ...params,
    limit: MAX_PAGE_SIZE,
  };

  while (true) {
    const response = await callShopifyApiWithResponse<Record<string, unknown>>({
      event,
      storeId,
      token,
      path,
      params: requestParams,
      missingProxyMessage,
      preserveUnsafeIntegers,
    });
    const pageItems = response.data[resourceKey];

    if (!Array.isArray(pageItems)) {
      throw createApiErrorFromMessage(
        `Shopify response is missing the "${resourceKey}" list.`,
        502,
      );
    }

    items.push(...pageItems.map(mapItem));

    const nextPageUrl = getNextPageUrl(response);
    if (!nextPageUrl) break;

    if (visitedPageUrls.has(nextPageUrl)) {
      throw createApiErrorFromMessage(
        "Shopify returned a repeated pagination cursor.",
        502,
      );
    }
    visitedPageUrls.add(nextPageUrl);
    requestParams = getCursorParams(nextPageUrl);
  }

  return items;
}

function getNextPageUrl(
  response: ShopifyApiResponse<Record<string, unknown>>,
): string | null {
  const headers = response.headers as AxiosHeaderLike;
  const rawLink =
    typeof headers.get === "function"
      ? headers.get("link")
      : headers.link ?? headers.Link;
  const linkHeader = Array.isArray(rawLink)
    ? rawLink.join(",")
    : String(rawLink || "");

  for (const part of linkHeader.split(/,\s*(?=<)/)) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([^";,\s]+)"?/i);
    if (match?.[2]?.toLowerCase() === "next") {
      return match[1] || null;
    }
  }

  return null;
}

function getCursorParams(nextPageUrl: string): ShopifyQueryParams {
  let url: URL;

  try {
    url = new URL(nextPageUrl);
  } catch {
    throw createApiErrorFromMessage(
      "Shopify returned an invalid pagination link.",
      502,
    );
  }

  const pageInfo = url.searchParams.get("page_info");
  if (!pageInfo) {
    throw createApiErrorFromMessage(
      "Shopify pagination link is missing page_info.",
      502,
    );
  }

  const requestedLimit = Number(url.searchParams.get("limit"));
  return {
    page_info: pageInfo,
    limit:
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= MAX_PAGE_SIZE
        ? requestedLimit
        : MAX_PAGE_SIZE,
  };
}

interface AxiosHeaderLike {
  get?: (name: string) => unknown;
  link?: unknown;
  Link?: unknown;
}
