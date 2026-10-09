/**
 * arivo main — the shell. the renderer can't touch the filesystem;
 * everything goes through the command surface. the epub is untrusted input.
 */
import { app, BrowserWindow, protocol, Menu } from 'electron';

import path from 'node:path';
import fs from 'node:fs';
import { createServices, type Services } from './services/index.ts';
import { registerIpc } from './ipc.ts';
import { startUpdateChecks } from './updates.ts';
import { captureWithWake, asCaptureSurface } from './smoke-capture.ts';

let mainWindow: BrowserWindow | null = null;
let services: Services | null = null;

const isSmoke = process.argv.includes('--smoke');
const isRebuild = process.argv.includes('--rebuild-index');
const isLab = process.argv.includes('--lab');
const isReaderShot = process.argv.includes('--reader');

// the arivo:// protocol must be privileged before ready (fetch + img + stream)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'arivo',
    // The renderer loads over app:// and fetches book bytes from arivo://.
    // Keep the custom scheme secure and explicitly CORS-capable.
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
  {
    // the built renderer loads over app:// — file:// blocks module scripts (CORS)
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

const rendererDevUrl = process.env['ELECTRON_RENDERER_URL'];
const allowedRendererOrigins = new Set<string>(['app://arivo']);

if (rendererDevUrl) {
  try {
    allowedRendererOrigins.add(new URL(rendererDevUrl).origin);
  } catch {
    // Ignore an invalid development renderer URL; packaged builds still use app://arivo.
  }
}

/**
 * electron's protocol Request carries `initiatorOrigin` at runtime — an
 * extension beyond the DOM lib type. read it through a typed lens.
 */
interface ElectronProtocolRequest extends Request {
  initiatorOrigin?: string;
}

function corsHeadersFor(request: Request): Record<string, string> {
  const origin = (request as ElectronProtocolRequest).initiatorOrigin;
  if (!origin || !allowedRendererOrigins.has(origin)) return {};

  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  };
}

function seedDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'public', 'seed')
    : path.join(__dirname, '..', '..', 'public', 'seed');
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: isSmoke ? 1440 : 1280,
    height: isSmoke ? 900 : 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#f4eee2',
    title: 'Arivo',
    /* v0.3.2 — the a. monogram speaks in dev too (packaged builds carry
     * it inside the exe via electron-builder) */
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    show: !isSmoke,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);
  win.removeMenu();

  /* SECURITY (final campaign): defense in depth for navigation. the
   * renderer has no external-link surface of its own, but a book's
   * content or a future regression must never earn a new window or a
   * navigation away from the app's own origin — both are denied at
   * the process level, and external openings would go nowhere. */
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('devtools://');
    if (!allowed) event.preventDefault();
  });

  // wire the smoke capture BEFORE loading — did-finish-load fires during
  // the await below, and a late listener never sees it
  if (isSmoke) {
    let exited = false;
    const exitWith = (code: number): void => {
      if (exited) return;
      exited = true;
      app.exit(code);
    };
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        // tri-state: false = probe failed, true = probe passed,
        // null = no book in library (probe not applicable). an empty
        // library on a fresh machine must not fail the launch gate —
        // the probe's regression coverage runs wherever a book exists.
        let fetchOk: boolean | null = null;
        try {
          if (isLab) {
            // the design lab is taller than the viewport: capture the
            // page section by section (scroll + shoot) so the whole
            // specimen record lands as smoke-lab-*.png
            const scrollHeight = (await win.webContents.executeJavaScript(
              `(() => {
                const scroller = document.querySelector('.lab');
                return scroller ? scroller.scrollHeight : Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
              })()`,
            )) as number;
            const view = win.getContentSize()[1] ?? 900;
            const step = Math.max(400, view - 40);
            let i = 0;
            for (let y = 0; y < scrollHeight; y += step, i += 1) {
              await win.webContents.executeJavaScript(
                `(() => {
                  const scroller = document.querySelector('.lab');
                  if (scroller) { scroller.scrollTop = ${y}; } else { window.scrollTo(0, ${y}); }
                })()`,
              );
              await new Promise((r) => setTimeout(r, 250));
              const image = await win.webContents.capturePage();
              const out = path.resolve(process.cwd(), `smoke-lab-${i}.png`);
              fs.writeFileSync(out, image.toPNG());
              console.warn(`[arivo] lab section capture → ${out}`);
            }
          } else {
            // the plain capture rides captureWithWake: under headless xvfb
            // a window composites on demand, and CI runners (software GL +
            // setuid sandbox) can miss the first BeginFrame — the wake +
            // retry loop is the difference between smoke.png and a red job
            // (five red CIs, diagnosed in the final campaign)
            const res = await captureWithWake(asCaptureSurface(win.webContents));
            if (res.ok && res.image) {
              const out = path.resolve(process.cwd(), 'smoke.png');
              fs.writeFileSync(out, res.image.toPNG());
              console.warn(`[arivo] smoke screenshot → ${out} (${res.attempts} attempt${res.attempts === 1 ? '' : 's'})`);
            } else {
              console.warn(`[arivo] smoke capture failed after ${res.attempts} attempts — ${res.lastError}`);
            }
          }
        } catch {
          console.warn('[arivo] smoke capture failed');
        }
        // the font gate (Gate B): typography must render from the intended
        // bundled assets, not silent system fallbacks. a dead @font-face
        // fails the smoke run.
        try {
          const fonts = (await win.webContents.executeJavaScript(
            `(async () => {
              // force-load the faces first: css fonts load lazily, and a
              // not-yet-used face would false-negative the check
              await Promise.all([
                document.fonts.load('400 15px "Inter"'),
                document.fonts.load('500 15px "Inter"'),
                document.fonts.load('400 16px "Literata"'),
                document.fonts.load('400 12px "JetBrains Mono"'),
              ]).catch(() => undefined);
              return {
                inter400: document.fonts.check('400 15px "Inter"'),
                inter500: document.fonts.check('500 15px "Inter"'),
                literata: document.fonts.check('400 16px "Literata"'),
                mono: document.fonts.check('400 12px "JetBrains Mono"'),
              };
            })()`,
          )) as Record<string, boolean>;
          fs.writeFileSync(path.resolve(process.cwd(), 'smoke-fonts.json'), JSON.stringify(fonts, null, 2));
          console.warn(`[arivo] font gate → ${JSON.stringify(fonts)}`);
          if (!fonts['inter400'] || !fonts['inter500'] || !fonts['literata']) {
            console.warn('[arivo] font gate FAILED — intended assets not loaded');
            exitWith(1);
            return;
          }
        } catch (err) {
          console.warn('[arivo] font gate crashed', err);
        }
        // the reader capture: open the first book through the real ui —
        // the golden path (library → open → read) end-to-end, and the
        // reading typography rendered from intended assets
        if (isReaderShot) {
          try {
            const opened = (await win.webContents.executeJavaScript(
              `(() => {
                // the canonical book object (L9): one system, one selector —
                // the shelf's objects are bo-tap buttons. the pull-forward
                // receipt fires the navigation on its own clock.
                const card = document.querySelector('.continue-row .bo-tap') || document.querySelector('.book-grid .bo-tap') || document.querySelector('.book-row');
                if (card) { card.click(); return true; }
                return false;
              })()`,
            )) as boolean;
            // the pull-forward receipt: the object tips toward the hand,
            // then the desk opens (150ms) — wait out the launch before
            // paginating
            await new Promise((r) => setTimeout(r, 400));
            // paginate into the body text — the cover is page one
            for (let i = 0; i < 3; i += 1) {
              await win.webContents.executeJavaScript(
                `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`,
              );
              await new Promise((r) => setTimeout(r, 900));
            }
            await new Promise((r) => setTimeout(r, 2500));
            // a hidden window composites on demand: input events force
            // BeginFrames so capturePage sees the rendered page. the first
            // wake paints the reading text; the second (after the attention
            // flip and the chrome fade complete) paints the full desk.
            try {
              await win.webContents.executeJavaScript(
                `window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 24 })); true;`,
              );
              await new Promise((r) => setTimeout(r, 650));
              await win.webContents.executeJavaScript(
                `window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 24 })); true;`,
              );
              await new Promise((r) => setTimeout(r, 550));
            } catch {
              /* wake is best-effort */
            }
            const image = await win.webContents.capturePage();
            fs.writeFileSync(path.resolve(process.cwd(), 'smoke-reader.png'), image.toPNG());
            console.warn(`[arivo] reader capture → ${opened ? 'opened + captured' : 'NO BOOK — captured library only'}`);
          } catch (err) {
            console.warn('[arivo] reader capture failed', err);
          }
        }
        // the fetch regression probe: the renderer page (origin app://arivo)
        // must be able to fetch book bytes over arivo:// — the exact chain
        // that failed as "FAILED TO FETCH" in the wild (commit 2ea230c).
        // CORS header + status + byte count are all asserted; failure fails
        // the smoke run, so the bug can never silently return.
        try {
          const first = services?.store.listBooks()[0];
          if (first) {
            const probe = (await win.webContents.executeJavaScript(
              `fetch('arivo://book/${first.id}').then(async (r) => ({
                status: r.status,
                acao: r.headers.get('access-control-allow-origin'),
                bytes: (await r.arrayBuffer()).byteLength,
              })).catch((e) => ({ error: String(e) }))`,
            )) as { status?: number; acao?: string | null; bytes?: number; error?: string };
            fs.writeFileSync(
              path.resolve(process.cwd(), 'smoke-fetch.json'),
              JSON.stringify(probe, null, 2),
            );
            fetchOk =
              probe.status === 200 &&
              probe.acao === 'app://arivo' &&
              typeof probe.bytes === 'number' &&
              probe.bytes > 0;
            console.warn(`[arivo] smoke fetch probe → ${fetchOk ? 'ok' : 'FAILED'}`);
          } else {
            console.warn('[arivo] smoke fetch probe skipped — no book in library (pass: launch gate)');
          }
        } catch (err) {
          console.warn('[arivo] smoke fetch probe crashed', err);
        }
        exitWith(fetchOk === false ? 1 : 0);
      }, 3500);
    });
    // hard fallback: never hang the smoke run (failure — a hung run proves
    // nothing); the lab's section captures need more runway
    setTimeout(
      () => {
        exitWith(1);
      },
      isLab || isReaderShot ? 45000 : 20000,
    );
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl && !app.isPackaged) {
    await win.loadURL(isLab ? `${devUrl}#lab` : devUrl);
  } else {
    await win.loadURL(isLab ? 'app://arivo/index.html#lab' : 'app://arivo/index.html');
  }

  return win;
}

