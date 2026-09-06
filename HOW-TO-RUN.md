# How to run Cadence

Two ways. Pick either.

## The easy way

Double-click **`start-cadence.cmd`** in this folder. It handles everything and
opens the app in your browser.

To make that even easier: right-click `start-cadence.cmd` →
**Show more options** → **Send to** → **Desktop (create shortcut)**.

## The PowerShell way

Open PowerShell and run:

```powershell
cd D:\16_BudgetingApp
npm run dev
```

Then open <http://localhost:3000>.

Leave the window open while you use the app. **Ctrl+C** stops the server.

## The other commands

Run these from `D:\16_BudgetingApp` in PowerShell.

| What you want | Command |
| --- | --- |
| Run the app for everyday use | `npm run dev` |
| Check nothing is broken (255 checks) | `npm run verify` |
| Make the real production build | `npm run build` |
| Look at that production build | `npm run preview` |
| Reinstall dependencies (rarely needed) | `npm install` |

## Testing on your phone

While `npm run dev` is running, look for the line that says **Network:** — it
will be something like `http://192.168.1.42:3000`. Type that into your phone's
browser while the phone is on the same wifi.

That gets the app onto your phone's screen, but it will **not** offer to
install to the home screen — that needs HTTPS, which means the GitHub Pages
address, not this one.

## If something goes wrong

- **"npm is not recognized"** — Node.js isn't installed or isn't on your PATH.
  Reinstall from nodejs.org and open a fresh PowerShell window.
- **"Port 3000 is already in use"** — the server is already running in another
  window. Close that window, or just open <http://localhost:3000>.
- **"Another git process seems to be running"** — a stale lock. Delete the file
  `D:\16_BudgetingApp\.git\index.lock` and try again.
- **The page loads but looks wrong after an update** — hard refresh with
  **Ctrl+Shift+R**. The service worker caches aggressively on purpose.
