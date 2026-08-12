import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { serializeCsvRows } from "../server/utils/csv-serialization.ts";

test("CSV export neutralizes formula triggers in actual serialized cells", () => {
  const triggers = ["=2+2", "+SUM(A1:A2)", "-10+20", "@IMPORTXML(A1)", "\tcmd"];
  const csv = serializeCsvRows(
    triggers.map((value) => ({ value })),
    ["value"],
    true,
  );
  const parsed = Papa.parse<string[]>(csv)
    .data.slice(1)
    .map((row) => row[0]);

  assert.deepEqual(
    parsed,
    triggers.map((value) => `'${value}`),
  );
});
