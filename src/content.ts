/**
 * Content script entry point.
 *
 * Re-levels the contribution calendar on load, then again whenever GitHub replaces part
 * of the page — switching year tabs swaps the whole calendar over AJAX, and the
 * tool-tip elements carrying the counts are appended after the table itself renders.
 */

import { applyLevels } from "./shade.js";

let scheduled: number | null = null;

function sweep(): void {
  scheduled = null;
  applyLevels(document);
}

/**
 * Coalesces a burst of mutations into a single sweep on the next frame.
 */
function schedule(): void {
  if (scheduled === null) {
    scheduled = requestAnimationFrame(sweep);
  }
}

sweep();

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
