import assert from "node:assert/strict";
import test from "node:test";
import { prepareTextDownload } from "../server/utils/prepared-download.ts";

test("prepared downloads finish generation before exposing a stream", async () => {
  const prepared = await prepareTextDownload(chunks("first", "second"));
  let output = "";
  for await (const chunk of prepared.stream) output += chunk.toString();

  assert.equal(output, "firstsecond");
  assert.equal(prepared.size, Buffer.byteLength(output));
});

test("prepared downloads surface generation failures before returning", async () => {
  await assert.rejects(
    prepareTextDownload(
      (async function* () {
        yield "partial";
        throw new Error("upstream page failed");
      })(),
    ),
    /upstream page failed/i,
  );
});

async function* chunks(...values: string[]) {
  yield* values;
}
