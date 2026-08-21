import assert from "node:assert/strict";
import test from "node:test";
import { extractServerSentEvents } from "../utils/sse.ts";

test("SSE parser preserves incomplete chunks and extracts named events", () => {
  const first = extractServerSentEvents(
    'event: connected\r\ndata: {"stores":2}\r\n\r\nid: delivery-1\r\nevent: notification\r\ndata: {"id":',
  );
  assert.deepEqual(first.events, [
    { id: "", event: "connected", data: '{"stores":2}' },
  ]);

  const second = extractServerSentEvents(`${first.remainder}"delivery-1"}\r\n\r\n`);
  assert.deepEqual(second.events, [
    {
      id: "delivery-1",
      event: "notification",
      data: '{"id":"delivery-1"}',
    },
  ]);
  assert.equal(second.remainder, "");
});
