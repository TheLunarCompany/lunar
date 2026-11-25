/**
 * Runs `fn` over `items` with at most `limit` calls in flight, and answers the
 * results in the items' order.
 *
 * Each worker takes the next item as soon as its current call settles, so a
 * slow call holds one slot, not a whole batch. If a call rejects, the returned
 * promise rejects with that error; calls already running still finish.
 */
export async function runCapped<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit must be a positive integer, got ${limit}`);
  }
  const results: R[] = new Array<R>(items.length);
  // One iterator shared by every worker: each takes the next item when it's free.
  const queue = items.entries();
  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) {
      results[index] = await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