app.whenReady().then(async () => {
  // the library protocol: arivo://book/{id} and arivo://cover/{id}
  protocol.handle('arivo', async (request) => {
    const cors = corsHeadersFor(request);

    // GET is the normal reader path. Support OPTIONS as well so future
    // range/header requests do not fail CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Range',
          'access-control-max-age': '600',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const kind = url.hostname;
      const id = decodeURIComponent(url.pathname.replace(/^\//, '').split('/')?.[0] ?? '');
      if (!services || !id || (kind !== 'book' && kind !== 'cover')) {
        return new Response('not found', { status: 404, headers: cors });
      }
      const file = services.libraryFile(id, kind === 'cover');
      if (!file) return new Response('not found', { status: 404, headers: cors });
      const data = await fs.promises.readFile(file);
      const mime = file.endsWith('.jpg')
        ? 'image/jpeg'
        : file.endsWith('.png')
          ? 'image/png'
          : file.endsWith('.pdf')
            ? 'application/pdf'
            : 'application/epub+zip';
      return new Response(new Uint8Array(data), {
        headers: {
          'content-type': mime,
          ...cors,
        },
      });
    } catch {
      return new Response('not found', { status: 404, headers: cors });
    }
  });

  const rendererDir = path.join(__dirname, '../renderer');
  const mimes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let p = decodeURIComponent(url.pathname);
      if (p === '/' || p === '') p = '/index.html';
      const file = path.normalize(path.join(rendererDir, p));
      if (!file.startsWith(rendererDir)) {
        return new Response('forbidden', { status: 403 });
      }
      const data = await fs.promises.readFile(file);
      return new Response(new Uint8Array(data), {
        headers: { 'content-type': mimes[path.extname(file)] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  if (isRebuild) {
    services = createServices();
    const result = await services.rebuildIndex();
    console.warn(`[arivo] index rebuilt: ${result.books} books, ${result.highlights} highlights`);
    app.exit(0);
    return;
  }

  services = createServices();
  registerIpc(() => services!);
  services.autoSeed(seedDir());

  // release delivery: packaged builds check the feed on launch (I-34)
  startUpdateChecks();

  console.warn('[arivo] window created, loading…');
  mainWindow = await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('[arivo] uncaught:', err);
});
