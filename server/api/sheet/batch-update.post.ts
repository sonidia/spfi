import { createError, defineEventHandler, readBody } from "h3";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";

type BatchUpdateBody = {
  spreadsheetId?: string;
  data: {
    range: string;
    values: any[][];
  }[];
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<BatchUpdateBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);

  if (!body.data || !Array.isArray(body.data)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing spreadsheetId or data array.",
    });
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
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.message || "Failed to batch update data via Google Sheet API.",
    });
  }
});
