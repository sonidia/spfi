import { defineEventHandler, readBody } from "h3";
import {
  createApiError,
  createApiErrorFromMessage,
} from "../../utils/callShopifyApi";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";

type BatchUpdateBody = {
  spreadsheetId?: string;
  data: {
    range: string;
    values: Array<Array<string | number | boolean | null>>;
  }[];
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<BatchUpdateBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);

  if (!body.data || !Array.isArray(body.data)) {
    throw createApiErrorFromMessage("Missing spreadsheetId or data array.", 400);
  }

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readwrite);
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: body.data,
      },
    });

    return {
      success: true,
      totalUpdatedCells: response.data.totalUpdatedCells,
      totalUpdatedRows: response.data.totalUpdatedRows,
    };
  } catch (error) {
    throw createApiError(
      error,
      "Failed to batch update data via Google Sheet API.",
    );
  }
});
