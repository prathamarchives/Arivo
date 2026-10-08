#!/usr/bin/env node
/**
 * builds test-fixtures/fixture.pdf — the deterministic synthetic pdf the
 * reader substrate's tests + live verification run against (the pdf twin
 * of fixture.epub). 12 letter pages of real selectable text, a real
 * outline (parts → chapters), and an info dict (title/author/subject).
 *
 * no pdf library: the bytes are written by hand so the fixture can never
 * depend on a generator's quirks. deterministic — the same bytes every run.
 *
 * usage: node scripts/make-pdf-fixture.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = 12;
const W = 612;
const H = 792;
const OUT = join(import.meta.dirname, '..', 'test-fixtures', 'fixture.pdf');

const lines = (page) => {
  const body = [
    `Arivo Field Notes, page ${page} of ${PAGES}.`,
    'The reading room keeps its own time, and the pages of a fixed-layout',
    'document hold their geometry exactly as the printer set them.',
    'Select any passage on this page to prove the text layer is live:',
    `evidence marker ${page}-${page}${page}${page} anchors this sheet,`,
    'and a highlight drawn here must survive zoom, resize, and reopen.',
  ];
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const text = body[i];
    // absolute placement per line; the font rides in every block (text
    // state persists across BT/ET, but the FIRST Tj needs a Tf first)
    out.push(`BT /F1 11 Tf 1 0 0 1 72 ${640 - i * 28} Tm (${escape(text)}) Tj ET`);
  }
  return out.join('\n');
};

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// ---------- object assembly ----------
const objects = []; // [objNumber, bytes]
const pageObjNums = [];
let maxObj = 0;
const add = (num, content) => {
  objects[num] = content;
  maxObj = Math.max(maxObj, num);
  return num;
};

// 1: catalog, 2: pages-tree, 3: outlines — reserved first
// 10: font, 4..: pages, contents, outline items, info
const fontNum = 10;
add(fontNum, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

const outlineSpec = [
  { title: 'Part One', page: 1, children: [{ title: 'Chapter 1 - The Room', page: 1 }, { title: 'Chapter 2 - The Desk', page: 5 }] },
  { title: 'Part Two', page: 9, children: [] },
];
let nextObj = 11;
const contentNums = [];
const pageNums = [];
for (let p = 1; p <= PAGES; p++) {
  const body = `${lines(p)}\nBT /F1 24 Tf 1 0 0 1 72 700 Tm (${escape(`Part ${p <= 8 ? 'One' : 'Two'} - ${p <= 4 ? 'Chapter 1' : p <= 8 ? 'Chapter 2' : 'Notes'}`)}) Tj ET\n`;
  const contentNum = nextObj++;
  contentNums.push(contentNum);
  add(
    contentNum,
    `<< /Length ${body.length} >>\nstream\n${body}endstream`,
  );
  const pageNum = nextObj++;
  pageNums.push(pageNum);
  pageObjNums.push(pageNum);
  add(
    pageNum,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
  );
}
add(2, `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${PAGES} >>`);

// outline items (leaf-first numbering so /First//Next chains are stable)
const outlineNums = [];
const buildOutline = (spec) => {
  const num = nextObj++;
  const children = (spec.children ?? []).map(buildOutline);
  return { num, title: spec.title, page: spec.page, children };
};
const roots = outlineSpec.map(buildOutline);
// chains: root items link /Next; children link /Next among themselves
const linkSiblings = (items) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const first = item.children[0];
    const last = item.children.at(-1);
    const o = {
      Title: `(${escape(item.title)})`,
      Parent: null, // filled below
      Dest: `[${pageNums[item.page - 1]} 0 R /XYZ null null null]`,
    };
    if (item.children.length > 0 && first && last) {
      o.First = `${first.num} 0 R`;
      o.Last = `${last.num} 0 R`;
      o.Count = item.children.length;
    }
    if (i > 0) o.Prev = `${items[i - 1].num} 0 R`;
    if (i < items.length - 1) o.Next = `${items[i + 1].num} 0 R`;
    item.dict = o;
    linkSiblings(item.children);
  }
};
linkSiblings(roots);
const stampParents = (items, parentNum) => {
  for (const it of items) {
    it.dict.Parent = `${parentNum} 0 R`;
    add(it.num, `<< ${Object.entries(it.dict).map(([k, v]) => `/${k} ${v}`).join(' ')} >>`);
    stampParents(it.children, it.num);
  }
};
const outlineRoot = 3;
const firstRoot = roots[0];
const lastRoot = roots.at(-1);
add(outlineRoot, `<< /Type /Outlines /First ${firstRoot.num} 0 R /Last ${lastRoot.num} 0 R /Count ${roots.length + roots.reduce((n, r) => n + r.children.length, 0)} >>`);
stampParents(roots, outlineRoot);

const infoNum = nextObj++;
add(
  infoNum,
  `<< /Title (Arivo Field Notes) /Author (A. Reader) /Subject (a synthetic pdf for substrate verification) /Creator (arivo fixture script) /Producer (arivo fixture script) >>`,
);
add(1, `<< /Type /Catalog /Pages 2 0 R /Outlines ${outlineRoot} 0 R /PageMode /UseOutlines >>`);

// ---------- byte assembly with a real xref ----------
const chunks = ['%PDF-1.4\n'];
const offsets = new Map();
let pos = chunks[0].length;
for (let num = 1; num <= maxObj; num++) {
  const content = objects[num];
  if (content === undefined) continue;
  const chunk = `${num} 0 obj\n${content}\nendobj\n`;
  offsets.set(num, pos);
  chunks.push(chunk);
  pos += chunk.length;
}
const xrefStart = pos;
const xrefCount = maxObj + 1;
const xref = [`xref\n0 ${xrefCount}\n0000000000 65535 f \n`];
for (let num = 1; num < xrefCount; num++) {
  const off = offsets.get(num);
  if (off === undefined) {
    xref.push('0000000000 00000 f \n'); // free slot
  } else {
    xref.push(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
}
chunks.push(xref.join(''));
chunks.push(`trailer\n<< /Size ${xrefCount} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

writeFileSync(OUT, Buffer.from(chunks.join(''), 'latin1'));
console.log(`fixture written: ${OUT} (${PAGES} pages, ${roots.length + roots.reduce((n, r) => n + r.children.length, 0)} outline entries)`);
