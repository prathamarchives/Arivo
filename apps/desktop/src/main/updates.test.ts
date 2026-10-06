/**
 * I-34 — the update check can never phone home from dev, never crash the
 * app, never keep the process alive, and always respects the kill switch.
 * electron + electron-updater are mocked because the contract under test is
 * the gating logic, not the network (the feed itself is proven by
 * scripts/verify-update-feed.mjs against the live release).
 *
 * state lives in vi.hoisted so module-registry resets (fresh imports per
 * test) re-read the same mutable truth instead of snapshotting a stale copy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  isPackaged: true,
  on: vi.fn(),
  checkForUpdatesAndNotify: vi.fn((): Promise<unknown> => Promise.resolve({})),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged(): boolean {
      return state.isPackaged;
    },
    getVersion: (): string => '0.2.1-test',
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    on: state.on,
    checkForUpdatesAndNotify: state.checkForUpdatesAndNotify,
  },
}));

const freshModule = async (): Promise<typeof import('./updates.ts')> => {
  vi.resetModules();
  return import('./updates.ts');
};

describe('startUpdateChecks gating (I-34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.isPackaged = true;
    state.on.mockClear();
    state.checkForUpdatesAndNotify.mockClear();
    state.checkForUpdatesAndNotify.mockImplementation(() => Promise.resolve({}));
    delete process.env['ARIVO_NO_UPDATE'];
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env['ARIVO_NO_UPDATE'];
  });

  it('packaged build: checks once immediately, again on the interval', async () => {
    const mod = await freshModule();
    mod.startUpdateChecks();
    expect(state.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
    expect(state.on).toHaveBeenCalledWith('error', expect.any(Function));
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(state.checkForUpdatesAndNotify).toHaveBeenCalledTimes(2);
  });

  it('dev build: never checks', async () => {
    state.isPackaged = false;
    const mod = await freshModule();
    mod.startUpdateChecks();
    expect(state.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it('kill switch ARIVO_NO_UPDATE=1: never checks', async () => {
    process.env['ARIVO_NO_UPDATE'] = '1';
    const mod = await freshModule();
    mod.startUpdateChecks();
    expect(state.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it('double start is idempotent — one check, one interval', async () => {
    const mod = await freshModule();
    mod.startUpdateChecks();
    mod.startUpdateChecks();
    expect(state.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it('a rejected check never surfaces (offline, broken feed)', async () => {
    state.checkForUpdatesAndNotify.mockImplementationOnce(() =>
      Promise.reject(new Error('network unreachable')),
    );
    const mod = await freshModule();
    mod.startUpdateChecks();
    // the swallowed rejection settles without an unhandled rejection
    await vi.advanceTimersByTimeAsync(0);
    expect(state.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });
});
