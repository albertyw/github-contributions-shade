import { expect } from "@wdio/globals";

import {
  DEFAULT_THRESHOLDS,
  applyLevels,
  levelFor,
  parseCount,
  tooltipTexts,
} from "../src/shade.js";

interface Day {
  id: string;
  level: string;
  tooltip?: string;
}

// Builds a calendar fragment shaped like GitHub's: a table of day cells plus the
// sibling tool-tip elements that carry the contribution counts.
function calendar(days: Day[]): HTMLElement {
  const root = document.createElement("div");
  const table = document.createElement("table");
  const row = document.createElement("tr");
  table.appendChild(row);
  root.appendChild(table);

  for (const day of days) {
    const cell = document.createElement("td");
    cell.className = "ContributionCalendar-day";
    cell.id = day.id;
    cell.setAttribute("data-level", day.level);
    cell.setAttribute("aria-describedby", `contribution-graph-legend-level-${day.level}`);
    row.appendChild(cell);

    if (day.tooltip !== undefined) {
      const tip = document.createElement("tool-tip");
      tip.setAttribute("for", day.id);
      tip.textContent = day.tooltip;
      root.appendChild(tip);
    }
  }
  return root;
}

// The five legend swatches reuse the ContributionCalendar-day class but are divs.
function legend(root: HTMLElement): HTMLElement {
  for (let level = 0; level <= 4; level++) {
    const swatch = document.createElement("div");
    swatch.className = "ContributionCalendar-day rounded-1 mr-1";
    swatch.id = `contribution-graph-legend-level-${level}`;
    swatch.setAttribute("data-level", String(level));
    root.appendChild(swatch);
  }
  return root;
}

describe("DEFAULT_THRESHOLDS", function() {
  it("is the confirmed set of cutoffs", function() {
    expect(DEFAULT_THRESHOLDS).toEqual([1, 7, 13, 19]);
  });
});

describe("parseCount", function() {
  it("reads a plural count", function() {
    expect(parseCount("20 contributions on August 31st.")).toBe(20);
  });
  it("reads the singular form", function() {
    expect(parseCount("1 contribution on September 2nd.")).toBe(1);
  });
  it("reads No contributions as zero", function() {
    expect(parseCount("No contributions on September 3rd.")).toBe(0);
  });
  it("reads a comma grouped count", function() {
    expect(parseCount("1,024 contributions on July 26th.")).toBe(1024);
  });
  it("returns null for unrecognized text", function() {
    expect(parseCount("Learn how we count contributions.")).toBeNull();
  });
  it("returns null for a digit-free count", function() {
    expect(parseCount(", contributions on August 31st.")).toBeNull();
  });
  it("returns null for empty, null and undefined input", function() {
    expect(parseCount("")).toBeNull();
    expect(parseCount(null)).toBeNull();
    expect(parseCount(undefined)).toBeNull();
  });
});

describe("levelFor", function() {
  it("maps counts to levels at every boundary", function() {
    const cases: [number, number][] = [
      [0, 0],
      [1, 1], [6, 1],
      [7, 2], [12, 2],
      [13, 3], [18, 3],
      [19, 4], [31, 4], [9999, 4],
    ];
    const actual = cases.map(([count]) => levelFor(count));
    expect(actual).toEqual(cases.map(([, expected]) => expected));
  });
  it("accepts custom thresholds", function() {
    expect(levelFor(5, [1, 5, 10, 20])).toBe(2);
  });
  it("treats a non-finite count as the lightest level, never the darkest", function() {
    expect(levelFor(NaN)).toBe(0);
  });
});

describe("tooltipTexts", function() {
  it("maps day ids to their tooltip text", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "1", tooltip: "20 contributions on August 31st." },
      { id: "contribution-day-component-0-1", level: "1", tooltip: "No contributions on September 1st." },
    ]);
    const texts = tooltipTexts(root);
    expect(texts.size).toBe(2);
    expect(texts.get("contribution-day-component-0-0")).toBe("20 contributions on August 31st.");
  });

  it("ignores tooltips that do not belong to day cells", function() {
    const root = calendar([]);
    const tip = document.createElement("tool-tip");
    tip.setAttribute("for", "some-other-component");
    tip.textContent = "unrelated";
    root.appendChild(tip);
    expect(tooltipTexts(root).size).toBe(0);
  });
});

