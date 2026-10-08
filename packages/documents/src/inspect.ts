/**
 * the import pipeline's inspection stage: a file walks in, truth walks out.
 * state machine: validating → parsing → extracting → indexing → done | failed.
 * documents are hostile input: shape + limits are enforced BEFORE any parse.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import JSZip from 'jszip';
import type { BookFormat } from '@arivo/core';
import {
  DocumentRejected,
  ImportError,
  LIMITS,
  capField,
  probeZipEntries,
  traversalShaped,
  validateFileShape,
  validateZipShape,
} from './security.ts';

export { ImportError, DocumentRejected };

export interface InspectedFile {
  format: BookFormat;
  hash: string;
  fileName: string;
  fileSize: number;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  language: string | null;
  publisher: string | null;
  publishedYear: string | null;
  cover: Buffer | null;
}

/** legacy name — the typed base lives in security.ts (INVALID_DOCUMENT) */

export function detectFormat(path: string): BookFormat | null {
  const ext = extname(path).toLowerCase();
  if (ext === '.epub') return 'epub';
  if (ext === '.pdf') return 'pdf';
  return null;
}

const decode = (s: string | undefined): string | null => {
  if (!s) return null;
  const t = s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
  return t.length > 0 ? t : null;
};

const firstMatch = (xml: string, re: RegExp): string | null => decode(xml.match(re)?.[1]);

const allMatches = (xml: string, re: RegExp): string[] => {
  const out: string[] = [];
  for (const m of xml.matchAll(re)) {
    const v = decode(m[1]);
    if (v) out.push(v);
  }
  return out;
};

/** the epub is untrusted input: we read strings + one image, we never execute it */
export async function inspectEpub(path: string): Promise<InspectedFile> {
  // validating: file-level shape first — size and extension
  const size = (await stat(path)).size;
  validateFileShape(path, size, extname(path).toLowerCase());

  const data = await readFile(path);
  const hash = createHash('sha256').update(data).digest('hex');

  const zip = await JSZip.loadAsync(data).catch(() => {
    throw new DocumentRejected('not a readable zip — the file is damaged');
  });

  // validating: the archive's SHAPE before any entry is decompressed —
  // entry count, per-entry + total sizes, compression ratios, traversal names
  validateZipShape(probeZipEntries(zip.files as Record<string, unknown>));

  // validating: a real epub has a container
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new DocumentRejected('missing META-INF/container.xml — not an epub');

  const rootfile = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!rootfile) throw new DocumentRejected('container.xml has no rootfile — not an epub');
  if (traversalShaped(rootfile)) {
    throw new DocumentRejected('the container points outside the archive — not an epub');
  }

  const opf = await zip.file(rootfile)?.async('string');
  if (!opf) throw new DocumentRejected(`missing ${rootfile} — the epub is damaged`);

  // parsing: metadata (hostile metadata is capped, never fatal)
  const title =
    capField(firstMatch(opf, /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i), 'title') ??
    basename(path, extname(path)).slice(0, LIMITS.maxMetadataLength);
  const creators = allMatches(opf, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/gi).map((c) =>
    c.slice(0, LIMITS.maxMetadataLength),
  );
  const description = capField(
    firstMatch(opf, /<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i),
    'description',
  );
  const language = capField(firstMatch(opf, /<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i), 'language');
  const publisher = capField(
    firstMatch(opf, /<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i),
    'publisher',
  );
  const rawDate = firstMatch(opf, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
  const publishedYear = rawDate?.match(/(\d{4})/)?.[1] ?? null;

  // extracting: the cover — the full EPUB2 + EPUB3 detection chain
  const manifest = opf.match(/<manifest[\s\S]*?<\/manifest>/i)?.[0] ?? '';
  const guide = opf.match(/<guide[\s\S]*?<\/guide>/i)?.[0] ?? '';
  const manifestItems = manifest.match(/<item\s[^>]*>/gi) ?? [];
  const hrefOf = (tag: string): string | null => tag.match(/href="([^"]+)"/i)?.[1] ?? null;
  const idOf = (tag: string): string | null => tag.match(/id="([^"]+)"/i)?.[1] ?? null;
  const isImage = (tag: string): boolean => /image\//i.test(tag);
  const decodeHref = (href: string): string => decodeURIComponent(href);

  let coverHref: string | null = null;

  // 1. <meta name="cover" content="item-id"/> → manifest item (EPUB2 classic)
  const coverMetaId =
    opf.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i)?.[1] ??
    opf.match(/<meta[^>]+content="([^"]+)"[^>]+name="cover"/i)?.[1] ??
    null;
  if (coverMetaId) {
    const item = manifestItems.find((t) => idOf(t) === coverMetaId && isImage(t));
    if (item) coverHref = hrefOf(item);
  }
  // 2. properties="cover-image" (EPUB3)
  if (!coverHref) {
    const item = manifestItems.find((t) => /properties="[^"]*cover-image/i.test(t));
    if (item && isImage(item)) coverHref = hrefOf(item);
  }
  // 3. <guide><reference type="cover" href="..."/> pointing at an image (EPUB2 guide)
  if (!coverHref) {
    for (const ref of guide.match(/<reference\s[^>]*>/gi) ?? []) {
      const type = ref.match(/type="([^"]+)"/i)?.[1] ?? '';
      const href = hrefOf(ref);
      if (type === 'cover' && href && /\.(png|jpe?g|gif|webp|svg)$/i.test(href)) {
        coverHref = href;
        break;
      }
    }
  }
  // 4. manifest item whose id says cover
  if (!coverHref) {
    const item = manifestItems.find((t) => isImage(t) && /cover/i.test(idOf(t) ?? ''));
    if (item) coverHref = hrefOf(item);
  }
  // 5. manifest item whose href says cover
  if (!coverHref) {
    const item = manifestItems.find((t) => isImage(t) && /cover/i.test(hrefOf(t) ?? ''));
    if (item) coverHref = hrefOf(item);
  }

  let cover: Buffer | null = null;
  if (coverHref && !traversalShaped(coverHref)) {
    const zipPath = coverHref.startsWith('/')
      ? coverHref.slice(1)
      : joinZipPath(rootfile, decodeHref(coverHref));
    if (!traversalShaped(zipPath)) {
      const entry = zip.file(zipPath);
      if (entry) {
        const bytes = await entry.async('nodebuffer');
        if (bytes.length > 0 && bytes.length < LIMITS.maxCoverBytes) cover = bytes;
      }
    }
  }

  return {
    format: 'epub',
    hash,
    fileName: basename(path),
    fileSize: size,
    title,
    subtitle: null,
    authors: creators,
    description,
    language,
    publisher,
    publishedYear,
    cover,
  };
}

