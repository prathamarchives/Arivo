import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFile, inspectEpub, detectFormat, ImportError } from './inspect.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REAL_EPUB = join(
  HERE,
  '../../../',
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

describe('inspectEpub — on the owner\u2019s real book', () => {
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
