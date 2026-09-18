// Where everything sits on the saved report-card image.
//
// The image is drawn on a canvas rather than screenshotted from the page, so
// that it looks the same on every device - the screenshot libraries mangle
// webfonts and CSS variables, and this app is built entirely on both. That
// means the layout has to be computed rather than inherited from a stylesheet,
// and computing it here, as plain arithmetic over a content model, is what
// lets a script check it. The painter in reportCardImage.js does no thinking:
// it walks this list and draws it.
//
// Coordinates are in image pixels at SCALE 1. The painter multiplies by the
// device pixel ratio so the text is sharp on a phone.

export const CARD_WIDTH = 1080

const PAD = 72
const TITLE_SIZE = 46
const RANGE_SIZE = 30
const ROW_LABEL_SIZE = 28
const ROW_VALUE_SIZE = 36
const ROW_HEIGHT = 74
const ASSESSMENT_SIZE = 38
const FOOTER_SIZE = 24
const RULE_GAP = 34

// One entry per thing drawn. `kind` is either 'text' or 'rule'; the painter
// needs no other vocabulary.
export function reportCardLayout(card) {
  const items = []
  const left = PAD
  const right = CARD_WIDTH - PAD
  let y = PAD

  y += TITLE_SIZE
  items.push({ kind: 'text', text: card.title, x: left, y, size: TITLE_SIZE, align: 'left', color: 'text', tracking: 6 })

  y += RANGE_SIZE + 22
  items.push({ kind: 'text', text: card.range, x: left, y, size: RANGE_SIZE, align: 'left', color: 'dim' })

  y += RULE_GAP
  items.push({ kind: 'rule', x1: left, x2: right, y, color: 'border' })

  // Rows are drawn on a shared baseline per row: the label small on the left,
  // the figure larger on the right, which is the same pairing the app's stat
  // rows use on screen.
  y += RULE_GAP
  for (const row of card.rows) {
    const baseline = y + ROW_VALUE_SIZE
    items.push({ kind: 'text', text: row.label, x: left, y: baseline, size: ROW_LABEL_SIZE, align: 'left', color: 'dim' })
    items.push({ kind: 'text', text: row.value, x: right, y: baseline, size: ROW_VALUE_SIZE, align: 'right', color: 'text' })
    y += ROW_HEIGHT
  }

  y += RULE_GAP - ROW_HEIGHT + ROW_VALUE_SIZE
  items.push({ kind: 'rule', x1: left, x2: right, y, color: 'border' })

  // The verdict gets the only colour on the card, and it is centred because it
  // is the one line that is about the period as a whole rather than a figure
  // in a column.
  y += RULE_GAP + ASSESSMENT_SIZE
  items.push({
    kind: 'text',
    text: card.assessment.text,
    x: CARD_WIDTH / 2,
    y,
    size: ASSESSMENT_SIZE,
    align: 'center',
    color: card.assessment.tone,
    tracking: 2
  })

  y += FOOTER_SIZE + 46
  items.push({ kind: 'text', text: `> ${card.footer}`, x: left, y, size: FOOTER_SIZE, align: 'left', color: 'dim', tracking: 4 })

  return { width: CARD_WIDTH, height: Math.round(y + PAD), items }
}
