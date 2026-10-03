/**
 * Options page logic: a table of GitHub logins and their four thresholds, saved to
 * chrome.storage.sync. Storage is passed in so tests can supply a fake.
 */

import { DEFAULT_THRESHOLDS, type Thresholds } from "./shade.js";
import {
  STORAGE_KEY,
  type Users,
  normalizeLogin,
  parseUsers,
  validLogin,
} from "./settings.js";

export interface StorageChange {
  newValue?: unknown;
}

/** The subset of chrome.storage.sync this page uses. */
export interface SettingsStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  onChanged: {
    addListener(callback: (changes: Record<string, StorageChange>) => void): void;
  };
}

export interface ReadResult {
  users: Record<string, Thresholds>;
  errors: string[];
  /** The input behind each error, in the same order, so it can be flagged and focused. */
  invalid: HTMLInputElement[];
}

/** What the page calls the four shades, lightest to darkest, in headers and messages. */
export const SHADE_NAMES = ["Lightest", "Medium-light", "Medium-dark", "Darkest"] as const;

export interface ThresholdProblem {
  index: number;
  message: string;
}

/** Explains the first threshold that is missing, not a whole number ≥ 1, or out of order. */
export function thresholdProblem(values: readonly number[]): ThresholdProblem | null {
  let previous = 0;
  for (const [index, value] of values.entries()) {
    const name = SHADE_NAMES[index];
    if (Number.isNaN(value)) {
      return { index, message: `${name} needs a number` };
    }
    if (!Number.isInteger(value) || value < 1) {
      return { index, message: `${name} (${value}) must be a whole number of at least 1` };
    }
    if (value <= previous) {
      return { index, message: `${name} (${value}) must be larger than ${SHADE_NAMES[index - 1]} (${previous})` };
    }
    previous = value;
  }
  return null;
}

/** "1–6 · 7–12 · 13–18 · 19+" for [1, 7, 13, 19], or "" while the values are invalid. */
export function describeRanges(values: readonly number[]): string {
  if (thresholdProblem(values) !== null) {
    return "";
  }
  return values.map((low, index) => {
    const next = values[index + 1];
    if (next === undefined) {
      return `${low}+`;
    }
    return next - 1 === low ? `${low}` : `${low}–${next - 1}`;
  }).join(" · ");
}

function cell(row: HTMLTableRowElement, child: HTMLElement): void {
  row.insertCell().appendChild(child);
}

function inputNumber(input: HTMLInputElement): number {
  return input.value.trim() === "" ? NaN : Number(input.value);
}

function thresholdInputs(row: HTMLTableRowElement): HTMLInputElement[] {
  return [...row.querySelectorAll<HTMLInputElement>("input.threshold")];
}

/**
 * Appends an editable row; new rows start from the default thresholds. Removing a row
 * moves focus to a neighbouring Remove button, or to Add user once the table is empty,
 * and fires an input event on the table so the page knows it has unsaved changes.
 */
export function addRow(
  tbody: HTMLTableSectionElement,
  login = "",
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): HTMLTableRowElement {
  const doc = tbody.ownerDocument;
  const row = tbody.insertRow();

  const loginInput = doc.createElement("input");
  loginInput.className = "login";
  loginInput.value = login;
  loginInput.placeholder = "e.g. octocat";
  loginInput.setAttribute("aria-label", "GitHub username");
  cell(row, loginInput);

  thresholds.forEach((threshold, index) => {
    const input = doc.createElement("input");
    input.className = "threshold";
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = String(threshold);
    input.setAttribute("aria-label", `${SHADE_NAMES[index]} shade: fewest contributions in a day`);
    cell(row, input);
  });

  const ranges = doc.createElement("span");
  ranges.className = "ranges";
  cell(row, ranges);

  const remove = doc.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.textContent = "Remove";
  cell(row, remove);

  const refresh = (): void => {
    ranges.textContent = describeRanges(thresholdInputs(row).map(inputNumber));
    remove.setAttribute("aria-label", `Remove ${loginInput.value.trim() || "this row"}`);
  };
  refresh();
  row.addEventListener("input", (event) => {
    refresh();
    (event.target as Element).removeAttribute("aria-invalid");
  });

  remove.addEventListener("click", () => {
    const neighbour = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    const target = neighbour?.querySelector<HTMLElement>("button.remove") ?? doc.getElementById("add");
    target?.focus();
    tbody.dispatchEvent(new Event("input", { bubbles: true }));
  });

  return row;
}

/** Replaces the table body with one row per user, sorted by login. */
export function renderRows(tbody: HTMLTableSectionElement, users: Users): void {
  tbody.replaceChildren();
  const sorted = [...users].sort(([a], [b]) => a.localeCompare(b));
  for (const [login, thresholds] of sorted) {
    addRow(tbody, login, thresholds);
  }
}

/**
 * Validates every row. A row with a blank username is skipped while its thresholds are
 * still the defaults, so an untouched spare row doesn't block saving.
 */
