import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset URLs, so one build runs from anywhere: a domain root, a
  // GitHub Pages project path like /cadence/, a preview URL, or a folder
  // opened locally. The alternative is hardcoding the deploy path at build
  // time and rebuilding whenever it changes, which is a footgun for an app
  // meant to be handed around as a link.
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 3000,
    host: true
  }
})
