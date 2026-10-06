/**
 * DOCUMENTS ARE HOSTILE INPUT — validated before parsed, always.
 * file → identify → validate → resource limits → parse → sanitize → index.
 * every limit here is generous on purpose: real books must pass, bombs must
 * not. numbers are documented in docs/IMPORT-PIPELINE.md and enforced here.
 */
import { ArivoError } from '@arivo/core';

/** the resource contract — one place, measured, documented */
export const LIMITS = {
  /** a single book file larger than this is rejected at the door */
  maxBookFileBytes: 512 * 1024 * 1024, // 512 MB — a 3000-page scanned pdf
  /** epub entries beyond this are bombs or breakage */
  maxZipEntries: 4096,
  /** total decompressed epub content beyond this is a bomb */
  maxZipTotalBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  /** a single decompressed entry beyond this is a bomb */
  maxZipEntryBytes: 512 * 1024 * 1024, // 512 MB
  /** per-entry compression ratio beyond this is suspicious (zeros compress ~1000:1) */
  maxCompressionRatio: 500,
  /** any single metadata field is capped (title/description/...) */
  maxMetadataLength: 4000,
  /** cover images beyond this are skipped, never fatal */
  maxCoverBytes: 12 * 1024 * 1024,
  /** pdf tail scan window for the info dictionary */
  pdfTailBytes: 4096,
} as const;

/** the typed rejection — never a raw throw at the user */
export class ImportError extends ArivoError {
  constructor(
    message: string,
    code: 'INVALID_DOCUMENT' | 'UNSUPPORTED_FORMAT' = 'INVALID_DOCUMENT',
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = 'ImportError';
  }
}

/** a document rejected by validation (shape, limits, traversal) */
export class DocumentRejected extends ImportError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_DOCUMENT', details);
    this.name = 'DocumentRejected';
  }
}

export interface ZipEntryProbe {
  name: string;
  dir: boolean;
  compressedSize: number;
  uncompressedSize: number;
}

/** the metadata we can pull from a jszip entry without decompressing it */
export function probeZipEntries(files: Record<string, unknown>): ZipEntryProbe[] {
  const out: ZipEntryProbe[] = [];
  for (const [name, entry] of Object.entries(files)) {
    const maybe = entry as { dir?: boolean; _data?: { compressedSize?: number; uncompressedSize?: number } };
    out.push({
      name,
      dir: Boolean(maybe.dir),
      compressedSize: maybe._data?.compressedSize ?? 0,
      uncompressedSize: maybe._data?.uncompressedSize ?? 0,
    });
  }
  return out;
}

/**
 * validate a loaded zip's shape: entry count, per-entry size, total
 * decompressed size, compression ratios, and traversal-shaped names.
 * throws DocumentRejected — import fails cleanly.
 */
export function validateZipShape(probes: ZipEntryProbe[]): void {
  const entries = probes.filter((p) => !p.dir);
  if (entries.length > LIMITS.maxZipEntries) {
    throw new DocumentRejected(
      `the epub contains ${entries.length} entries (limit ${LIMITS.maxZipEntries}) — this is a bomb or a broken file`,
      { entries: entries.length },
    );
  }
  let total = 0;
  for (const p of entries) {
    if (p.uncompressedSize > LIMITS.maxZipEntryBytes) {
      throw new DocumentRejected(
        `the entry ${p.name} expands to ${p.uncompressedSize} bytes (limit ${LIMITS.maxZipEntryBytes})`,
        { entry: p.name, uncompressedSize: p.uncompressedSize },
      );
    }
    total += p.uncompressedSize;
    if (total > LIMITS.maxZipTotalBytes) {
      throw new DocumentRejected('the epub expands past the total content limit — zip bomb', {
        total,
      });
    }
    // ratio check on entries that MATTER: a genuinely large payload compressing
    // absurdly well is the bomb signature (a real bomb compresses SMALL — the
    // guard is the uncompressed size, not the compressed one)
    if (
      p.uncompressedSize > 1024 * 1024 &&
      p.uncompressedSize / Math.max(1, p.compressedSize) > LIMITS.maxCompressionRatio
    ) {
      throw new DocumentRejected(
        `the entry ${p.name} compresses ${Math.round(p.uncompressedSize / Math.max(1, p.compressedSize))}:1 — zip bomb`,
        { entry: p.name, ratio: p.uncompressedSize / Math.max(1, p.compressedSize) },
      );
    }
    if (traversalShaped(p.name)) {
      throw new DocumentRejected(`the entry ${p.name} tries to escape the archive root`, {
        entry: p.name,
      });
    }
  }
}

/** names that would resolve outside the archive root if ever extracted */
export function traversalShaped(name: string): boolean {
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return true; // absolute path
  let depth = 0;
  for (const part of normalized.split('/')) {
    if (part === '..') {
      depth -= 1;
      // dipping below the root at ANY point is an escape, even if later
      // segments would climb back inside ('a/../../evil' resolves outside)
      if (depth < 0) return true;
    } else if (part !== '.' && part.length > 0) {
      depth += 1;
    }
  }
  return false;
}

/** cap a metadata field — hostile metadata never reaches the ui */
export function capField(value: string | null, _field: string): string | null {
  if (value === null) return null;
  if (value.length > LIMITS.maxMetadataLength) {
    return value.slice(0, LIMITS.maxMetadataLength); // truncated, not fatal
  }
  return value;
}

/** file-level validation before any parsing happens */
export function validateFileShape(path: string, size: number, ext: string): void {
  if (size > LIMITS.maxBookFileBytes) {
    throw new DocumentRejected(
      `${path} is ${size} bytes — over the ${LIMITS.maxBookFileBytes} import limit`,
      { size },
    );
  }
  if (ext !== '.epub' && ext !== '.pdf') {
    throw new ImportError('arivo reads epub and pdf', 'UNSUPPORTED_FORMAT', { ext });
  }
}
