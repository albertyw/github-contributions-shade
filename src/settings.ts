/**
 * Per-user threshold settings: validation, parsing of stored data, and working out
 * which profile a page belongs to. Free of extension APIs so tests can import it.
 */

import type { Thresholds } from "./shade.js";

/** The chrome.storage.sync key holding `{ [lowercase login]: Thresholds }`. */
export const STORAGE_KEY = "users";

export type Users = Map<string, Thresholds>;

/**
 * GitHub's rule: 1-39 alphanumerics or single inner hyphens, plus the underscore that
 * Enterprise Managed Users get before their shortcode (octocat_acme).
 */
const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|[-_](?=[a-z\d])){0,38}$/i;

/**
 * GitHub logins are case-insensitive (/AlbertYW serves the same profile as
 * /albertyw), so they are stored and compared lowercase. A leading "@", as in a
 * pasted mention, is dropped.
 */
export function normalizeLogin(text: string): string {
  return text.trim().replace(/^@/, "").toLowerCase();
}

export function validLogin(text: string): boolean {
  return LOGIN_PATTERN.test(normalizeLogin(text));
}

/** Four integers of at least 1, strictly increasing, so every level is reachable. */
export function validThresholds(value: unknown): value is Thresholds {
  if (!Array.isArray(value) || value.length !== 4) {
    return false;
  }
  let previous = 0;
  for (const threshold of value) {
    if (!Number.isInteger(threshold) || threshold <= previous) {
      return false;
    }
    previous = threshold;
  }
  return true;
}

/**
 * Builds the lookup table from whatever storage returned, dropping anything malformed
 * rather than trusting it.
 */
export function parseUsers(raw: unknown): Users {
  const users: Users = new Map();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return users;
  }
  for (const [login, thresholds] of Object.entries(raw)) {
    if (validLogin(login) && validThresholds(thresholds)) {
      users.set(normalizeLogin(login), thresholds);
    }
  }
  return users;
}

/**
 * The login a page belongs to, from the first path segment. Non-profile pages such as
 * /settings or /albertyw/repo may yield a login too, which is harmless: they have no
 * calendar cells to re-level.
 */
export function profileLogin(pathname: string): string | null {
  const segment = pathname.split("/")[1] ?? "";
  return validLogin(segment) ? normalizeLogin(segment) : null;
}
