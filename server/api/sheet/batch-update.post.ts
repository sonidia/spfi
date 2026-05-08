import { google } from "googleapis";
import { createError, defineEventHandler, readBody } from "h3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type BatchUpdateBody = {
  spreadsheetId?: string;
  data: {
    range: string;
    values: any[][];
  }[];
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
  const body = (await readBody<BatchUpdateBody>(event)) || {};
  const runtimeConfig = useRuntimeConfig(event);

  const spreadsheetId =
    body.spreadsheetId ||
    runtimeConfig.googleSheetSpreadsheetId ||
    runtimeConfig.public.googleSheetSpreadsheetId;

  if (!spreadsheetId || !body.data || !Array.isArray(body.data)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing spreadsheetId or data array.",
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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
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
