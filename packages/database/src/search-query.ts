/**
 * THE SEARCH QUERY LAYER — raw user input never becomes FTS syntax.
 * queries are tokenized, sanitized to word characters, and each token is
 * quoted + prefix-starred. FTS operators (AND/OR/NOT/NEAR/^, quotes,
 * colons, stars) are consumed as plain text, never executed.
 */
const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 64;

/**
 * sanitize one raw token to a safe FTS phrase body: strip double quotes and
 * backslashes (phrase-breakers), then keep word-ish characters only.
 * CJK passes through: unicode61 tokenizes continuous CJK as one token.
 */
function sanitizeToken(raw: string): string {
  return raw
    .replace(/["\\]/g, '')
    .replace(/[^\p{L}\p{N}_'-]/gu, '')
    .slice(0, MAX_TOKEN_LENGTH);
}

/**
 * build a safe prefix query: `"tok1"* "tok2"*` …
 * returns null when nothing searchable remains (empty, punctuation-only,
 * over-long queries are all no-ops, never errors).
 */
export function toFtsPrefixQuery(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return null;
  const tokens = raw
    .split(/\s+/)
    .map(sanitizeToken)
    .filter((t) => t.length >= 1);
  if (tokens.length === 0) return null;
  return tokens
    .slice(0, MAX_TOKENS)
    .map((t) => `"${t}"*`)
    .join(' ');
}
