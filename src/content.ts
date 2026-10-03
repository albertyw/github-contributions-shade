/**
 * Content script entry point.
 *
 * Loads the per-user thresholds, re-levels the contribution calendar of a configured
 * profile, then again whenever GitHub replaces part of the page — switching year tabs
 * swaps the whole calendar over AJAX, and the tool-tip elements carrying the counts are
 * appended after the table itself renders — or whenever the settings change.
 */

import { applyLevels } from "./shade.js";
import { STORAGE_KEY, type Users, parseUsers, profileLogin } from "./settings.js";

let users: Users = new Map();
let scheduled: number | null = null;
/** Whether this page has ever been re-shaded; until then there is nothing to restore. */
let shaded = false;

/*
 * The login is read on every sweep rather than once, because GitHub navigates between
 * pages without reloading, so this script outlives the profile it started on. Most
 * GitHub pages are never shaded, so they skip the document-wide query entirely.
 */
function sweep(): void {
  scheduled = null;
  const login = profileLogin(location.pathname);
  const thresholds = login === null ? undefined : users.get(login);
  if (thresholds) {
    applyLevels(document, thresholds);
    shaded = true;
  } else if (shaded) {
    applyLevels(document, null);
  }
}

/**
 * Coalesces a burst of mutations into a single sweep on the next frame.
 */
function schedule(): void {
  if (scheduled === null) {
    scheduled = requestAnimationFrame(sweep);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  const change = changes[STORAGE_KEY];
  if (areaName === "sync" && change) {
    users = parseUsers(change.newValue);
    schedule();
  }
});

/*
 * Nothing is swept before the settings arrive, so an unconfigured profile is never
 * touched.
 */
void chrome.storage.sync.get(STORAGE_KEY).then((stored) => {
  users = parseUsers(stored[STORAGE_KEY]);
  sweep();
});

/*
 * childList only. applyLevels writes data-level and aria-describedby, so observing
 * attributes would wake the observer on its own writes; that would settle after one
 * redundant no-op sweep rather than loop, since applyLevels skips cells already at the
 * right level, but the sweep is pure waste. Everything that matters here - year tabs
 * replacing the calendar, tool-tips appended after the table - is a childList change.
 */
new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
