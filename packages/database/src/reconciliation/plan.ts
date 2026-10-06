/**
 * PLAN — turn classified states into an explicit action list. planning is
 * pure; applying is where mutation happens, and only from this list.
 * ordering: MISSING rows drop FIRST (their hash stops being a duplicate
 * target), then registrations run oldest-first (addedAt, then id) so
 * duplicate resolution is deterministic — same library, same winner, every
 * time.
 */
import type { ClassifiedBook, PlanAction } from './types.ts';

export function planFromClassification(books: ClassifiedBook[]): PlanAction[] {
  interface Registration {
    action: PlanAction;
    addedAt: number;
    id: string;
  }
  const drops: PlanAction[] = [];
  const registrations: Registration[] = [];
  const rest: PlanAction[] = [];

  for (const b of books) {
    const obs = b.observed;
    const addedAt = obs?.meta?.addedAt ?? Number.MAX_SAFE_INTEGER;
    const fingerprint = obs
      ? {
          hash: obs.contentHash ?? obs.meta?.hash ?? '',
          fileSize: obs.bookFileSize ?? obs.meta?.fileSize ?? 0,
          fileMtime: obs.bookFileMtime ?? obs.meta?.fileMtime ?? 0,
          fileName: obs.bookFileName ?? obs.meta?.fileName ?? '',
        }
      : null;
    switch (b.state) {
      case 'NEW':
        registrations.push({
          action: { kind: 'register', id: b.id, dir: obs!.dir, ...fingerprint! },
          addedAt,
          id: b.id,
        });
        break;
      case 'STALE_INDEX':
        registrations.push({
          action: { kind: 'rebuildRow', id: b.id, dir: obs!.dir, ...fingerprint! },
          addedAt,
          id: b.id,
        });
        break;
      case 'ORPHANED_DATA':
        if (!b.indexRow) {
          registrations.push({
            action: { kind: 'register', id: b.id, dir: obs!.dir, ...fingerprint! },
            addedAt,
            id: b.id,
          });
        }
        rest.push({ kind: 'markFileMissing', id: b.id, dir: obs!.dir, missing: true });
        break;
      case 'UNCHANGED':
        if (obs?.meta && b.reason.includes('fingerprint backfill') && obs.bookFileMtime !== null) {
          rest.push({
            kind: 'refreshFingerprint',
            id: b.id,
            dir: obs.dir,
            hash: obs.contentHash!,
            fileSize: obs.bookFileSize!,
            fileMtime: obs.bookFileMtime!,
            fileName: obs.bookFileName!,
          });
        }
        break;
      case 'MODIFIED': {
        const o = obs!;
        rest.push({
          kind: 'markModified',
          id: b.id,
          dir: o.dir,
          hash: o.contentHash!,
          fileSize: o.bookFileSize!,
          fileMtime: o.bookFileMtime!,
          fileName: o.bookFileName!,
        });
        break;
      }
      case 'MISSING':
        drops.push({ kind: 'dropRow', id: b.id, reason: b.reason });
        break;
      case 'CORRUPT':
        rest.push({ kind: 'reportOnly', id: b.id, state: 'CORRUPT', reason: b.reason });
        break;
      case 'SUPPRESSED':
        rest.push({ kind: 'reportOnly', id: b.id, state: 'SUPPRESSED', reason: b.reason });
        break;
      case 'DUPLICATE':
        rest.push({ kind: 'suppress', id: b.id, dir: obs!.dir, duplicateOf: b.duplicateOf! });
        break;
    }
  }

  registrations.sort((a, b) => a.addedAt - b.addedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // drops first (frees duplicate targets), then registrations (deterministic
  // winner order), then the rest — markFileMissing always follows its register
  return [...drops, ...registrations.map((r) => r.action), ...rest];
}
