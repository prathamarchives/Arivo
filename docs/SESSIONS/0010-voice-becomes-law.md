# session 0010 — the voice becomes law (L13)

> starting commit: 7ac8cd9 (L12 landed, 425/2 green)
> branch: campaign/experience-v0.8

## objective

L13 — the content/voice audit: no SaaS language, no corporate filler,
no startup-ese, no AI marketing, no internal leakage; one fixed
vocabulary; errors that say what happened, what is affected, and what
the user can do.

## the audit's honest result

the app was already written in its own voice — the sweep found **zero
banned vocabulary** in any user-facing string (the first draft of the
law caught only code identifiers — `subscribe()`, the room's
`engagement` state — and was refined to scan string literals only;
test files are developer-facing and excluded). the toasts speak the
product's language: "quote collected — research started", "question
kept", "the document stayed — try again".

the real gaps were two:

1. **raw internal messages could reach users.** the reader's boot
   catch and the archive's read catch displayed `err.message` — our
   coded errors (RemoteError over IPC) speak plainly, but an epub.js
   parser failure or a driver's internals would surface verbatim.
   fixed: `lib/voice.ts` — `plainError(err, fallback)` lets only our
   coded errors speak; everything else becomes the surface's plain
   language. both surfaces now use it (and the law forbids the raw
   pattern from returning).
2. **the archive's error state had no way out.** the reader's error
   offered "back to the shelf"; the archive's offered only the
   message. fixed: "go to the shelf" joins it — every error surface
   speaks the full contract.

## the law

`tests/voice.test.ts` (5 laws):

1. no banned vocabulary (26 phrases: productivity, workspace,
   workflow, seamless, empower, supercharge, ai-powered, best-in-
   class, premium, free trial, …) in any user-facing string literal
   of the renderer
2. the fixed nouns (shelf, desk, archive, book, mark, note, question,
   research, make, reflect, document, passage) live where the product
   defines itself
3. error surfaces speak the full contract — what happened + a way out
4. plainError passes our coded messages, turns internals into the
   plain fallback
5. the renderer never displays a raw `err.message` — plainError owns
   every surface

`VOICE_NOUNS` is exported from lib/voice.ts — the dictionary the
whole product speaks.

## verification

- **P2**: typecheck + lint clean; **430 passed / 2 skipped** (+5 voice
  laws)
- **P3**: the live surfaces render as before (the voice was already
  honest); the guards are static law

## next

L14 — the accessibility/responsive campaign: keyboard, focus, SR
labels, reduced motion as spatial state, responsive identity.
