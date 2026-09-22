# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension that re-shades the GitHub contribution calendar using
fixed thresholds (`THRESHOLDS` in `src/shade.ts`) instead of GitHub's max-derived
cutoffs.  There is no options page, background worker, network access, or storage;
`PRIVACY.md` promises that, so keep it true.

## Commands

pnpm, Node >=22.18 (the TypeScript `eslint.config.ts` relies on Node's native type
stripping).

```
pnpm run build     # webpack src/content.ts -> github-contributions-shade/github-contributions-shade.min.js
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
src/content.ts  (content script, bundled by webpack)
   │  sweep on load, then MutationObserver(childList, subtree) → rAF-coalesced sweep
   ▼
src/shade.ts    (pure DOM logic, no chrome.* APIs)
   applyLevels(root)
     tooltipTexts(root): tool-tip[for=<cell id>] → text
     parseCount(text)  : "20 contributions on …" → 20
     levelFor(count)   : bucket against THRESHOLDS → 0..4
     writes data-level and aria-describedby="contribution-graph-legend-level-N"
   ▼
GitHub's own CSS repaints the cell (no colors are overridden, so themes keep working)
```

- `shade.ts` must stay free of extension APIs.  That is what lets the tests import it
  directly and run it in a real browser via the WebdriverIO **browser runner**
  (`runner: ["browser", …]`), with no extension host involved.  Tests build fake
  calendar fragments shaped like GitHub's markup (see the `calendar()` and `legend()`
  helpers in `test/shade.test.ts`).
- The observer watches `childList` only, never attributes, so the extension's own
  writes don't wake it.  `applyLevels` skips cells that are already at the right level.
- Legend swatches share the `ContributionCalendar-day` class but are `div`s, so only
  `td` cells get re-leveled.
- Sources import siblings as `./shade.js`; webpack's `extensionAlias` maps that back to
  `.ts`.  webpack overrides `noEmit: false` for ts-loader.
- Content-script `matches` in `github-contributions-shade/manifest.json` are limited to
  `github.com/albertyw`.  The Chrome Web Store treats these as host permissions.

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
