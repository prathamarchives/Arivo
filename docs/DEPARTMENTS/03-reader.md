# dept 03 — reader engineering

owns: the reading engines.

- epub adapter: epub.js paginated, spine navigation, cfi locations,
  selection → anchor, annotation rendering, drift repair via text match +
  cfi re-minting. themes injected as style elements per section.
- pdf adapter: pdfjs-dist, canvas + text layer, page anchors with
  normalized rects, zoom/fit, night = canvas inversion.
- progress: relocated events → throttled save (2s) + on exit. sessions
  begin/end on open/close.

ship checks: read → close → reopen → same spot. a highlight survives a
font-size change. night mode is genuinely dark.
