import { defineEventHandler, readBody, setResponseHeaders, type H3Event } from "h3";
import { createApiErrorFromMessage } from "~~/server/utils/callShopifyApi";
import { iterateShopifyPaginatedApi } from "~~/server/utils/callShopifyPaginatedApi";
import { getCsvExportDefinition } from "~~/server/utils/csv-export";
import { prepareTextDownload } from "~~/server/utils/prepared-download";
import { serializeCsvRows, serializeEmptyCsv } from "~~/server/utils/csv-serialization";

interface CsvExportBody {
  storeId?: string;
  token?: string;
  filters?: Record<string, unknown>;
}

export default defineEventHandler(async (event) => {
  const resource = String(event.context.params?.resource || "").toLowerCase();
  const body = (await readBody<CsvExportBody>(event)) || {};
  const storeId = String(body.storeId || "").trim();
  const token = String(body.token || "").trim();
  if (!storeId || !token) {
    throw createApiErrorFromMessage("Store ID and Access Token are required.", 400);
  }

  const definition = getCsvExportDefinition(resource, body.filters);
  const filename = buildFilename(storeId, resource);
  const prepared = await prepareTextDownload(streamCsv(event, body, definition));

  try {
    setResponseHeaders(event, {
      "content-type": "text/csv; charset=utf-8",
      "content-length": prepared.size,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-spf-export-mode": "prepared",
    });
    return prepared.stream;
  } catch (error) {
    await prepared.dispose();
    throw error;
  }
});

async function* streamCsv(
  event: H3Event,
  body: CsvExportBody,
  definition: ReturnType<typeof getCsvExportDefinition>,
) {
  let hasWrittenHeader = false;
  const pages = iterateShopifyPaginatedApi<Record<string, unknown>>({
    event,
    storeId: String(body.storeId),
    token: String(body.token),
    path: definition.path,
    resourceKey: definition.resourceKey,
    params: definition.params,
    preserveUnsafeIntegers: definition.preserveUnsafeIntegers,
    forwardResponseHeaders: false,
  });

  for await (const page of pages) {
    const rows = page.items.map(definition.mapRow);
    if (!rows.length) continue;

    const csv = serializeCsvRows(rows, definition.columns, !hasWrittenHeader);
    yield `${hasWrittenHeader ? "" : "\uFEFF"}${csv}\r\n`;
    hasWrittenHeader = true;
  }

  if (!hasWrittenHeader) {
    yield `\uFEFF${serializeEmptyCsv(definition.columns)}`;
  }
}

function buildFilename(storeId: string, resource: string) {
  const store = storeId.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "store";
  return `${store}-${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
}
