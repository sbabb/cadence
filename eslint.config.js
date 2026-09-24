// Flat ESLint config. The point of having this at all is narrow: the verify
// suites prove the ARITHMETIC is right - that a paycheque on the 31st
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
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // There used to be a react/jsx-uses-vars here, and eslint-plugin-react
      // with it, because no-unused-vars could not see that <Dashboard /> is a
      // use of `Dashboard`. ESLint 10 tracks JSX references itself, so the
      // plugin had nothing left to do - and it was the one thing holding the
      // project on an unsupported ESLint.

      // Named one by one rather than spreading the plugin's recommended set.
      // From v7 that set also carries the React Compiler's rules, which flag
      // setState in effects and refs written during render - six places here,
      // among them useBackDismiss, which is not code to reshape in passing.
      // Whether to take those on is its own decision; upgrading the linter
      // should not make it silently.
      //
      // These two matter most, both promoted to errors so a broken push fails
      // rather than prints a warning nobody reads.
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