describe("applyLevels", function() {
  it("re-buckets days and updates aria-describedby", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "3", tooltip: "20 contributions on August 31st." },
      { id: "contribution-day-component-0-1", level: "1", tooltip: "8 contributions on September 1st." },
      { id: "contribution-day-component-0-2", level: "0", tooltip: "No contributions on September 2nd." },
    ]);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(2);

    const cells = root.querySelectorAll("td.ContributionCalendar-day");
    expect(cells[0]?.getAttribute("data-level")).toBe("4");
    expect(cells[0]?.getAttribute("aria-describedby")).toBe("contribution-graph-legend-level-4");
    expect(cells[1]?.getAttribute("data-level")).toBe("2");
    expect(cells[1]?.getAttribute("aria-describedby")).toBe("contribution-graph-legend-level-2");
    expect(cells[2]?.getAttribute("data-level")).toBe("0");
  });

  it("is idempotent", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "3", tooltip: "20 contributions on August 31st." },
    ]);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(1);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(0);
  });

  it("leaves a day without a tooltip alone", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "2" },
    ]);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(0);
    expect(root.querySelector("td")?.getAttribute("data-level")).toBe("2");
  });

  it("leaves a day with unparsable tooltip text alone", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "2", tooltip: "Something else entirely." },
    ]);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(0);
    expect(root.querySelector("td")?.getAttribute("data-level")).toBe("2");
  });

  it("never touches the legend swatches", function() {
    const root = legend(calendar([
      { id: "contribution-day-component-0-0", level: "3", tooltip: "20 contributions on August 31st." },
    ]));
    applyLevels(root, DEFAULT_THRESHOLDS);
    const swatchLevels = [...root.querySelectorAll("div.ContributionCalendar-day")]
      .map((swatch) => swatch.getAttribute("data-level"));
    expect(swatchLevels).toEqual(["0", "1", "2", "3", "4"]);
  });

  // Guards the `td` in the day selector. A div sharing the class AND owning a tooltip
  // would be re-levelled by a class-only selector, so dropping the tag name fails here.
  it("only levels td cells, even when a div has a matching tooltip", function() {
    const root = calendar([]);
    const impostor = document.createElement("div");
    impostor.className = "ContributionCalendar-day";
    impostor.id = "contribution-day-component-9-9";
    impostor.setAttribute("data-level", "0");
    root.appendChild(impostor);
    const tip = document.createElement("tool-tip");
    tip.setAttribute("for", "contribution-day-component-9-9");
    tip.textContent = "20 contributions on August 31st.";
    root.appendChild(tip);

    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(0);
    expect(impostor.getAttribute("data-level")).toBe("0");
  });

  it("honours custom thresholds", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "0", tooltip: "5 contributions on August 31st." },
    ]);
    expect(applyLevels(root, [1, 5, 10, 20])).toBe(1);
    expect(root.querySelector("td")?.getAttribute("data-level")).toBe("2");
  });

  it("records GitHub's level the first time a cell changes", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "1", tooltip: "20 contributions on August 31st." },
    ]);
    const cell = root.querySelector("td");
    applyLevels(root, DEFAULT_THRESHOLDS);
    expect(cell?.getAttribute("data-shade-original-level")).toBe("1");
    applyLevels(root, [1, 50, 100, 200]);
    expect(cell?.getAttribute("data-level")).toBe("1");
    expect(cell?.getAttribute("data-shade-original-level")).toBe("1");
    applyLevels(root, [1, 2, 3, 4]);
    expect(cell?.getAttribute("data-shade-original-level")).toBe("1");
  });

  it("does not record anything for a cell already at the right level", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "4", tooltip: "20 contributions on August 31st." },
    ]);
    applyLevels(root, DEFAULT_THRESHOLDS);
    expect(root.querySelector("td")?.hasAttribute("data-shade-original-level")).toBe(false);
  });
  it("has nothing to record for a cell without a level", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "0", tooltip: "20 contributions on August 31st." },
    ]);
    const cell = root.querySelector("td");
    cell?.removeAttribute("data-level");
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(1);
    expect(cell?.getAttribute("data-level")).toBe("4");
    expect(cell?.hasAttribute("data-shade-original-level")).toBe(false);
  });
});

describe("applyLevels with null thresholds", function() {
  it("restores GitHub's level and removes the marker", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "1", tooltip: "20 contributions on August 31st." },
    ]);
    const cell = root.querySelector("td");
    applyLevels(root, DEFAULT_THRESHOLDS);
    expect(applyLevels(root, null)).toBe(1);
    expect(cell?.getAttribute("data-level")).toBe("1");
    expect(cell?.getAttribute("aria-describedby")).toBe("contribution-graph-legend-level-1");
    expect(cell?.hasAttribute("data-shade-original-level")).toBe(false);
  });

  it("leaves unmarked cells alone", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "3", tooltip: "20 contributions on August 31st." },
    ]);
    expect(applyLevels(root, null)).toBe(0);
    expect(root.querySelector("td")?.getAttribute("data-level")).toBe("3");
  });

  it("round-trips through thresholds, null, and thresholds again", function() {
    const root = calendar([
      { id: "contribution-day-component-0-0", level: "1", tooltip: "20 contributions on August 31st." },
    ]);
    const cell = root.querySelector("td");
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(1);
    expect(applyLevels(root, null)).toBe(1);
    expect(applyLevels(root, null)).toBe(0);
    expect(applyLevels(root, DEFAULT_THRESHOLDS)).toBe(1);
    expect(cell?.getAttribute("data-level")).toBe("4");
    expect(cell?.getAttribute("data-shade-original-level")).toBe("1");
  });
});
