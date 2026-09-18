// Paints a report card onto a canvas and hands back a PNG.
//
// Drawn rather than screenshotted on purpose. The DOM-to-image libraries add a
// dependency and routinely mis-render webfonts and CSS custom properties,
// which is the entire visual vocabulary of this app - a card that came out
// wrong on the one phone that matters would be worse than no card at all.
//
// This file does no layout and no arithmetic about what the period did: it
// walks the list reportCardLayout() produced and draws it. Everything it
// decides is about pixels.

import { reportCardLayout } from './reportCardLayout.js'

// The palette is read from the live theme rather than hardcoded, so a card
// saved while the app is in Tokyo Night looks like Tokyo Night.
const COLOR_VARS = {
  bg: '--bg',
  text: '--text',
  dim: '--text-dim',
  border: '--border',
  good: '--green',
  over: '--red',
  neutral: '--text'
}

export function readThemeColors(root = document.documentElement) {
  const style = getComputedStyle(root)
  const out = {}
  for (const [key, variable] of Object.entries(COLOR_VARS)) {
    out[key] = style.getPropertyValue(variable).trim() || '#000000'
  }
  return out
}

// The card is typeset in the app's own font. It is already loaded by the time
// any screen renders, but canvas draws with whatever is available at that
// instant rather than waiting, so an unlucky first tap would produce a card in
// the fallback monospace. Waiting for the font costs nothing.
async function waitForFont() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.ready
  } catch {
    // A browser that cannot tell us is no reason not to draw.
  }
}

function fontFor(size) {
  return `${size}px "JetBrains Mono", ui-monospace, monospace`
}

// Canvas has no letter-spacing on older browsers, and the app's headings are
// tracked out. Drawing character by character costs nothing at this size and
// looks right everywhere.
function drawTracked(ctx, text, x, y, tracking, align) {
  const chars = [...text]
  const width = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + tracking, 0) - tracking
  let cursor = x
  if (align === 'center') cursor = x - width / 2
  else if (align === 'right') cursor = x - width
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + tracking
  }
}

export function paintReportCard(canvas, card, colors, scale = 1) {
  const layout = reportCardLayout(card)
  canvas.width = Math.round(layout.width * scale)
  canvas.height = Math.round(layout.height * scale)

  const ctx = canvas.getContext('2d')
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.textBaseline = 'alphabetic'

  for (const item of layout.items) {
    if (item.kind === 'rule') {
      ctx.fillStyle = colors.border
      ctx.fillRect(item.x1, item.y, item.x2 - item.x1, 1)
      continue
    }
    ctx.fillStyle = colors[item.color] || colors.text
    ctx.font = fontFor(item.size)
    if (item.tracking) {
      ctx.textAlign = 'left'
      drawTracked(ctx, item.text, item.x, item.y, item.tracking, item.align)
    } else {
      ctx.textAlign = item.align
      ctx.fillText(item.text, item.x, item.y)
    }
  }

  return layout
}

// A PNG of the card at the screen's pixel density, capped so a high-DPI phone
// cannot produce a file too large to share.
export async function renderReportCardBlob(card, options = {}) {
  await waitForFont()
  const scale = Math.min(3, Math.max(1, options.scale || (window.devicePixelRatio || 1)))
  const colors = options.colors || readThemeColors()
  const canvas = document.createElement('canvas')
  paintReportCard(canvas, card, colors, scale)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}
