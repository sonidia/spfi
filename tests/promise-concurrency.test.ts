import assert from "node:assert/strict";
import test from "node:test";
import { mapSettledWithConcurrency } from "../utils/promise-concurrency.ts";

test("settled concurrency preserves order and caps active work", async () => {
  let active = 0;
  let maximumActive = 0;
  const results = await mapSettledWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await Promise.resolve();
    active -= 1;
    if (value === 3) throw new Error("expected failure");
    return value * 10;
  });

  assert.equal(maximumActive, 2);
  assert.deepEqual(
    results.map((result) =>
      result.status === "fulfilled" ? result.value : result.reason.message,
    ),
    [10, 20, "expected failure", 40],
  );
});

test("settled concurrency captures synchronous mapper failures", async () => {
  const results = await mapSettledWithConcurrency([1], 1, () => {
    throw new Error("synchronous failure");
  });

  assert.equal(results[0]?.status, "rejected");
  assert.equal(
    results[0]?.status === "rejected" ? results[0].reason.message : "",
    "synchronous failure",
  );
});
