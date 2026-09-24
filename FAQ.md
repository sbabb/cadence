# Cadence — the short answers

Everything people actually ask, with the real numbers rather than reassuring
adjectives. If you only read one section, read **Your data lives on your phone
and nowhere else**. If you are deciding whether to trust it at all, read **Is it
safe to install?**.

---

## The basics

**What does it actually do?**
Asks one question a day — *what did you spend?* — and answers one back: *what
can you spend today?* It divides your discretionary money for the pay period
across the days you have left, and it re-does that sum every time you log
something.

**Is it free?**
Yes. No account, no subscription, no ads, nothing to sign up for.

**Does it connect to my bank?**
No. There is nothing to connect. You type in what you spent.

**Does it track categories, cents, or receipts?**
No. Whole dollars, one number a day. That is the whole design — a budget you
have to think about is a budget you abandon.

**Do I need the internet?**
Only for the very first load. After that it runs entirely offline, including
on a plane or with no signal.

**Which currency?**
Dollars, hardcoded. There is no currency setting, and the `$` will show
whatever country you are in.

---

## Your data lives on your phone and nowhere else

**Where is my data stored?**
In your browser's own storage on that device, under the key
`budgetHabitTracker.v1`. That is the only copy that exists.

**Does anything get sent anywhere?**
No. There is no server, no account, no analytics, no telemetry. Nobody —
including whoever built this — can see what you spend. That is not a privacy
policy, it is just how it is built: there is nothing on the other end to send
it to.

**How much space does it use?**

| History | Stored size |
| --- | --- |
| One year, logged every day | about **15 KB** |
| Five years | about **75 KB** |
| Ten years | about **150 KB** |

For scale, one photo from your phone is roughly 3,000 KB. You will never run
out of room for this.

**Will the browser ever delete it on its own?**
It can. Browsers treat ordinary website storage as disposable and may clear it
when the device runs low on space. Cadence asks the browser to mark its
storage as *persistent*, which exempts it from that — and **installing to your
home screen is what makes browsers say yes.** Check the answer any time under
**Settings → Backup**.

**What definitely erases it?**

- Clearing site data or "browsing data" for the site
- Uninstalling the app from your home screen
- Using a private / incognito window (it is gone the moment you close it)
- Switching to a different browser on the same phone — each one has its own
  separate storage

**So what is my safety net?**
**Settings → EXPORT BACKUP.** It saves a small `cadence-backup-YYYY-MM-DD.json`
file with every period and every logged day in it. Put it somewhere that isn't
the phone — email it to yourself, drop it in cloud storage. Import it on any
device to restore. It is also offered at the end of each period, which is the
natural moment to take one.

**Can I read the backup file?**
Yes, it's plain text JSON. You can open it in any text editor. Import is
deliberately strict, though — a file that has been edited into an invalid shape
gets refused at the door with a reason, rather than half-loaded.

---

## Is it safe to install?

**Can it damage my phone?**
No. Cadence is a web page, and web pages run inside a sandbox enforced by your
browser — by Apple, Google and Mozilla, not by us. Nothing on a web page can
damage hardware, change your operating system settings, reach another app's
data, or touch your files. That holds even if the app has a bug in it.

**Installing it to my home screen doesn't change that?**
No. What gets installed is the same sandboxed page, just without the browser's
address bar around it. It is not a native app and it gains no new powers by
being installed.

**What permissions does it ask for?**
None. No camera, no microphone, no location, no contacts, no photos, no
notifications. The only thing it ever asks the browser is *please don't delete
my storage* — and on Firefox that appears as a prompt you can decline.

**Can my spending data get out?**
There is no code in the app that contacts a network, so there is no channel for
it to leave by. Not "we promise not to" — there is no send function to
misuse. The only way data moves off your device is the backup file you export
yourself.

