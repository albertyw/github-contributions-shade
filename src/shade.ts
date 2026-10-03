/**
 * Re-buckets GitHub contribution calendar days into shade levels using configured
 * thresholds.
 *
 * GitHub derives its five cutoffs from the largest single day in the window, so one
 * unusual day rescales the whole calendar. Configured thresholds are constant, so no
 * single day can flatten the rest of the year.
 */

export type Level = 0 | 1 | 2 | 3 | 4;

export type Thresholds = readonly [number, number, number, number];

/**
 * Minimum contribution count for levels 1, 2, 3 and 4, used as the starting point when
 * configuring a new profile.
 */
export const DEFAULT_THRESHOLDS: Thresholds = [1, 7, 13, 19];

/**
 * Day cells are `td` elements. The legend swatches reuse the same class on `div`
 * elements and carry their own data-level, so the tag name is what keeps them out.
 */
const DAY_SELECTOR = "td.ContributionCalendar-day";

/** GitHub's own level for a cell, saved before the first overwrite so it can be restored. */
const ORIGINAL_ATTRIBUTE = "data-shade-original-level";

const TOOLTIP_SELECTOR = "tool-tip[for^=\"contribution-day-component\"]";

const COUNT_PATTERN = /^\s*(No|\d[\d,]*)\s+contributions?\s+on\b/;

/**
 * Reads the contribution count out of a tooltip such as
 * "20 contributions on August 31st." or "No contributions on September 3rd.".
 * Returns null when the text is missing or in an unexpected shape, which tells callers
 * to leave the cell as GitHub rendered it.
 */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) {
    return null;
  }
  const count = COUNT_PATTERN.exec(text)?.[1];
  if (count === undefined) {
    return null;
  }
  if (count === "No") {
    return 0;
  }
  return Number(count.replace(/,/g, ""));
}

/** Buckets a contribution count into a shade level. */
export function levelFor(count: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): Level {
  // NaN compares false against every threshold, so without this guard it would fall
  // through the loop and come out at the darkest level rather than the lightest.
  if (!Number.isFinite(count)) {
    return 0;
  }
  let level = 0;
  for (const threshold of thresholds) {
    if (count < threshold) {
      break;
    }
    level++;
  }
  return level as Level;
}

/**
 * Collects every day tooltip in one pass, keyed by the id of the cell it describes.
 * Doing this once per sweep avoids a document-wide query for each of the ~372 cells.
 */
export function tooltipTexts(root: ParentNode): Map<string, string> {
  const texts = new Map<string, string>();
  for (const tooltip of root.querySelectorAll(TOOLTIP_SELECTOR)) {
    const target = tooltip.getAttribute("for");
    if (target) {
      texts.set(target, tooltip.textContent ?? "");
    }
  }
  return texts;
}

function setLevel(cell: Element, level: string): void {
  cell.setAttribute("data-level", level);
  cell.setAttribute("aria-describedby", `contribution-graph-legend-level-${level}`);
}

/**
 * Re-levels every day cell under `root` and returns how many cells changed.
 * Cells whose count cannot be read, and cells already at the right level, are left
 * untouched, so repeated sweeps are cheap and idempotent.
 *
 * With null thresholds, cells this function changed earlier go back to GitHub's level.
 */
export function applyLevels(root: ParentNode, thresholds: Thresholds | null): number {
  if (thresholds === null) {
    return restoreLevels(root);
  }
  const texts = tooltipTexts(root);
  let changed = 0;

  for (const cell of root.querySelectorAll(DAY_SELECTOR)) {
    const count = parseCount(texts.get(cell.id));
    if (count === null) {
      continue;
    }
    const level = String(levelFor(count, thresholds));
    const current = cell.getAttribute("data-level");
    if (current === level) {
      continue;
    }
    if (current !== null && !cell.hasAttribute(ORIGINAL_ATTRIBUTE)) {
      cell.setAttribute(ORIGINAL_ATTRIBUTE, current);
    }
    setLevel(cell, level);
    changed++;
  }

  return changed;
}

function restoreLevels(root: ParentNode): number {
  let changed = 0;
  for (const cell of root.querySelectorAll(`${DAY_SELECTOR}[${ORIGINAL_ATTRIBUTE}]`)) {
    setLevel(cell, cell.getAttribute(ORIGINAL_ATTRIBUTE) as string);
    cell.removeAttribute(ORIGINAL_ATTRIBUTE);
    changed++;
  }
  return changed;
}
