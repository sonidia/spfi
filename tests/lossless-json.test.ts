import assert from "node:assert/strict";
import test from "node:test";
import {
  parseJsonPreservingUnsafeIntegers,
  quoteUnsafeIntegerLiterals,
} from "../server/utils/lossless-json.ts";

test("lossless JSON parsing preserves unsafe integer identifiers", () => {
  assert.deepEqual(
    parseJsonPreservingUnsafeIntegers(
      '{"safe":9007199254740991,"large":9007199254740993,"negative":-9007199254740993}',
    ),
    {
      safe: Number.MAX_SAFE_INTEGER,
      large: "9007199254740993",
      negative: "-9007199254740993",
    },
  );
});

test("lossless JSON parsing does not rewrite digits inside strings", () => {
  const json =
    '{"text":"escaped \\\"id\\\":9007199254740993","decimal":9007199254740993.5,"exponent":9.007199254740993e15}';
  const parsed = parseJsonPreservingUnsafeIntegers(json) as Record<
    string,
    unknown
  >;

  assert.equal(parsed.text, 'escaped "id":9007199254740993');
  assert.equal(typeof parsed.decimal, "number");
  assert.equal(typeof parsed.exponent, "number");
  assert.equal(
    quoteUnsafeIntegerLiterals(' [ 9007199254740993, "9007199254740993" ] '),
    ' [ "9007199254740993", "9007199254740993" ] ',
  );
});

test("lossless JSON parsing returns non-JSON response bodies unchanged", () => {
  assert.equal(parseJsonPreservingUnsafeIntegers("not json"), "not json");
  assert.equal(parseJsonPreservingUnsafeIntegers(""), "");
});
