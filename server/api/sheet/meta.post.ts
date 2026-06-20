import { createError, defineEventHandler, readBody } from "h3";
import {
  createGoogleSheetsClient,
  GOOGLE_SHEET_SCOPES,
  requireSpreadsheetId,
} from "../../utils/google-sheet-client";

type SheetBody = {
  spreadsheetId?: string;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody<SheetBody>(event)) || {};
  const spreadsheetId = requireSpreadsheetId(body.spreadsheetId);

  try {
    const sheets = await createGoogleSheetsClient(GOOGLE_SHEET_SCOPES.readonly);
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    const spreadsheetTitle = response.data.properties?.title || spreadsheetId;
    const sheetTitles = (response.data.sheets || [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title));

    return {
      spreadsheetId,
      title: spreadsheetTitle,
      sheets: sheetTitles,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.message ||
        "Failed to fetch spreadsheet metadata from Google Sheets API.",
    });
  }
});
