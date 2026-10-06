# recovery — trust as a product feature

> recovery isn't invisible. arivo names what happened, rebuilds from the
> truth, and reports the numbers.

## the startup sequence

```
open index
  ├─ corruption detected (typed DATABASE_CORRUPT)
  │    → move the damaged file aside (forensics)
  │    → fresh index → rebuild from the library folders
  │    → recovery note ("N books, M highlights, 0 annotations lost")
  └─ clean open
reconcile the library to a fixed point
report (diagnostics events + the recovery banner in the ui)
```

code: `apps/desktop/src/main/services/recovery.ts`. the ui shows the
note through the `recovery:note` channel — `app.tsx` `RecoveryBanner`.

## crash safety (proven with real SIGKILLs)

- **single-file truth writes** are atomic: temp → fsync → rename →
  dir-fsync. `crash.test.ts` kills child processes at four controlled
  points (`after-temp-write`, `after-fsync`, `before-rename`,
  `after-rename`); the live file is always old-or-new, never partial
- **imports** commit with one atomic directory rename out of
  `library/.staging/` — a crash leaves either a complete book or
  sweepable staging (reconciliation sweeps it at next startup)
- **the index** runs sqlite WAL + `synchronous = FULL`
- **the journal** (`@arivo/persistence` MutationJournal) records
  in-flight multi-step operations; torn final lines read as "something
  was interrupted" — evidence for the diagnostics, never guesswork

## truth corruption

- `annotations.json` corrupted → salvage from `.bak` (the writeTruth
  rotation) → else an empty truth with a diagnostic — the app never
  crashes, the book stays, the notes export still works
  (`destroy.test.ts` proves both paths)

## the failure model

`docs/FAILURE-MODEL.md` is the full matrix (23 failures, expected
results, detection, proof). every row traces to a test.

## what arivo never does

never guesses an ambiguous anchor. never deletes a user file. never
writes a truth file non-atomically. never reports "something went wrong"
when it can name the failure. never loses annotations to a crash, a
corrupt index, or a rebuild.
