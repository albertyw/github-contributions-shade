# Privacy Policy

_Effective September 21, 2026_

GitHub Contributions Shade is a browser extension that re-shades the contribution
calendar on GitHub profile pages.  This policy describes what the extension does with
your data: nothing leaves your browser.

## Data collection

The extension does not collect, store, transmit, sell, or share any personal or
non-personal data.  It has no analytics, no telemetry, no advertising, and no remote
servers.

## What the extension accesses

The extension runs a content script only on the GitHub pages listed in its manifest.
On those pages it reads the contribution counts that GitHub has already rendered in the
calendar and changes the color level of each calendar cell.  This happens entirely
within the page in your browser.  The counts are not saved and are discarded when you
leave the page.

The extension does not:

- make any network requests;
- use cookies, `localStorage`, or extension storage;
- read your GitHub credentials, session, or any page content beyond the calendar;
- request any extension permissions beyond running on those GitHub pages.

## Third parties

No data is shared with third parties because no data is collected.  Your use of GitHub
itself is governed by
[GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Changes

Any change to this policy will be published in this file in the extension's source
repository, with an updated effective date.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/albertyw/github-contributions-shade/issues>.
