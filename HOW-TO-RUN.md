# How to run Cadence

The project lives at `~/Projects/cadence` on the Linux machine. Everything
below assumes you are there:

```bash
cd ~/Projects/cadence
```

## The easy way

```bash
./start-cadence.sh
```

It installs dependencies on first run, starts the dev server and opens your
browser. **Ctrl+C** stops it.

To get it into the Omarchy app launcher, drop a desktop entry in
`~/.local/share/applications/cadence.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Cadence
Comment=Start the Cadence dev server
Exec=alacritty -e /home/steve/Projects/cadence/start-cadence.sh
Terminal=false
Categories=Development;
```

Swap `alacritty` for whichever terminal you are running if you have changed it.

## The manual way

```bash
npm run dev
```

Then open <http://localhost:3000>. Leave the terminal open while you use the
app.

## The other commands

| What you want | Command |
| --- | --- |
| Run the app for everyday use | `npm run dev` |
| Check nothing is broken (lint + 400 checks) | `npm run verify` |
| Update the in-app FAQ after editing FAQ.md | `npm run faq` |
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

If the phone cannot reach it, the firewall is the usual reason. Omarchy ships
`ufw` enabled, so open the port on your local network only:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 3000 proto tcp
```

Adjust the range if your router hands out something other than `192.168.x.x`
(`ip -4 addr` will tell you). To close it again afterwards, repeat the command
with `delete` in front of `allow`.

## If something goes wrong

- **`./start-cadence.sh: Permission denied`** — the executable bit was lost,
  usually by copying the folder around. `chmod +x start-cadence.sh` restores it.
- **"npm: command not found"** — Node isn't installed. `sudo pacman -S nodejs npm`.
- **"Port 3000 is already in use"** — a server is already running somewhere.
  `ss -tlnp | grep 3000` finds it, or just open <http://localhost:3000>.
- **"Another git process seems to be running"** — a stale lock. Delete
  `~/Projects/cadence/.git/index.lock` and try again.
- **The page loads but looks wrong after an update** — hard refresh with
  **Ctrl+Shift+R**. The service worker caches aggressively on purpose.
- **Every file shows as modified right after cloning** — line endings. The
  repo normalises to LF via `.gitattributes`; `git add --renormalize .` sorts
  out a working copy that predates it.

## On Windows

The Windows launcher is still in the repo. Double-click **`start-cadence.cmd`**,
or from PowerShell in the project folder:

```powershell
npm run dev
```

Everything under *The other commands* above works there too — the npm scripts
are the same on both machines.
