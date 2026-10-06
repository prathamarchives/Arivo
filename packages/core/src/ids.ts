/** uuidv7 — time-ordered, locally generated, no server needed. */
export function uuidv7(): string {
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(16));
  const bytes = new Uint8Array(16);
  // 48-bit big-endian timestamp
  const ts = BigInt(now);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ts >> BigInt(40 - i * 8)) & 0xffn);
  }
  bytes.set(rand.subarray(0, 10), 6);
  // version 7
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  // variant
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  // hex without Buffer — this must run in the sandboxed renderer too
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** short id for display: first 8 chars of any uuid */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
