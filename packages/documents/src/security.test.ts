/**
 * DOCUMENTS ARE HOSTILE INPUT — proven by attack, not by hope.
 * fuzzed garbage, zip bombs, traversal names, entry-count bombs, hostile
 * metadata, truncation: every one is rejected with a typed error, never a
 * crash, never a partial registration.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { ArivoError } from '@arivo/core';
import { inspectFile, inspectEpub, ImportError } from './inspect.ts';
import {
  DocumentRejected,
  LIMITS,
  traversalShaped,
  validateZipShape,
  probeZipEntries,
  capField,
} from './security.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '../../..');
const FIXTURE_EPUB = join(ROOT, 'test-fixtures/fixture.epub');

let dir: string;
const put = (name: string, bytes: Uint8Array | string): string => {
  const file = join(dir, name);
  writeFileSync(file, bytes);
  return file;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'arivo-sec-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** a minimal VALID epub skeleton to hang attacks on */
async function epubBytes(mutate: (zip: JSZip) => void): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'content.opf',
    '<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Attack Book</dc:title><dc:creator>Someone</dc:creator></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>',
  );
  zip.file('c.xhtml', '<html><body><p>hello</p></body></html>');
  mutate(zip);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('fuzz: garbage never crashes the pipeline (I-24)', () => {
  it('arbitrary bytes as .epub → typed rejection, never a crash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }).filter((b) => b.length !== fixtureLength()),
        async (bytes) => {
          const file = put('garbage.epub', bytes);
          try {
            await inspectFile(file);
            // accidental valid zips are possible — then it must still be a
            // structured rejection (no container), never a partial result
            expect.unreachable('inspectFile must reject garbage');
          } catch (err) {
            expect(err).toBeInstanceOf(ArivoError);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('arbitrary bytes as .pdf → typed rejection', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 2048 }), async (bytes) => {
        const file = put('garbage.pdf', bytes);
        try {
          await inspectFile(file);
          expect.unreachable('inspectFile must reject garbage');
        } catch (err) {
          expect(err).toBeInstanceOf(ArivoError);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('truncated real epubs reject cleanly at every cut point', async () => {
    const bytes = readFileSync(FIXTURE_EPUB);
    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.95]) {
      const cut = Math.floor(bytes.length * fraction);
      const file = put(`truncated-${fraction}.epub`, bytes.subarray(0, cut));
      try {
        await inspectEpub(file);
        // a truncated zip that still parses must fail the container checks
        expect.unreachable('truncated epub must reject');
      } catch (err) {
        expect(err).toBeInstanceOf(ArivoError);
      }
    }
  });
});

describe('zip bombs (I-21)', () => {
  it('a high-ratio entry (zeros, deflated) is rejected before extraction', async () => {
    const file = put(
      'bomb.epub',
      await epubBytes((zip) => {
        zip.file('payload.bin', Buffer.alloc(4 * 1024 * 1024, 0)); // 4MB zeros
      }).then(async (skeleton) =>
        // re-generate the whole zip with deflate so the entry genuinely compresses
        JSZip.loadAsync(skeleton).then(async (z) =>
          z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
        ),
      ),
    );
    await expect(inspectEpub(file)).rejects.toThrow(/bomb|expands/i);
  });

  it('an entry-count bomb is rejected', async () => {
    const file = put(
      'entries.epub',
      await epubBytes((zip) => {
        for (let i = 0; i < LIMITS.maxZipEntries + 10; i++) zip.file(`f${i}.txt`, 'x');
      }),
    );
    await expect(inspectEpub(file)).rejects.toThrow(/entries/i);
  });

  it('validateZipShape rejects oversized single entries and totals', () => {
    expect(() =>
      validateZipShape([
        { name: 'big.bin', dir: false, compressedSize: 1024, uncompressedSize: LIMITS.maxZipEntryBytes + 1 },
      ]),
    ).toThrow(DocumentRejected);
    // total cap: 5 entries of 500MB each (each under the per-entry cap, stored
    // uncompressed so the ratio guard stays quiet) bust the 2GB total
    const probes = Array.from({ length: 5 }, (_, i) => ({
      name: `part-${i}`,
      dir: false,
      compressedSize: 500 * 1024 * 1024,
      uncompressedSize: 500 * 1024 * 1024,
    }));
    expect(() => validateZipShape(probes)).toThrow(/total/i);
  });
});

describe('path traversal (I-21)', () => {
  it('traversal-shaped entry names are rejected', () => {
    expect(traversalShaped('../evil.txt')).toBe(true);
    expect(traversalShaped('a/../../evil')).toBe(true);
    expect(traversalShaped('/absolute/path')).toBe(true);
    expect(traversalShaped('normal/path.txt')).toBe(false);
    expect(traversalShaped('./here.txt')).toBe(false);
    expect(traversalShaped('good/../ok.txt')).toBe(false); // stays inside root
  });

  it('jszip normalizes traversal names at load; validateZipShape catches raw shaped names (defense in depth)', async () => {
    // craft the zip with a traversal name — jszip's own loader sanitizes it
    const bytes = await epubBytes((zip) => {
      zip.file('../../evil.txt', 'escaped');
    });
    const loaded = await JSZip.loadAsync(bytes);
    const names = Object.keys(loaded.files).filter((n) => !n.endsWith('/'));
    // no non-directory name survives as traversal-shaped through the loader
    expect(names.every((n) => !traversalShaped(n))).toBe(true);
    // and the validator still rejects raw shaped probes if a future loader
    // ever passes them through
    expect(() =>
      validateZipShape([{ name: '../../evil.txt', dir: false, compressedSize: 1, uncompressedSize: 1 }]),
    ).toThrow(/escape/i);
  });

  it('a container pointing outside the archive is rejected', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      '<?xml version="1.0"?><container><rootfiles><rootfile full-path="../../etc/passwd"/></rootfiles></container>',
    );
    const file = put('escape-container.epub', await zip.generateAsync({ type: 'nodebuffer' }));
    await expect(inspectEpub(file)).rejects.toThrow(/outside/i);
  });
});

