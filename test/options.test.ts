import { browser, expect } from "@wdio/globals";

import {
  type SettingsStorage,
  type StorageChange,
  addRow,
  describeRanges,
  init,
  readRows,
  renderRows,
  save,
  thresholdProblem,
} from "../src/options.js";

type Listener = (changes: Record<string, StorageChange>) => void;

// In-memory stand-in for chrome.storage.sync that records writes and, like Chrome,
// notifies listeners of every write including the page's own.
class FakeStorage implements SettingsStorage {
  data: Record<string, unknown>;
  writes: Record<string, unknown>[] = [];
  failure: Error | null = null;
  loadFailure: Error | null = null;
  // While set, writes wait for it, to model a save still in flight.
  gate: Promise<void> | null = null;
  listeners: Listener[] = [];
  onChanged = {
    addListener: (callback: Listener): void => {
      this.listeners.push(callback);
    },
  };

  constructor(data: Record<string, unknown> = {}) {
    this.data = data;
  }

  async get(key: string): Promise<Record<string, unknown>> {
    if (this.loadFailure) {
      throw this.loadFailure;
    }
    return key in this.data ? { [key]: this.data[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    await this.gate;
    if (this.failure) {
      throw this.failure;
    }
    this.writes.push(items);
    this.emit(items);
  }

  // A write from another tab or a synced browser.
  emit(items: Record<string, unknown>): void {
    Object.assign(this.data, items);
    const changes = Object.fromEntries(
      Object.entries(items).map(([key, newValue]) => [key, { newValue }]));
    this.listeners.forEach((listener) => listener(changes));
  }
}

// The parts of options.html that options.ts looks up by id.
function page(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <form id="settings">
      <table><tbody id="users"></tbody></table>
      <button type="button" id="add">Add user</button>
      <button type="submit" id="save">Save</button>
    </form>
    <p id="status"></p>
  `;
  document.body.appendChild(root);
  return root;
}

function tbody(): HTMLTableSectionElement {
  return document.createElement("table").createTBody();
}

function rowValues(body: HTMLTableSectionElement): string[][] {
  return [...body.rows].map((row) =>
    [...row.querySelectorAll("input")].map((input) => input.value));
}

function type(input: Element | null | undefined, value: string): void {
  (input as HTMLInputElement).value = value;
  input?.dispatchEvent(new Event("input", { bubbles: true }));
}

function fill(row: HTMLTableRowElement, values: string[]): void {
  row.querySelectorAll("input").forEach((input, index) => {
    type(input, values[index] ?? "");
  });
}

describe("thresholdProblem", function() {
  it("accepts valid thresholds", function() {
    expect(thresholdProblem([1, 7, 13, 19])).toBeNull();
  });
  it("names the first missing, invalid, or out of order value", function() {
    expect(thresholdProblem([1, NaN, 13, 19])).toEqual({ index: 1, message: "Medium-light needs a number" });
    expect(thresholdProblem([0, 7, 13, 19])).toEqual({
      index: 0, message: "Lightest (0) must be a whole number of at least 1" });
    expect(thresholdProblem([1, 7.5, 13, 19])).toEqual({
      index: 1, message: "Medium-light (7.5) must be a whole number of at least 1" });
    expect(thresholdProblem([1, 7, 7, 19])).toEqual({
      index: 2, message: "Medium-dark (7) must be larger than Medium-light (7)" });
  });
});

describe("describeRanges", function() {
  it("spells out the range each shade covers", function() {
    expect(describeRanges([1, 7, 13, 19])).toBe("1–6 · 7–12 · 13–18 · 19+");
  });
  it("collapses a single-count range", function() {
    expect(describeRanges([1, 2, 3, 4])).toBe("1 · 2 · 3 · 4+");
  });
  it("is empty while the values are invalid", function() {
    expect(describeRanges([1, 13, 7, 19])).toBe("");
  });
});

describe("addRow", function() {
  it("adds a blank login with the default thresholds and their ranges", function() {
    const body = tbody();
    const row = addRow(body);
    expect(rowValues(body)).toEqual([["", "1", "7", "13", "19"]]);
    expect([...row.querySelectorAll("input.threshold")].map((input) => input.getAttribute("aria-label")))
      .toEqual([
        "Lightest shade: fewest contributions in a day",
        "Medium-light shade: fewest contributions in a day",
        "Medium-dark shade: fewest contributions in a day",
        "Darkest shade: fewest contributions in a day",
      ]);
    expect(row.querySelector(".ranges")?.textContent).toBe("1–6 · 7–12 · 13–18 · 19+");
    expect(row.querySelector("button.remove")?.getAttribute("aria-label")).toBe("Remove this row");
  });

  it("updates the ranges and Remove label as the row is edited", function() {
    const row = addRow(tbody());
    fill(row, ["octocat", "2", "4"]);
    expect(row.querySelector(".ranges")?.textContent).toBe("");
    fill(row, ["octocat", "2", "4", "6", "8"]);
    expect(row.querySelector(".ranges")?.textContent).toBe("2–3 · 4–5 · 6–7 · 8+");
    expect(row.querySelector("button.remove")?.getAttribute("aria-label")).toBe("Remove octocat");
  });

  describe("Remove", function() {
    let root: HTMLElement;

    beforeEach(function() {
      root = page();
    });

    afterEach(function() {
      root.remove();
    });

    function users(): HTMLTableSectionElement {
      return root.querySelector("#users") as HTMLTableSectionElement;
    }

    it("removes the row, focuses the next Remove button, and reports an edit", function() {
      const body = users();
      let edits = 0;
      body.addEventListener("input", () => edits++);
      const first = addRow(body, "albertyw");
      const second = addRow(body, "octocat");
      first.querySelector<HTMLButtonElement>("button.remove")?.click();
      expect(rowValues(body).map(([login]) => login)).toEqual(["octocat"]);
      expect(document.activeElement).toBe(second.querySelector("button.remove"));
      expect(edits).toBe(1);
    });

    it("focuses the previous Remove button when the last row goes", function() {
      const body = users();
      const first = addRow(body, "albertyw");
      addRow(body, "octocat").querySelector<HTMLButtonElement>("button.remove")?.click();
      expect(document.activeElement).toBe(first.querySelector("button.remove"));
    });

    it("focuses Add user once the table is empty", function() {
      addRow(users(), "albertyw").querySelector<HTMLButtonElement>("button.remove")?.click();
      expect(document.activeElement).toBe(root.querySelector("#add"));
    });
  });

  it("removes the only row even without an Add user button", function() {
    const body = tbody();
    addRow(body).querySelector<HTMLButtonElement>("button.remove")?.click();
    expect(body.rows.length).toBe(0);
  });
});

describe("renderRows", function() {
  it("replaces existing rows with one per user, sorted by login", function() {
    const body = tbody();
    addRow(body, "stale");
    renderRows(body, new Map([
      ["octocat", [1, 3, 6, 10]],
      ["albertyw", [1, 7, 13, 19]],
    ]));
    expect(rowValues(body)).toEqual([
      ["albertyw", "1", "7", "13", "19"],
      ["octocat", "1", "3", "6", "10"],
    ]);
  });
});

describe("readRows", function() {
  it("returns valid rows keyed by normalized login", function() {
    const body = tbody();
    addRow(body, " AlbertYW ");
    fill(addRow(body), ["octocat", "1", "3", "6", "10"]);
    expect(readRows(body)).toEqual({
      users: { albertyw: [1, 7, 13, 19], octocat: [1, 3, 6, 10] },
      errors: [],
      invalid: [],
    });
  });

  it("skips an untouched row with a blank username", function() {
    const body = tbody();
    addRow(body, "   ");
    expect(readRows(body)).toEqual({ users: {}, errors: [], invalid: [] });
  });

  it("reports a blank username on a row whose numbers were edited", function() {
    const body = tbody();
    const row = addRow(body);
    fill(row, ["", "2", "7", "13", "19"]);
    expect(readRows(body)).toEqual({
      users: {},
      errors: ["A row has shade numbers but no username. Enter a username or remove the row."],
      invalid: [row.querySelector("input.login")],
    });
  });

  it("accepts a pasted @mention", function() {
    const body = tbody();
    addRow(body, "@Octocat");
    expect(readRows(body).users).toEqual({ octocat: [1, 7, 13, 19] });
  });

  it("reports an invalid username with GitHub's rule", function() {
    const body = tbody();
    const row = addRow(body, "-bad-");
    const result = readRows(body);
    expect(result.errors).toEqual([
      "\"-bad-\" is not a valid GitHub username (letters, numbers and single hyphens, up to 39 characters).",
    ]);
    expect(result.invalid).toEqual([row.querySelector("input.login")]);
  });

  it("reports a username listed twice, regardless of case or which row is valid", function() {
    const body = tbody();
    fill(addRow(body), ["albertyw", "5", "3", "7", "9"]);
    const second = addRow(body, "AlbertYW");
    const result = readRows(body);
    expect(result.users).toEqual({});
    expect(result.errors).toEqual([
      "albertyw: Medium-light (3) must be larger than Lightest (5).",
      "albertyw is listed more than once. Remove one of the albertyw rows.",
    ]);
    expect(result.invalid[1]).toBe(second.querySelector("input.login"));
  });

  it("points at the offending threshold input", function() {
    const body = tbody();
    const row = addRow(body);
    fill(row, ["blank", "1", "", "13", "19"]);
    const result = readRows(body);
    expect(result.errors).toEqual(["blank: Medium-light needs a number."]);
    expect(result.invalid).toEqual([row.querySelectorAll("input.threshold")[1]]);
  });
});

describe("save", function() {
  it("writes the users and reports success", async function() {
    const storage = new FakeStorage();
    const body = tbody();
    addRow(body, "albertyw");
    const status = document.createElement("p");
    expect(await save(storage, body, status)).toBe(true);
    expect(storage.writes).toEqual([{ users: { albertyw: [1, 7, 13, 19] } }]);
    expect(status.textContent).toBe("Saved.");
  });

  it("saves an empty table as no users", async function() {
    const storage = new FakeStorage({ users: { albertyw: [1, 7, 13, 19] } });
    const status = document.createElement("p");
    expect(await save(storage, tbody(), status)).toBe(true);
    expect(storage.data).toEqual({ users: {} });
  });

  describe("with invalid rows", function() {
    let root: HTMLElement;

    beforeEach(function() {
      root = page();
    });

    afterEach(function() {
      root.remove();
    });

    it("flags and focuses invalid inputs without writing, unflagging each as it is edited", async function() {
      const body = root.querySelector("#users") as HTMLTableSectionElement;
      const status = document.createElement("p");
      const storage = new FakeStorage();
      const bad = addRow(body, "-bad-").querySelector("input.login");
      const underscore = addRow(body, "al_bert").querySelector("input.login");

      expect(await save(storage, body, status)).toBe(false);
      expect(storage.writes).toEqual([]);
      expect(status.textContent?.split("\n").length).toBe(2);
      expect(bad?.getAttribute("aria-invalid")).toBe("true");
      expect(underscore?.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(bad);

      type(bad, "albertyw");
      expect(bad?.hasAttribute("aria-invalid")).toBe(false);
      expect(underscore?.getAttribute("aria-invalid")).toBe("true");
      type(underscore, "octocat");
      expect(await save(storage, body, status)).toBe(true);
    });
  });

  it("explains a sync quota failure in plain words", async function() {
    const storage = new FakeStorage();
    storage.failure = new Error("Resource::kQuotaBytesPerItem quota exceeded (QUOTA_BYTES_PER_ITEM)");
    const body = tbody();
    addRow(body, "albertyw");
    const status = document.createElement("p");
    expect(await save(storage, body, status)).toBe(false);
    expect(status.textContent).toBe(
      "Could not save: too many usernames for Chrome sync storage. Remove some and save again.");
  });

  it("reports any other storage failure as is", async function() {
    const storage = new FakeStorage();
    storage.failure = new Error("Extension context invalidated.");
    const body = tbody();
    addRow(body, "albertyw");
    const status = document.createElement("p");
    expect(await save(storage, body, status)).toBe(false);
    expect(status.textContent).toBe("Could not save: Extension context invalidated.");
  });
});

describe("init", function() {
  let root: HTMLElement;
  let dispose: (() => void) | undefined;

  beforeEach(function() {
    root = page();
    dispose = undefined;
  });

  afterEach(function() {
    dispose?.();
    root.remove();
  });

  function $<T extends Element>(selector: string): T {
    return root.querySelector(selector) as T;
  }

  function status(): string | null | undefined {
    return $("#status").textContent;
  }

  function unloadBlocked(): boolean {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it("renders saved users, ignoring malformed entries", async function() {
    const storage = new FakeStorage({ users: { octocat: [1, 3, 6, 10], "-bad-": [1, 2, 3, 4] } });
    dispose = await init(document, storage);
    expect(rowValues($("#users"))).toEqual([["octocat", "1", "3", "6", "10"]]);
  });

  it("starts with one focused blank row when nothing is saved", async function() {
    dispose = await init(document, new FakeStorage());
    expect(rowValues($("#users"))).toEqual([["", "1", "7", "13", "19"]]);
    expect(document.activeElement).toBe($("#users input.login"));
    expect(status()).toBe("");
  });

  it("disables saving when the settings cannot be loaded", async function() {
    const storage = new FakeStorage();
    storage.loadFailure = new Error("Extension context invalidated");
    dispose = await init(document, storage);
    expect($<HTMLButtonElement>("#save").disabled).toBe(true);
    expect($<HTMLButtonElement>("#add").disabled).toBe(true);
    expect(status()).toBe("Could not load settings: Extension context invalidated. Reload the page to try again.");
    expect(storage.listeners.length).toBe(0);
  });

  it("adds a focused row, tracks unsaved changes, and saves on submit", async function() {
    const storage = new FakeStorage();
    dispose = await init(document, storage);
    expect(unloadBlocked()).toBe(false);

    $<HTMLButtonElement>("#add").click();
    expect(status()).toBe("Unsaved changes.");
    expect(unloadBlocked()).toBe(true);
    const logins = root.querySelectorAll<HTMLInputElement>("#users input.login");
    expect(document.activeElement).toBe(logins[1]);
    type(logins[1], "albertyw");

    $<HTMLFormElement>("#settings").requestSubmit();
    await browser.waitUntil(() => status() === "Saved.");
    expect(storage.data).toEqual({ users: { albertyw: [1, 7, 13, 19] } });
    expect(unloadBlocked()).toBe(false);
  });

  it("stays dirty and keeps the errors visible while they are being fixed", async function() {
    dispose = await init(document, new FakeStorage());
    type($("#users input.login"), "-bad-");
    $<HTMLFormElement>("#settings").requestSubmit();
    await browser.waitUntil(() => status()?.startsWith("\"-bad-\"") ?? false);
    expect(unloadBlocked()).toBe(true);
    type($("#users input.login"), "-bad");
    expect(status()?.startsWith("\"-bad-\"")).toBe(true);
  });

  it("explains out of range numbers itself instead of Chrome's validation bubble", async function() {
    const storage = new FakeStorage();
    dispose = await init(document, storage);
    type($("#users input.login"), "albertyw");
    const lightest = $<HTMLInputElement>("#users input.threshold");
    type(lightest, "0");
    $<HTMLFormElement>("#settings").requestSubmit();
    await browser.waitUntil(() => status() === "albertyw: Lightest (0) must be a whole number of at least 1.");
    expect(lightest.getAttribute("aria-invalid")).toBe("true");
    expect(storage.writes).toEqual([]);
  });

  it("keeps edits made while a save is in flight unsaved", async function() {
    const storage = new FakeStorage();
    let release = (): void => undefined;
    storage.gate = new Promise((resolve) => {
      release = resolve;
    });
    dispose = await init(document, storage);
    type($("#users input.login"), "albertyw");
    $<HTMLFormElement>("#settings").requestSubmit();
    type($("#users input.threshold"), "2");
    release();
    await browser.waitUntil(() => storage.writes.length === 1);
    await browser.waitUntil(() => status() === "Saved, but there are newer unsaved changes.");
    expect(storage.data).toEqual({ users: { albertyw: [1, 7, 13, 19] } });
    expect(unloadBlocked()).toBe(true);
  });

  it("marks a removal as unsaved", async function() {
    dispose = await init(document, new FakeStorage({ users: { albertyw: [1, 7, 13, 19] } }));
    $<HTMLButtonElement>("#users button.remove").click();
    expect(status()).toBe("Unsaved changes.");
  });

  it("picks up changes from another window when there are no local edits", async function() {
    const storage = new FakeStorage({ users: { albertyw: [1, 7, 13, 19] } });
    dispose = await init(document, storage);
    storage.emit({ users: { albertyw: [1, 7, 13, 19], bob: [1, 2, 3, 4] } });
    expect(rowValues($("#users")).map(([login]) => login)).toEqual(["albertyw", "bob"]);
    expect(status()).toBe("Updated with changes from another window.");
  });

  it("shows a blank starter row when another window removes every user", async function() {
    const storage = new FakeStorage({ users: { albertyw: [1, 7, 13, 19] } });
    dispose = await init(document, storage);
    storage.emit({ users: {} });
    expect(rowValues($("#users"))).toEqual([["", "1", "7", "13", "19"]]);
  });

  it("warns instead of overwriting local edits when another window saves", async function() {
    const storage = new FakeStorage({ users: { albertyw: [1, 7, 13, 19] } });
    dispose = await init(document, storage);
    type($("#users input.threshold"), "2");
    storage.emit({ users: { albertyw: [1, 7, 13, 19], bob: [1, 2, 3, 4] } });
    expect(rowValues($("#users"))).toEqual([["albertyw", "2", "7", "13", "19"]]);
    expect(status()).toBe(
      "Settings were changed in another window. Saving will replace them; reload this page to see them.");
  });

  it("ignores its own save and unrelated keys", async function() {
    const storage = new FakeStorage();
    dispose = await init(document, storage);
    type($("#users input.login"), "AlbertYW");
    $<HTMLFormElement>("#settings").requestSubmit();
    await browser.waitUntil(() => status() === "Saved.");
    storage.emit({ other: true });
    expect(status()).toBe("Saved.");
    expect(rowValues($("#users"))).toEqual([["AlbertYW", "1", "7", "13", "19"]]);
  });
});
