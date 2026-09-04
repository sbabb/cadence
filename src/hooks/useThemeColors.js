import { createContext, useContext } from 'react'
import { DEFAULT_RAMP_COLORS } from '../utils/color.js'

// The active theme's four ramp colours, published to whoever needs them.
//
// The bar's colour is computed in JavaScript rather than CSS - the OKLCH
// interpolation has no CSS equivalent, and the debug panel needs the resolved
// hex as a value it can print - so those four colours have to reach the
// components as data. Two things rule out the obvious alternatives:
//
//   - A module-level variable set from an effect would be written AFTER the
//     render that changed the theme, so the bar would spend one frame drawn in
//     the old palette. Colour is the thing this component exists to show; a
//     stale frame of it is exactly the bug worth avoiding.
//   - Threading a prop through would mean adding a colour argument to
//     PeriodPager, which renders the dashboard but has nothing to do with
//     colour, purely to hand it onward.
//
// Context is neither: it's read during render, so it can't lag, and only the
// two components that actually care ever mention it.
export const ThemeColorsContext = createContext(DEFAULT_RAMP_COLORS)

export default function useThemeColors() {
  return useContext(ThemeColorsContext)
}
