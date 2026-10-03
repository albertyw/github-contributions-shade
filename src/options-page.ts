/**
 * Options page entry point, kept apart from options.ts so tests can import that
 * module without it reaching for chrome.storage.
 */

import { init } from "./options.js";

void init(document, chrome.storage.sync);
