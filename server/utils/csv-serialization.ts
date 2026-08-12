import Papa from "papaparse";

export function serializeCsvRows(
  rows: Record<string, unknown>[],
  columns: string[],
  includeHeader: boolean,
) {
  return Papa.unparse(rows, {
    columns,
    header: includeHeader,
    newline: "\r\n",
    // Prefix spreadsheet formula triggers with an apostrophe. Quoting alone
    // does not stop Excel or Google Sheets from evaluating cell contents.
    escapeFormulae: true,
  });
}

export function serializeEmptyCsv(columns: string[]) {
  return Papa.unparse({ fields: columns, data: [] }, { newline: "\r\n" });
}
