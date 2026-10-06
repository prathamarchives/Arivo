/**
 * the import pipeline's inspection stage: a file walks in, truth walks out.
 * state machine: validating → parsing → extracting → indexing → done | failed.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import JSZip from 'jszip';
import type { BookFormat } from '@arivo/core';

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

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

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
  const data = await readFile(path);
  const hash = createHash('sha256').update(data).digest('hex');
  const size = (await stat(path)).size;

  const zip = await JSZip.loadAsync(data).catch(() => {
    throw new ImportError('not a readable zip — the file is damaged');
  });

  // validating: a real epub has a container
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new ImportError('missing META-INF/container.xml — not an epub');

  const rootfile = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!rootfile) throw new ImportError('container.xml has no rootfile — not an epub');

  const opf = await zip.file(rootfile)?.async('string');
  if (!opf) throw new ImportError(`missing ${rootfile} — the epub is damaged`);

  // parsing: metadata
  const title = firstMatch(opf, /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) ?? basename(path, extname(path));
  const creators = allMatches(opf, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/gi);
  const description = firstMatch(opf, /<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
  const language = firstMatch(opf, /<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
  const publisher = firstMatch(opf, /<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
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
  if (coverHref) {
    const zipPath = coverHref.startsWith('/')
      ? coverHref.slice(1)
      : joinZipPath(rootfile, decodeHref(coverHref));
    const entry = zip.file(zipPath);
    if (entry) {
      const bytes = await entry.async('nodebuffer');
      if (bytes.length > 0 && bytes.length < 12 * 1024 * 1024) cover = bytes;
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

/** pdf inspection v0.1: honest minimal — filename is the title, truth discovered on open */
export async function inspectPdf(path: string): Promise<InspectedFile> {
  const data = await readFile(path);
  const head = data.subarray(0, 5).toString('latin1');
  if (head !== '%PDF-') throw new ImportError('not a pdf file');
  const hash = createHash('sha256').update(data).digest('hex');
  const size = (await stat(path)).size;
  const base = basename(path, extname(path)).replace(/[_-]+/g, ' ').trim();
  // try to pull the title from the pdf info dict (best effort, no parser dep)
  const tail = data.subarray(Math.max(0, data.length - 4096)).toString('latin1');
  const titleMatch = tail.match(/\/Title\s*\(([^)]{1,200})\)/)?.[1];
  const title = titleMatch ? titleMatch.trim() : base.length > 0 ? base : basename(path);
  return {
    format: 'pdf',
    hash,
    fileName: basename(path),
    fileSize: size,
    title,
    subtitle: null,
    authors: [],
    description: null,
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
  throw new ImportError('unsupported format — arivo reads epub and pdf');
}
