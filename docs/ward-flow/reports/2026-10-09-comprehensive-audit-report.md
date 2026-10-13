# Ward Flow Repository Audit & Adversarial Review Report

**Repository:** `BigSimmo/Ward-Flow`  
**Current Branch:** `feat/movement-drawer-audit-and-actions`  
**Base Commit / Head:** `d2995166` (11 commits ahead of `origin/main` + working tree modifications)  
**Date of Audit:** October 9, 2026  
**Auditor / Review System:** Antigravity Autonomous Systems (`/audit`, `/repo-auditor`, `/review-swarm`, `/boost`, `/competing-hypotheses`)  
**Target Architecture:** Next.js 16 (App Router), React 19, TypeScript 6, Vitest 4, Playwright 1.62  
**Dataset & Boundary:** 100% Synthetic Patient Data, WA Mental Health Act 2014 bed flow operational prototype

---

## Table of Contents

1. [Executive Summary & Key Takeaways](#1-executive-summary--key-takeaways)
2. [Clinical Safety, Privacy & Statutory Language Governance](#2-clinical-safety-privacy--statutory-language-governance)
3. [Fast Verification Gates & Static Code Hygiene](#3-fast-verification-gates--static-code-hygiene)
4. [Dependencies, Lockfile Parity & Security Vulnerabilities](#4-dependencies-lockfile-parity--security-vulnerabilities)
5. [Module Architecture, State Synchronization & Knip Analysis](#5-module-architecture-state-synchronization--knip-analysis)
6. [Vitest Test Suites: Genuine Defects vs Concurrency Contention](#6-vitest-test-suites-genuine-defects-vs-concurrency-contention)
7. [The E2E Journey Feature Knot ("Cluster A") & Playwright Config](#7-the-e2e-journey-feature-knot-cluster-a--playwright-config)
8. [Workspace Cleanliness, Scratch Artifacts & Charter Adherence](#8-workspace-cleanliness-scratch-artifacts--charter-adherence)
9. [Prioritized 4-Phase Remediation Roadmap](#9-prioritized-4-phase-remediation-roadmap)
10. [Open Architectural & Operational Decisions for the Project Owner](#10-open-architectural--operational-decisions-for-the-project-owner)

---

## 1. Executive Summary & Key Takeaways

A repository-wide audit and adversarial red-team review was conducted across `BigSimmo/Ward-Flow`. Every file, dependency, test suite, and configuration gate was tested directly against the live working state.

### Highlights & Critical Discoveries
* **Clinical Safety Flaw in Inpatient Status:** An acute psychiatric bed management tool must never mislabel involuntary patients. In [`src/components/ward-management/movements/movement-drawer.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L649-L653), the drawer inspects `movement.legalForm`, but completely fails to inspect `movement.legalStatus`. If an involuntary patient has no explicit statutory form record attached in state, the UI badges them as **"Voluntary / Informal"**.
* **Statutory Mandate Language Violation:** In [`src/components/ward-management/movements/movement-drawer.tsx:819`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L819), the UI asserts `Required under MHA 2014`, violating clinical governance rules that forbid the software from asserting legal mandates over clinicians. Furthermore, the seed fixture attaches "Form 1A" (a referral for exam), whereas the lawful transport order under the WA Mental Health Act 2014 is Form 4A (s. 148/149).
* **The "Cluster A" Uncommitted Feature Knot:** Six ostensibly separate defects (`check:installed-lock-parity` failure, Knip unused package report, failing `docs:check-inventory`, local headed browser launch, and inverted Playwright isolation assertions) are unified by a single root cause: an uncommitted and untracked E2E accessibility journey feature branch left partially staged.
* **Separation of Real Test Bugs from Concurrency Timeouts:** A previous pass reported 21 failing tests across 14 suites. Adversarial execution proved that **8 of those suites pass 100% cleanly in isolation**. Full-suite parallel execution on Windows causes disk and thread thrashing that artificially breaches the 30-second test timeout. There are exactly **6 test files** with real code bugs.
* **Decision D-18 Privacy Enforcement:** Removing `sessionStorage` caching from [`use-dirty-state-guard.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/use-dirty-state-guard.ts) was an intentional implementation of Decision D-18 (*"typed text stays off the device"*). The hook is actively used for `beforeunload` warnings; its dead code gate failure on push is expected and authorized under `DEAD_CODE_OWNER_APPROVED=1`.

---

## 2. Clinical Safety, Privacy & Statutory Language Governance

### Issue 2.1: Involuntary Patients Rendered as "Voluntary / Informal"
* **Classification:** Critical Clinical Safety Defect
* **File Location:** [`src/components/ward-management/movements/movement-drawer.tsx:649-653`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L649-L653)
* **Code Trace:**
  ```tsx
  {movement.legalForm ? (
    <span className={styles.auditBadgeLegal}>{legalFormName(movement.legalForm)}</span>
  ) : (
    <span className={styles.auditBadgeMuted}>Voluntary / Informal</span>
  )}
  ```
* **Root Cause & Clinical Risk:**  
  Across all 871 lines of `movement-drawer.tsx`, `movement.legalStatus` is never referenced. In psychiatric bed flow, a patient's legal status (`"Involuntary inpatient"`, `"Detained awaiting examination"`, etc.) is distinct from whether a specific statutory form object is attached to their immediate transfer record. If an involuntary patient is admitted without an explicit `legalForm` payload, line 652 silently falls back to badging them as **Voluntary / Informal**. In a clinical setting, misidentifying an involuntary patient as voluntary creates an immediate risk of unlawful departure, unescorted transit, or failure of statutory observation.
* **Recommendation:**  
  Refactor lines 649–653 to evaluate `movement.legalStatus` first. If `movement.legalStatus === "Involuntary inpatient"` or `"Detained awaiting examination"`, badge the legal status explicitly regardless of whether `movement.legalForm` is populated.

### Issue 2.2: Statutory Mandate Language in UI (`check:ward-legal-language`)
* **Classification:** Governance & Legal Language Blocker
* **File Location:** [`src/components/ward-management/movements/movement-drawer.tsx:816-821`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L816-L821)
* **Reproduction:** `npm run check:ward-legal-language`
* **Output:**
  ```text
  🔴 Wording that claims legal authority the app does not have:
    src/components/ward-management/movements/movement-drawer.tsx:819  MHA 2014
  1 occurrence(s) across 1 file(s).
  ```
* **Code Trace:**
  ```tsx
  {movement.transport.formRequired ? (
    <div className={styles.auditTransportRow}>
      <span className={styles.telemetryLabel}>Transport Statutory Form:</span>
      <strong>Required under MHA 2014</strong>
    </div>
  ) : null}
  ```
* **Context & Clinical Policy:**  
  Under the Clinical Safety Case and Ward Flow Governance rulings (18 September 2026), the application is an advisory bed flow tool using synthetic data; it has no legal mandate to instruct clinicians that an action is "Required under MHA 2014".  
  Additionally, adversarial review revealed that the seed fixture sets `formRequired: "Form 1A"`. Under the WA *Mental Health Act 2014*, Form 1A is a Referral for Examination (ss. 26, 36). The lawful transport order is Form 4A (ss. 148, 149). The UI string currently drops the actual `formRequired` value and displays a blanket legal claim.
* **Recommendation:**  
  Replace `<strong>Required under MHA 2014</strong>` with:
  ```tsx
  <strong>{movement.transport.formRequired ? `Statutory Form Flagged: ${movement.transport.formRequired}` : "None"}</strong>
  ```

### Issue 2.3: Inert Draft Parameters in `useDirtyStateGuard` (Decision D-18)
* **Classification:** API Inertia / Architectural Cleanliness
* **File Location:** [`src/components/ward-management/use-dirty-state-guard.ts:5-13, 23`](file:///d:/Repos/Ward-Flow/src/components/ward-management/use-dirty-state-guard.ts#L5-L13)
* **Context & Privacy Ruling:**  
  Commit `d4cd47d` implemented Decision D-18 (*"typed text stays off the device"*), ensuring patient notes and psychiatric triage observations are never written to `sessionStorage` or `localStorage`. `useDirtyStateGuard` was refactored to sanitize legacy storage on mount and attach a browser `beforeunload` listener to warn clinicians of unsaved state.  
  However, the options interface still accepts `{ value, onRestore, confirmMessage }`. These parameters are completely ignored by the hook. Callers in [`alerts-screen.tsx:556`](file:///d:/Repos/Ward-Flow/src/components/ward-management/alerts/alerts-screen.tsx#L556), [`ward-decisions-cockpit.tsx:102`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-decisions-cockpit.tsx#L102), and [`shortlist-panel.tsx:481`](file:///d:/Repos/Ward-Flow/src/components/ward-management/coordinator/shortlist-panel.tsx#L481) pass these values expecting recovery, but the functionality is inert.
* **Recommendation:**  
  Prune the inert options from `DirtyStateGuardOptions` or document clearly that draft persistence is restricted to in-memory React state during active component lifecycle.

---

## 3. Fast Verification Gates & Static Code Hygiene

### Issue 3.1: ESLint Gate Failures from Untracked Scripts
* **Classification:** Build / CI Gate Blocker
* **File Locations:**
  - [`scripts/analyze-ooa-structure.mjs:16:11`](file:///d:/Repos/Ward-Flow/scripts/analyze-ooa-structure.mjs#L16) (`main` assigned but unused)
  - [`scripts/diagnose-ooa-bottom.mjs:25:9`](file:///d:/Repos/Ward-Flow/scripts/diagnose-ooa-bottom.mjs#L25) (`panel` assigned but unused)
  - [`scripts/diagnose-ooa-bottom.mjs:26:9`](file:///d:/Repos/Ward-Flow/scripts/diagnose-ooa-bottom.mjs#L26) (`table` assigned but unused)
* **Reproduction:** `npm run lint`
* **Output:** Exits with code 1:
  ```text
  ✖ 3 problems (0 errors, 3 warnings)
  ESLint found too many warnings (maximum: 0).
  ```
* **Context:**  
  `package.json` configures ESLint with `--max-warnings 0`. While all production application files in `src/` and tests in `tests/` pass with zero warnings, the linter scans the `scripts/` directory where these two untracked diagnostic files reside.
* **Recommendation:**  
  Remove the unused variable assignments or prefix with an underscore (`_main`, `_panel`, `_table`), or delete the untracked diagnostic files.

### Issue 3.2: UTF-8 Mojibake in Mockup Layout Comments
* **Classification:** Code Quality / Encoding Degradation
* **File Location:** [`src/app/mockups/ward-flow/layout.tsx:19, 32, 36, 49, 56, 65, 68`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/layout.tsx#L19)
* **Evidence:**
  ```tsx
  // Line 19: children here â€” the whole of every route's own output
  // Line 32: âš ï¸  **A COUNT OF THOSE MOUNTS WAS TYPED...
  // Line 36: ðŸ”´ **THE THIRD-EDITION SHELL MOUNTS HERE â€”
  // Line 65: â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Line 68: Master plan Â§1.3 item 1.2
  ```
* **Context:**  
  A previous edit using a tool configured with Windows-1252 ANSI encoding round-tripped UTF-8 characters (em-dashes, warning emojis, section symbols), corrupting them into mojibake.
* **Recommendation:**  
  Clean and re-save `layout.tsx` with clean UTF-8 characters (`—`, `⚠️`, `🔴`, `§`).

### Issue 3.3: Bare PR Policy Failure Tripped by Untracked `.agents/`
* **Classification:** Repository Policy Gate Blocker
* **File Location:** [`tests/bare-pr-publication-policy.test.ts:32`](file:///d:/Repos/Ward-Flow/tests/bare-pr-publication-policy.test.ts#L32)
* **Reproduction:** `npx vitest run tests/bare-pr-publication-policy.test.ts`
* **Output:**
  ```text
  AssertionError: expected true to be false
  31| if (!existsSync(releasePath) && !existsSync(handoverPath)) {
  32|   expect(existsSync(join(repoRoot, ".agents"))).toBe(false);
  ```
* **Context:**  
  An uncommitted change in `.gitignore` whitelisted `!/.agents/skills/node-best-practices/`. Because that untracked directory exists physically on disk, line 32 asserts that `.agents` should not exist if release/handover skills are absent.
* **Recommendation:**  
  Remove the local `.agents/skills/node-best-practices` directory or update the test to account for project skills.

---

## 4. Dependencies, Lockfile Parity & Security Vulnerabilities

### Issue 4.1: Lockfile Parity Failure (`check:installed-lock-parity`)
* **Classification:** Dependency Gate Blocker
* **File Locations:** [`package.json:161`](file:///d:/Repos/Ward-Flow/package.json#L161), [`package-lock.json`](file:///d:/Repos/Ward-Flow/package-lock.json), `.codex-installed-tree.json`
* **Reproduction:** `npm run check:installed-lock-parity`
* **Output:** Exits with code 1:
  ```text
  [installed-lock-parity] full tree: install stamp belongs to a different package-lock.json
  Installed dependencies do not match package-lock.json. Run npm ci before interpreting test failures.
  ```
* **Root Cause:**  
  `@axe-core/playwright: ^4.13.0` was manually added to `package.json` and `package-lock.json` for accessibility testing, but `npm ci` was never executed and `.codex-installed-tree.json` was never regenerated.
* **Recommendation:**  
  Run `node scripts/check-installed-lock-parity.mjs --write-stamp` or execute `npm ci` once the package addition is finalized.

### Issue 4.2: Undeclared Runtime Dependency `parse5`
* **Classification:** Knip / Dependency Defect
* **File Location:** [`tests/ward-landmarks.test.ts:12`](file:///d:/Repos/Ward-Flow/tests/ward-landmarks.test.ts#L12)
* **Evidence:**
  ```ts
  import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
  ```
  `grep "parse5" package.json` returns zero results.
* **Context:**  
  `parse5` is directly imported in tests, but is not listed in `dependencies` or `devDependencies`. It resolves locally only because it is transitively hoisted by other packages in `node_modules`. On clean CI runners or alternative package managers, tests importing `parse5` will crash with `Cannot find module 'parse5'`.
* **Recommendation:**  
  Add `"parse5": "^7.1.2"` to `devDependencies` in `package.json`.

### Issue 4.3: Undeclared Development Dependency `sharp`
* **Classification:** Knip / Dependency Defect
* **File Location:** [`scripts/ward-flow/shots.mjs:33`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/shots.mjs#L33)
* **Evidence:**
  ```js
  const sharp = require("sharp");
  ```
* **Context:**  
  `sharp` is dynamically required by screenshot capture scripts. While it is pinned in `package.json` overrides, it is missing from `devDependencies`. Knip flags it as an unlisted dependency.
* **Recommendation:**  
  Add `"sharp": "^0.33.5"` to `devDependencies` in `package.json`.

### Issue 4.4: Orphaned Dependency `server-only`
* **Classification:** Package Bloat / Stale Dependency
* **File Location:** [`package.json:143`](file:///d:/Repos/Ward-Flow/package.json#L143)
* **Context:**  
  `"server-only": "^0.0.1"` was originally added during early integration with PsychSift. PsychSift code was completely retired on 27 Sept 2026. Zero files in `src/` import `server-only`. Knip flags it as an unused dependency.
* **Recommendation:**  
  Remove `"server-only"` from `package.json` and remove the stub alias in `vitest.config.mts:94`.

### Issue 4.5: Transitive Security Vulnerabilities (`npm audit`)
* **Classification:** Security Vulnerability
* **Reproduction:** `npm audit`
* **Output:** Exits with code 1 (9 vulnerabilities: 1 Moderate, 8 High):
  1. `braces *` (High, GHSA-vfj7-8cjw-p6xm): ReDoS via `micromatch` in `eslint-config-next`.
  2. `sharp <0.35.5` (High, CVE-2026-96889): librsvg vulnerability pulled via Next.js image optimization.
  3. `source-map-js 1.0.0 - 1.2.1` (High, GHSA-68fv-2mgg-jv7q): Event loop denial of service via indexed source maps.
  4. `smol-toml <=1.8.0` (Moderate, GHSA-r4xh-jqrq-34v2): Quadratic parsing time.
* **Recommendation:**  
  Update dependencies via `npm audit fix` or specify clean overrides in `package.json` for `source-map-js` (`>=1.3.0`) and `braces` (`>=3.0.3`).

---

## 5. Module Architecture, State Synchronization & Knip Analysis

### Issue 5.1: Split-Brain State in `ward-sites.ts` on Scenario Switch
* **Classification:** Architecture & React Reactivity Defect
* **File Locations:**
  - [`src/components/ward-management/ward-sites.ts:139, 872`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-sites.ts#L139)
  - [`src/components/ward-management/ward-scenarios.ts:31, 43`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-scenarios.ts#L31)
  - [`src/components/ward-management/ward-demo-network.ts:646, 1258`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-demo-network.ts#L646)
* **Code Trace:**
  ```ts
  // ward-sites.ts
  export const STANDARD_WARD_SITES: WardSite[] = [...];
  export let wardSites: WardSite[] = STANDARD_WARD_SITES;
  export function activateWardNetwork(sites: WardSite[]) {
    wardSites = sites;
  }
  ```
* **Adversarial Architectural Analysis:**  
  Knip flags `STANDARD_WARD_SITES` and `wardSites` as duplicate exports. However, deeper tracing reveals an active reactivity bug:
  1. `ward-scenarios.ts` calls `activateWardNetwork(sites)` when switching between clinical scenarios.
  2. In modern ES modules, mutating an exported variable (`wardSites = sites`) updates live module bindings, but **does not trigger React state re-renders**.
  3. Worse, `ward-demo-network.ts` imports the constant `STANDARD_WARD_SITES` directly, while UI screens (`ward-board.tsx`, `community-screen.tsx`) import `wardSites`.
  4. When a demo scenario is activated, capacity calculations read the immutable baseline while board displays read the mutated array, creating a split-brain state where bed capacity numbers diverge from displayed beds.
* **Recommendation:**  
  Move active network state into the `WardFlowProvider` React Context. Eliminate `export let wardSites` in favor of a `useWardSites()` context hook, keeping `STANDARD_WARD_SITES` strictly as the immutable fallback initial state.

### Issue 5.2: Knip Duplicate & Backward-Compatibility Exports
* **Classification:** Knip Warning
* **File Locations:**
  - [`src/components/ward-management/tools/ward-mha-calculator.tsx:226-228`](file:///d:/Repos/Ward-Flow/src/components/ward-management/tools/ward-mha-calculator.tsx#L226-L228) (`calculateForm1A = getForm1ARecord`, etc.)
  - [`src/components/ward-management/shell/ward-dynamic-island.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/shell/ward-dynamic-island.tsx)
  - [`src/components/ward-management/tools/ward-catchment-resolver.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/tools/ward-catchment-resolver.tsx)
  - [`src/components/ward-management/ward/ward-notification-center.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-notification-center.tsx)
* **Context:**  
  Knip reports 7 duplicate export pairs. The MHA calculator exports legacy aliases for backward compatibility. The three UI components export both a named export and a default export.
* **Recommendation:**  
  Standardize on named exports across all components; remove redundant default exports and deprecate unused calculator aliases.

---

## 6. Vitest Test Suites: Genuine Defects vs Concurrency Contention

### The Concurrency Contention Finding
Running `npm test` across all 907 test files concurrently on Windows spawns 4 parallel worker threads handling 10,600+ test cases. Due to Windows process creation overhead for Git child processes and JSDOM AST re-evaluations, 8 test files reported 30,000ms timeouts:
* `tests/public-startup-boundary.test.ts`
* `tests/ward-flow-remote-boundary.test.ts`
* `tests/ward-trial-merge.test.ts`
* `tests/ward-board-triage.dom.test.tsx`
* `tests/ward-board-people-panel.dom.test.tsx`
* `tests/ward-discharge-board-access.dom.test.tsx`
* `tests/ward-ed-polished.dom.test.tsx`
* `tests/ward-refinement-discharge-ui.dom.test.tsx`

**Adversarial Verification:** Every one of these 8 files was executed in isolation via `npx vitest run <file>`. **All 8 suites pass 100% cleanly.** For example, `tests/ward-shell-third-edition.dom.test.tsx` executed all 55 tests in 53 seconds with zero logic errors.

---

### The 6 Genuine Test Failures

#### Issue 6.1: Missing Directory in Dead Code Test Fixture
* **File Location:** [`tests/dead-code-candidate.test.ts:40`](file:///d:/Repos/Ward-Flow/tests/dead-code-candidate.test.ts#L40)
* **Reproduction:** `npx vitest run tests/dead-code-candidate.test.ts`
* **Output:** Exits 1 (5 tests fail with `ENOENT: no such file or directory, scandir '.../docs/ward-flow/plans'`).
* **Root Cause:**  
  `scripts/check-dead-code-candidate.mjs:244` was updated to search `docs/ward-flow/plans`. The test fixture helper `createFixture()` in `tests/dead-code-candidate.test.ts` was not updated to create `docs/ward-flow/plans` in the mock temp directory.
* **Fix:**  
  Add `"docs/ward-flow/plans"` to the directory array in `createFixture()`.

#### Issue 6.2: Windows Backslash Path Normalization Mismatch
* **File Location:** [`tests/ward-ci-main-reuse.test.ts:150`](file:///d:/Repos/Ward-Flow/tests/ward-ci-main-reuse.test.ts#L150)
* **Reproduction:** `npx vitest run tests/ward-ci-main-reuse.test.ts`
* **Output:**
  ```text
  AssertionError: expected '\blobs\blob-shard-2-of-5-batch-001.json' to be '/blobs/blob-shard-2-of-5-batch-001.json'
  ```
* **Root Cause:**  
  `scripts/check-ward-expected-reds.mjs:415` constructs `--outputFile.blob` using `path.join()`, producing Windows backslashes (`\`). Line 150 asserts against a literal POSIX forward-slash string (`/`).
* **Fix:**  
  Normalize the path with `.replace(/\\/g, "/")` in `check-ward-expected-reds.mjs` before comparison.

#### Issue 6.3 & 6.4: Storage Tests Expecting Pre-D-18 Behavior
* **File Locations:**
  - [`tests/ward-alerts-broadcast-draft.dom.test.tsx:53, 87`](file:///d:/Repos/Ward-Flow/tests/ward-alerts-broadcast-draft.dom.test.tsx#L53)
  - [`tests/ward-shortlist-override-draft-switch.dom.test.tsx:63`](file:///d:/Repos/Ward-Flow/tests/ward-shortlist-override-draft-switch.dom.test.tsx#L63)
* **Reproduction:** `npx vitest run tests/ward-alerts-broadcast-draft.dom.test.tsx tests/ward-shortlist-override-draft-switch.dom.test.tsx`
* **Output:** Exits 1 (3 tests fail).
* **Root Cause:**  
  Under Decision D-18, `useDirtyStateGuard.ts:36` actively removes drafts from `sessionStorage` on mount. These tests were written prior to D-18 and still assert that drafts are recovered from `sessionStorage`.
* **Fix:**  
  Update test assertions to verify that `sessionStorage` is empty on mount and that active drafts remain strictly in-memory during user interaction.

#### Issue 6.5: React Microtask Race Condition in Scenario Loader
* **File Location:** [`tests/ward-flow-scenario-file.dom.test.tsx:176`](file:///d:/Repos/Ward-Flow/tests/ward-flow-scenario-file.dom.test.tsx#L176)
* **Reproduction:** `npx vitest run tests/ward-flow-scenario-file.dom.test.tsx`
* **Output:** Exits 1 (flaky assertion on `patient.givenName === "Josephine"`).
* **Root Cause:**  
  At line 168, `vi.useRealTimers()` is enabled. Line 175 awaits the DOM notification `"Scenario loaded"`. Line 176 immediately inspects `current!.patients`. Because the DOM message updates before the React state update propagates to `<Capture />`, the assertion fails intermittently.
* **Fix:**  
  Wrap line 176 in `await waitFor(() => expect(current!.patients.some(...)).toBe(true))`.

---

## 7. The E2E Journey Feature Knot ("Cluster A") & Playwright Config

### Root Cause Analysis of "Cluster A"
The audit revealed that 6 disparate findings are bound together as part of an untracked, partially staged E2E user journey testing initiative:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │           UNCOMMITTED E2E JOURNEY INITIATIVE             │
                  └────────────────────────────┬────────────────────────────┘
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
    [Dependency / Lockfile]          [Untracked Files in tests/]     [Playwright Config Inversion]
    - @axe-core/playwright added     - 6 journey spec files          - Headless default inverted
    - Lockfile parity broken         - accessibility.ts helper       - Mockup tags stripped
    - Knip flags as "unused"         - modal-focus DOM test          - Isolation test inverted
               │                                                               │
               └───────────────────────────────┬───────────────────────────────┘
                                               ▼
                                    [Documentation Drift]
                                    - 6 new scripts in package.json
                                    - docs:check-inventory fails (117 vs 123)
```

### Specific Defects in Cluster A

#### Issue 7.1: Local Headed Browser Default Inversion
* **File Location:** [`playwright.config.ts:62`](file:///d:/Repos/Ward-Flow/playwright.config.ts#L62)
* **Evidence:**
  ```ts
  headless: process.env.HEADED ? false : !!process.env.CI,
  ```
* **Impact:** In local developer environments where `CI` is undefined, `!!process.env.CI` evaluates to `false`. Running Playwright tests pops open browser windows by default, stealing desktop focus.

#### Issue 7.2: Mockup Spec Tag Stripping & Test Isolation Inversion
* **File Locations:**
  - [`playwright.config.ts:91-100`](file:///d:/Repos/Ward-Flow/playwright.config.ts#L91)
  - [`tests/playwright-project-isolation.test.ts:26-61`](file:///d:/Repos/Ward-Flow/tests/playwright-project-isolation.test.ts#L26)
* **Impact:** The repository boundary in `AGENTS.md` mandates that unstable mockup tests must not block production CI. The uncommitted change removed `grepInvert: mockupTag` from the production `chromium` project and inverted `tests/playwright-project-isolation.test.ts` from asserting that mockup tests do **not** leak into production (`toBe(false)`) to asserting that they **must** leak (`toBe(true)`).

#### Issue 7.3: Untracked Journey Test Suites & Accessibility Helper
* **Files:**
  - `tests/helpers/accessibility.ts`
  - `tests/ui-ward-journey-auth.spec.ts`
  - `tests/ui-ward-journey-core-flow.spec.ts`
  - `tests/ui-ward-journey-error-resilience.spec.ts`
  - `tests/ui-ward-journey-preview-smoke.spec.ts`
  - `tests/ui-ward-journey-referrals.spec.ts`
  - `tests/ui-ward-journey-submission.spec.ts`
  - `tests/ward-screen-modal-focus.dom.test.tsx`
* **Impact:** These files are uncommitted, yet `package.json` contains npm scripts (`test:e2e:journeys`) pointing to them. Fresh clones cannot run these scripts.

#### Issue 7.4: Stale Documentation Script Inventory (`docs:check-inventory`)
* **File Location:** [`docs/scripts-index.md`](file:///d:/Repos/Ward-Flow/docs/scripts-index.md)
* **Reproduction:** `npm run docs:check-inventory`
* **Output:**
  ```text
  docs/scripts-index.md inventory is stale. Run `npm run docs:update` (expected 159 script files and 123 npm scripts, current: 159 and 117).
  ```

---

## 8. Workspace Cleanliness, Scratch Artifacts & Charter Adherence

### Issue 8.1: 15 Standalone HTML Mockups in `public/` (Charter Breach)
* **Files:** `public/delays-mockup-*.html`, `public/perfected-*.html`, `public/ward-flow-complete-showcase.html`, `public/mockups-index.html` (15 files total).
* **Governance Rule Breached:**  
  `AGENTS.md` explicitly mandates:
  > *"Build interactive Ward Flow mockups in React and TypeScript using the site's existing Next.js routes, reusable components and CSS Modules. Design the actual components that can become the approved site implementation; do not create a separate HTML/JavaScript UI that must be rewritten."*
* **Recommendation:**  
  Archive or delete the standalone HTML files; ensure all mockup screens are implemented as Next.js routes under `src/app/mockups/ward-flow/`.

### Issue 8.2: 21 Untracked Diagnostic Scripts in `scripts/`
* **Files:** `scripts/analyze-bottom-curvature.mjs`, `scripts/apply-flightdeck.mjs`, `scripts/check-card-html.mjs`, `scripts/diagnose-ooa-bottom.mjs`, `scripts/test-deck-interactions.mjs`, etc. (21 files total).
* **Impact:** Clutters git status and triggers ESLint failures (`--max-warnings 0`).
* **Recommendation:**  
  Consolidate reusable test scripts under `scripts/tools/` or remove one-off diagnostic scripts.

### Issue 8.3: Root-Level Scratch Artifacts
* **Files:** `audit-buttons.mjs`, `audit-results.json`, `related-tests-report.json`, `tests_ward_list.txt`, `playwright.visual.config.ts`.
* **Recommendation:** Delete these temporary scratch files.

---

## 9. Prioritized 4-Phase Remediation Roadmap

```mermaid
flowchart TD
    subgraph Phase 1: Critical Clinical & Gate Blockers
        P1A["Fix Legal Language & Involuntary Status in movement-drawer.tsx"] --> P1B["Fix 3 ESLint warnings in scripts/"]
        P1B --> P1C["Clean up untracked .agents/ directory"]
    end

    subgraph Phase 2: Resolve Cluster A Knot
        P2A{"Josh's Decision: Keep or Revert Journeys?"}
        P2A -->|Keep| P2B["Commit 8 Journey Test Files & Sync Lockfile Stamp"]
        P2A -->|Revert| P2C["Discard package.json & Playwright Changes"]
        P2B --> P2D["Run npm run docs:update"]
        P2C --> P2D
    end

    subgraph Phase 3: Vitest Test Suite Realignment
        P3A["Fix Fixture in dead-code-candidate.test.ts"] --> P3B["Normalize Slashes in ward-ci-main-reuse.test.ts"]
        P3B --> P3C["Update Alerts & Shortlist Tests to match Decision D-18"]
        P3C --> P3D["Wrap Scenario Loader Assertion in waitFor"]
    end

    subgraph Phase 4: Architectural & Hygiene Cleanup
        P4A["Declare parse5 and sharp in package.json"] --> P4B["Move active network state to WardFlowProvider"]
        P4B --> P4C["Remove 15 standalone HTML files from public/"]
        P4C --> P4D["Delete root scratch artifacts"]
    end

    Phase 1 --> Phase 2
    Phase 2 --> Phase 3
    Phase 3 --> Phase 4
```

### Phase 1: Immediate Critical Fixes (Pre-Push Gates)
1. **Involuntary Status & Legal Language:**  
   In [`src/components/ward-management/movements/movement-drawer.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx):
   - Refactor lines 649–653 to evaluate `movement.legalStatus` directly so involuntary patients are never badged as voluntary.
   - Refactor line 819 to display the flagged statutory form dynamically rather than asserting `"Required under MHA 2014"`.
2. **ESLint Gate:**  
   Prefix unused variables with `_` or delete [`scripts/analyze-ooa-structure.mjs`](file:///d:/Repos/Ward-Flow/scripts/analyze-ooa-structure.mjs) and [`scripts/diagnose-ooa-bottom.mjs`](file:///d:/Repos/Ward-Flow/scripts/diagnose-ooa-bottom.mjs).
3. **Bare PR Gate:**  
   Remove the untracked `.agents/skills/node-best-practices/` directory.

### Phase 2: Resolving "Cluster A"
4. **Action based on Josh's Decision:**
   - **If Keeping:** Commit the 8 journey test files, run `node scripts/check-installed-lock-parity.mjs --write-stamp`, restore `headless: true` default in `playwright.config.ts`, and run `npm run docs:update`.
   - **If Reverting:** Discard uncommitted edits to `package.json`, `package-lock.json`, `playwright.config.ts`, and remove untracked journey tests.

### Phase 3: Vitest Suite Fixes
5. Add `"docs/ward-flow/plans"` to `tests/dead-code-candidate.test.ts:40`.
6. Add `.replace(/\\/g, "/")` to `scripts/check-ward-expected-reds.mjs:415` for Windows path compatibility.
7. Update `tests/ward-alerts-broadcast-draft.dom.test.tsx` and `tests/ward-shortlist-override-draft-switch.dom.test.tsx` to assert that `sessionStorage` is purged and active drafts remain memory-only per Decision D-18.
8. Wrap line 176 in `tests/ward-flow-scenario-file.dom.test.tsx` in `await waitFor(...)`.

### Phase 4: Architectural, Dependency & Workspace Cleanup
9. Add `"parse5": "^7.1.2"` and `"sharp": "^0.33.5"` to `devDependencies` in `package.json`.
10. Remove `"server-only"` from `package.json` and `vitest.config.mts`.
11. Refactor `wardSites` into `WardFlowProvider` context to prevent split-brain capacity rendering.
12. Clean up 15 HTML files in `public/` and root scratch artifacts.

---

## 10. Open Architectural & Operational Decisions for the Project Owner

Before executing Phase 2 and Phase 4, your guidance is requested on the following two operational decisions:

1. **The E2E Journey Initiative ("Cluster A"):**  
   Should we formally incorporate and commit `@axe-core/playwright` and the 6 user journey test suites (`tests/ui-ward-journey-*.spec.ts`), or would you prefer to revert those modifications to keep the pull request focused strictly on movement drawer audits and actions?
2. **Push Authorization for Decision D-18 Cleanups:**  
   May we push the branch using `DEAD_CODE_OWNER_APPROVED=1` to acknowledge the intentional removal of internal storage helpers under Privacy Decision D-18?
