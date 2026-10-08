import type { WebContents } from 'electron';

/** minimal surface the capture needs — the real WebContents satisfies it,
 * tests pass a fake. keeps the module unit-testable without electron. */
export interface CaptureSurface {
  capturePage(): Promise<Electron.NativeImage>;
  executeJavaScript(code: string): Promise<unknown>;
}

export interface CaptureResult {
  ok: boolean;
  image?: Electron.NativeImage;
  attempts: number;
  lastError: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * capture a page from a window that may not have composited yet.
 *
 * the mechanism (learned twice, now law): under xvfb / headless runners a
 * hidden or freshly-loaded window composites ON DEMAND — input events
 * force BeginFrames, and `capturePage` rejects or yields an empty image
 * until the first frame exists. CI runners with software GL and the setuid
 * sandbox can take longer than any fixed beat to produce that frame, so
 * the honest strategy is: try, wake, retry — bounded, with the real error
 * surfaced instead of swallowed.
 */
export async function captureWithWake(
  wc: CaptureSurface,
  opts: { attempts?: number; wakeMs?: number } = {},
): Promise<CaptureResult> {
  const attempts = opts.attempts ?? 6;
  const wakeMs = opts.wakeMs ?? 800;
  let lastError: string | null = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const image = await wc.capturePage();
      // an empty native image (0x0) means no frame yet — same treatment
      // as a rejection: wake and retry
      if (!image.isEmpty() && image.getSize().width > 0) {
        return { ok: true, image, attempts: i + 1, lastError };
      }
      lastError = 'empty frame';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (i === attempts - 1) break;
    // the wake: synthetic pointer input forces a BeginFrame on a window
    // nobody is pointing at (best-effort — the surface may be torn down)
    try {
      await wc.executeJavaScript(
        `window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 24 })); true;`,
      );
    } catch {
      /* best-effort */
    }
    await sleep(wakeMs);
  }
  return { ok: false, attempts, lastError };
}

/** typed for index.ts's use — the WebContents structurally satisfies CaptureSurface. */
export function asCaptureSurface(wc: WebContents): CaptureSurface {
  return wc as unknown as CaptureSurface;
}