**Can I check that rather than take your word for it?**
Yes, and it takes about a minute. Open the app on a computer, press **F12**,
click the **Network** tab, then use it — log a spend, change the theme, open
Settings. You will see the files load once and then nothing further. No rows
means nothing is being sent.

**Are there hidden trackers or ads?**
No analytics, no advertising, no third-party scripts of any kind. The font is
served from the app itself rather than pulled from Google, so even loading the
page tells nobody anything.

**So what is the worst that could realistically happen?**
Your Cadence history gets corrupted or lost, or a daily limit comes out wrong.
The first is why **EXPORT BACKUP** exists and why the app warns you rather than
quietly starting over. The second is what the 327 automated checks that run
before every single update are there to catch. Neither one reaches anything
else on your phone.

**Who made this and is it supported?**
One person, as a personal project, given away free under an MIT licence — which
like nearly all free software comes with no warranty. It is offered in good
faith and used at your own discretion. Keep a backup, which is good advice for
anything you would be annoyed to lose.

---

## Two phones, new phones, shared phones

**Does it sync between my phone and my laptop?**
No. There is no sync because there is no server. Each device keeps its own
independent history.

**How do I move to a new phone?**
Export a backup on the old one, install Cadence on the new one, then
**Settings → IMPORT BACKUP**. Importing *replaces* everything on the new
device, so do it before you start logging there.

**I installed it to my home screen but my data isn't there.**
Expected, and it catches everyone. The browser and the installed app are
treated as two separate places, so anything logged while browsing does not
appear in the installed copy. Export from the browser, import into the app.

**Best practice:** install first, then start logging.

---

## How big is it?

**Download, first time:** about **320 KB** of files, of which roughly
**160 KB** actually crosses the network once compressed. That is a fraction of
a single web page these days.

| Piece | Size |
| --- | --- |
| The app itself (JavaScript) | 201 KB → 64 KB compressed |
| Styling | 22 KB → 5 KB compressed |
| JetBrains Mono font, 3 weights | 63 KB |
| Icons | 25 KB |

**After that:** zero. It is cached on the device and loads instantly with no
network at all.

**Installed size on the phone:** the files above plus your history, so well
under half a megabyte in total for years of use.

---

## Installing it

You need the **HTTPS address**, not a local network one. A plain `http://`
address will load the app fine but will never offer a real install.

| Phone | How |
| --- | --- |
| **Android, Chrome** | ⋮ menu → **Install app** |
| **Android, Firefox** | ⋮ menu → **Install** (older builds: *Add to Home screen*) |
| **iPhone, Safari** | Share → **Add to Home Screen** |
| **iPhone, other browsers** | Use Safari. Firefox and Chrome on iOS are Safari underneath anyway, and Safari is the route that reliably works. |

**Why bother installing rather than bookmarking?**
Three things change: it opens full-screen with no browser chrome, it gets a
real icon in your app drawer, and — the important one — the browser stops
treating your history as disposable.

**Firefox asks me for permission to store data.**
Say yes. Firefox prompts out loud about persistent storage where Chrome decides
silently. It appears once you create your first period, and accepting is what
keeps your history out of the browser's automatic cleanup. If you dismissed it,
**Settings → Backup** has a **CHECK AGAIN** button.

---

## Updates

**How does the app update?**
By itself. Next time you open it with a working connection it picks up the
latest version. There is no app store, nothing to approve, and no version
number to check.

**Will an update wipe my data?**
No. Your history is stored separately from the app's code and survives every
update.

**Does it break if I open it while an update is happening?**
No. It waits three seconds for the network, and if it doesn't get a good
answer it opens the copy already on the phone. A slow connection, no
connection, or a server error mid-deploy all end up at the same place: the app
opens.

**I updated and it looks the same / looks wrong.**
Close it completely and reopen. On a desktop browser, hard refresh with
**Ctrl+Shift+R**.

---

## Using it day to day

