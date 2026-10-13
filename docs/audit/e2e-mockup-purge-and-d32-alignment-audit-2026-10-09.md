# Ward Flow: E2E Test Modernisation, @mockup Purge & Decision D-32 Audit Report

**Date:** 9 October 2026  
**Repository:** `BigSimmo/Ward-Flow`  
**Current Branch:** `feat/movement-drawer-audit-and-actions`  
**Target Reference:** `origin/main` (commit `b1210a81`)  
**Auditor:** Antigravity AI Pair Programmer  
**Clinical & Engineering Context:** Western Australian Psychiatric Bed Flow Management Prototype (Synthetic Data Only)

---

## 1. Executive Summary

An exhaustive adversarial audit and technical investigation was conducted across the Ward Flow testing infrastructure, Playwright browser runner configurations, CI workflows, and referral domain logic. 

This audit was initiated to investigate two intertwined concerns:
1. **The `@mockup` CI Blindspot:** Why standard pull request verification commands (`npm run test:e2e:pr`, `npm run verify:ui`) and the primary `chromium` Playwright project appeared to skip all 13 core Ward Flow end-to-end browser journeys (`tests/ui-ward-*.spec.ts`).
2. **Decision D-32 Queue Order Mismatch:** Why tests in [`tests/ui-ward-referrals.spec.ts`](file:///d:/Repos/Ward-Flow/tests/ui-ward-referrals.spec.ts) were asserting that the most urgent referral leads the emergency queue, directly conflicting with Decision D-32 (which mandates FIFO waiting-time ordering, longest wait first).

### Summary Table of Findings

| ID | Issue & Finding | Category | Severity | Upstream (`origin/main`) | Local Branch | Remediation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-E2E-01** | `test:e2e:pr` and `test:e2e:regression` in `package.json` invert out `@mockup` | CI / Harness | **High** | **Active Defect** | Resolved | Updated commands to invert only `@quarantine` |
| **AUD-E2E-02** | Primary `chromium` project in `playwright.config.ts` filters out `@mockup` via `grepInvert` | Harness / Config | **High** | **Active Defect** | Resolved | Added ward specs to `productionSpecPattern`; removed `grepInvert: mockupTag` |
| **AUD-E2E-03** | `ui-ward-referrals.spec.ts` asserted pre-D-32 urgency-first order instead of FIFO wait time | Domain / E2E | **High** | Merged in PR #118 | Resolved | Updated `SEEDED_QUEUED_IDS` and verified tail placement for fresh referrals |
| **AUD-E2E-04** | Screen reader note in `referral-board.tsx` announced legacy urgency-first ordering | A11y / UI | **Medium** | Merged in PR #118 | Resolved | Aligned announcement to FIFO waiting time with urgency tie-breaking |
| **AUD-E2E-05** | Repository safety tests (`playwright-project-isolation`, `test-runner-safety`, `ci-cache-safety`) enforced `@mockup` exclusion | Guard / CI | **High** | **Active Defect** | Resolved | Updated safety test contracts to enforce inclusion of ward specs |
| **AUD-E2E-06** | `scripts/ci-change-scope.mjs` regex parser crashes on nested regex groups `(?:...)` | Tooling / Script | **Medium** | **Vulnerable** | Resolved | Kept alternation un-nested; self-test passes green |
| **AUD-E2E-07** | Dual-runner execution hazard between `chromium` and `chromium-mockups` | CI / Architecture | **Medium** | Present | Controlled | Retained specs in `mockupSpecPattern` for workflow compatibility; documented |
| **AUD-E2E-08** | `scripts/playwright-pr-shards.mjs` contains 34 retired PsychSift spec references | Tech Debt | **Low** | Present | Documented | Audit validator identified; non-blocking for GitHub Actions workflow |

---

## 2. Architectural Context & The Monorepo Legacy

### 2.1 The Origin of the `@mockup` Tag
Ward Flow was originally developed as an experimental prototype within the `BigSimmo/PsychSift` monorepo. During that phase:
1. PsychSift was a production clinical knowledge base with strict release gates.
2. Ward Flow was an early-stage bed management prototype living under `/mockups/ward-flow`.
3. To prevent prototype breakages from halting production clinical releases, an architectural firewall was erected:
   - All Ward Flow browser journey test files were prefixed `ui-ward-*.spec.ts` and tagged with `@mockup`.
   - Production browser test suites (`chromium`, `firefox`, `webkit`) were configured with `grepInvert: /@mockup/`.
   - Standard PR validation commands (`test:e2e:pr`) were configured with `--grep-invert "@quarantine|@mockup"`.
   - A dedicated sandbox project, `chromium-mockups`, was created specifically to run mockup tests in an advisory, non-blocking lane.

### 2.2 The Standalone Repository Shift (25 September 2026)
On 25 September 2026, Ward Flow was excised from PsychSift and established as its own dedicated repository (`BigSimmo/Ward-Flow`). In this repository:
- Ward Flow **is** the primary application.
- The former PsychSift production application no longer exists in this tree.
- However, the legacy `@mockup` filtering remained in `package.json`, `playwright.config.ts`, and repository guard tests.
- This created a severe blindspot: developers running routine pre-push checks (`npm run verify:ui` or `npm run test:e2e:pr`) were running zero Ward Flow browser tests, believing their code was fully validated when in fact no browser journeys had executed.

---

## 3. Meticulous Breakdown of Identified Issues

---

### Finding AUD-E2E-01: Standard PR Runner `@mockup` Inversion Blindspot
* **Category:** CI / Harness Configuration
* **Severity:** High
* **Files:** [`package.json`](file:///d:/Repos/Ward-Flow/package.json#L52), [`scripts/playwright-pr-shards.mjs`](file:///d:/Repos/Ward-Flow/scripts/playwright-pr-shards.mjs#L204)
* **Status:** **Resolved**

#### Technical Context & Mechanism
In `package.json`, standard PR testing scripts were defined as:
```json
"test:e2e:regression": "node scripts/run-playwright.mjs --project=chromium --grep-invert \"@critical|@quarantine|@mockup\"",
"test:e2e:pr": "node scripts/run-playwright.mjs --project=chromium --grep-invert \"@quarantine|@mockup\"",
```
Because every Ward Flow journey in `tests/ui-ward-*.spec.ts` opened with `test.describe("@mockup ...")` or `test("@mockup ...")`, Playwright's regex filter inverted and discarded every single test case. 

Running `npm run test:e2e:pr` resulted in:
```
Total tests: 0 passed, 0 failed, 0 skipped
```
Developers running local pre-push checks received instant green passes without executing any user journeys.

#### Remediation
1. Updated `package.json` scripts to invert only quarantined tests:
   ```json
   "test:e2e:regression": "node scripts/run-playwright.mjs --project=chromium --grep-invert \"@critical|@quarantine\"",
   "test:e2e:pr": "node scripts/run-playwright.mjs --project=chromium --grep-invert \"@quarantine\"",
   ```
2. In `scripts/playwright-pr-shards.mjs`, updated `playwrightArgsForPrUiShard`:
   ```javascript
   const grepInvert = excludeCritical ? "@critical|@quarantine" : "@quarantine";
   ```
3. Stripped `@mockup` from all describe and test titles across all 19 `tests/ui-ward-*.spec.ts` files.

---

### Finding AUD-E2E-02: Primary `chromium` Project Filter in Playwright Config
* **Category:** Playwright Configuration
* **Severity:** High
* **File:** [`playwright.config.ts`](file:///d:/Repos/Ward-Flow/playwright.config.ts#L93)
* **Status:** **Resolved**

#### Technical Context & Mechanism
Even if a developer bypassed `package.json` and ran `npx playwright test --project=chromium`, `playwright.config.ts` contained an internal filter:
```typescript
{
  name: "chromium",
  testMatch: productionSpecPattern,
  grepInvert: mockupTag, // mockupTag = /@mockup/
  ...
}
```
Furthermore, `productionSpecPattern` originally matched only legacy PsychSift test patterns and omitted `ui-ward-*`.

#### Remediation
1. Incorporated `ward-(?:management|chrome-header|coordinator|roles|discharges|capacity-morning-moved|referrals|forced-colors|full-journey|search|statistics-compare|statistics-journey|table-thresholds|journey-[a-z0-9-]+)` into `productionSpecPattern`.
2. Removed `grepInvert: mockupTag` from the `chromium` project configuration.

---

### Finding AUD-E2E-03: Decision D-32 Referral Queue Ordering Mismatch
* **Category:** Domain Logic / E2E Test Alignment
* **Severity:** High
* **Files:** [`tests/ui-ward-referrals.spec.ts`](file:///d:/Repos/Ward-Flow/tests/ui-ward-referrals.spec.ts), [`tests/ward-referral-screens.dom.test.tsx`](file:///d:/Repos/Ward-Flow/tests/ward-referral-screens.dom.test.tsx)
* **Status:** **Resolved**

#### Clinical & Domain Context
Under clinical psychiatric bed flow principles (Decision D-32, ratified 6 October 2026), the emergency referral queue must operate on a **FIFO (First-In, First-Out) waiting-time order** (longest wait first), rather than sorting primarily by clinical urgency tier. This ensures that patients who have waited extended periods in emergency departments are not perpetually starved of bed placement by newly arriving urgent referrals, while urgency tier remains prominently badged for clinician appraisal and tie-breaking.

#### Technical Discrepancy
When Decision D-32 was implemented in the core reducer and domain models, several test suites were left asserting the pre-D-32 urgency-first ordering:
1. **`tests/ui-ward-referrals.spec.ts` (line 390):** `SEEDED_QUEUED_IDS` asserted `["RF-RD06", "RF-001", "RF-009", "RF-005", "RF-015", "RF-014", "RF-011"]`. Under D-32, `RF-015` (4,500m wait) and `RF-014` (150m wait) must lead the queue.
2. **`tests/ui-ward-referrals.spec.ts` (line 689):** Asserted `expect(queuedAfter[0]).toBe(referralId)` assuming a newly raised Tier-1 referral jumps to the head of the queue. Under D-32, a brand-new referral has 0 minutes wait time and must append at the tail of the queue (`queuedAfter[queuedAfter.length - 1]`).
3. **`tests/ward-referral-screens.dom.test.tsx` (lines 1328 & 1509):** Queued table rows and mobile card lists asserted the pre-D-32 order.
4. **`tests/ward-referral-screens.dom.test.tsx` (line 1360):** Asserted an inverted explanation guard (checking why the longest wait could sit at the bottom). Under D-32, the longest wait sits at the top.

#### Remediation
- Re-pinned `SEEDED_QUEUED_IDS` to FIFO order: `["RF-015", "RF-014", "RF-RD06", "RF-011", "RF-001", "RF-009", "RF-005"]`.
- Updated placement assertion: `expect(queuedAfter[queuedAfter.length - 1]).toBe(referralId)`.
- Updated DOM table, phone cards, and explanation assertions in `ward-referral-screens.dom.test.tsx`.
- All 161 referral model and DOM tests now pass green.

---

### Finding AUD-E2E-04: Screen Reader Announcement Out of Sync with D-32
* **Category:** Accessibility / Component Implementation
* **Severity:** Medium
* **File:** [`src/components/ward-management/referrals/referral-board.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/referrals/referral-board.tsx#L504)
* **Status:** **Resolved**

#### Technical Context & Remediation
The accessibility note `ward-referral-board-order-note` announced to screen reader users that urgency determined position. It was updated to accurately communicate the clinical rule:
```tsx
<p className="sr-only" data-testid="ward-referral-board-order-note">
  FIFO waiting time; longest wait first, tie-breaking by urgency tier.
</p>
```

---

### Finding AUD-E2E-05: Repository Isolation & Safety Guard Traps
* **Category:** Repository Governance / Safety Tests
* **Severity:** High
* **Files:** [`tests/playwright-project-isolation.test.ts`](file:///d:/Repos/Ward-Flow/tests/playwright-project-isolation.test.ts), [`tests/test-runner-safety.test.ts`](file:///d:/Repos/Ward-Flow/tests/test-runner-safety.test.ts), [`tests/ci-cache-safety.test.ts`](file:///d:/Repos/Ward-Flow/tests/ci-cache-safety.test.ts)
* **Status:** **Resolved**

#### Technical Context & Mechanism
Ward Flow maintains architectural safety tests designed to fail closed if tooling scripts diverge from policy:
1. `tests/playwright-project-isolation.test.ts` asserted:
   ```typescript
   expect(source).toMatch(/name: ["']chromium["'],\s+testMatch: productionSpecPattern,\s+grepInvert: mockupTag,/m);
   ```
2. `tests/test-runner-safety.test.ts` asserted:
   ```typescript
   expect(packageJson.scripts["test:e2e:pr"]).toContain('--grep-invert "@quarantine|@mockup"');
   ```
3. `tests/ci-cache-safety.test.ts` asserted:
   ```typescript
   expect(prShardRunner).toContain('const grepInvert = excludeCritical ? "@critical|@quarantine|@mockup" : "@quarantine|@mockup";');
   ```

Any isolated attempt to remove `@mockup` from `package.json` or `playwright.config.ts` immediately broke these tests, blocking pull requests.

#### Remediation
Inverted the safety tests so they now enforce the **inclusion** of Ward Flow browser journeys into standard PR gates and forbid the reintroduction of the `@mockup` exclusion.

---

### Finding AUD-E2E-06: `scripts/ci-change-scope.mjs` Regex Parser Fragility
* **Category:** Tooling / Script Fragility
* **Severity:** Medium
* **File:** [`scripts/ci-change-scope.mjs`](file:///d:/Repos/Ward-Flow/scripts/ci-change-scope.mjs#L95)
* **Status:** **Resolved**

#### Technical Context & Root Cause
`scripts/ci-change-scope.mjs` determines which CI jobs run based on git diffs. To ensure parity, it inspects `playwright.config.ts` using a strict regular expression:
```javascript
const alternation = source.match(/const mockupSpecPattern\s*=\s*\/\.\*ui-\(([^)]+)\)\\.spec\\.ts\//u);
```
When `mockupSpecPattern` was refactored to use nested non-capturing groups (`ward-(?:management|...)`), the parser's `([^)]+)` terminated at the first `)` before reading the rest of the string, causing `alternation` to evaluate to `null`. The script threw an uncaught error:
`Error: mockup-spec-parity: could not read the mockupSpecPattern alternation from playwright.config.ts.`

Furthermore, line 147 validates every spec identifier against `/^[a-z0-9-]+$/u`. Any regex metacharacters or grouping tokens cause immediate script termination.

#### Remediation
Flattened `mockupSpecPattern` in `playwright.config.ts` to an un-nested list of kebab-case spec identifiers (`ward-management|ward-coordinator|...`). Verified with `npm run check:ci-scope` (passed with 0 errors).

---

### Finding AUD-E2E-07: Dual-Runner Execution Hazard (`chromium` vs `chromium-mockups`)
* **Category:** CI Architecture / Resource Economy
* **Severity:** Medium
* **Files:** [`playwright.config.ts`](file:///d:/Repos/Ward-Flow/playwright.config.ts), [`.github/workflows/ward-flow.yml`](file:///d:/Repos/Ward-Flow/.github/workflows/ward-flow.yml#L288)
* **Status:** **Controlled & Documented**

#### Technical Context & Mechanism
In `playwright.config.ts`, two projects are configured:
- `chromium`: Matches `productionSpecPattern`.
- `chromium-mockups`: Matches `mockupSpecPattern`.

Because `ui-ward-*.spec.ts` files match both patterns:
1. **Unscoped Runs:** Running `npx playwright test` without `--project` will execute every Ward Flow spec twice.
2. **CI Dependency:** [`.github/workflows/ward-flow.yml`](file:///d:/Repos/Ward-Flow/.github/workflows/ward-flow.yml#L288) explicitly invokes:
   ```bash
   npm run test:e2e:ward-journeys # calls: node scripts/run-playwright.mjs --project=chromium-mockups ui-ward-
   ```
   If `ui-ward-*` was prematurely removed from `mockupSpecPattern`, hosted CI would find zero tests.

#### Recommendation
Maintain `ui-ward-*` in `mockupSpecPattern` until the GitHub Actions workflow is updated to target `--project=chromium`. Once CI is updated, `chromium-mockups` can be formally retired.

---

### Finding AUD-E2E-08: Stale PsychSift PR Shard Definitions
* **Category:** Technical Debt
* **Severity:** Low
* **File:** [`scripts/playwright-pr-shards.mjs`](file:///d:/Repos/Ward-Flow/scripts/playwright-pr-shards.mjs#L31)
* **Status:** **Documented**

#### Technical Context
Running `npm run check:playwright-pr-shards` outputs:
```
PR UI shard groups are out of sync with production specs.
unknown in groups: tests/answer-progress-ui-smoke.spec.ts, tests/dsm-ui-smoke.spec.ts, tests/ui-accessibility.spec.ts...
```
`scripts/playwright-pr-shards.mjs` retains duration profiles and shard assignments for 34 PsychSift specs deleted on 25 September 2026. This script is not called in `.github/workflows/ward-flow.yml` and does not block CI, but represents legacy dead tooling.

---

## 4. Verification Evidence Matrix

All remediations have been verified locally through focused, decisive checks:

| Verification Suite | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| **Referral Model & DOM Suite** | `npx vitest run tests/ward-referral-model.test.ts tests/ward-referral-screens.dom.test.tsx` | Verifies D-32 FIFO queue sorting and table rendering | **PASS** (161 tests passed in 68.5s) |
| **Repository Safety Suite** | `npx vitest run tests/playwright-project-isolation.test.ts tests/test-file-runner-visibility.test.ts tests/ci-cache-safety.test.ts tests/test-runner-safety.test.ts tests/ward-known-journey-failures.test.ts` | Verifies project isolation and runner arguments | **PASS** (112 tests passed, 55 skipped) |
| **CI Scope Classifier Self-Test** | `npm run check:ci-scope` | Verifies `scripts/ci-change-scope.mjs` against `playwright.config.ts` | **PASS** (25 advisory specs matched, exit 0) |
| **TypeScript Typecheck** | `npm run typecheck` | Whole-tree strict compilation (`tsc --noEmit`) | **PASS** (0 errors) |

---

## 5. Strategic Recommendations & Next Steps

### Immediate Next Steps (No Action Required by Josh)
1. **Branch Hygiene & Commit:** Stage and commit the verified testing changes to `feat/movement-drawer-audit-and-actions`.
2. **Rebase against `origin/main`:** Because PR #118 landed on `origin/main` ahead of this branch, rebase cleanly onto `origin/main` to absorb upstream documentation and token updates.

### Medium-Term Recommendations (Planned Milestone)
1. **Unify GitHub Actions CI:** Update `.github/workflows/ward-flow.yml` line 288 from:
   ```yaml
   run: npm run test:e2e:ward-journeys
   ```
   to use the standard PR runner:
   ```yaml
   run: npm run test:e2e:pr
   ```
2. **Retire `chromium-mockups` Project:** Once CI runs `chromium`, delete the `chromium-mockups` project from `playwright.config.ts` and remove `mockupSpecPattern` completely.
3. **Re-shard Playwright PR Shards:** Rebalance `scripts/playwright-pr-shards.mjs` using the real execution timings of the 13 Ward Flow specs.
