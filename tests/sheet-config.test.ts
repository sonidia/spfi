import assert from "node:assert/strict";
import test from "node:test";
import { resolveMasterSheetTabs } from "../utils/sheetConfig.ts";
import { defaultSheets, parseSheetConfigList } from "../utils/sheets.ts";
import {
  normalizeSheetSettings,
  resolveEffectiveSheetSettings,
} from "../utils/sheet-settings.ts";

test("sheet deployment lists support CSV and JSON array configuration", () => {
  assert.deepEqual(parseSheetConfigList("one, two,one"), ["one", "two"]);
  assert.deepEqual(defaultSheets('["https://sheet/one","https://sheet/two"]'), [
    "https://sheet/one",
    "https://sheet/two",
  ]);
  assert.deepEqual(parseSheetConfigList(["Q1, retail", "Q2", "Q1, retail"]), [
    "Q1, retail",
    "Q2",
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

test("browser Sheet settings override deployment IDs and preserve tab commas", () => {
  const deployment = {
    sheetUrls: "deployment-sheet",
    masterSheetUrl: "deployment-master",
    masterSheetTabs: "Deployment tab",
  };
  const local = normalizeSheetSettings({
    sheetUrls: ["viewer-one", "viewer-two"],
    masterSheetUrl: "local-master",
    masterSheetTabs: ["Q1, retail", "Q2"],
  });

  assert.deepEqual(resolveEffectiveSheetSettings(local, deployment, true), local);
  assert.deepEqual(resolveEffectiveSheetSettings(local, deployment, false), {
    sheetUrls: ["deployment-sheet"],
    masterSheetUrl: "deployment-master",
    masterSheetTabs: ["Deployment tab"],
  });
});
