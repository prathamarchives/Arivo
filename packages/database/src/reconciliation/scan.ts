/**
 * OBSERVE — scan the library root and describe what is actually on disk.
 * stat-based fast path: hash a book file only when mtime/size disagree with
 * metadata, so an all-unchanged 10k scan never reads a book's bytes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BookFolderMeta } from '@arivo/core';
import type { ObservedBook } from './types.ts';

const BOOK_EXT = /\.(epub|pdf)$/i;

export interface ScanResult {
  books: ObservedBook[];
  /** folders without metadata.json and without a book file — junk, reported */
  junk: string[];
  /** stale staging leftovers swept (arivo's own scratch — safe to delete) */
  sweptStaging: string[];
}

function readMeta(dir: string): BookFolderMeta | null {
  const file = join(dir, 'metadata.json');
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<BookFolderMeta>;
    // the full folder contract must hold — anything less is CORRUPT, and
    // never worth an sqlite named-parameter crash downstream
    const valid =
      typeof raw.id === 'string' &&
      raw.id.length > 0 &&
      typeof raw.hash === 'string' &&
      raw.hash.length >= 16 &&
      typeof raw.fileName === 'string' &&
      raw.fileName.length > 0 &&
      typeof raw.title === 'string' &&
      Array.isArray(raw.authors) &&
      (raw.format === 'epub' || raw.format === 'pdf') &&
      typeof raw.fileSize === 'number';
    if (!valid) return null;
    return raw as BookFolderMeta;
  } catch {
    return null;
  }
}

const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

/** observe one book folder: locate the file, fast-path the fingerprint */
function observeFolder(dir: string, entry: string): ObservedBook {
  const id = entry;
  const meta = readMeta(dir);
  const observed: ObservedBook = {
    id,
    dir,
    meta,
    bookFileName: null,
    bookFileSize: null,
    bookFileMtime: null,
    contentHash: null,
    renamed: false,
  };
  if (!meta) return observed;

  const named = join(dir, meta.fileName);
  let file: string | null = null;
  if (existsSync(named)) {
    file = named;
  } else {
    // metadata's fileName is gone — is there exactly one book file instead?
    const candidates = readdirSync(dir).filter((f) => BOOK_EXT.test(f));
    if (candidates.length === 1) {
      file = join(dir, candidates[0]!);
      observed.renamed = true;
    }
  }
  if (!file) return observed;

  const st = statSync(file);
  observed.bookFileName = file.endsWith(meta.fileName) ? meta.fileName : file.split(/[\\/]/).pop()!;
  observed.bookFileSize = st.size;
  observed.bookFileMtime = st.mtimeMs;

  // fast path: mtime + size agree with the stored fingerprint → trust it
  const fpKnown =
    typeof meta.fileMtime === 'number' &&
    meta.fileMtime === st.mtimeMs &&
    meta.fileSize === st.size &&
    !observed.renamed;

  if (fpKnown) {
    observed.contentHash = meta.hash; // no bytes read
  } else {
    // slow path: the disk disagrees with the fingerprint → hash for truth
    observed.contentHash = sha256(file);
  }
  return observed;
}

/** arivo's own hidden temp litter from a killed atomic write */
const TEMP_RE = /^\..+\.tmp-\d+-\d+-\d+$/;

/** sweep arivo's own scratch — staging + temp litter. safe to remove. */
function sweepScratch(dir: string): string[] {
  const swept: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (TEMP_RE.test(entry)) {
        try {
          rmSync(join(dir, entry), { force: true });
          swept.push(entry);
        } catch {
          /* best-effort; re-swept next run */
        }
      }
    }
  } catch {
    /* best effort */
  }
  return swept;
}

/** sweep arivo's own staging scratch — incomplete imports, safe to remove */
function sweepStaging(libraryDir: string): string[] {
  const staging = join(libraryDir, '.staging');
  if (!existsSync(staging)) return [];
  const swept: string[] = [];
  for (const entry of readdirSync(staging)) {
    const dir = join(staging, entry);
    try {
      if (statSync(dir).isDirectory()) {
        rmSync(dir, { recursive: true, force: true });
        swept.push(entry);
      } else {
        rmSync(dir, { force: true });
        swept.push(entry);
      }
    } catch {
      /* best-effort sweep; leftovers re-swept next run */
    }
  }
  return swept;
}

export function scanLibrary(libraryDir: string): ScanResult {
  const books: ObservedBook[] = [];
  const junk: string[] = [];
  if (!existsSync(libraryDir)) return { books, junk, sweptStaging: [] };

  const sweptStaging = sweepStaging(libraryDir);
  sweptStaging.push(...sweepScratch(libraryDir));

  for (const entry of readdirSync(libraryDir)) {
    if (entry === '.staging' || entry === 'collections.json') continue;
    const dir = join(libraryDir, entry);
    let st;
    try {
      st = statSync(dir);
    } catch {
      continue; // vanished mid-scan: next run classifies it
    }
    if (!st.isDirectory()) continue;
    if (!existsSync(join(dir, 'metadata.json')) && readdirSync(dir).every((f) => !BOOK_EXT.test(f))) {
      junk.push(entry); // neither metadata nor a book file — not a book
      continue;
    }
    books.push(observeFolder(dir, entry));
  }
  return { books, junk, sweptStaging };
}
