import { Fragment, useMemo, useState } from 'react'
import { FAQ } from '../generated/faq.js'

// The FAQ, rendered from FAQ.md.
//
// Reached from Settings. The point of having it in the app rather than as a
// link out to GitHub is that it has to work in the two situations where it is
// most wanted: standing next to someone who has just installed it and has a
// question, and offline. A link to a repository fails both.
//
// Sections start collapsed. The document is ~2,300 words; opened flat on a
// phone that is a wall, and the person scrolling it is looking for one answer,
// not reading it through. The headings ARE the index.

// Inline runs from the generator: a bare string, or a list of strings and
// {b}/{i}/{c} marks. Never HTML - see the note at the top of build-faq.mjs.
function Inline({ body }) {
  if (typeof body === 'string') return body
  return (
    <>
      {body.map((part, i) => {
        if (typeof part === 'string') return <Fragment key={i}>{part}</Fragment>
        if (part.b) return <strong key={i}>{part.b}</strong>
        if (part.i) return <em key={i}>{part.i}</em>
        return <code key={i}>{part.c}</code>
      })}
    </>
  )
}

function Blocks({ blocks }) {
  return blocks.map((block, i) => {
    if (block.type === 'p') return <p key={i} className="faq-p"><Inline body={block.body} /></p>
    if (block.type === 'list') {
      return (
        <ul key={i} className="faq-list">
          {block.items.map((item, j) => <li key={j}><Inline body={item} /></li>)}
        </ul>
      )
    }
    return (
      // Two columns and a phone: the wrapper scrolls sideways rather than
      // letting the table force the whole page to.
      <div key={i} className="faq-table-wrap">
        <table className="faq-table">
          <thead>
            <tr>{block.head.map((cell, j) => <th key={j}><Inline body={cell} /></th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, j) => (
              <tr key={j}>{row.map((cell, k) => <td key={k}><Inline body={cell} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  })
}

export default function Faq({ onBack }) {
  const [open, setOpen] = useState(() => new Set())

  const questionCount = useMemo(
    () => FAQ.sections.reduce((n, s) => n + s.items.length, 0),
    []
  )

  function toggle(heading) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(heading)) next.delete(heading)
      else next.add(heading)
      return next
    })
  }

  const allOpen = open.size === FAQ.sections.length

  return (
    <div className="screen faq-screen">
      <h1 className="screen-title">QUESTIONS</h1>

      <Blocks blocks={FAQ.intro} />

      <button
        className="faq-expand-all"
        onClick={() => setOpen(allOpen ? new Set() : new Set(FAQ.sections.map((s) => s.heading)))}
      >
        {allOpen ? 'COLLAPSE ALL' : `EXPAND ALL — ${questionCount} ANSWERS`}
      </button>

      {FAQ.sections.map((section) => {
        const isOpen = open.has(section.heading)
        return (
          <section key={section.heading} className="faq-section">
            <button
              className="faq-section-header"
              onClick={() => toggle(section.heading)}
              aria-expanded={isOpen}
            >
              {/* Rotated by CSS rather than swapped for a different glyph, so
                  the control reads as one thing turning, not two icons. */}
              <span className={isOpen ? 'faq-caret faq-caret-open' : 'faq-caret'}>›</span>
              <span className="faq-section-title">{section.heading}</span>
              {section.items.length > 0 && (
                <span className="faq-section-count">{section.items.length}</span>
              )}
            </button>

            {isOpen && (
              <div className="faq-section-body">
                <Blocks blocks={section.lead} />
                {section.items.map((item) => (
                  <div key={item.q} className="faq-item">
                    <h3 className="faq-q">{item.q}</h3>
                    <Blocks blocks={item.body} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <button className="cancel-button" onClick={onBack}>
        ‹ BACK TO SETTINGS
      </button>
    </div>
  )
}
