import assert from "node:assert/strict";
import test from "node:test";
import { resolveMasterSheetTabs } from "../utils/sheetConfig.ts";
import { defaultSheets, parseSheetConfigList } from "../utils/sheets.ts";

test("sheet deployment lists support CSV and JSON array configuration", () => {
  assert.deepEqual(parseSheetConfigList("one, two,one"), ["one", "two"]);
  assert.deepEqual(defaultSheets('["https://sheet/one","https://sheet/two"]'), [
    "https://sheet/one",
    "https://sheet/two",
  ]);
});

test("master tabs prefer deployment config and otherwise use discovery", () => {
  assert.deepEqual(resolveMasterSheetTabs("Configured", ["Discovered"]), [
    "Configured",
  ]);
  assert.deepEqual(resolveMasterSheetTabs("", ["First", "Second", "First"]), [
    "First",
    "Second",
  ]);
});
