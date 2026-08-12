import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  callShopifyApiWithResponse,
  resolveStoreCookieData,
  toStandardApiError,
} from "~~/server/utils/callShopifyApi";

type TestEvent = {
  cookies: Record<string, string>;
  node: { req: { headers: Record<string, string> } };
  responseHeaders: Record<string, string>;
};

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: {
    request: requestMock,
    isAxiosError: (error: unknown) =>
      Boolean(error && typeof error === "object" && "isAxiosError" in error),
  },
}));

vi.mock("#imports", () => ({
  useRuntimeConfig: () => ({
    adminApiVersion: "2026-07",
    allowPrivateProxyHosts: false,
  }),
}));

vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  getCookie: (event: TestEvent, key: string) => event.cookies[key],
  parseCookies: (event: TestEvent) => event.cookies,
  setResponseHeader: (event: TestEvent, name: string, value: unknown) => {
    event.responseHeaders[name.toLowerCase()] = String(value);
  },
}));

vi.mock("socks-proxy-agent", () => ({
  SocksProxyAgent: class {
    proxyUrl: string;
    shouldLookup = false;

    constructor(proxyUrl: string) {
      this.proxyUrl = proxyUrl;
    }
  },
}));

vi.mock("~~/server/utils/public-proxy", () => ({
  resolvePublicProxyUrls: (urls: string[]) => Promise.resolve(urls),
}));

function createEvent(
  cookieData: Record<string, unknown>,
  headerData?: Record<string, unknown>,
): TestEvent {
  return {
    cookies: { shop: JSON.stringify(cookieData) },
    node: {
      req: {
        headers: headerData ? { "x-store-data": JSON.stringify(headerData) } : {},
      },
    },
    responseHeaders: {},
  };
}

function axiosError(input: Record<string, unknown>) {
  return { isAxiosError: true, message: "Axios request failed", ...input };
}

describe("callShopifyApi request resolution", () => {
  beforeEach(() => requestMock.mockReset());

  it("merges request metadata without allowing headers to smuggle secrets", () => {
    const event = createEvent(
      {
        domain: "shop.myshopify.com",
        sock: "8.8.8.8:1080",
        accessToken: "persisted-token",
        clientSecret: "persisted-secret",
      },
      {
        domain: "https://shop.myshopify.com/path",
        sock: "1.1.1.1:1080",
        accessToken: "injected-token",
        clientSecret: "injected-secret",
      },
    );

    expect(resolveStoreCookieData(event as never, "shop")).toMatchObject({
      domain: "shop.myshopify.com",
      sock: "1.1.1.1:1080",
      accessToken: "persisted-token",
      clientSecret: "persisted-secret",
    });
  });

  it("retries a GET transport failure on the next validated proxy variant", async () => {
    requestMock
      .mockRejectedValueOnce(axiosError({ code: "ECONNRESET" }))
      .mockResolvedValueOnce({
        data: { shop: { id: "1" } },
        status: 200,
        headers: {
          "x-shopify-shop-api-call-limit": "1/40",
          "x-shopify-api-version": "2026-07",
        },
      });
    const event = createEvent({
      domain: "shop.myshopify.com",
      sock: "8.8.8.8:1080:user:p@ss",
      accessToken: "token",
    });

    await expect(
      callShopifyApiWithResponse({
        event: event as never,
        storeId: "shop",
        path: "/shop.json",
      }),
    ).resolves.toMatchObject({ data: { shop: { id: "1" } }, status: 200 });
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(event.responseHeaders["x-shopify-api-version"]).toBe("2026-07");
  });

  it("retries a Shopify 429 only when Retry-After supplies a bounded window", async () => {
    requestMock
      .mockRejectedValueOnce(
        axiosError({
          response: { status: 429, headers: { "retry-after": "0" }, data: {} },
        }),
      )
      .mockResolvedValueOnce({ data: { orders: [] }, status: 200, headers: {} });
    const event = createEvent({
      domain: "shop.myshopify.com",
      sock: "8.8.8.8:1080",
      accessToken: "token",
    });

    await expect(
      callShopifyApiWithResponse({
        event: event as never,
        storeId: "shop",
        path: "/orders.json",
      }),
    ).resolves.toMatchObject({ data: { orders: [] } });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it("maps Shopify response status, code, message and details consistently", () => {
    expect(
      toStandardApiError(
        axiosError({
          code: "ERR_BAD_REQUEST",
          response: { status: 422, data: { errors: { email: ["is invalid"] } } },
        }),
      ),
    ).toEqual({
      success: false,
      error: {
        status: 422,
        code: "ERR_BAD_REQUEST",
        message: '{"email":["is invalid"]}',
        details: { errors: { email: ["is invalid"] } },
      },
    });
  });
});
