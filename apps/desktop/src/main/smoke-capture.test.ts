import { describe, it, expect } from 'vitest';
import { captureWithWake, type CaptureSurface } from './smoke-capture.ts';

/* the CI failure that made this module: five red packaged-smoke runs where
 * capturePage rejected on runners (software GL, setuid sandbox, no
 * BeginFrame yet), the catch swallowed the error, and the artifact step
 * failed the job. the law: capture must wake + retry, surface the real
 * error, and never treat an empty frame as success. */

interface FakeImage {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
}

const realImage = (w = 1440, h = 900): FakeImage => ({
  isEmpty: () => false,
  getSize: () => ({ width: w, height: h }),
});

const emptyImage = (): FakeImage => ({
  isEmpty: () => true,
  getSize: () => ({ width: 0, height: 0 }),
});

function makeSurface(script: (call: number) => FakeImage | Error) {
  let calls = 0;
  const wakes: string[] = [];
  const wc: CaptureSurface = {
    capturePage: async () => {
      calls += 1;
      const r = script(calls);
      if (r instanceof Error) throw r;
      return r as unknown as Electron.NativeImage;
    },
    executeJavaScript: async (code: string) => {
      wakes.push(code);
      return true;
    },
  };
  return { wc, wakes, calls: () => calls };
}

describe('captureWithWake', () => {
  it('succeeds first try when the compositor already has a frame', async () => {
    const s = makeSurface(() => realImage());
    const res = await captureWithWake(s.wc, { wakeMs: 1 });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(1);
    expect(s.calls()).toBe(1);
    expect(s.wakes).toHaveLength(0);
  });

  it('retries a rejected capturePage and succeeds after a wake (the CI shape)', async () => {
    const s = makeSurface((n) => (n < 3 ? new Error('widget not composited') : realImage()));
    const res = await captureWithWake(s.wc, { wakeMs: 1 });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(3);
    // each retry woke the window first — input forces the BeginFrame
    expect(s.wakes).toHaveLength(2);
    expect(s.wakes[0]).toContain('mousemove');
  });

  it('treats an empty frame as not-yet-rendered and retries (0x0 guard)', async () => {
    const s = makeSurface((n) => (n === 1 ? emptyImage() : realImage()));
    const res = await captureWithWake(s.wc, { wakeMs: 1 });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(2);
  });

  it('gives up after the bounded attempts and surfaces the real error', async () => {
    const s = makeSurface(() => new Error('Object has been destroyed'));
    const res = await captureWithWake(s.wc, { attempts: 3, wakeMs: 1 });
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(3);
    expect(res.lastError).toBe('Object has been destroyed');
  });

  it('survives a wake failure (window torn down mid-retry) and keeps trying', async () => {
    const s = makeSurface((n) => (n < 2 ? new Error('no frame') : realImage()));
    const wc: CaptureSurface = {
      capturePage: s.wc.capturePage,
      executeJavaScript: async () => {
        throw new Error('window gone');
      },
    };
    const res = await captureWithWake(wc, { wakeMs: 1 });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(2);
  });
});
