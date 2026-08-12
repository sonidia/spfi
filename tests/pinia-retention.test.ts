import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PINIA_RETENTION_INDEX,
  isPiniaCacheAlive,
  normalizePiniaRetentionIndex,
  PINIA_RETENTION_PRESETS,
} from "../utils/pinia-retention.ts";

test("retention setting defaults to the current browser session", () => {
  assert.equal(
    normalizePiniaRetentionIndex(null),
    DEFAULT_PINIA_RETENTION_INDEX,
  );
  assert.equal(
    PINIA_RETENTION_PRESETS[DEFAULT_PINIA_RETENTION_INDEX]?.key,
    "session",
  );
});

test("retention setting accepts and clamps discrete slider positions", () => {
  assert.equal(normalizePiniaRetentionIndex("4"), 4);
  assert.equal(normalizePiniaRetentionIndex(-5), 0);
  assert.equal(
    normalizePiniaRetentionIndex(100),
    PINIA_RETENTION_PRESETS.length - 1,
  );
  assert.equal(
    normalizePiniaRetentionIndex("not-a-number"),
    DEFAULT_PINIA_RETENTION_INDEX,
  );
});

test("no-cache and finite lifetimes expire at the expected boundary", () => {
  assert.equal(isPiniaCacheAlive(1_000, 0, 1_001), false);
  assert.equal(isPiniaCacheAlive(undefined, 60_000, 10_000), false);
  assert.equal(isPiniaCacheAlive(1_000, 60_000, 60_999), true);
  assert.equal(isPiniaCacheAlive(1_000, 60_000, 61_000), false);
});

test("session retention stays alive until the page refreshes", () => {
  assert.equal(isPiniaCacheAlive(undefined, null, Number.MAX_SAFE_INTEGER), true);
});
