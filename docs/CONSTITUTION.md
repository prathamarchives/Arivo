# arivo — the constitution

> the laws. every agent, every session, every line. a violation is a bug.

## the product

arivo is a **reading environment** — not a prettier reader. the book is the
source, the reading experience is the surface, and your annotations, behavior,
and ideas become a personal knowledge layer. local-first, optionally cloud,
forever portable.

the golden path, perfect, is the only v0.1 metric:

```
import → open beautifully → read comfortably → annotate naturally
→ organize → search → close → reopen → everything is where you left it
→ export → walk away with everything
```

## the twelve laws

1. **local-first.** the app works fully offline. accounts and cloud are
   optional acceleration, never dependencies.
2. **the folder is the truth.** `~/Arivo/` is a complete, human-readable
   export. `annotations.json` per book is written FIRST; the sqlite index is
   rebuildable from it. deleting the index costs zero data.
3. **the anchor contract.** every annotation stores primary (cfi / page) +
   textRange (exact, prefix, suffix) + position (chapter, percent).
   resolution: primary → text → position → visible drift → visible orphan.
   never silent loss. a highlight surviving a font-size change is the test.
4. **the format contract.** the reader, annotations, search, and progress
   speak only to the format plugin interface. no format-specific code above
   `packages/reader`. a new format is a new plugin, never a fork.
5. **reading is quiet.** chrome fades when reading. the text is the
   interface. no effect runs during uninterrupted reading. selection is an
   intellectual action — it settles, it never sparkles.
6. **closed vocabulary.** every color, size, duration, and easing comes from
   the token files. no component invents a value. monochrome base; the five
   annotation colors are the only hue.
7. **domain purity.** `packages/core` has zero ui, zero electron, zero
   sqlite. pure typescript, testable anywhere.
8. **the dependency law.** core ← database/documents ← reader/ui ← app.
   nothing imports upward. the renderer never imports electron. enforced in
   eslint.
9. **the epub is untrusted input.** contextIsolation on, nodeIntegration
   off, sandbox on. we read strings and one image; we never execute content.
10. **behavior is data.** every open-to-close is a reading session. nothing
    is paywalled that the user made.
11. **json-first writes.** every mutation writes the truth file before the
    index. crash after the json write = stale index = rebuild fixes. never
    the reverse.
12. **the evening build.** arivo is the side project. the sends own the day.

## the bans

no saas dashboard. no glass everywhere. no rainbow gradients. no random
bounce. no card-in-card. no magic numbers. no 20-item menus. no toolbar over
reading text. no effect without a reason. no silent data loss, ever.

## the honest scope of v0.1

- pdf is a fixed-layout reading experience: render, zoom/fit, page
  bookmarks, text-layer highlights when the text layer exists. scanned
  pages = page bookmarks only, said plainly. no reflow.
- no sync, no ai, no knowledge layer. those wait for the usage month.
