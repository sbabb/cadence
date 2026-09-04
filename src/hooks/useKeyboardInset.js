import { useEffect, useState } from 'react'

// How many pixels at the bottom of the layout viewport are currently covered
// by something the browser has drawn over the page - in practice, the
// on-screen keyboard.
//
// `interactive-widget=resizes-content` in index.html is the real fix and is
// what modern Chrome for Android honours: it shrinks the LAYOUT viewport when
// the keyboard opens, so a `position: fixed` sheet stops at the top of the
// keyboard on its own and this hook measures nothing. This exists for
// everywhere that doesn't honour it - iOS Safari never resizes the layout
// viewport for the keyboard, and older Android WebViews ignore the hint -
// where the VISUAL viewport is the only thing that reports the keyboard at all.
//
// The two can't double up, because they're measured from the same number:
// whichever mechanism the browser applies, the other one reads as zero.
export default function useKeyboardInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined

    const measure = () => {
      // Everything below the bottom edge of the visual viewport is obscured.
      // offsetTop counts because the browser also shifts the visual viewport
      // upward to keep the focused field in sight, and that shift comes out of
      // the same budget.
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      // A collapsing address bar and sub-pixel rounding both show up here as a
      // few stray pixels. No keyboard is 40px tall, so anything smaller is
      // noise and gets ignored rather than nudging the sheet around.
      setInset(hidden > 40 ? Math.round(hidden) : 0)
    }

    measure()
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [])

  return inset
}
