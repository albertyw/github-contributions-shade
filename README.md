# GitHub Contributions Shade

Before:

![Before](img/before.png)

After:

![After](img/after.png)

[![Build Status](https://drone.albertyw.com/api/badges/albertyw/github-contributions-shade/status.svg)](https://drone.albertyw.com/albertyw/github-contributions-shade)
[![Maintainability](https://qlty.sh/badges/3dd6baf2-69fb-477f-a245-f65e6cab9284/maintainability.svg)](https://qlty.sh/gh/albertyw/projects/github-contributions-shade)
[![Code Coverage](https://qlty.sh/badges/3dd6baf2-69fb-477f-a245-f65e6cab9284/coverage.svg)](https://qlty.sh/gh/albertyw/projects/github-contributions-shade)

<!--
Chrome Web Store description: everything between the BEGIN and END markers is pasted
verbatim into the developer dashboard, so keep it plain text (no Markdown syntax
beyond "- " lists and bare URLs), one line per paragraph, and under 16,000 characters.
-->
<!-- BEGIN STORE DESCRIPTION -->
GitHub Contributions Shade re-shades the contribution calendar on GitHub profile pages using fixed thresholds, so a single unusual day cannot wash out the rest of the year.

WHY

GitHub paints each day of the contribution calendar in one of five shades, and it derives the cutoffs between those shades from the busiest single day in the window. That makes the whole calendar hostage to one number: a single outlier day rescales every other day on the graph.

That is exactly what happened on the profile this extension was built for. One accidental day of 31 contributions, far above any other, pushed GitHub's top cutoff to roughly 24. Across the trailing 371 days, only 5 days reached the darkest shade while 160 sat at the lightest, even though the underlying activity was steady: just one day with no contributions, and the middle half of active days fell between 4 and 17 contributions. The data was fine; the cutoffs were wrong for it.

This extension replaces GitHub's cutoffs with constants, so no single day can rescale the others. With them, the same year spreads across the five shades as 1, 143, 83, 72 and 72 days.

THRESHOLDS

- Empty: no contributions
- Shade 1 (lightest): 1 to 6 contributions
- Shade 2: 7 to 12 contributions
- Shade 3: 13 to 18 contributions
- Shade 4 (darkest): 19 or more contributions

HOW IT WORKS

- It reads each day's contribution count from the tooltip GitHub already renders, works out which shade that count belongs to, and sets that shade on the day's square.
- It does not override any colors. GitHub's own styles paint the square, so the light, dark, dimmed and colorblind themes all keep working exactly as before.
- The screen-reader description of each day is updated along with its shade, so the two stay consistent.
- Switching between year tabs on the profile is handled automatically.
- There is nothing to configure: no options page, no toolbar button, no settings.

WHERE IT RUNS

The extension currently runs only on the GitHub profile at https://github.com/albertyw and pages under it. It does nothing on any other website or on any other GitHub profile.

PRIVACY

- No data is collected, stored, transmitted, sold or shared.
- No network requests, no analytics, no cookies, no storage.
- No extension permissions beyond running on the pages listed above.
- Everything happens inside the page you are already viewing, and the counts it reads are discarded when you leave.

Privacy policy: https://github.com/albertyw/github-contributions-shade/blob/master/PRIVACY.md

OPEN SOURCE

The extension is open source under the MIT license. The source code is about 140 lines of TypeScript and is worth reading before installing anything that touches your browser: https://github.com/albertyw/github-contributions-shade

Bug reports and questions: https://github.com/albertyw/github-contributions-shade/issues
<!-- END STORE DESCRIPTION -->

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

## Changing the thresholds

The thresholds are constants, not settings.  To change them, edit `THRESHOLDS` in
`src/shade.ts`, run `pnpm run build`, and reload the extension.  The profiles it runs
on are the content-script `matches` in `github-contributions-shade/manifest.json`.

## Development

### Layout

- `src/` — TypeScript sources.
  - `shade.ts` — the logic: parse a count, bucket it into a level, apply levels to a
    DOM subtree.  Pure DOM manipulation with no extension APIs, which is what makes it
    testable outside an extension host.
  - `content.ts` — the content script: sweeps on load and installs the observer.
  - `icon.png` — the icon as originally drawn, kept as the design reference.
- `github-contributions-shade/` — the extension itself, and the directory that gets
  zipped.
  - `manifest.json` — Manifest V3 declaration.
  - `github-contributions-shade.min.js` — webpack output, not checked in.
  - `icons/` — `icon16.png`, `icon32.png`, `icon48.png` and `icon128.png`, the four
    sizes Chrome asks for.
- `test/` — WebdriverIO browser tests run with Mocha.
- `webpack.config.ts` — bundles `src/content.ts` into the extension directory.

### Setup

```
pnpm install
```

Node >=22.18 is required (see `engines` in `package.json`).

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
produces a binary that cannot execute.  So `wdio.conf.ts` looks for an already installed
Chrome or Chromium first, checking the usual locations including snap's.  Nothing needs
configuring on a machine that has a browser installed.

`CHROME_BINARY` and `CHROMEDRIVER_BINARY` override that search, which is how CI points
at the Chromium its image installs.  `CHROME_BINARY` must be the real executable rather
than a launcher wrapper: snap's `/snap/bin/chromium` is a wrapper, and the executable
lives at `/snap/chromium/current/usr/lib/chromium-browser/chrome`.

### Loading the extension locally

To try a development build, install it unpacked.

1. `pnpm run build`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the `github-contributions-shade/` directory
4. Visit <https://github.com/albertyw> and look at the contribution calendar

## Testing

```
pnpm test
```

## Releasing a New Version

The extension is distributed through the Chrome Web Store.

1. Update `CHANGELOG.md`
2. Bump the version in `package.json` and `github-contributions-shade/manifest.json`
3. Commit and tag the release
4. `pnpm run package` to produce `github-contributions-shade.zip`
5. Upload the zip in the Chrome Web Store developer dashboard

## License

MIT — see [LICENSE](LICENSE).
