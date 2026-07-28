import { createError, defineEventHandler, readBody } from "h3";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";

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
    throw createError({
      statusCode: 400,
      statusMessage: "Missing spreadsheetId, range, or values.",
    });
  }

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readwrite);
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: body.values,
      },
    });

    return {
      success: true,
      updatedCells: response.data.updatedCells,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error
          ? error.message
          : "Failed to update data via Google Sheet API.",
    });
  }
});
