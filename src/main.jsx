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
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
