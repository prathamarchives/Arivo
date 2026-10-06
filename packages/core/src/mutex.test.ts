/**
 * CONCURRENCY DISCIPLINE (I-29) — the write queue never interleaves
 * multi-step mutations, keeps order under contention, and survives errors.
 */
import { describe, it, expect } from 'vitest';
import { createWriteQueue } from './mutex.ts';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('the single-writer queue', () => {
  it('mutations run one at a time, in submission order', async () => {
    const q = createWriteQueue();
    const events: string[] = [];
    const slow = async (name: string, ticks: number): Promise<string> => {
      for (let i = 0; i < ticks; i++) await tick();
      events.push(name);
      return name;
    };

    const results = await Promise.all([
      q.runExclusive('a', () => slow('a', 3)),
      q.runExclusive('b', () => slow('b', 1)),
      q.runExclusive('c', () => slow('c', 2)),
    ]);
    // a finishes after 3 ticks, b submitted second — but a is ALREADY
    // running when b is queued: order is submission order, not completion
    expect(results).toEqual(['a', 'b', 'c']);
    expect(events).toEqual(['a', 'b', 'c']);
  });

  it('a failed mutation never blocks or corrupts the queue', async () => {
    const q = createWriteQueue();
    const boom = await q
      .runExclusive('boom', async () => {
        await tick();
        throw new Error('disk full');
      })
      .catch((err: Error) => err.message);
    expect(boom).toBe('disk full');
    // the queue keeps working
    const after = await q.runExclusive('after', async () => 'ok');
    expect(after).toBe('ok');
    expect(q.depth()).toBe(0);
  });

  it('100 concurrent mutations all land — zero lost updates', async () => {
    const q = createWriteQueue();
    const landed: number[] = [];
    await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        q.runExclusive(`op-${i}`, async () => {
          await tick();
          landed.push(i);
        }),
      ),
    );
    expect(landed).toHaveLength(100);
    // strictly ordered — no interleaving
    for (let i = 1; i < landed.length; i++) {
      expect(landed[i]!).toBeGreaterThan(landed[i - 1]!);
    }
  });

  it('depth tracks the in-flight + queued work', async () => {
    const q = createWriteQueue();
    expect(q.depth()).toBe(0);
    const a = q.runExclusive('a', async () => {
      await tick();
      return 1;
    });
    const b = q.runExclusive('b', async () => 2);
    expect(q.depth()).toBe(2);
    await Promise.all([a, b]);
    expect(q.depth()).toBe(0);
  });
});
