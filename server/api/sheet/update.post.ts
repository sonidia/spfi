import { google } from "googleapis";
import { createError, defineEventHandler, readBody } from "h3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type SheetBody = {
  spreadsheetId?: string;
  range: string;
  values: any[][];
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
  const range = body.range;

  if (!spreadsheetId || !range || !body.values) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing spreadsheetId, range, or values.",
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
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.message || "Failed to update data via Google Sheet API.",
    });
  }
});