export function readRows(tbody: HTMLTableSectionElement): ReadResult {
  const users: Record<string, Thresholds> = {};
  const errors: string[] = [];
  const invalid: HTMLInputElement[] = [];
  const seen = new Set<string>();

  for (const row of tbody.rows) {
    const loginInput = row.querySelector("input.login") as HTMLInputElement;
    const raw = loginInput.value.trim();
    const inputs = thresholdInputs(row);
    const values = inputs.map(inputNumber);
    if (raw === "") {
      if (values.some((value, index) => value !== DEFAULT_THRESHOLDS[index])) {
        errors.push("A row has shade numbers but no username. Enter a username or remove the row.");
        invalid.push(loginInput);
      }
      continue;
    }
    if (!validLogin(raw)) {
      errors.push(`"${raw}" is not a valid GitHub username (letters, numbers and single hyphens, up to 39 characters).`);
      invalid.push(loginInput);
      continue;
    }
    const login = normalizeLogin(raw);
    if (seen.has(login)) {
      errors.push(`${login} is listed more than once. Remove one of the ${login} rows.`);
      invalid.push(loginInput);
      continue;
    }
    seen.add(login);

    const problem = thresholdProblem(values);
    if (problem !== null) {
      errors.push(`${login}: ${problem.message}.`);
      invalid.push(inputs[problem.index] as HTMLInputElement);
      continue;
    }
    users[login] = values as unknown as Thresholds;
  }

  return { users, errors, invalid };
}

function friendlySaveError(error: unknown): string {
  const message = (error as Error).message;
  if (message.includes("QUOTA_BYTES")) {
    return "Could not save: too many usernames for Chrome sync storage. Remove some and save again.";
  }
  return `Could not save: ${message}`;
}

/**
 * Saves the table if every row is valid, reporting the outcome in `status`. Invalid
 * inputs are flagged with aria-invalid and the first one is focused.
 */
export async function save(
  storage: SettingsStorage,
  tbody: HTMLTableSectionElement,
  status: HTMLElement,
): Promise<boolean> {
  const { users, errors, invalid } = readRows(tbody);
  for (const input of tbody.querySelectorAll("input")) {
    input.removeAttribute("aria-invalid");
  }
  if (errors.length > 0) {
    for (const input of invalid) {
      input.setAttribute("aria-invalid", "true");
    }
    invalid[0]?.focus();
    status.textContent = errors.join("\n");
    return false;
  }
  try {
    await storage.set({ [STORAGE_KEY]: users });
  } catch (error) {
    status.textContent = friendlySaveError(error);
    return false;
  }
  status.textContent = "Saved.";
  return true;
}

function serialize(users: Record<string, Thresholds>): string {
  return JSON.stringify(Object.entries(users).sort(([a], [b]) => a.localeCompare(b)));
}

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  return doc.getElementById(id) as T;
}

/**
 * Loads saved users into the page and wires up its controls. Returns a function that
 * removes the window-level listener, for tests.
 */
export async function init(doc: Document, storage: SettingsStorage): Promise<() => void> {
  const form = byId<HTMLFormElement>(doc, "settings");
  const tbody = byId<HTMLTableSectionElement>(doc, "users");
  const status = byId<HTMLElement>(doc, "status");
  const addButton = byId<HTMLButtonElement>(doc, "add");
  const saveButton = byId<HTMLButtonElement>(doc, "save");
  const win = doc.defaultView as Window;
  let dirty = false;
  /** Counts edits so a save only marks the page clean if nothing changed meanwhile. */
  let edits = 0;
  /** The users being written by an in-flight save, to recognise its own onChanged. */
  let saving: string | null = null;

  const beforeUnload = (event: Event): void => {
    if (dirty) {
      event.preventDefault();
    }
  };
  const dispose = (): void => win.removeEventListener("beforeunload", beforeUnload);

  let stored: Record<string, unknown>;
  try {
    stored = await storage.get(STORAGE_KEY);
  } catch (error) {
    // Saving now would replace the real settings with an empty table.
    addButton.disabled = true;
    saveButton.disabled = true;
    status.textContent = `Could not load settings: ${(error as Error).message}. Reload the page to try again.`;
    return dispose;
  }

  // An empty table gets one blank starter row rather than just headers.
  const show = (shown: Users): void => {
    renderRows(tbody, shown);
    if (shown.size === 0) {
      addRow(tbody);
    }
  };
  const users = parseUsers(stored[STORAGE_KEY]);
  show(users);
  if (users.size === 0) {
    (tbody.querySelector("input.login") as HTMLInputElement).focus();
  }
  // Chrome's built-in checks for min and step would block the submit with a generic
  // bubble, one field at a time, before save() could explain and flag every problem.
  form.noValidate = true;

  // Only announce the switch from clean to dirty, so typing doesn't wipe out a list of
  // errors or the warning about another window.
  const markDirty = (): void => {
    edits++;
    if (!dirty) {
      dirty = true;
      status.textContent = "Unsaved changes.";
    }
  };
  tbody.addEventListener("input", markDirty);
  addButton.addEventListener("click", () => {
    addRow(tbody).querySelector("input")?.focus();
    markDirty();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const editsAtSave = edits;
    saving = serialize(readRows(tbody).users);
    void save(storage, tbody, status).then((saved) => {
      saving = null;
      if (saved && edits === editsAtSave) {
        dirty = false;
      } else if (saved) {
        status.textContent = "Saved, but there are newer unsaved changes.";
      }
    });
  });
  win.addEventListener("beforeunload", beforeUnload);

  // Another tab or a synced browser changed the settings. Saving this table as is would
  // silently drop their change, so refresh it, or warn when there are local edits.
  storage.onChanged.addListener((changes) => {
    const change = changes[STORAGE_KEY];
    if (!change) {
      return;
    }
    const incoming = serialize(Object.fromEntries(parseUsers(change.newValue)));
    if (incoming === saving || incoming === serialize(readRows(tbody).users)) {
      return;
    }
    if (dirty) {
      status.textContent = "Settings were changed in another window. Saving will replace them; reload this page to see them.";
      return;
    }
    show(parseUsers(change.newValue));
    status.textContent = "Updated with changes from another window.";
  });

  return dispose;
}
