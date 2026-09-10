// Flat ESLint config. The point of having this at all is narrow: the four
// verify suites prove the ARITHMETIC is right - that a paycheque on the 31st
// lands correctly in February - but they never mount a component, so they are
// blind to the class of bug that lives in React itself. A value captured stale
// in a closure, an effect that re-runs when it shouldn't, a variable that is
// quietly undefined. Those are what this catches.
//
// Deliberately not a style guide. Nothing here reformats code or argues about
// quotes; every rule below describes a way the app can actually misbehave.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  // The app itself: browser globals, JSX, ES modules.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Without this, every component is reported as an unused import: the
      // base no-unused-vars rule reads plain JS and cannot see that <Dashboard
      // /> is a use of `Dashboard`. This teaches it to look inside JSX.
      'react/jsx-uses-vars': 'error',

      // The two that matter most here, both promoted to errors so a broken
      // push fails rather than prints a warning nobody reads.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Unused variables are usually harmless, but an unused CAUGHT ERROR or a
      // leftover import is a sign that a code path was rewritten and something
      // got orphaned - worth looking at. Args are exempt: a handler that
      // ignores its event is normal and fine.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],

      // Silent data corruption, both of them: `==` coerces types before
      // comparing, and a `case` that falls through does two things when it
      // was meant to do one.
      eqeqeq: ['error', 'always'],
      'no-fallthrough': 'error',
    },
  },

  // The service worker runs in a different global scope entirely - no window,
  // no document, but `self`, `caches` and `clients` all exist.
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...globals.browser },
    },
    rules: { ...js.configs.recommended.rules, eqeqeq: ['error', 'always'] },
  },

  // Build and verification scripts: node, not a browser.
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
    },
  },
]
