import assert from "node:assert/strict";
import test from "node:test";
import {
  parseJsonPreservingUnsafeIntegers,
  quoteUnsafeIntegerLiterals,
  stringifyJsonPreservingIntegerIds,
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
  const parsed = parseJsonPreservingUnsafeIntegers(json) as Record<string, unknown>;

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

test("Shopify request serialization keeps 64-bit IDs exact on the wire", () => {
  assert.equal(
    stringifyJsonPreservingIntegerIds({
      id: "9007199254740993",
      line_item_id: "9007199254740995",
      variant_ids: ["9007199254740997", "42"],
      note: "9007199254740999",
    }),
    '{"id":9007199254740993,"line_item_id":9007199254740995,"variant_ids":[9007199254740997,42],"note":"9007199254740999"}',
  );
});

test("Shopify request serialization cannot replace marker-like user content", () => {
  assert.equal(
    stringifyJsonPreservingIntegerIds({
      id: "9007199254740993",
      note: "__SPF_EXACT_INTEGER_ID__0__",
    }),
    '{"id":9007199254740993,"note":"__SPF_EXACT_INTEGER_ID__0__"}',
  );
});
