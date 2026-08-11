import { defineEventHandler, readBody } from "h3";
import { createApiError, createApiErrorFromMessage } from "../../utils/callShopifyApi";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";
import { GOOGLE_SHEET_VALUE_INPUT_OPTION } from "../../utils/google-sheet-values";

type SheetBody = {
  spreadsheetId?: string;
  range: string;
  values: Array<Array<string | number | boolean | null>>;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<SheetBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);
  const range = body.range;

  if (!range || !body.values) {
    throw createApiErrorFromMessage("Missing spreadsheetId, range, or values.", 400);
  }

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readwrite);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: GOOGLE_SHEET_VALUE_INPUT_OPTION,
      requestBody: {
        values: body.values,
      },
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
    };
  } catch (error) {
    throw createApiError(error, "Failed to update data via Google Sheet API.");
  }
});
