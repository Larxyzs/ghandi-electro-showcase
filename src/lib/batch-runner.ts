/**
 * Bounded-concurrency batch runner with per-item failure isolation.
 * Pure and dependency-free so it can be unit tested: one item throwing never
 * cancels the others, and progress is reported item by item.
 */
export type IsolatedOutcome<T> =
  | { index: number; ok: true; value: T }
  | { index: number; ok: false; error: string };

export async function runIsolated<I, T>(
  items: I[],
  worker: (item: I, index: number) => Promise<T>,
  options: {
    concurrency?: number;
    signal?: AbortSignal;
    onSettled?: (outcome: IsolatedOutcome<T>, processed: number, total: number) => void | Promise<void>;
  } = {},
): Promise<IsolatedOutcome<T>[]> {
  const total = items.length;
  const results: IsolatedOutcome<T>[] = new Array(total);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 12));
  let cursor = 0;
  let processed = 0;

  const run = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;
      if (options.signal?.aborted) return;
      let outcome: IsolatedOutcome<T>;
      try {
        outcome = { index, ok: true, value: await worker(items[index]!, index) };
      } catch (error) {
        outcome = { index, ok: false, error: error instanceof Error ? error.message : "FAILED" };
      }
      results[index] = outcome;
      processed += 1;
      try {
        await options.onSettled?.(outcome, processed, total);
      } catch {
        /* reporting must never break the batch */
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, run));
  return results.filter(Boolean);
}
