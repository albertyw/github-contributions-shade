# Privacy Policy

_Effective October 3, 2026_

GitHub Contributions Shade is a browser extension that re-shades the contribution
calendar on GitHub profile pages.  This policy describes what the extension does with
your data: nothing is sent to the developer or anyone else.

## Data collection

The extension does not collect, transmit, sell, or share any personal or non-personal
data.  It has no analytics, no telemetry, no advertising, and no remote servers.

## What the extension stores

The only data the extension stores is the settings you enter on its options page: a
list of GitHub usernames and the four shading thresholds for each.  They are kept in
Chrome's extension storage (`chrome.storage.sync`).  If you have Chrome sync turned on,
Chrome syncs them through your Google account to your other browsers, under
[Google's Privacy Policy](https://policies.google.com/privacy); the developer never
receives them.  Removing a username on the options page and saving deletes it, and
uninstalling the extension deletes all of them.

## What the extension accesses

The extension runs a content script on github.com pages so that it can tell which
profile you are viewing.  On the profile of a username you have listed, it reads the
contribution counts that GitHub has already rendered in the calendar and changes the
color level of each calendar cell.  On any other page it changes nothing.  This happens
entirely within the page in your browser.  The counts are not saved and are discarded
when you leave the page.

The extension does not:

- make any network requests;
- use cookies or `localStorage`;
- read your GitHub credentials, session, or any page content beyond the calendar and
  the address of the page;
- request any extension permissions beyond running on github.com pages and `storage`
  for your settings.

## Third parties

No data is shared with third parties because no data is collected.  Your settings
sync only through Chrome's own sync, if you have turned it on.  Your use of GitHub
itself is governed by
[GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Changes

Any change to this policy will be published in this file in the extension's source
repository, with an updated effective date.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/albertyw/github-contributions-shade/issues>.
