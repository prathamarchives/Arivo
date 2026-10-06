import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFile, inspectEpub, detectFormat, ImportError } from './inspect.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');
// the committed deterministic fixture — runs everywhere (fresh clones, CI)
const FIXTURE_EPUB = join(ROOT, 'test-fixtures/fixture.epub');
// the owner's real book — present on the dev machine, gitignored, skipped elsewhere
const REAL_EPUB = join(
  ROOT,
  'apps/desktop/public/seed/The Burnout Society.epub',
);

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'arivo-inspect-'));
});

describe('detectFormat', () => {
  it('knows epub and pdf, nothing else', () => {
    expect(detectFormat('/books/a.epub')).toBe('epub');
    expect(detectFormat('/books/a.pdf')).toBe('pdf');
    expect(detectFormat('/books/a.mobi')).toBeNull();
    expect(detectFormat('/books/a.txt')).toBeNull();
  });
});

describe('inspectEpub — on the committed fixture (runs everywhere, incl. CI)', () => {
  it('extracts metadata, cover, and a stable hash', async () => {
    const result = await inspectEpub(FIXTURE_EPUB);
    expect(result.format).toBe('epub');
    expect(result.title).toBe('A Fixture Book');
    expect(result.authors).toEqual(['Fixture Author']);
    expect(result.language).toBe('en');
    expect(result.publisher).toBe('Arivo Press');
    expect(result.publishedYear).toBe('2015');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.fileSize).toBe((await readFile(FIXTURE_EPUB)).length);
    // the fixture ships a real cover through the epub2 meta path (epub3
    // properties + guide are also declared — chain order picks meta first)
    expect(result.cover).not.toBeNull();
    expect(result.cover!.length).toBeGreaterThan(1000);
  });

  it('is deterministic — same file, same truth', async () => {
    const a = await inspectEpub(FIXTURE_EPUB);
    const b = await inspectEpub(FIXTURE_EPUB);
    expect(a.hash).toBe(b.hash);
    expect(a.title).toBe(b.title);
  });
});

describe.skipIf(!existsSync(REAL_EPUB))('inspectEpub — on the owner\u2019s real book', () => {
  it('extracts metadata, cover, and a stable hash', async () => {
    const result = await inspectEpub(REAL_EPUB);
    expect(result.format).toBe('epub');
    expect(result.title.toLowerCase()).toContain('burnout');
    expect(result.authors.join(' ')).toContain('Han');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.fileSize).toBe((await readFile(REAL_EPUB)).length);
    // the cover exists in this book (OEBPS/img/1_1.png is ~260KB)
    expect(result.cover).not.toBeNull();
    expect(result.cover!.length).toBeGreaterThan(1000);
  });

  it('is deterministic — same file, same truth', async () => {
    const a = await inspectEpub(REAL_EPUB);
    const b = await inspectEpub(REAL_EPUB);
    expect(a.hash).toBe(b.hash);
    expect(a.title).toBe(b.title);
  });
});

describe('the epub is untrusted input — validation', () => {
  it('rejects a file that is not a zip', async () => {
    const fake = join(tmp, 'fake.epub');
    await writeFile(fake, 'this is definitely not an epub');
    await expect(inspectEpub(fake)).rejects.toThrow(ImportError);
  });

  it('rejects a zip without a container', async () => {
    const fake = join(tmp, 'fake2.epub');
    await writeFile(fake, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]));
    await expect(inspectEpub(fake)).rejects.toThrow(ImportError);
  });

  it('rejects unsupported formats through the pipeline', async () => {
    const fake = join(tmp, 'book.mobi');
    await writeFile(fake, 'mobi');
    await expect(inspectFile(fake)).rejects.toThrow(ImportError);
  });

  it('rejects a pdf with a broken header', async () => {
    const fake = join(tmp, 'fake.pdf');
    await writeFile(fake, '%NOT-PDF');
    await expect(inspectFile(fake)).rejects.toThrow(ImportError);
  });
});
