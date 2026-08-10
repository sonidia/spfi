import type { H3Event } from "h3";
import {
  callShopifyApiWithResponse,
  createApiErrorFromMessage,
} from "./callShopifyApi";
import { getShopifyPageInfo, type ShopifyPageInfo } from "./shopify-pagination";

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
  forwardResponseHeaders?: boolean;
}

export interface ShopifyPaginatedPage<TItem> {
  items: TItem[];
  pageInfo: ShopifyPageInfo;
}

const MAX_PAGE_SIZE = 250;

export async function callShopifyPaginatedApi<TItem>(
  options: CallShopifyPaginatedApiOptions<TItem>,
): Promise<TItem[]> {
  const items: TItem[] = [];

  for await (const page of iterateShopifyPaginatedApi(options)) {
    items.push(...page.items);
  }

  return items;
}

export async function* iterateShopifyPaginatedApi<TItem>({
  event,
  storeId,
  token,
  path,
  resourceKey,
  params = {},
  missingProxyMessage,
  mapItem = (item) => item as TItem,
  preserveUnsafeIntegers = false,
  forwardResponseHeaders = true,
}: CallShopifyPaginatedApiOptions<TItem>): AsyncGenerator<ShopifyPaginatedPage<TItem>> {
  const visitedCursors = new Set<string>();
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
      forwardResponseHeaders,
    });
    const rawItems = response.data[resourceKey];

    if (!Array.isArray(rawItems)) {
      throw createApiErrorFromMessage(
        `Shopify response is missing the "${resourceKey}" list.`,
        502,
      );
    }

    const pageInfo = getShopifyPageInfo(response.headers);
    yield {
      items: rawItems.map(mapItem),
      pageInfo,
    };

    if (!pageInfo.nextCursor) break;
    if (visitedCursors.has(pageInfo.nextCursor)) {
      throw createApiErrorFromMessage(
        "Shopify returned a repeated pagination cursor.",
        502,
      );
    }

    visitedCursors.add(pageInfo.nextCursor);
    requestParams = {
      page_info: pageInfo.nextCursor,
      limit: MAX_PAGE_SIZE,
    };
  }
}