function joinZipPath(opfPath: string, href: string): string {
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  return dir + decodeURIComponent(href);
}

/** pdf inspection: the info dict where it exists, the filename where it
 *  doesn't — never a guessed metadata field (W2.1: authors + description
 *  joined the title). */
export async function inspectPdf(path: string): Promise<InspectedFile> {
  const size = (await stat(path)).size;
  validateFileShape(path, size, '.pdf');
  const data = await readFile(path);
  const head = data.subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') throw new DocumentRejected('not a pdf file');
  const hash = createHash('sha256').update(data).digest('hex');
  const base = basename(path, extname(path)).replace(/[_-]+/g, ' ').trim();
  // info-dict fields — parsed from the /Info object itself when the trailer
  // points at one (outline items also carry /Title; the tail-wide regex
  // must never read a bookmark's title as the document's)
  const tail = data.subarray(Math.max(0, data.length - LIMITS.pdfTailBytes)).toString('latin1');
  let infoScope = tail;
  const infoRef = tail.match(/\/Info\s+(\d+)\s+0\s+R/)?.[1];
  if (infoRef) {
    const start = tail.indexOf(`${infoRef} 0 obj`);
    if (start !== -1) {
      const end = tail.indexOf('endobj', start);
      infoScope = tail.slice(start, end === -1 ? undefined : end);
    }
  }
  const infoString = (key: string): string | null => {
    const matches = [...infoScope.matchAll(new RegExp(`/${key}\\s*\\(([^)]{1,400})\\)`, 'g'))];
    const last = matches.at(-1)?.[1];
    return last ? last.trim() : null;
  };
  const titleMatch = infoString('Title');
  const title = titleMatch
    ? titleMatch.slice(0, LIMITS.maxMetadataLength)
    : base.length > 0
      ? base.slice(0, LIMITS.maxMetadataLength)
      : basename(path);
  // /Author holds one or many names — split on the conventional separators
  const authorRaw = infoString('Author');
  const authors = (authorRaw ?? '')
    .split(/[;]\s*/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .map((a) => a.slice(0, LIMITS.maxMetadataLength));
  const description = capField(infoString('Subject'), 'description');
  return {
    format: 'pdf',
    hash,
    fileName: basename(path),
    fileSize: size,
    title,
    subtitle: null,
    authors,
    description,
    language: null,
    publisher: null,
    publishedYear: null,
    cover: null,
  };
}

export async function inspectFile(path: string): Promise<InspectedFile> {
  const format = detectFormat(path);
  if (format === 'epub') return inspectEpub(path);
  if (format === 'pdf') return inspectPdf(path);
  throw new ImportError('arivo reads epub and pdf', 'UNSUPPORTED_FORMAT');
}
