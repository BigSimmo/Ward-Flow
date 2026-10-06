import { defineConfig, devices } from "playwright/test";
import { stableProjectPort } from "./src/lib/local-server-utils.mjs";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";
import { knownFailurePatternFromEnvironment } from "./scripts/ward-flow/known-journey-failures.mjs";

process.env.PORT = process.env.PORT || String(stableProjectPort(process.cwd()));

const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

// Sandboxed CI/cloud containers often ship a preinstalled Chromium and block
// browser downloads; point this at that binary instead of the managed one.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// Prototype /mockups journeys live in their own advisory project so a red
// mockup can never mask a production-journey regression (PT-05). The two
// Tag-level filters keep production and prototype journeys disjoint even when
// they share a spec file. Every required browser project uses the same
// production matcher and tag exclusion.
// `phone-scroll` carries an open `-<suffix>` arm: that coverage is split across
// ui-phone-scroll{,-routes,-page-owned}.spec.ts so no single file can dominate a
// `--shard` (it was 65% of shard 1 at 267s). An exact `phone-scroll` alternative
// would silently leave the siblings uncollected, so the arm is open on purpose —
// a future ui-phone-scroll-*.spec.ts runs rather than quietly not running.
// `tests/playwright-project-isolation.test.ts` asserts every such file on disk is
// matched here.
const productionSpecPattern = /.*(?:api-csrf-proxy|ui-smoke|visual-artifacts)\.spec\.ts/;
const mockupSpecPattern =
  /.*ui-ward-(?:management|chrome-header|coordinator|roles|discharges|capacity-morning-moved|referrals|forced-colors|full-journey|search|statistics-compare|statistics-journey|table-thresholds)\.spec\.ts/;
const mockupTag = /@mockup/;

// Ward Flow fold gate (Josh, 25 September 2026): the known-failing journeys still run every gate, but
// in their own project with a short timeout, so a known failure fails fast instead of waiting out
// the full 60 s. WARD_JOURNEY_KNOWN_FAILURES names the list ("<file>:<line> | <title>" per line). A
// known failure that starts passing shows as passed in that project, so recoveries stay visible.
const knownFailurePattern = knownFailurePatternFromEnvironment();

export default defineConfig({
  testDir: "./tests",
  testMatch:
    /.*(?:api-csrf-proxy|ui-smoke|ui-ward-(?:management|chrome-header|coordinator|roles|discharges|capacity-morning-moved|referrals|forced-colors|full-journey|search|statistics-compare|statistics-journey|table-thresholds))\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  // Fail the run if a stray `test.only` is committed: otherwise it silently
  // narrows CI to that one test (and skips the whole release matrix) while the
  // required check still reports green.
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        ["junit", { outputFile: "test-results/playwright-junit.xml" }],
        ["json", { outputFile: "test-results/playwright-results.json" }],
      ]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Dual-mode motion validation strategy (#75JA0P):
    // 1. Suite-wide baseline: set contextOptions: { reducedMotion: "reduce" } to
    //    disable CSS/web animations suite-wide so clicks cannot land mid-transition
    //    on moving targets (preventing race conditions in ui-stress/ui-smoke).
    // 2. Dual-mode per-test coverage: motion-sensitive journeys (e.g. ui-phone-motion,
    //    ui-phone-scroll, answer-progress-ui-smoke, ui-accessibility) explicitly
    //    exercise both default motion (page.emulateMedia({ reducedMotion: "no-preference" }))
    //    and reduced motion (page.emulateMedia({ reducedMotion: "reduce" })) to guarantee
    //    neither default active transitions nor reduced-motion accessibility fallbacks freeze
    //    or blank out UI elements.
    contextOptions: { reducedMotion: "reduce" },
    // Phone PWA standalone mode emulation strategy (#71NT23):
    // Validates the phone PWA bounded scroll shell (globals.css:3755-3793) by
    // allowing phone scroll journeys to emulate `display-mode: standalone` either
    // through Chromium CDP session or the forceCompiledStandalonePhoneCss fixture.
    // In production builds the PWA worker (public/sw.js) registers in every test,
    // claims the page, and serves every subsequent navigation — bypassing route
    // interception for navigations outright, and wedging Playwright-Firefox's
    // reload path under an active route (the two ui-smoke reload hangs in matrix
    // run 4012). Page routes also cannot intercept requests made by a controlling
    // service worker. Only ui-pwa.spec.ts is meant to exercise the worker; it opts
    // back in with test.use({ serviceWorkers: "allow" }).
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: "chromium-mockups",
      testMatch: mockupSpecPattern,
      grep: mockupTag,
      ...(knownFailurePattern ? { grepInvert: knownFailurePattern } : {}),
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    ...(knownFailurePattern
      ? [
          {
            name: "chromium-mockups-known",
            testMatch: mockupSpecPattern,
            grep: knownFailurePattern,
            timeout: 20_000,
            retries: 0,
            use: {
              ...devices["Desktop Chrome"],
              ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
            },
          },
        ]
      : []),
    {
      name: "firefox",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-webkit",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "mobile-pwa-standalone",
      testMatch: productionSpecPattern,
      grepInvert: mockupTag,
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "firefox-mockups",
      testMatch: mockupSpecPattern,
      grep: mockupTag,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-mockups",
      testMatch: mockupSpecPattern,
      grep: mockupTag,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-webkit-mockups",
      testMatch: mockupSpecPattern,
      grep: mockupTag,
      use: { ...devices["iPhone 14"] },
    },
  ],
});
