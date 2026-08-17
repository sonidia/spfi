export interface ServerSentEvent {
  id: string;
  event: string;
  data: string;
}

export function extractServerSentEvents(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const remainder = blocks.pop() || "";
  const events = blocks
    .map(parseServerSentEvent)
    .filter((event): event is ServerSentEvent => event !== null);
  return { events, remainder };
}

function parseServerSentEvent(block: string): ServerSentEvent | null {
  let id = "";
  let event = "message";
  const data: string[] = [];

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";

    if (field === "id") id = value;
    else if (field === "event") event = value || "message";
    else if (field === "data") data.push(value);
  }

  return data.length ? { id, event, data: data.join("\n") } : null;
}