describe('hostile metadata (I-21)', () => {
  it('a 10KB title is capped, never fatal', async () => {
    const hugeTitle = 'A'.repeat(10 * 1024);
    const file = put(
      'huge-meta.epub',
      await epubBytes((zip) => {
        zip.file(
          'content.opf',
          `<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>${hugeTitle}</dc:title><dc:creator>Someone</dc:creator></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>`,
        );
      }),
    );
    const inspected = await inspectEpub(file);
    expect(inspected.title.length).toBeLessThanOrEqual(LIMITS.maxMetadataLength);
    expect(inspected.title.startsWith('AAAA')).toBe(true);
  });

  it('capField truncates and passes through small values', () => {
    expect(capField('short', 'title')).toBe('short');
    expect(capField('B'.repeat(9999), 'title')!.length).toBe(LIMITS.maxMetadataLength);
    expect(capField(null, 'title')).toBeNull();
  });
});

describe('the real fixture still passes (regression)', () => {
  it('the committed fixture imports cleanly with the full validation chain', async () => {
    const file = join(dir, 'fixture.epub');
    copyFileSync(FIXTURE_EPUB, file);
    const inspected = await inspectFile(file);
    expect(inspected.format).toBe('epub');
    expect(inspected.title).toBe('A Fixture Book');
    expect(inspected.cover).not.toBeNull();
    // and the shape probe is green on it
    const zip = await JSZip.loadAsync(readFileSync(file));
    expect(() => validateZipShape(probeZipEntries(zip.files as Record<string, unknown>))).not.toThrow();
  });
});

describe('ImportError is a typed ArivoError (item 9 preview)', () => {
  it('carries the INVALID_DOCUMENT code and serializes', () => {
    const err = new ImportError('nope');
    expect(err).toBeInstanceOf(ArivoError);
    expect(err.code).toBe('INVALID_DOCUMENT');
    expect(err.toJSON().code).toBe('INVALID_DOCUMENT');
  });
});

function fixtureLength(): number {
  return readFileSync(FIXTURE_EPUB).length;
}
