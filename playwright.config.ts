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
// tag-level filters keep production and prototype journeys disjoint even when
// they share a spec file. Every required browser project uses the same
// production matcher and tag exclusion. The PsychSift spec names these patterns
// once listed were removed on 15 October 2026: none of those specs exist here.
// `tests/playwright-project-isolation.test.ts` asserts every spec on disk is matched.
const productionSpecPattern = /.*api-csrf-proxy\.spec\.ts/;
const mockupSpecPattern =
  /.*ui-(ward-native-history-print|ward-management|ward-chrome-header|ward-coordinator|ward-roles|ward-discharges|ward-capacity-morning-moved|ward-referrals|ward-forced-colors|ward-full-journey|ward-search|ward-statistics-compare|ward-statistics-journey|ward-table-thresholds|ward-responsive-audit|ward-tour-targets|ward-help-show-me|ward-design-sweep|ward-pwa-lifecycle|ward-seclusion)\.spec\.ts/;
// A bounded Ward-only cross-browser proof; keep prototype cases separate from the inherited
// production projects. The spec checks responsive geometry and keyboard access to local scrollers.
const wardResponsiveSpecPattern = /.*ui-ward-responsive-audit\.spec\.ts/;
const mockupTag = /@mockup/;
// The release gate (15 October 2026): four core bed-flow journeys with an axe check at each key
// step, on desktop Chrome and phone WebKit. Its own projects, its own CI job, nothing else in them.
const releaseGateSpecPattern =
  /.*(?:release-gate-journeys|release-gate-axe-sweep|release-gate-inpatient-transfer|release-gate-community-referral|release-gate-legal-form)\.spec\.ts/;
// Shared mode (audit F-16): two signed-in desks against a real local backend and PostgreSQL. It needs
// the stack `tests/support/ward-shared-mode-run.mjs` starts (shared-mode production `next start`, the backend, a
// fake sign-in service), so the project exists only inside that runner, never in the offline gates.
// Nightly only (.github/workflows/ward-flow-nightly-browsers.yml), never on a pull request. TE-01: image
// baselines for ten key screens, made and compared on the same hosted Linux runner. TE-02: the 834px
// tablet layout, which has its own server path (guessTabletFromRequest), runs the axe sweep and the
// responsive audit on iPad WebKit. Front-end audit, 5 Nov 2026.
const visualSpecPattern = /.*ward-visual-baselines\.spec\.ts/;
const tabletSpecPattern = /.*(?:release-gate-axe-sweep|ui-ward-responsive-audit)\.spec\.ts/;
const visualBaselinePath = "{testDir}/visual-baselines/{projectName}/{arg}{ext}";
const sharedModeSpecPattern = /.*ward-shared-(?:mode|recovery|performance)\.spec\.ts/;
const sharedPhoneSpecPattern = /.*ward-shared-recovery\.spec\.ts/;
const sharedModeRunner = Boolean(process.env.WARD_E2E_ACCOUNTS);

// Ward Flow fold gate (Josh, 25 September 2026): the known-failing journeys still run every gate, but
// in their own project with a short timeout, so a known failure fails fast instead of waiting out
// the full 60 s. WARD_JOURNEY_KNOWN_FAILURES names the list ("<file>:<line> | <title>" per line). A
// known failure that starts passing shows as passed in that project, so recoveries stay visible.
const knownFailurePattern = knownFailurePatternFromEnvironment();

export default defineConfig({
  testDir: "./tests",
  testMatch:
    /.*(?:release-gate-journeys|release-gate-axe-sweep|ward-visual-baselines|ward-shared-(?:mode|recovery|performance)|api-csrf-proxy|ui-ward-(?:native-history-print|management|chrome-header|coordinator|roles|discharges|capacity-morning-moved|referrals|forced-colors|full-journey|search|statistics-compare|statistics-journey|table-thresholds|responsive-audit|tour-targets|help-show-me|design-sweep|pwa-lifecycle|seclusion))\.spec\.ts/,
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
    // A signed-in desk's tour starts on its own once, over its home screen (#576). The journeys
    // are about the screens underneath, so every desk's tour starts out seen. Contexts a spec opens
    // itself with browser.newContext() do not get this and mark it seen themselves.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            {
              name: "ward_flow_choice_tour_seen",
              value: "coordinator,ward,ed,community,officer,bed_manager,executive,admin",
            },
          ],
        },
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Animations are off suite-wide so clicks cannot land mid-transition on a moving target. A
    // journey that needs real motion turns it back on for itself with
    // page.emulateMedia({ reducedMotion: "no-preference" }).
    contextOptions: { reducedMotion: "reduce" },
    // Keep routing-based journeys isolated from production workers. The real-worker lifecycle
    // lane (ui-ward-pwa-lifecycle.spec.ts) alone opts in through test.use({ serviceWorkers: "allow" });
    // it controls faults at a loopback HTTP proxy, since page routes cannot intercept worker traffic.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "release-gate-desktop",
      testMatch: releaseGateSpecPattern,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1024 },
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      // Phone is its own design at 390x844, on the engine an iPhone actually runs.
      name: "release-gate-phone",
      testMatch: releaseGateSpecPattern,
      use: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } },
    },
    // Nightly only (TE-01, TE-02): off by default, so an unfiltered test:e2e or verify:release never
    // runs them. The nightly workflow names each with --project.
    {
      name: "visual-desktop",
      default: false,
      testMatch: visualSpecPattern,
      snapshotPathTemplate: visualBaselinePath,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1024 },
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
    {
      name: "visual-phone",
      default: false,
      testMatch: visualSpecPattern,
      snapshotPathTemplate: visualBaselinePath,
      use: { ...devices["iPhone 14"], viewport: { width: 390, height: 844 } },
    },
    {
      // The responsive audit's own cases are tagged @mockup; the axe sweep's are not, so no grep here.
      name: "tablet-webkit",
      default: false,
      testMatch: tabletSpecPattern,
      use: { ...devices["iPad Pro 11"], viewport: { width: 834, height: 1112 } },
    },
    {
      name: "firefox-ward-responsive",
      testMatch: wardResponsiveSpecPattern,
      grep: mockupTag,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-ward-responsive",
      testMatch: wardResponsiveSpecPattern,
      grep: mockupTag,
      use: { ...devices["Desktop Safari"] },
    },
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
    ...(sharedModeRunner
      ? [
          {
            name: "ward-shared-mode",
            testMatch: sharedModeSpecPattern,
            timeout: 120_000,
            use: {
              ...devices["Desktop Chrome"],
              // The local proof creates a one-day self-signed loopback API certificate.
              ignoreHTTPSErrors: true,
              viewport: { width: 1600, height: 1100 },
              ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
            },
          },
          {
            name: "ward-shared-phone",
            testMatch: sharedPhoneSpecPattern,
            timeout: 120_000,
            retries: 0,
            use: {
              ...devices["iPhone 13"],
              ignoreHTTPSErrors: true,
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
  ],
});
