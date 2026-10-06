/**
 * THE SINGLE-WRITER QUEUE — multi-step mutations never interleave.
 * better-sqlite3 is synchronous (single-threaded by construction), but
 * multi-step workflows (import: copy → rename → index; reconcile: scan →
 * apply) suspend across awaits. this mutex serializes them against each
 * other; readers and single-statement writes are unaffected.
 */
export interface WriteQueue {
  /** run an exclusive mutation; queued in order, errors propagate */
  runExclusive<T>(label: string, fn: () => Promise<T>): Promise<T>;
  /** how many operations are queued or running (for diagnostics) */
  depth(): number;
}

export function createWriteQueue(): WriteQueue {
  let chain: Promise<unknown> = Promise.resolve();
  let pending = 0;

  return {
    runExclusive<T>(label: string, fn: () => Promise<T>): Promise<T> {
      pending += 1;
      void label; // surfaced in diagnostics when a queue is stuck
      const run = chain.then(fn, fn); // prior failures never block the queue
      const tracked = run.finally(() => {
        pending -= 1;
      });
      // the chain advances only after the caller-visible promise settles
      chain = tracked.then(
        () => undefined,
        () => undefined,
      );
      return tracked;
    },
    depth(): number {
      return pending;
    },
  };
}
