import { createReadStream, type ReadStream } from "node:fs";
import { mkdtemp, open, rm, stat, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PreparedDownload {
  stream: ReadStream;
  size: number;
  dispose: () => Promise<void>;
}

export async function prepareTextDownload(
  chunks: AsyncIterable<string>,
): Promise<PreparedDownload> {
  const directory = await mkdtemp(join(tmpdir(), "spf-download-"));
  const filePath = join(directory, "payload");
  let handle: FileHandle | null = null;

  try {
    handle = await open(filePath, "wx");
    for await (const chunk of chunks) {
      await handle.write(chunk, undefined, "utf8");
    }
    await handle.close();
    handle = null;

    const { size } = await stat(filePath);
    const stream = createReadStream(filePath);
    let disposed = false;
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    };
    stream.once("close", () => void dispose());

    return { stream, size, dispose };
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
