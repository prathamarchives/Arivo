/** durability helpers: fsync a file, fsync its directory. */
import { openSync, closeSync, fsyncSync } from 'node:fs';

/** flush an open fd to disk (crash → the bytes are on the platter) */
export function fsyncFd(fd: number): void {
  fsyncSync(fd);
}

/**
 * fsync the directory containing a path — required for rename durability on
 * posix filesystems. best-effort: some platforms/windows filesystems refuse
 * directory fsync; that must never fail a write that already succeeded.
 */
export function fsyncDir(path: string): void {
  try {
    const fd = openSync(path, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* directory fsync unsupported here — the rename is still atomic */
  }
}
