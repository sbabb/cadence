# Cadence

A habit-forming daily spend tracker. Not a finance app — no bank connections,
no categories, no cents. Whole dollars only, always rounded up.

The idea is that a budget you have to think about is a budget you abandon.
Cadence asks one question a day — *what did you spend?* — and answers one in
return: *what can you spend today?*

## The algorithm

This is the part worth reading, because the obvious version is wrong.

Each pay period has a discretionary budget: whatever's left after rent, bills
and savings. The naive way to get a daily limit is to divide what's left by the
calendar days remaining. That breaks the moment you miss a day — skip three
days of logging and your limit lurches upwards, as if not tracking had earned
you money.

Cadence divides by the days you haven't *tracked* yet instead:

```
dailyLimit = ceil(remainingBudget / (totalPeriodDays - daysActuallyLogged))
```

Two consequences fall out of that. A day nobody logged doesn't shrink the
divisor and doesn't touch the budget — its share simply stays in the pool for
whichever day gets tracked next, so $500 over 14 days stays about $36/day even
after a gap. And if you *do* log every day, the maths reduces exactly to
"what's left ÷ days left", including on the final day, which absorbs the
remainder.

Unlogged days are never backfilled as $0. A day you deliberately log as $0 is a
tracked day and a small achievement; a day you ignored is unknown. The app
refuses to confuse the two, and that principle governs the rest of the
data model too — periods are only ever created for time you actually lived
through, never generated in advance.

## What it does

- **Payday-based setup.** Tell it when you were last paid, how often, and how
  much you can spend. It derives the period. Weekly, every two weeks (26/yr),
  twice a month (24/yr), monthly, or set your own dates.
- **A bar you tap to log.** It depletes as you spend and shifts continuously
  green → amber → red. Go over and it refills *backwards* from zero in red
  rather than just bottoming out.
- **Any day, not just today.** Forgot yesterday? Tap that row and the bar
  follows it, showing that day's figures and its historical limit.
- **Rollover you can see.** Overspend and it tells you what tomorrow drops to —
  but only when the figure genuinely falls.
- **Five themes**, switchable in Settings and applied instantly.
- **Period history** you swipe back through, an end-of-period summary that
  states the facts without moralising, and a trends chart across every period —
  tap any bar to jump straight to that period.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test on a phone, use the `Network:` URL it
prints — the dev server is exposed to the local network.

```bash
npm run build      # production build
npm run preview    # serve the build
npm run verify     # both suites below, no dependencies, plain node
```

- `scripts/verify-engine.mjs` — 66 scenarios over the algorithm above.
- `scripts/verify-themes.mjs` — contrast and colour-ramp checks for every
  theme. See *Themes* below for why this one isn't optional.

## Design

Terminal-adjacent, deliberately not a generic SaaS dashboard: sharp corners, no
shadows or gradients, borders rather than fills to carry state, and colour
always paired with a number or a word.

The bar's colour ramp interpolates in **OKLCH** rather than RGB. Rotating hue
the short way from green (~130°) to red (~10°) passes through yellow and orange,
so amber falls out for free without being specified, and perceived brightness
stays even — the same blend in RGB sags into a muddy olive at the midpoint. The
ramp is weighted rather than linear: green holds through 65% of the day's limit,
because spending your allowance as intended shouldn't look like a warning.

A faint field of 2–3px squares drifts up out of the bar and fades before it
reaches the figure, in whatever colour the bar currently is. It is decoration
and nothing else — it carries no data, sits behind every piece of text, and is
removed outright under `prefers-reduced-motion`.

Motion timings live in one exported table (`src/utils/motion.js`) that the
in-app debug panel reads from, so the documented spec and the running animation
can't drift apart. `prefers-reduced-motion` is honoured throughout.

## Themes

