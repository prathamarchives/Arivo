/**
 * THE FIXTURE IS A REAL PDF — pdf.js opens it in node, so the substrate's
 * assumptions (outline shape, destination types, text layer, metadata)
 * are proven here, not assumed (D11's spirit: never trust an unrendered
 * path). the DOM/rendering halves are proven live in W2.2.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const FIXTURE = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../test-fixtures/fixture.pdf',
);

async function openFixture() {
  const data = new Uint8Array(readFileSync(FIXTURE));
  const task = pdfjs.getDocument({ data, useSystemFonts: false });
  const doc = await task.promise;
  return { doc, task };
}

describe('the pdf fixture — a real document, not a mock', () => {
  it('is a 12-page letter document with a text layer', async () => {
    const { doc, task } = await openFixture();
    try {
      expect(doc.numPages).toBe(12);
      const page = await doc.getPage(2);
      const vp = page.getViewport({ scale: 1 });
      expect(Math.round(vp.width)).toBe(612);
      expect(Math.round(vp.height)).toBe(792);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((i) => ('str' in i ? i.str : ''))
        .join(' ');
      expect(text).toContain('page 2 of 12');
      expect(text).toContain('evidence marker 2-222');
    } finally {
      await task.destroy();
    }
  });

  it('carries a real outline with resolvable destinations', async () => {
    const { doc, task } = await openFixture();
    try {
      const outline = await doc.getOutline();
      expect(outline.map((o: { title?: string }) => o.title)).toEqual([
        'Part One',
        'Part Two',
      ]);
      const partOne = outline[0]!;
      expect((partOne.items ?? []).map((c: { title?: string }) => c.title)).toEqual([
        'Chapter 1 - The Room',
        'Chapter 2 - The Desk',
      ]);
      // resolve every destination to a page number the way the adapter does
      const pageOf = async (dest: unknown): Promise<number> => {
        const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : (dest as unknown[]);
        expect(Array.isArray(resolved)).toBe(true);
        const index = await doc.getPageIndex(resolved![0] as never);
        return index + 1;
      };
      expect(await pageOf(partOne.dest)).toBe(1);
      expect(await pageOf(outline[1]!.dest)).toBe(9);
      for (const child of partOne.items ?? []) {
        await pageOf(child.dest); // every child resolves — none may throw
      }
    } finally {
      await task.destroy();
    }
  });

  it('carries the info dict the importer reads', async () => {
    const { doc, task } = await openFixture();
    try {
      const meta = await doc.getMetadata();
      expect((meta.info as { Title?: string }).Title).toBe('Arivo Field Notes');
      expect((meta.info as { Author?: string }).Author).toBe('A. Reader');
    } finally {
      await task.destroy();
    }
  });

  it('teardown through the loading task is clean (the adapter destroy path)', async () => {
    const { task } = await openFixture();
    await expect(task.destroy()).resolves.toBeUndefined();
  });
});

describe('pdf.js failure modes — the honest error surface', () => {
  it('garbage bytes raise InvalidPDFException → the adapter maps plain language', async () => {
    const garbage = new Uint8Array(
      Buffer.from('%PDF-1.4\nthis is not a real document\n%%EOF\n', 'latin1'),
    );
    const task = pdfjs.getDocument({ data: garbage });
    await expect(task.promise).rejects.toThrow();
    try {
      await task.promise;
    } catch (err) {
      expect((err as { name?: string }).name).toBe('InvalidPDFException');
    }
    await task.destroy().catch(() => undefined);
  });
});
