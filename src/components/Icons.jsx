// Small inline SVG glyphs for the header buttons.
//
// Deliberately not Unicode dingbats or emoji: "⚙" renders as a full-colour
// emoji on several platforms, which sits badly beside monospace type and
// ignores the button's own colour. These inherit `currentColor`, so they dim
// and brighten with the button they live in, and stay monochrome everywhere.
//
// Drawn on a 12x12 grid at 1.5 stroke to match the weight of the text.

export function TrendsIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="1,9.5 4,5.5 7,7.5 11,2" />
    </svg>
  )
}

// Sliders rather than a gear: a cogwheel needs far more detail than 12px
// allows and turns to mush, while two tracks with handles stays legible.
export function SettingsIcon() {
  return (
    <svg
      className="button-icon"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="1" y1="4" x2="11" y2="4" />
      <line x1="1" y1="8.5" x2="11" y2="8.5" />
      <circle cx="4" cy="4" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
