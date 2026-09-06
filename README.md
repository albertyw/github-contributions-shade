# GitHub Contributions Shade

> The before/after screenshot is pending; it will be added once the extension has been
> loaded locally and captured.

![Before and after](img/before-after.png)

[![Build Status](https://drone.albertyw.com/api/badges/albertyw/github-contributions-shade/status.svg)](https://drone.albertyw.com/albertyw/github-contributions-shade)
[![Maintainability](https://qlty.sh/badges/3dd6baf2-69fb-477f-a245-f65e6cab9284/maintainability.svg)](https://qlty.sh/gh/albertyw/projects/github-contributions-shade)
[![Code Coverage](https://qlty.sh/badges/3dd6baf2-69fb-477f-a245-f65e6cab9284/coverage.svg)](https://qlty.sh/gh/albertyw/projects/github-contributions-shade)

A Chrome extension that re-shades the GitHub contribution calendar using fixed
thresholds, so a single unusual day cannot flatten the rest of the year.

## About

GitHub paints each day of the contribution calendar in one of five shades, and it
derives the cutoffs between those shades from the largest single day in the window.
That makes the whole calendar hostage to one number: a single outlier day rescales
every other day on the graph.

That is exactly what happened here.  On 2026-07-26 this account recorded 31
contributions — an accident, far above any other day.  It set the maximum, which pushed
the top cutoff to roughly 24, and the darkest shade ended up describing essentially that
one day.  Measured on 2026-09-04 across the trailing 371 days:

| Shade   | Days |                                    |
| ------- | ---- | ---------------------------------- |
| level 0 |    2 |                                    |
| level 1 |  160 |                                    |
| level 2 |   99 |                                    |
| level 3 |  110 |                                    |
| level 4 |    5 | ← the outlier, and almost nothing else |

Five days out of 371 reached the darkest shade while 160 sat at the lightest.  The
underlying distribution is perfectly healthy — only one zero day, and nonzero quartiles
at 4, 9 and 17 — so it is not the data that is flat, only the cutoffs that are wrong
for it.

This extension replaces those cutoffs with fixed thresholds.  Because they are
constants, no single day can rescale the others.

## How it works

The extension reads each day's contribution count out of the tooltip GitHub already
renders, recomputes which shade level that count belongs to, and writes the level back
onto the cell:

```
 page load / year-tab AJAX swap
            │
            ▼
  querySelectorAll("td.ContributionCalendar-day")
            │ per cell
            ▼
  tool-tip[for=<cell.id>]  ──►  "20 contributions on August 31st."
            │                              │ parseCount()
            ▼                              ▼
    levelFor(20, [1, 7, 13, 19])  ◄────────┘
            │
            ▼  level 4
  cell.dataset.level = "4"
  cell.setAttribute("aria-describedby", "…legend-level-4")
            │
            ▼
  GitHub's own CSS repaints the square
```

Nothing about the page's colors is overridden.  The extension only changes which
*level* a day belongs to and lets GitHub paint it, so the light, dark, dimmed and
colorblind themes all keep working exactly as they do without the extension.
`aria-describedby` is updated alongside `data-level`, so the screen-reader description
of a day stays consistent with its shade.

A `MutationObserver` re-runs the sweep when GitHub replaces part of the page — switching
year tabs swaps the calendar over AJAX, and the tooltips are appended after the table
renders.  It watches `childList` only, never attributes, so the extension's own writes
cannot retrigger it.

## Thresholds

| Level | Contributions | Days, with this extension |
| ----- | ------------- | ------------------------- |
| 0     | 0             | 1                         |
| 1     | 1–6           | 143                       |
| 2     | 7–12          | 83                        |
| 3     | 13–18         | 72                        |
| 4     | 19+           | 72                        |

The thresholds are constants, not settings — there is no options page.  To change them,
edit `THRESHOLDS` in `src/shade.ts`, run `pnpm run build`, and reload the extension.

## Privacy

The extension requests no permissions, makes no network requests, and stores nothing.
It runs only on `github.com/albertyw`, and it only reads and writes the calendar's DOM
on the page you are already looking at.  The manifest is 21 lines and the two source
files are about 140 lines including comments; both are worth reading before installing
anything that touches your browser.

## Development

### Layout

- `src/` — TypeScript sources.
  - `shade.ts` — the logic: parse a count, bucket it into a level, apply levels to a
    DOM subtree.  Pure DOM manipulation with no extension APIs, which is what makes it
    testable outside an extension host.
  - `content.ts` — the content script: sweeps on load and installs the observer.
- `github-contributions-shade/` — the extension itself, and the directory that gets
  zipped.
  - `manifest.json` — Manifest V3 declaration.
  - `github-contributions-shade.min.js` — webpack output, not checked in.
- `test/` — WebdriverIO browser tests run with Mocha.
- `webpack.config.js` — bundles `src/content.ts` into the extension directory.

### Setup

```
pnpm install
```

Node >=18 is required (see `engines` in `package.json`).

### Common commands

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm run build`    | Bundle `src/content.ts` into the extension directory  |
| `pnpm run eslint`   | Lint sources, tests and config                        |
| `pnpm run tsc`      | Type check                                            |
| `pnpm run wdio`     | Run the WebdriverIO test suite                        |
| `pnpm test`         | `build` + `eslint` + `tsc` + `wdio`                   |
| `pnpm run package`  | Clean, build, and produce the zip                     |
| `pnpm run clean`    | Remove the built bundle and the zip                   |

### Browsers

The test suite runs in Chrome.

WebdriverIO would otherwise download its own Chrome for Testing build and a matching
chromedriver, and Google publishes those only for `linux-x86_64` — on arm64 the download
produces a binary that cannot execute.  So `wdio.conf.js` looks for an already installed
Chrome or Chromium first, checking the usual locations including snap's.  Nothing needs
configuring on a machine that has a browser installed.

`CHROME_BINARY` and `CHROMEDRIVER_BINARY` override that search, which is how CI points
at the Chromium its image installs.  `CHROME_BINARY` must be the real executable rather
than a launcher wrapper: snap's `/snap/bin/chromium` is a wrapper, and the executable
lives at `/snap/chromium/current/usr/lib/chromium-browser/chrome`.

### Loading the extension locally

The extension is not published anywhere.  Install it from a local build.

1. `pnpm run build`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the `github-contributions-shade/` directory
4. Visit <https://github.com/albertyw> and look at the contribution calendar

## Testing

```
pnpm test
```

## Releasing a New Version

There is no upload step: this extension is not distributed to the Chrome Web Store or
to npm.  A release is only a marker in this repository's history.

1. Update `CHANGELOG.md`
2. Bump the version in `package.json` and `github-contributions-shade/manifest.json`
3. Commit and tag the release

`pnpm run package` produces `github-contributions-shade.zip` on demand if you want to
hand someone a build, but that zip is a build artifact rather than a release.

## License

MIT — see [LICENSE](LICENSE).
