import { beforeEach, describe, expect, it, vi } from "vitest";
import checkProxyHandler from "~~/server/api/check-proxy.post";
import generateTokenHandler from "~~/server/api/generate-token.post";
import marketAllHandler from "~~/server/api/market/all.post";
import marketAssignmentsHandler from "~~/server/api/market/assignments.post";
import marketContextHandler from "~~/server/api/market/context.post";
import marketConditionsHandler from "~~/server/api/market/conditions.post";
import marketCreateHandler from "~~/server/api/market/create.post";
import marketIdentityHandler from "~~/server/api/market/identity.post";
import marketLocalizationReadHandler from "~~/server/api/market/localization/read.post";
import marketLocalizationSaveHandler from "~~/server/api/market/localization/save.post";
import marketPricingHandler from "~~/server/api/market/pricing.post";
import marketRegionsHandler from "~~/server/api/market/regions.post";
import marketResolveHandler from "~~/server/api/market/resolve.post";
import marketShippingHandler from "~~/server/api/market/shipping.post";
import marketStatusHandler from "~~/server/api/market/status.post";
import marketWebPresenceCreateHandler from "~~/server/api/market/web-presence/create.post";
import marketWebPresenceDeleteHandler from "~~/server/api/market/web-presence/delete.post";
import marketWebPresenceUpdateHandler from "~~/server/api/market/web-presence/update.post";
import batchUpdateHandler from "~~/server/api/sheet/batch-update.post";
import metaHandler from "~~/server/api/sheet/meta.post";
import updateHandler from "~~/server/api/sheet/update.post";
import valuesHandler from "~~/server/api/sheet/values.post";
import statusHandler from "~~/server/api/status/check.post";
import tracktacoHandler from "~~/server/api/tracktaco/get-trackingnr.post";

type RouteEvent = { body?: unknown; context?: Record<string, unknown> };

vi.hoisted(() => {
  Object.assign(globalThis, { $fetch: vi.fn() });
});

vi.mock("h3", () => ({
  createError: (input: Record<string, unknown>) => Object.assign(new Error(), input),
  defineEventHandler: <T>(handler: T) => handler,
  readBody: (event: RouteEvent) => Promise.resolve(event.body),
}));

vi.mock("#imports", () => ({
  useRuntimeConfig: () => ({ allowPrivateProxyHosts: false }),
}));

const sheetClient = vi.hoisted(() => ({
  spreadsheets: {
    get: vi.fn(),
    values: {
      get: vi.fn(),
      update: vi.fn(),
      batchUpdate: vi.fn(),
    },
  },
}));

vi.mock("~~/server/utils/google-sheet-client", () => ({
  GOOGLE_SHEET_SCOPES: { readonly: ["readonly"], readwrite: ["readwrite"] },
  createGoogleSheetsClient: vi.fn(() => sheetClient),
  requireSpreadsheetId: (value?: string) => {
    if (!String(value || "").trim()) {
      throw Object.assign(new Error("Missing spreadsheetId."), { statusCode: 400 });
    }
    return String(value).trim();
  },
  resolveSheetRange: (value?: string) => String(value || "A:Z").trim() || "A:Z",
}));

describe("Google Sheet routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing spreadsheet IDs at the route boundary", async () => {
    await expect(valuesHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(metaHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("reads values with the safe default range", async () => {
    sheetClient.spreadsheets.values.get.mockResolvedValueOnce({
      data: { values: [["name"], ["Spfi"]] },
    });

    await expect(
      valuesHandler({ body: { spreadsheetId: "sheet-1" } } as never),
    ).resolves.toEqual({
      spreadsheetId: "sheet-1",
      range: "A:Z",
      values: [["name"], ["Spfi"]],
    });
    expect(sheetClient.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: "sheet-1",
      range: "A:Z",
    });
  });

  it("maps metadata and writes values using RAW input", async () => {
    sheetClient.spreadsheets.get.mockResolvedValueOnce({
      data: {
        properties: { title: "Stores" },
        sheets: [{ properties: { title: "Q1" } }, { properties: {} }],
      },
    });
    await expect(
      metaHandler({ body: { spreadsheetId: "sheet-1" } } as never),
    ).resolves.toMatchObject({ title: "Stores", sheets: ["Q1"] });

    sheetClient.spreadsheets.values.update.mockResolvedValueOnce({
      data: { updatedCells: 2 },
    });
    await expect(
      updateHandler({
        body: { spreadsheetId: "sheet-1", range: "Q1!A1", values: [["=2+2"]] },
      } as never),
    ).resolves.toEqual({ success: true, updatedCells: 2 });
    expect(sheetClient.spreadsheets.values.update).toHaveBeenCalledWith(
      expect.objectContaining({ valueInputOption: "RAW" }),
    );
  });

  it("validates and forwards batch updates", async () => {
    await expect(
      batchUpdateHandler({ body: { spreadsheetId: "sheet-1" } } as never),
    ).rejects.toMatchObject({ statusCode: 400 });

    sheetClient.spreadsheets.values.batchUpdate.mockResolvedValueOnce({
      data: { totalUpdatedCells: 2, totalUpdatedRows: 1 },
    });
    await expect(
      batchUpdateHandler({
        body: {
          spreadsheetId: "sheet-1",
          data: [{ range: "Q1!A1:B1", values: [["a", "b"]] }],
        },
      } as never),
    ).resolves.toEqual({ success: true, totalUpdatedCells: 2, totalUpdatedRows: 1 });
  });
});

describe("diagnostic and credential routes", () => {
  beforeEach(() => vi.mocked(globalThis.$fetch).mockReset());

  it("validates status, token, proxy and Tracktaco requests before I/O", async () => {
    await expect(statusHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(generateTokenHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(marketAllHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(marketResolveHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(marketStatusHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    for (const marketHandler of [
      marketAssignmentsHandler,
      marketContextHandler,
      marketConditionsHandler,
      marketCreateHandler,
      marketIdentityHandler,
      marketLocalizationReadHandler,
      marketLocalizationSaveHandler,
      marketPricingHandler,
      marketRegionsHandler,
      marketShippingHandler,
      marketWebPresenceCreateHandler,
      marketWebPresenceDeleteHandler,
      marketWebPresenceUpdateHandler,
    ]) {
      await expect(marketHandler({ body: {} } as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    await expect(checkProxyHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(tracktacoHandler({ body: {} } as never)).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      tracktacoHandler({ body: { provider: { apiKey: "bad\nkey" } } } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("searches then reveals a Tracktaco candidate without exposing it in the response", async () => {
    vi.mocked(globalThis.$fetch)
      .mockResolvedValueOnce({
        searches: [
          { results: [{ tn_id: "tn-1", carrier: "fedex", service: "ground" }] },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          {
            tn_id: "tn-1",
            outcome: "revealed",
            tracking_number: "871512246087",
            carrier: "fedex",
            service: "ground",
          },
        ],
        credits_remaining: 4,
      });

    await expect(
      tracktacoHandler({
        body: {
          provider: { apiKey: "tt_test_secret" },
          carrier: "fedex",
          destination: { country: "US", state: "TX", city: "Austin" },
          shippedBetween: { from: "2026-08-05", to: "2026-08-12" },
        },
      } as never),
    ).resolves.toEqual({
      trackingNumber: "871512246087",
      carrier: "fedex",
      service: "ground",
      creditsRemaining: 4,
    });
    expect(globalThis.$fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/v2/tns/search"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer tt_test_secret" }),
        redirect: "error",
      }),
    );
  });
});
