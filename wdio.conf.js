import { existsSync } from "node:fs";

/**
 * WebdriverIO downloads a Chrome for Testing build and a matching chromedriver by
 * default. That download is unusable on arm64 Linux, where Google publishes no stable
 * build and @puppeteer/browsers hands out the x86-64 binary anyway. Prefer a locally
 * installed browser and driver on every platform, falling back to WebdriverIO's own
 * download when none is found, so one rule holds regardless of architecture.
 *
 * CHROME_BINARY and CHROMEDRIVER_BINARY override the discovery.
 *
 * The snap entry is the real executable rather than /snap/bin/chromium, which is a
 * launcher wrapper that chromedriver cannot drive.
 */
function findBinary(name, configured, candidates) {
  if (configured) {
    if (!existsSync(configured)) {
      throw new Error(`${name} is set to ${configured}, which does not exist`);
    }
    return configured;
  }
  return candidates.find(existsSync);
}

const chromeBinary = findBinary("CHROME_BINARY", process.env.CHROME_BINARY, [
  "/snap/chromium/current/usr/lib/chromium-browser/chrome",
  "/usr/lib/chromium/chromium",
  "/usr/lib/chromium-browser/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
]);

const chromedriverBinary = findBinary("CHROMEDRIVER_BINARY", process.env.CHROMEDRIVER_BINARY, [
  "/snap/bin/chromium.chromedriver",
  "/usr/bin/chromedriver",
  "/usr/lib/chromium/chromedriver",
]);

export const config = {
  runner: ["browser", {
    coverage: {
      enabled: true,
      reportsDirectory: ".coverage",
      // shade.ts is pure logic with no excuse for untested paths. Branches sit below
      // 100 because two null guards in tooltipTexts are unreachable: the
      // `tool-tip[for^=...]` selector guarantees the attribute, and Element.textContent
      // is never null, but the DOM types require both checks.
      statements: 100,
      lines: 100,
      functions: 100,
      branches: 90,
    },
  }],

  specs: [
    "./test/*.test.ts",
  ],

  maxInstances: 10,

  // CHROME_BINARY and CHROMEDRIVER_BINARY override the discovery above.
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--headless=new",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        ...(chromeBinary ? { binary: chromeBinary } : {}),
      },
      ...(chromedriverBinary
        ? { "wdio:chromedriverOptions": { binary: chromedriverBinary } }
        : {}),
      acceptInsecureCerts: true,
    },
  ],

  logLevel: process.env.WDIO_LOG_LEVEL || "warn",
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Strip the `Content-Length` and `Connection` headers that the webdriver
  // package sets manually. Node 26 bundles undici v8, which enforces the Fetch
  // spec and rejects these forbidden request headers with UND_ERR_INVALID_ARG,
  // breaking session creation. See https://github.com/webdriverio/webdriverio/issues/15265
  transformRequest: (requestOptions) => {
    const headers = requestOptions.headers;
    headers?.delete("content-length");
    headers?.delete("connection");
    return requestOptions;
  },

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};
