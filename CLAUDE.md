# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension that re-shades the GitHub contribution calendar using
per-username thresholds set on an options page, instead of GitHub's max-derived
cutoffs.  Profiles without an entry keep GitHub's shading.  Settings live in
`chrome.storage.sync`.  There is no background worker and no network access;
`PRIVACY.md` promises that and describes the stored settings, so keep it true.

## Commands

pnpm, Node >=22.18 (the TypeScript `eslint.config.ts` relies on Node's native type
stripping).

```
pnpm run build     # webpack -> github-contributions-shade/{github-contributions-shade,options}.min.js
pnpm run eslint
pnpm run tsc       # type check only; tsconfig has noEmit
pnpm run wdio      # browser tests + coverage gate
pnpm test          # build + eslint + tsc + wdio (what CI runs)
pnpm run package   # clean + build + zip into github-contributions-shade.zip
```

Single test file or test name.  Call wdio directly: extra args passed to `pnpm run wdio`
land after its trailing `test -s .coverage/clover.xml` and break it.

```
pnpm exec wdio run ./wdio.conf.ts --spec test/shade.test.ts
pnpm exec wdio run ./wdio.conf.ts --mochaOpts.grep "levelFor"
```

A filtered run can fail the coverage thresholds in `wdio.conf.ts` (100% statements,
lines, and functions; 90% branches) even when every selected test passes.

## Architecture

```
options.html + src/options.ts ──save──► chrome.storage.sync { users: { login: [t1..t4] } }
  (src/options-page.ts passes the real storage;                │
   tests pass a fake)                                          │ get on load, onChanged
                                                               ▼
src/content.ts  (content script on https://github.com/*)
   │  sweep after settings load, on MutationObserver(childList, subtree), and on
   │  settings change, rAF-coalesced
   │  src/settings.ts: profileLogin(location.pathname) → users.get(login) ?? null
   ▼
src/shade.ts    (pure DOM logic, no chrome.* APIs)
   applyLevels(root, thresholds | null)
     tooltipTexts(root): tool-tip[for=<cell id>] → text
     parseCount(text)  : "20 contributions on …" → 20
     levelFor(count)   : bucket against thresholds → 0..4
     writes data-level and aria-describedby="contribution-graph-legend-level-N",
     saving GitHub's level in data-shade-original-level on first change
   null → restore cells from data-shade-original-level
   ▼
GitHub's own CSS repaints the cell (no colors are overridden, so themes keep working)
```

- `shade.ts` and `settings.ts` must stay free of extension APIs, and `options.ts` takes
  storage as a parameter.  The entry points `content.ts` and `options-page.ts` are the
  only files touching `chrome.*`; tests don't load them.  That is what lets the tests
  import the other modules directly and run them in a real browser via the WebdriverIO
  **browser runner** (`runner: ["browser", …]`), with no extension host involved.
  `test/options.test.ts` passes an in-memory `FakeStorage`, which also fires
  `onChanged` for writes.  Tests build fake calendar fragments shaped like GitHub's
  markup (see the `calendar()` and `legend()` helpers in `test/shade.test.ts`).
- The observer watches `childList` only, never attributes, so the extension's own
  writes don't wake it.  `applyLevels` skips cells that are already at the right level.
- Legend swatches share the `ContributionCalendar-day` class but are `div`s, so only
  `td` cells get re-leveled.
- Sources import siblings as `./shade.js`; webpack's `extensionAlias` maps that back to
  `.ts`.  webpack overrides `noEmit: false` for ts-loader.
- The options page saves the whole `users` map at once, so it listens to
  `storage.onChanged`: with no local edits it re-renders, otherwise it warns that saving
  would overwrite the other window's change.  It tracks unsaved edits for its status
  line and a `beforeunload` guard, counting edits so a save only marks the page clean
  if nothing changed while it was in flight.  Users see the shades named by `SHADE_NAMES`
  (Lightest, Medium-light, Medium-dark, Darkest); code and DOM say level 1-4.
- `content.ts` skips sweeping on pages it has never shaded, so most GitHub pages cost
  nothing.
- Logins are stored and compared lowercase (`normalizeLogin`), since GitHub serves
  `/AlbertYW` and `/albertyw` as the same profile.  Valid thresholds are 4 integers ≥ 1,
  strictly increasing (`validThresholds`); `parseUsers` drops anything else from storage.
- Content-script `matches` is `https://github.com/*` because the profile is chosen at
  runtime.  The Chrome Web Store treats it as a host permission.
- `@types/chrome` declares a global `browser`, which shadows WebdriverIO's; tests that
  need it import `browser` from `@wdio/globals`.

## Test browser

`wdio.conf.ts` prefers an installed Chrome/Chromium and chromedriver over WebdriverIO's
Chrome for Testing download, which doesn't work on arm64 Linux.
`CHROME_BINARY`/`CHROMEDRIVER_BINARY` override the search (CI sets them to
`/usr/bin/chromium` and `/usr/bin/chromedriver`).  `CHROME_BINARY` must be the real
executable, not snap's `/snap/bin/chromium` wrapper.  The `transformRequest` hook works
around Node 26's undici rejecting headers that the webdriver package sets manually.
`WDIO_LOG_LEVEL` controls log verbosity.

## Releases and versions

The version appears in both `package.json` and `github-contributions-shade/manifest.json`.
They must match, and `CHANGELOG.md` gets updated along with them.  The `.min.js` bundle
and the zip are build artifacts and are not checked in.
