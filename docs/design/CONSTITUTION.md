# arivo — the design constitution (L1)

> the experience laws, encoded. like `docs/CONSTITUTION.md`, these are not
> metaphors — they are enforced in tokens, tested in vitest, and checked in
> review. a violation is a bug. the thesis behind these laws is
> `EXPERIENCE.md`.

## identity

1. arivo is a personal intellectual environment, not a generic reader.
2. the architecture is swiss; the objects are human.
3. the system stays quiet so the user's work can become expressive.
4. arivo never depends on decoration for personality.
5. **remove the logo and it must still feel like arivo.**

## hierarchy

6. content outranks chrome.
7. the current object of thought is the primary visual focus.
8. one primary attention target dominates unless the user enters an
   explicit multi-focus workspace.
9. whitespace is a structural element, not leftover space.
10. the user never needs visual noise to understand hierarchy.

## typography

11. ui typography is neutral and transparent — helvetica speaks for the
    room. personality never comes from the typeface.
12. book typography is sovereign — literata speaks for the author. the book
    is never forced onto the ui grid.
13. optical correction may override mathematical alignment.
14. composite typography tokens are canonical: family + size + weight +
    line-height + tracking + role travel together. **no arbitrary
    typography.**
15. the supplied font assets are the implementation, not system fallbacks.
16. the wordmark is `arivo.` — lowercase, full stop attached, quiet.

## geometry

17. spatial values derive from the 4/8 system. the spacing scale is
    `4 8 12 16 24 32 48 64 96 128` — nothing else without a recorded
    exception.
18. arbitrary one-off spacing, radius, or elevation values are forbidden.
19. roundness communicates proximity to the hand:

```
4px structural · 8px surface · 12px interactive · 14px object
16px generous surface · 999px instrument/pill
```

20. nested surfaces preserve coherent concentric corner geometry. visual
    correctness wins over the formula — record the exception.

## material

21. **matte paper is the default surface.** warm, quiet, low reflectivity,
    fine grain, restrained radius, soft shadow.
22. glass is an instrument, never wallpaper — only floating chrome
    (selection menus, command surfaces, mode controls). the walls are matte.
23. ink is the authoritative dark material for high-priority controls and
    lab's serious expression.
24. borders communicate structure; shadows communicate elevation. never
    both for one job.
25. elevation is two shadows — **contact (closeness) + ambient (altitude)**.
    light rooms use warm shadows; dark rooms step surface values before
    piling shadow on shadow.
26. texture supports material meaning; it never hides weak composition.

## motion

27. motion obeys **viscous precision** — immediate → continuous →
    weighted → exact. fast response, continuous travel, mass, exact rest.
28. no visible bounce. no elastic overshoot. no rebound. swiss rails,
    liquid cushion.
29. motion is causal and interruptible. velocity is not discarded on
    interruption where physics permits.
30. duration scales with **mass class** (micro / component / surface /
    spatial), not developer mood.
31. entering may breathe; leaving is brisk. things entering feel lighter
    than things leaving.
32. object continuity: the thing the user touched is the thing that moves —
    book card → reader, selection → instrument, tab → sliding pill.
33. motion never delays reading. reader text is sacred.
34. every motion has a reduced-motion twin. the easing vocabulary is
    glide / retreat / shift / settle — nothing else.

## modes

35. lab and den are authored temperaments, not alternate apps.
36. modes alter atmosphere, density, and selected surface details — never
    information architecture, anatomy, grid, or token structure.
37. booklight is den-only. it changes the light around content, never the
    identity of the room.
38. annotation colors are constant across modes and lighting:

```
amber #DCA93B · sage #6E9951 · blue #4E8FC4 · rose #C66A67 · violet #9074C2
```

## interaction

39. every interactive component has explicit state coverage — rest, hover,
    press, focus, selected, disabled, loading, error, empty.
40. stateful differences are semantic, not arbitrary css accidents.
41. the interface acknowledges proximity; it never chases the pointer.
42. a useful effect justifies its performance cost. a visual effect that
    competes with content is a defect.

## scroll

43. reader scroll is native and sacred — no hijacking, no artificial
    inertia, no blur over glyphs, no decorative motion over text.
44. workspace scroll may use optical effects (edge dissolve near floating
    chrome) only if profiling and review prove them.

## spatial

45. the reader body tops out at **68ch**. the room grows around the page;
    the page does not grow with the monitor.
46. margins are useful space — where tools, notes, references, and
    booklight breathe.
47. z-space is semantic and closed:

```
0 canvas · 1 content · 10 sticky · 20 floating · 30 overlay · 40 transient
```

## anti-slop (never ship by default)

random gradients · arbitrary glass or blur · shadows to fake hierarchy ·
unmotivated animation · particles with no semantic job · giant rounded
cards everywhere · random icon families · raw hex/spacing/duration in
components · duplicated component families · screen-specific design
languages · effects that exist because the gpu can render them · "ai"
chrome that solves no real workflow · making everything float, glow, or
move.

novelty comes from composition, material, spatial relationships,
interaction, motion, object continuity, context, and user expression —
**never from decoration.**

## governance

- the design system is **executable policy**: tokens, canonical
  components, contracts, and the design lab (see `docs/design/LAB.md`).
- experiments live in the lab. **production never consumes an unproven
  effect.**
- violations (raw hex, off-scale spacing, off-grammar radius, unapproved
  family, missing state, invalid motion) are caught by automated checks
  with seeded violations that must fail.
- optical exceptions are allowed but must be recorded in
  `docs/design/DECISIONS.md` — governance never makes optical correction
  impossible.
- gates and still-open decisions live in `docs/design/GATES.md`.

## reopening a locked law

locked laws reopen only on implementation, usability, performance, or
accessibility evidence, or a stronger first-principles argument — with the
reason recorded before the change.
