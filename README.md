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
- **A dial you tap to log.** It depletes as you spend and shifts continuously
  green → amber → red. Go over and it runs *backwards* through zero in red
  rather than just bottoming out.
- **Any day, not just today.** Forgot yesterday? Tap that row and the dial
  follows it, showing that day's figures and its historical limit.
- **Rollover you can see.** Overspend and it tells you what tomorrow drops to —
  but only when the figure genuinely falls.
- **Period history** you swipe back through, an end-of-period summary that
  states the facts without moralising, and a trends chart across every period.

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
node scripts/verify-engine.mjs   # engine regression suite, no dependencies
```

## Design

Terminal-adjacent, deliberately not a generic SaaS dashboard: sharp corners, no
shadows or gradients, borders rather than fills to carry state, and colour
always paired with a number or a word. The palette is Tokyo Night, defined once
as CSS custom properties so nothing downstream invents its own hex.

The dial's colour ramp interpolates in **OKLCH** rather than RGB. Rotating hue
the short way from green (~130°) to red (~10°) passes through yellow and orange,
so amber falls out for free without being specified, and perceived brightness
stays even — the same blend in RGB sags into a muddy olive at the midpoint. The
ramp is weighted rather than linear: green holds through 65% of the day's limit,
because spending your allowance as intended shouldn't look like a warning.

Motion timings live in one exported table (`src/utils/motion.js`) that the
in-app debug panel reads from, so the documented spec and the running animation
can't drift apart. `prefers-reduced-motion` is honoured throughout.

## Structure

```
src/
  App.jsx              screen router, end-of-period state machine
  utils/
    budgetEngine.js    the algorithm above — pure, fully tested
    cadence.js         payday arithmetic and period derivation
    color.js           sRGB <-> OKLCH conversion and the ramp
    motion.js          durations and easing curves, single source of truth
    dateUtils.js       'YYYY-MM-DD' date maths
  hooks/
    useBudgetData.js   localStorage state
    useAnimatedValue.js  rAF interpolation
  components/          screens and widgets
scripts/
  verify-engine.mjs    55 scenarios, run with plain node
```

Everything is a pure recompute: the engine derives the whole period from its
entry list on every render, so editing a past day recalculates every subsequent
limit for free. There is no incremental cache to get out of step.

## Stack

React 18 with plain function components and hooks — no state library. Vite 7.
JetBrains Mono, self-hosted rather than pulled from a CDN so the app looks right
offline. `localStorage` only (key `budgetHabitTracker.v1`); nothing leaves the
browser and there is no backend.

## Note

The dashboard carries four buttons prefixed `DEV:` — reset data, clear today's
log, preview the period summary, and a motion debug panel. They are development
scaffolding and are meant to be removed before any real deployment.
