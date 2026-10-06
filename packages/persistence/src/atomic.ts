/**
 * THE ATOMIC WRITE — the only way arivo writes a truth file.
 *
 *   write temp (unique name) → fsync → close → rename → fsync dir
 *
 * a process death at ANY point leaves either the previous content or the new
 * content, complete and parseable. there is no moment on disk where the live
 * file is partial. crash.test.ts proves this with real SIGKILLs.
 */
import {
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fsyncDir } from './fsync.ts';

/**
 * test hook — when armed, the write kills the process at a controlled point.
 * values: 'after-temp-write' | 'after-fsync' | 'before-rename' | 'after-rename'
 * never set in production; crash.test.ts sets it in a child process.
 */
export let crashPoint: string | null = null;
export function armCrashPoint(point: string | null): void {
  crashPoint = point;
}

const die = (): never => {
  process.kill(process.pid, 'SIGKILL');
  // SIGKILL is asynchronous — hold the process open until it lands
  for (;;) {
    /* unreachable in practice */
  }
};

let tempCounter = 0;

const basenameOf = (p: string): string => p.split(/[\\/]/).pop() ?? 'file';

/** atomically replace a file's full content (string or buffer) */
export function writeFileSyncAtomic(path: string, data: string | Uint8Array): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `.${basenameOf(path)}.tmp-${process.pid}-${Date.now()}-${tempCounter++}`);
  try {
    writeFileSync(temp, data); // 1. write the temp file
    if (crashPoint === 'after-temp-write') die();
    const fd = openSync(temp, 'r+');
    try {
      fsyncSync(fd); // 2. push the bytes to the platter
    } finally {
      closeSync(fd);
    }
    if (crashPoint === 'after-fsync') die();
    if (crashPoint === 'before-rename') die();
    renameSync(temp, path); // 3. the atomic commit
    if (crashPoint === 'after-rename') die();
    fsyncDir(dir); // 4. make the rename itself durable
  } finally {
    // never leave a temp file behind on the failure path
    if (crashPoint === null && existsSync(temp)) {
      try {
        unlinkSync(temp);
      } catch {
        /* best effort */
      }
    }
  }
}
