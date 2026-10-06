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

let mainWindow: BrowserWindow | null = null;
let services: Services | null = null;

const isSmoke = process.argv.includes('--smoke');
const isRebuild = process.argv.includes('--rebuild-index');

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
    backgroundColor: '#f6f3ec',
    title: 'Arivo',
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
        let fetchOk = false;
        try {
          const image = await win.webContents.capturePage();
          const out = path.resolve(process.cwd(), 'smoke.png');
          fs.writeFileSync(out, image.toPNG());
          console.warn(`[arivo] smoke screenshot → ${out}`);
        } catch {
          console.warn('[arivo] smoke capture failed');
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
            console.warn('[arivo] smoke fetch probe skipped — no book in library');
          }
        } catch (err) {
          console.warn('[arivo] smoke fetch probe crashed', err);
        }
        exitWith(fetchOk ? 0 : 1);
      }, 3500);
    });
    // hard fallback: never hang the smoke run (failure — a hung run proves
    // nothing)
    setTimeout(
      () => {
        exitWith(1);
      },
      20000,
    );
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl && !app.isPackaged) {
    await win.loadURL(devUrl);
  } else {
    await win.loadURL('app://arivo/index.html');
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
