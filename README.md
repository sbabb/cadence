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
- **Backup you own.** Export every period and logged day to a file, import it
  back on another phone. There is no account and no server, so this is how a
  history survives a new device — offered in Settings and again at the end of
  each period, which is the natural moment to take a copy.
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
- `scripts/verify-backup.mjs` — 27 checks on the backup format, most of them
  about what it must *refuse*. Importing replaces everything, so a malformed
  file being accepted is the one bug here that destroys data silently.

## Installing it on a phone

The build is path-agnostic (`base: './'`), so one build runs from a domain
root, a project subpath like `/cadence/`, or a preview URL without being
rebuilt. `.github/workflows/deploy.yml` publishes it to GitHub Pages on every
push to `main` — enable it once under **Settings → Pages → Source → GitHub
Actions**, and the verify suites gate every deploy.

Open the resulting HTTPS address on a phone and install it: Chrome offers
*Install app*, and Safari does it via *Share → Add to Home Screen*. **HTTPS is
required** — a plain `http://` LAN address loads fine but will never offer a
real install.

Installing also matters for durability. Browsers treat ordinary site storage as
disposable and may evict it under pressure; an installed app is normally
granted persistent storage instead. The app asks for that automatically and
reports the answer in Settings under *Backup*.

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

A faint field of 2–3px squares drifts in place behind the figure, in whatever
colour the bar currently is. Positions are randomised on every load rather than
laid out by hand, so the field never reads as a pattern, and the column where
the figure and its label sit is excluded outright, so a mote can never land on
a letter. It is decoration and nothing else — it carries no data, sits behind
every piece of text, and is removed outright under `prefers-reduced-motion`.

The fill itself carries two continuous, deliberately small pieces of motion: a
slow brightness pulse and a band of light that crosses it. Both are there to
keep the bar from looking like a static rectangle; neither means anything. The
much more visible breathe on an unlogged day is separate, and does mean
something.

Motion timings live in one exported table (`src/utils/motion.js`), so the
documented spec and the running animation can't drift apart. The CSS-driven
animations repeat those numbers by hand, since CSS cannot read the table.
`prefers-reduced-motion` is honoured throughout.

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
  utils/
    backup.js          backup envelope, validation, summaries — DOM-free
    fileTransfer.js    saving a file out and reading one back in
  hooks/
    useBudgetData.js   localStorage state
    usePersistentStorage.js  asks the browser not to evict that state
    useAnimatedValue.js  rAF interpolation
    useThemeColors.js  the active ramp colours, via context
    useKeyboardInset.js  visualViewport fallback for the on-screen keyboard
  components/          screens and widgets
scripts/
  verify-engine.mjs    66 scenarios, run with plain node
  verify-themes.mjs    162 colour checks, likewise
  verify-backup.mjs    27 backup-format checks, mostly rejections
```

Everything is a pure recompute: the engine derives the whole period from its
entry list on every render, so editing a past day recalculates every subsequent
limit for free. There is no incremental cache to get out of step.

## Stack

React 18 with plain function components and hooks — no state library. Vite 7.
JetBrains Mono (SIL Open Font License 1.1, free for commercial use), self-hosted
rather than pulled from a CDN so the app looks right offline. `localStorage`
only (key `budgetHabitTracker.v1`); nothing leaves the browser and there is no
backend — so a backup file is the only way data moves between devices, and
export/import is a first-class feature rather than an afterthought. A service
worker caches the build so it runs with no network, and a web manifest plus
icons make it installable to a home screen over HTTPS.