Five palettes — Tokyo Night (default), Gruvbox Dark, Catppuccin Mocha, Nord,
and Catppuccin Latte, which is light. Every colour in the app resolves through
a CSS custom property on `:root`, so a theme is a set of values written onto
`documentElement` and nothing downstream needs to know theme switching exists.
The saved theme is applied in `main.jsx` before React mounts, so a Latte user
never sees an indigo frame on the way in.

The green/amber/red the bar mixes through come from the active theme too, which
is the one place a theme can do real damage: Tokyo Night's green on Latte's
near-white background is 1.7:1, which is invisible, and no amount of squinting
at a screenshot reliably catches that before a user does. So
`scripts/verify-themes.mjs` checks all of it arithmetically — WCAG contrast for
every token against every ground, that green/amber/red stay distinguishable
*from each other* in Oklab, that the "deep" red really is darker than the red it
deepens from, that light themes invert elevation correctly, and that no point
along a theme's actual 0–200% colour ramp dips below 3:1 or desaturates toward
grey. Four of the five palettes needed adjusting to pass.

## Edge cases worth knowing about

The awkward cases are handled deliberately rather than left to chance, and each
one has a scenario in the engine suite:

- **A limit never goes negative.** Overspend hard enough and the arithmetic
  wants to hand back `-$38`; the most you may spend is never less than nothing,
  so it floors at `$0` and the debt is reported by REMAINING instead. Left
  unclamped it also drove the colour ramp to a fraction of zero, which painted
  a *green* figure above the words "over today".
- **Storage failures are visible.** There is no backend, so `localStorage` is
  not a cache — it is the only copy. A refused write and an unreadable blob
  each raise a banner, rather than a console message no phone user will see.
  Corrupted data is never quietly presented as a fresh install.
- **Edits that would hide days ask first.** Shrinking a period past logged
  entries doesn't delete them — they return if the range is widened — but they
  vanish from every screen, so it confirms first.
- **Dates are UTC-noon anchored**, which is what keeps a period spanning a
  daylight-saving change at fourteen days, and what stops a timezone change
  mid-period from double-counting or dropping an entry.
- **The spend sheet outranks the end-of-period flow.** A period ending at
  midnight used to unmount the sheet mid-entry; now the summary waits.
- **Untracked gaps stay visible.** Periods only exist for time actually lived
  through, so Trends marks the space between them rather than closing it up.

## Structure

```
src/
  App.jsx              screen router, end-of-period state machine
  main.jsx             entry point; paints the saved theme before first render
  utils/
    budgetEngine.js    the algorithm above — pure, fully tested
    cadence.js         payday arithmetic and period derivation
    color.js           sRGB <-> OKLCH conversion and the ramp
    themes.js          the five palettes and the token writer
    motion.js          durations and easing curves, single source of truth
    dateUtils.js       'YYYY-MM-DD' date maths
  hooks/
    useBudgetData.js   localStorage state
    useAnimatedValue.js  rAF interpolation
    useThemeColors.js  the active ramp colours, via context
    useKeyboardInset.js  visualViewport fallback for the on-screen keyboard
  components/          screens and widgets
scripts/
  verify-engine.mjs    66 scenarios, run with plain node
  verify-themes.mjs    162 colour checks, likewise
```

Everything is a pure recompute: the engine derives the whole period from its
entry list on every render, so editing a past day recalculates every subsequent
limit for free. There is no incremental cache to get out of step.

## Stack

React 18 with plain function components and hooks — no state library. Vite 7.
JetBrains Mono (SIL Open Font License 1.1, free for commercial use), self-hosted
rather than pulled from a CDN so the app looks right offline. `localStorage`
only (key `budgetHabitTracker.v1`); nothing leaves the browser and there is no
backend. A service worker caches the build so it runs with no network, and a web
manifest plus icons make it installable to a home screen over HTTPS.

## Note

The dashboard carries four buttons prefixed `DEV:` — reset data, clear today's
log, preview the period summary, and a motion debug panel. They are development
scaffolding and are meant to be removed before any real deployment.