**What if I forget to log a day?**
Nothing bad. A day you never logged is *unknown*, not zero, and it never
inflates or deflates your limit — its share of money simply stays in the pool
for whichever day you log next. $500 over 14 days stays about $36/day even
after a gap.

**Can I go back and fill in yesterday?**
Yes. Tap any past day in the list and log it there. Everything after it
recalculates automatically.

**Can I log tomorrow in advance?**
No. Future days are refused deliberately — the app only ever records time you
have actually lived through.

**What if I spend nothing?**
Log **$0**. That is a tracked day and it counts. It is different from ignoring
the day, and the app treats them differently.

**What happens if I go over?**
The bar refills backwards from zero in red, and tomorrow's limit drops to
absorb it. Your daily limit never goes negative — it floors at $0 and the debt
shows up under REMAINING instead.

**What happens when a period ends?**
You get a summary of how it went, an offer to save a backup, and the next
period is set up for you based on your pay cadence.

**Can I see that summary again later?**
Yes. Every period's day list ends with a **REPORT CARD** row — the current
period and every finished one. Swipe back to a period, or tap its bar in
Trends, then scroll to the bottom of the days and tap it.

**Can I save a report card as a picture?**
Yes. Open it and tap **SAVE AS IMAGE**. Your phone's share sheet opens, so it
can go straight to Photos, Drive, a message, or an email; if sharing is not
available it saves to your downloads instead. The image is drawn fresh rather
than screenshotted, so it looks the same everywhere and uses whichever theme
you have on.

**I was away for a week and haven't opened it.**
It notices. A gap of three days or more gets acknowledged rather than silently
papered over, and it helps you start fresh.

**How do I change how often I get paid?**
**Settings → Pay Cadence.** Weekly, every two weeks (26/yr), twice a month
(24/yr), monthly, or set your own dates each time.

Note that "every two weeks" and "twice a month" are not the same schedule — 26
pay periods against 24, and only one of them can be right for you. Every two
weeks keeps the same *weekday* and lets the date wander; twice a month keeps the
same *dates* and lets the weekday wander.

If you are paid twice a month, just enter either one of your two paydays and it
works out the other. The 1st and 16th, the 5th and 20th, the 15th and the last
day of the month — all handled, and the last day of the month follows February
without you having to fix it.

**How do I change my budget mid-period?**
**Settings → Edit Current Period** changes the amount and the end date. Every
daily limit recalculates. If shrinking the period would hide days you already
logged, it asks first — and those days come back if you widen it again.

**What does "Abandon Current Period" do?**
Ends the current period today and starts the next one tomorrow. It is an escape
hatch for a period set up wrong, not something you need in normal use.

**Can I change how it looks?**
**Settings → Theme.** Three palettes, darkest to lightest: Tokyo Night (deep
indigo), Slate (neutral grey), Catppuccin Latte (light). Applies instantly, and
your choice survives closing the app.

---

## When something goes wrong

**A warning banner about storage appeared.**
Two different things it might mean:

- **NOT SAVING** — writes are failing (storage full, or a private window).
  Nothing logged since it appeared will survive closing the tab. Free up space,
  and export a backup if it will let you.
- **COULD NOT READ SAVED DATA** — what was stored couldn't be understood, so
  the app started empty. **Don't log anything yet.** The old data may still be
  there, and Cadence deliberately avoids overwriting it — but starting a new
  period will.

**My history vanished and it's showing me the setup screen.**
Something cleared the site's storage. If you have a backup file, import it. If
not, it is gone — there is no server copy to recover. This is the reason export
exists, and the reason to keep one somewhere off the phone.

**Blank screen when I open it.**
Close it fully and reopen. If it persists, open the same address in a normal
browser tab to check the site itself is up.

**It won't offer to install.**
You are almost certainly on an `http://` address. Installing requires HTTPS.

---

*For running the project or building it yourself, see `HOW-TO-RUN.md` and
`README.md`.*
