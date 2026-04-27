import { google } from "googleapis";
import { createError, defineEventHandler, readBody } from "h3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type SheetBody = {
  spreadsheetId?: string;
};

type ServiceAccountFile = {
  client_email?: string;
  private_key?: string;
};

let cachedServiceAccount: ServiceAccountFile | null = null;

async function readServiceAccountFile() {
  if (cachedServiceAccount) return cachedServiceAccount;

  const filePath = join(process.cwd(), "server", "service_account.json");

  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ServiceAccountFile;
    cachedServiceAccount = parsed;
    return parsed;
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.code === "ENOENT"
          ? "Missing service account file at server/service_account.json"
          : "Invalid service account file format in server/service_account.json",
    });
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<SheetBody>(event)) || {};
  const runtimeConfig = useRuntimeConfig(event);

  const spreadsheetId =
    body.spreadsheetId ||
    runtimeConfig.googleSheetSpreadsheetId ||
    runtimeConfig.public.googleSheetSpreadsheetId;

  if (!spreadsheetId) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Missing spreadsheetId. Please configure GOOGLE_SHEET_SPREADSHEET_ID.",
    });
  }

  const serviceAccount = await readServiceAccountFile();
  const clientEmail = String(serviceAccount.client_email || "");
  const privateKey = String(serviceAccount.private_key || "").replace(
    /\\n/g,
    "\n",
  );

  if (!clientEmail || !privateKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Missing client_email/private_key in server/service_account.json",
    });
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
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
