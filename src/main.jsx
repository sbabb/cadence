import React from 'react'
import ReactDOM from 'react-dom/client'
// JetBrains Mono, bundled rather than pulled from a CDN. The app has no
// backend and stores everything locally, so it should keep working - and
// looking right - with no network at all. Latin subset only, three weights,
// ~72KB total.
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import App from './App.jsx'
import { STORAGE_KEY } from './hooks/useBudgetData.js'
import { applyTheme, getTheme, DEFAULT_THEME } from './utils/themes.js'
import './index.css'

// Paint the saved theme before React mounts.
//
// index.css declares Tokyo Night's values on :root as the built-in default, so
// applying the theme from an effect inside App would let one indigo frame
// through on the way to a Latte user's white app. Reading localStorage
// directly here is a little blunt, but it's the only code that runs early
// enough to beat the first paint, and it fails silently to the default if
// storage is unavailable or the saved blob is malformed.
function bootTheme() {
  let id = DEFAULT_THEME
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.settings && parsed.settings.theme) id = parsed.settings.theme
    }
  } catch {
    // Private-mode storage, quota errors, corrupted JSON - all mean "use the
    // default", and none of them should stop the app rendering.
  }
  applyTheme(getTheme(id))
}

bootTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
