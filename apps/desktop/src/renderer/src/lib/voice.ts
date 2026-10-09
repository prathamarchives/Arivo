/**
 * the voice (L13) — one vocabulary, plain language, no leakage.
 *
 * the product's nouns are fixed: shelf, desk, archive, book, mark,
 * note, question, research, make, reflect, document, passage. the
 * failure vocabulary states what happened, what is affected, and
 * what the reader can do — never stack terminology, never internal
 * module names.
 *
 * plainError is the guard at every surface: only OUR coded errors
 * (RemoteError carries code + our own message) may speak; anything
 * else — a parser's internals, a driver's grumble — becomes the
 * surface's plain fallback.
 */

/** the product's own dictionary — the nouns the surfaces speak.
 *  v0.3.2: the archive vocabulary retired; the reading surface's nouns
 *  stay. the notebook's nouns arrive with the notebook. */
export const VOICE_NOUNS = [
  'shelf',
  'desk',
  'book',
  'highlight',
  'note',
  'question',
  'sticky',
  'bookmark',
  'passage',
] as const;

/**
 * the one error translator. our coded errors (RemoteError over IPC,
 * ArivoError in-process) already speak plainly — their message passes.
 * anything else is an internal we never show: the fallback speaks.
 */
export function plainError(err: unknown, fallback: string): string {
  const e = err as { code?: unknown; message?: unknown };
  if (
    e &&
    typeof e.code === 'string' &&
    typeof e.code === 'string' &&
    e.code.length > 0 &&
    typeof e.message === 'string' &&
    e.message.length > 0
  ) {
    return e.message;
  }
  return fallback;
}
