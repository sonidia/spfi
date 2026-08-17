export function settlePromise<T>(
  promise: Promise<T>,
): Promise<PromiseSettledResult<T>> {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason: unknown) => ({ status: "rejected", reason }),
  );
}

export async function mapSettledWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<PromiseSettledResult<TOutput>[]> {
  if (!items.length) return [];

  const results = new Array<PromiseSettledResult<TOutput>>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await settlePromise(
        Promise.resolve().then(() => mapper(items[index] as TInput, index)),
      );
    }
  }

  const normalizedConcurrency = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : 1;
  const workerCount = Math.min(normalizedConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}
