/**
 * auto-update — the delivery loop for releases.
 *
 * the contract (see docs/RELEASE-AND-UPDATES.md):
 * - only packaged builds check; dev never phones home
 * - the check is one GET against github releases; no user data leaves
 * - offline, rate-limited, or a broken feed is a silent no-op, never a crash
 * - ARIVO_NO_UPDATE=1 is the kill switch
 *
 * invariant I-34: update checks can never block, break, or wake the app.
 */
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let started = false;

function checkOnce(): void {
  // errors land in the 'error' handler below; the returned promise is
  // belt-and-braces — a rejected promise must never surface to the user
  void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

export function startUpdateChecks(): void {
  if (started) return;
  if (!app.isPackaged) return;
  if (process.env['ARIVO_NO_UPDATE'] === '1') return;
  started = true;

  // null logger: the updater is chatty and its output is not actionable
  // in a packaged desktop app
  autoUpdater.logger = null;

  // offline / 404 / parse failures — all benign, all silent
  autoUpdater.on('error', () => {});

  checkOnce();

  const timer = setInterval(checkOnce, RECHECK_INTERVAL_MS);
  // the recheck timer must never keep the process alive on quit
  if (typeof timer.unref === 'function') timer.unref();
}
