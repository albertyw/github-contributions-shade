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
 * childList only, never attributes: applyLevels writes data-level and aria-describedby,
 * so observing attributes would make the observer retrigger on its own writes.
 */
new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
