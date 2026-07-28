import { defineEventHandler, readBody } from "h3";
import { createApiError } from "../../utils/callShopifyApi";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
  resolveSheetRange,
} from "../../utils/google-sheet-client";

type SheetBody = {
  spreadsheetId?: string;
  range?: string;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<SheetBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);
  const range = resolveSheetRange(body.range);

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readonly);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return {
      spreadsheetId,
      range,
      values: response.data.values || [],
    };
  } catch (error) {
    throw createApiError(error, "Failed to fetch data from Google Sheet API.");
  }
});
