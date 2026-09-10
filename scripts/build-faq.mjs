// Turns FAQ.md into a data module the app can render.
//
// FAQ.md stays the single source of truth. It is the file a person edits, it
// reads fine on GitHub, and this script is the only thing that knows how to
// get it onto a screen - so the document and the in-app version cannot drift
// into disagreeing with each other.
//
// This emits DATA, not HTML. The app renders it with ordinary React elements,
// which keeps the promise that nothing in this codebase ever hands a string to
// dangerouslySetInnerHTML - the FAQ itself makes claims about how safe the app
// is, and it would be a poor joke if displaying them opened the one injection
// hole the rest of the code doesn't have.
//
// It is not a markdown parser. It handles exactly the constructs FAQ.md uses -
// ## headings, **bold** question lines, paragraphs, - bullets, two-column
// tables, *italic*, `code` and --- rules - and throws on anything else rather than silently
// dropping it, so adding a link or a table to FAQ.md fails the build instead
// of quietly vanishing from the app.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'FAQ.md')
const OUT = join(root, 'src/generated/faq.js')

// Inline runs: **bold**, *italic*, `code`. Split on all three at once so the
// scan stays linear and the three cannot nest (they never do in FAQ.md).
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

function inline(text) {
  const parts = []
  for (const piece of text.split(INLINE)) {
    if (!piece) continue
    if (piece.startsWith('**')) parts.push({ b: piece.slice(2, -2) })
    else if (piece.startsWith('`')) parts.push({ c: piece.slice(1, -1) })
    else if (piece.startsWith('*')) parts.push({ i: piece.slice(1, -1) })
    else parts.push(piece)
  }
  // A run with no formatting at all collapses to a bare string, which is most
  // of them - it keeps the generated file readable and roughly a third smaller.
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

const lines = readFileSync(SOURCE, 'utf8').split('\n')
const doc = { title: '', intro: [], sections: [] }

let section = null // the ## we are inside
let block = null   // the current paragraph or bullet list being accumulated
let para = []      // soft-wrapped lines waiting to be joined

// FAQ.md is hard-wrapped at ~80 columns for readability as a document. Those
// line breaks are an artefact of the file, not of the prose, so a paragraph is
// rejoined with spaces before it reaches the app, where it rewraps to whatever
// width the phone actually has.
function flushPara() {
  if (!para.length) return
  const text = para.join(' ').trim()
  para = []
  if (!text) return
  if (block && block.type === 'list') block.items.push(inline(text))
  else target().push({ type: 'p', body: inline(text) })
}

function target() {
  if (!section) return doc.intro
  const last = section.items[section.items.length - 1]
  // Prose that follows a **question** belongs to that question's answer;
  // prose before the first question is section-level lead-in.
  return last ? last.body : section.lead
}

function flushBlock() {
  flushPara()
  if (block && block.type === 'list' && block.items.length) target().push(block)
  if (block && block.type === 'table' && block.rows.length) target().push(block)
  block = null
}

for (const [n, raw] of lines.entries()) {
  const where = `FAQ.md:${n + 1}`
  const line = raw.trimEnd()

  if (!line.trim()) { flushBlock(); continue }

  if (line.startsWith('# ')) {
    flushBlock()
    if (doc.title) throw new Error(`${where}: a second H1; the FAQ should have one title`)
    doc.title = line.slice(2).trim()
    continue
  }

  if (line.startsWith('## ')) {
    flushBlock()
    section = { heading: line.slice(3).trim(), lead: [], items: [] }
    doc.sections.push(section)
    continue
  }

  if (line === '---') { flushBlock(); continue } // a divider in the document, noise in the app

  // A line that is entirely bold, inside a section, is a question.
  const q = /^\*\*(.+)\*\*$/.exec(line.trim())
  if (q && section) {
    flushBlock()
    section.items.push({ q: q[1].trim(), body: [] })
    continue
  }

  // Two-column tables. The pipe rows arrive consecutively, so the header row
  // opens the block and the --- separator under it is skipped. Anything wider
  // than two columns has nowhere to go on a phone, so it is rejected loudly
  // rather than squeezed.
  if (line.trim().startsWith('|')) {
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    if (cells.length !== 2) throw new Error(`${where}: the in-app FAQ renders two-column tables only, got ${cells.length}`)
    if (/^-{2,}$/.test(cells[0])) continue // the header separator
    flushPara()
    if (!block || block.type !== 'table') { flushBlock(); block = { type: 'table', head: cells.map(inline), rows: [] } }
    else block.rows.push(cells.map(inline))
    continue
  }

  if (/^[-*] /.test(line)) {
    flushPara()
    if (!block || block.type !== 'list') { flushBlock(); block = { type: 'list', items: [] } }
    para.push(line.slice(2).trim())
    continue
  }

  if (line.startsWith('#') || line.startsWith('```') || line.includes('](')) {
    throw new Error(`${where}: unsupported markdown for the in-app FAQ: ${line.slice(0, 60)}`)
  }

  para.push(line.trim())
}
flushBlock()

if (!doc.title) throw new Error('FAQ.md has no H1 title')
if (!doc.sections.length) throw new Error('FAQ.md has no ## sections')

const questions = doc.sections.reduce((n, s) => n + s.items.length, 0)

const out = `// GENERATED FILE - do not edit.
//
// Written by scripts/build-faq.mjs from FAQ.md. Edit FAQ.md and the next build
// (or \`npm run faq\`) regenerates this. \`npm run verify\` fails if the two have
// drifted, so a stale copy cannot reach a user.
//
// ${doc.sections.length} sections, ${questions} questions.
export const FAQ = ${JSON.stringify(doc, null, 2)}
`

mkdirSync(dirname(OUT), { recursive: true })

// --check is how verify asks "is the committed file current?" without writing.
if (process.argv.includes('--check')) {
  let existing = null
  try { existing = readFileSync(OUT, 'utf8') } catch { /* never generated */ }
  if (existing !== out) {
    console.error('FAIL: src/generated/faq.js is out of date with FAQ.md. Run `npm run faq`.')
    process.exit(1)
  }
  console.log(`PASS: the in-app FAQ matches FAQ.md (${doc.sections.length} sections, ${questions} questions)`)
} else {
  writeFileSync(OUT, out)
  console.log(`Wrote src/generated/faq.js - ${doc.sections.length} sections, ${questions} questions`)
}
