/** markdown reading-notes export — the portability law's friendly face. */
import type { Book, Highlight, Bookmark, ReadingProgress } from './types.ts';

export function exportReadingNotes(
  book: Book,
  highlights: Highlight[],
  bookmarks: Bookmark[],
  progress: ReadingProgress | null,
): string {
  const lines: string[] = [];
  const by = book.authors.length > 0 ? ` — ${book.authors.join(', ')}` : '';
  lines.push(`# ${book.title}${book.subtitle ? `: ${book.subtitle}` : ''}${by}`);
  lines.push('');
  lines.push(`> exported from arivo · ${new Date().toISOString().slice(0, 10)} · ${highlights.length} highlights, ${bookmarks.length} bookmarks`);
  if (progress) {
    const pct = Math.round(progress.percent * 100);
    lines.push(`> progress: ${pct}%${progress.completedAt ? ' · finished' : ''}`);
  }
  lines.push('');

  if (highlights.length > 0) {
    lines.push('## highlights');
    lines.push('');
    for (const h of highlights) {
      const where = h.chapter ? `*${h.chapter}* · ` : '';
      lines.push(`- (${h.color}) ${where}\`${h.anchor.primary}\``);
      lines.push(`  > ${h.text.replace(/\n+/g, ' ')}`);
      if (h.note) {
        lines.push(`  - note: ${h.note.replace(/\n+/g, ' ')}`);
      }
      if (h.status === 'drifted') lines.push('  - *drifted — re-anchored on last open*');
      if (h.status === 'ambiguous')
        lines.push('  - *needs review — the text moved and arivo could not place it with confidence*');
      if (h.status === 'orphaned') lines.push('  - *orphaned — text not found in current edition*');
      lines.push('');
    }
  }

  if (bookmarks.length > 0) {
    lines.push('## bookmarks');
    lines.push('');
    for (const b of bookmarks) {
      const where = b.chapter ? `*${b.chapter}*` : '—';
      lines.push(`- ${where} · \`${b.anchor.primary}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
