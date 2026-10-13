# Ward Flow: TypeScript, Domain Integrity & Architectural Audit Report

**Date:** 9 October 2026  
**Repository:** `BigSimmo/Ward-Flow`  
**Current Branch:** `feat/movement-drawer-audit-and-actions`  
**Target Reference:** `origin/main` (commit `b1210a81`)  
**Auditor:** Antigravity AI Pair Programmer  
**Clinical & Engineering Context:** Western Australian Psychiatric Bed Flow Management Prototype (Synthetic Data Only)

---

## 1. Executive Summary

A comprehensive adversarial audit was conducted on the Ward Flow codebase to verify nine previously reported TypeScript, architectural, and domain-integrity findings against the current upstream repository state (`origin/main`) and the active local working tree.

### Key Audit Findings
1. **Four True Architectural & Domain Flaws Confirmed on `origin/main`:**
   - **Compiler Configuration:** Neither `tsconfig.json` nor `tsconfig.typecheck.json` excluded `tmp/**`, causing temporary scratch files and heavy-runner build caches to be compiled as source code.
   - **Domain Integrity in Fallback Referrals (`community-screen.tsx`):** A fallback referral object double-cast via `as unknown as Referral` omitted five mandatory domain fields (`suburb`, `ageBand`, `destinations`, `transportNeeded`, and valid diagnosis) while illegally injecting `provisionalDiagnosis` (violating ICD-10 block code constraints).
   - **Dead Logic in Patient Search Filters (`patient-search.tsx`, `record-preview.tsx`, `search-filters.ts`):** Exactly 11 instances compared `(homeRegion as unknown as string) === "Community"`. Because `"Community"` is a care setting rather than one of Western Australia's ten geographic health regions (`HOME_REGIONS`), the comparison was logically impossible and always evaluated to `false`, silently breaking referral search filtering.
   - **Event Log Type Impersonation (`ward-event-log.ts`):** `acceptedEventsForHistory` cast flat `EventLogEntry` audit summaries (intentionally stripped of payloads and free text under privacy rule D-14) to full `WardFlowEvent` objects (`as unknown as WardFlowEvent`), posing severe runtime undefined-property hazards for consumers.

2. **One React Hook Lifecycle Defect Confirmed on Active Branch:**
   - **Ref Cleanup Trap (`ward-modal-focus.ts`):** The `useWardModalFocus` hook was reading `returnFocusRef.current` directly inside the `useEffect` cleanup closure, violating React lifecycle invariants and risking focus restoration failures.

3. **Three Non-Issues / Transient Spike Artifacts:**
   - **Dual Sign-Off API & Panel:** `src/app/api/clinical-dual-signoff/route.ts` and `clinical-dual-signoff-panel.tsx` do not exist on `origin/main` or on disk; they were transient artifacts from an earlier unmerged feature spike.
   - **Clinical Assessment Route Test:** `tests/clinical-assessment-api-route.test.ts` does not exist on `origin/main` or on disk.
   - **Screenshot Script Modules:** Active generator and screenshot scripts (`scripts/generate-delays-mockups.mjs` and `scripts/ward-flow/shots.mjs`) already use standard ES module syntax (`import`) and approved Node CJS interop (`createRequire`).

### Remediation Status
All active issues have been resolved, statically type-checked with `0` errors across the entire repository, and verified green through 83 targeted unit and DOM tests.

---

## 2. Methodology & Adversarial Verification Framework

Every item was subjected to a three-point adversarial verification:
1. **Upstream Baseline Proof:** Inspect `origin/main` directly via `git show` and `git grep` to confirm whether the defect existed in the canonical codebase.
2. **Current Tree Inspection:** Analyze the exact git diff against the working tree to verify that the repair is syntactically sound, type-safe, and adheres to project domain rules.
3. **Execution Gate:** Run the TypeScript compiler (`tsc`), the linter (`eslint`), and the Vitest test runner against affected modules to confirm no regressions were introduced.

---

## 3. Detailed Findings, Root Cause Analysis & Resolutions

---

### Finding AUD-TS-01: Compiler Leak via Missing `tmp/**` Exclusion
* **Category:** Compiler Configuration
* **Severity:** Medium
* **Files:** [`tsconfig.json`](file:///d:/Repos/Ward-Flow/tsconfig.json), [`tsconfig.typecheck.json`](file:///d:/Repos/Ward-Flow/tsconfig.typecheck.json)
* **Status:** **Resolved**

#### Technical Context & Root Cause
In Next.js and TypeScript projects with automated test runners and heavy build scripts (e.g. `scripts/run-heavy.mjs`), temporary caches and buildinfo files are written to a root-level `tmp/` directory. 
In `origin/main`, both configuration files included `"**/*.ts"` and `"**/*.tsx"` while only excluding:
```json
"exclude": [
  "node_modules",
  "scratch/**",
  "worktrees/**",
  "scripts/archive/**",
  "docs/**"
]
```
Because `tmp/**` was not excluded, any temporary script, runner cache, or scratch file generated in `tmp/` was automatically swept into the compiler's compilation context. If a scratch file contained invalid TypeScript or incomplete experimental code, `npm run typecheck` would fail across the entire project.

#### Resolution
Added `"tmp/**"` to the `exclude` array in both [`tsconfig.json`](file:///d:/Repos/Ward-Flow/tsconfig.json) and [`tsconfig.typecheck.json`](file:///d:/Repos/Ward-Flow/tsconfig.typecheck.json).

```diff
diff --git a/tsconfig.json b/tsconfig.json
@@ -28,6 +28,7 @@
   "exclude": [
     "node_modules",
+    "tmp/**",
     "scratch/**",
     "worktrees/**",
     "scripts/archive/**",
diff --git a/tsconfig.typecheck.json b/tsconfig.typecheck.json
@@ -38,6 +38,7 @@
     "node_modules",
     ".next/**",
     "next-env.d.ts",
+    "tmp/**",
     "scratch/**",
     "worktrees/**",
     "scripts/archive/**",
```

#### Verification Proof
* Ran: `node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit`
* Output: **Exit code 0. Zero compiler errors.**

---

### Finding AUD-TS-02: Fallback Referral Double-Cast & Missing Mandatory Domain Fields
* **Category:** Domain Integrity / Type Safety
* **Severity:** High
* **File:** [`src/components/ward-management/community/community-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/community/community-screen.tsx)
* **Status:** **Resolved**

#### Technical Context & Root Cause
In `community-screen.tsx`, the `openReferralDrawer` function had a fallback branch when a requested referral ID was not found in the live referrals list. 
On `origin/main`, the fallback object was constructed as:
```typescript
setSelectedReferral({
  id: refId,
  urgency: 1,
  raisedAt: now - 252,
  patientId: refId === "RF-8824" ? "PT-4620" : "PT-4409",
  sendingTeamName: "ED Liaison Team",
  originSiteCode: "Fiona Stanley Hospital ED Resus",
  source: "ed_medical",
  homeRegion: "Perth Metropolitan",
  history:
    "Acute behavioural disturbance, persecutory delusions regarding neighbours, severe sleep disturbance.",
  provisionalDiagnosis: "Acute relapse of paranoid schizophrenia",
} as unknown as Referral);
```
This construct contained multiple critical domain and typing violations:
1. **Illegal Double-Cast:** `as unknown as Referral` was used to bypass TypeScript's type checker.
2. **Missing Mandatory Fields:** The `Referral` type strictly requires:
   - `suburb: ReferralSuburb` (`{ kind: "named"; name: string } | { kind: "unknown"; reason: SuburbUnknownReason }`)
   - `ageBand: Cohort` (`"Adult" | "Older adult" | "Youth"`)
   - `transportNeeded: boolean`
   - `destinations: ReferralAddressing[]` (at least one destination with valid state)
3. **Invalid Diagnosis Property:** `provisionalDiagnosis` is not a field on `Referral`. Under decision `T15`, referrals store `tentativeDiagnosis?: TentativeDiagnosisBlock`, restricted to the eleven ICD-10-AM Chapter V block codes (e.g., `"F20–F29"`).

#### Clinical & Runtime Impact
When the referral drawer opened for a fallback referral, child components attempting to read `referral.destinations.map(...)` or display `referral.suburb.name` would encounter `TypeError: Cannot read properties of undefined` in production, crashing the client view.

#### Resolution
Constructed a fully valid `Referral` object matching all domain constraints and removed `as unknown as Referral`:
```diff
diff --git a/src/components/ward-management/community/community-screen.tsx b/src/components/ward-management/community/community-screen.tsx
@@ -677,10 +677,19 @@ export function CommunityScreen({
           originSiteCode: "Fiona Stanley Hospital ED Resus",
           source: "ed_medical",
           homeRegion: "Perth Metropolitan",
+          suburb: { kind: "named", name: "Murdoch" },
+          ageBand: "Adult",
+          transportNeeded: false,
+          destinations: [
+            {
+              destination: { kind: "community_team", teamName: "ED Liaison Team" },
+              state: "queued",
+            },
+          ],
           history:
             "Acute behavioural disturbance, persecutory delusions regarding neighbours, severe sleep disturbance.",
-          provisionalDiagnosis: "Acute relapse of paranoid schizophrenia",
-        } as unknown as Referral);
+          tentativeDiagnosis: "F20–F29",
+        });
```

#### Verification Proof
* Grep check: `git grep "as unknown as Referral" src/` returned **0 results**.
* Vitest DOM suites:
  - `tests/ward-community-index.dom.test.tsx` (5 passed)
  - `tests/ward-community-hub.dom.test.tsx` (43 passed)
  - Total: **48 passed (48)**.

---

### Finding AUD-TS-03: Dead-Code Search Filter Checks (`homeRegion === "Community"`)
* **Category:** Domain Integrity / Search & Filter Logic
* **Severity:** Medium (Dead Logic / Functional Bug)
* **Files:**
  - [`src/components/ward-management/search/patient-search.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-search.tsx) (5 instances)
  - [`src/components/ward-management/search/record-preview.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/record-preview.tsx) (2 instances)
  - [`src/components/ward-management/search/search-filters.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/search-filters.ts) (4 instances)
* **Status:** **Resolved**

#### Technical Context & Root Cause
In Western Australian mental health services and the Ward Flow domain model, `HomeRegion` designates geographic health areas:
```typescript
export const HOME_REGIONS = [
  "Perth Metropolitan", "South West", "Great Southern", "Midwest",
  "Pilbara", "Kimberley", "Goldfields", "Wheatbelt"
] as const;
```
"Community" is **not** a geographic region; it is a clinical care setting, represented on the referral by `source: ReferralSource` (`"community"`, `"ed_medical"`, `"psychiatric_ward"`, etc.).

In `origin/main`, 11 separate conditional statements checked whether a referral was a community referral via:
```typescript
(result.referral.homeRegion as unknown as string) === "Community"
```
The developer was forced to write `as unknown as string` because TypeScript knew `HomeRegion` could never equal `"Community"`. At runtime, this comparison **always evaluated to `false`**.

#### Clinical & Functional Impact
Because `homeRegion === "Community"` was always false, any filter looking for community referrals only matched if the referral had `"CMHT"` or `"Clinic"` explicitly in its `originSiteCode`. Legitimate community referrals with alternative site codes were incorrectly categorized as acute inpatient referrals.

#### Resolution
Replaced all 11 instances with the accurate domain check: `referral.source === "community"` (or `!== "community"`).

```diff
diff --git a/src/components/ward-management/search/search-filters.ts b/src/components/ward-management/search/search-filters.ts
@@ -126,7 +126,7 @@ export function matchesSetting(result: PatientSearchResult, setting: string): bo
       return (
         result.referral.originSiteCode.includes("CMHT") ||
         result.referral.originSiteCode.includes("Clinic") ||
-        (result.referral.homeRegion as unknown as string) === "Community"
+        result.referral.source === "community"
       );
     }
```

#### Verification Proof
* Grep check: `git grep "homeRegion as unknown as string" src/` returned **0 results**.
* Unit tests:
  - `tests/ward-patient-search.test.ts` (22 passed)
  - `tests/ward-search-refusals.test.ts` (5 passed)
  - Total: **27 passed (27)**.

---

### Finding AUD-TS-04: Dishonest Event Log Type Impersonation
* **Category:** Type Safety / Clinical Privacy Architecture
* **Severity:** Medium
* **File:** [`src/components/ward-management/ward-event-log.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-event-log.ts)
* **Status:** **Resolved**

#### Technical Context & Root Cause
Under clinical privacy requirement D-14, the in-memory event audit log deliberately strips free text, notes, and patient identifiers to prevent transient clinical notes from lingering in browser memory. This data is modeled as `EventLogEntry`:
```typescript
export type EventLogEntry = {
  type: WardFlowEvent["type"];
  role: WardFlowRole | undefined;
  now: Instant | undefined;
  accepted: boolean;
  movementId?: string;
  admissionId?: string;
  referralId?: string;
  unitId?: string;
  actingUnitId?: string;
  bedId?: string;
  releaseId?: string;
};
```
However, in `origin/main`, `acceptedEventsForHistory` declared its return type as `WardFlowEvent[]` and used `as unknown as WardFlowEvent`:
```typescript
export function acceptedEventsForHistory(log: readonly EventLogEntry[]): WardFlowEvent[] {
  return log.filter((entry) => entry.accepted).map((entry) => entry as unknown as WardFlowEvent);
}
```
`WardFlowEvent` is a rich union of 50+ event types carrying specific payloads (bed IDs, patient transfers, referral records, clock dispatches). The objects returned by this function did not have those payloads; they were flat audit logs pretending to be complete events.

#### Resolution
Updated the function signature and implementation to honestly reflect what it produces: `EventLogEntry[]`.
```diff
diff --git a/src/components/ward-management/ward-event-log.ts b/src/components/ward-management/ward-event-log.ts
@@ -53,6 +53,6 @@ export function eventLogEntryFor(event: WardFlowEvent, accepted: boolean): Event
-export function acceptedEventsForHistory(log: readonly EventLogEntry[]): WardFlowEvent[] {
-  return log.filter((entry) => entry.accepted).map((entry) => entry as unknown as WardFlowEvent);
+export function acceptedEventsForHistory(log: readonly EventLogEntry[]): EventLogEntry[] {
+  return log.filter((entry) => entry.accepted);
 }
```

#### Verification Proof
* Vitest: `npx vitest run tests/ward-event-log.dom.test.tsx` passed all **4 tests**.

---

### Finding AUD-TS-05: React Hook Ref-Trap in Modal Focus Cleanup
* **Category:** React Hooks / Ergonomics
* **Severity:** Low
* **File:** [`src/components/ward-management/ward-modal-focus.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-modal-focus.ts)
* **Status:** **Resolved**

#### Technical Context & Root Cause
When the 4th argument `returnFocusRef?: RefObject<HTMLElement | null>` was introduced to `useWardModalFocus` to support explicit focus restoration on modal dismissals, the cleanup function of `useEffect` was reading `returnFocusRef?.current`.
In React, refs are mutable containers. By the time a component unmounts and the effect cleanup executes, `ref.current` may already have been set to `null` or pointed to a detached DOM element, triggering the `react-hooks/exhaustive-deps` warning and failing to restore keyboard focus to the triggering button.

#### Resolution
Captured the element target within the effect body at setup time:
```typescript
const returnFocusElement = returnFocusRef?.current;
window.addEventListener("keydown", keydown, true);
return () => {
  window.removeEventListener("keydown", keydown, true);
  popSheet(id);
  const target =
    returnFocusElement && returnFocusElement.isConnected && canRestoreFocusTo(returnFocusElement)
      ? returnFocusElement
      : previous && previous.isConnected && canRestoreFocusTo(previous)
        ? previous
        : null;
  if (target?.isConnected && canRestoreFocusTo(target)) {
    target.focus({ preventScroll: true });
  }
};
```

#### Verification Proof
* ESLint: `npx eslint src/components/ward-management/ward-modal-focus.ts` passed with **0 errors and 0 warnings**.
* Vitest: `npx vitest run tests/ward-screen-modal-focus.dom.test.tsx` passed all **4 tests** (including Daily Sheet and Capacity Confirmation Escape dismissal).

---

### Finding AUD-TS-06: Script Module Imports & CommonJS Interop
* **Category:** Build & Tooling Hygiene
* **Severity:** Low
* **Files:** [`scripts/generate-delays-mockups.mjs`](file:///d:/Repos/Ward-Flow/scripts/generate-delays-mockups.mjs), [`scripts/ward-flow/shots.mjs`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/shots.mjs)
* **Status:** **Confirmed Valid**

#### Technical Context & Root Cause
The audit flagged potential legacy CommonJS `require()` statements in screenshot and mockup generators.
Upon adversarial review:
- Untracked generators like `scripts/generate-delays-mockups.mjs` use ESM `import fs from "node:fs"`.
- Tracked screenshot runners like `scripts/ward-flow/shots.mjs` are `.mjs` ES modules that use Node's standard interop pattern:
  ```javascript
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright");
  const sharp = require("sharp");
  ```
  Because `package.json` does not declare `"type": "module"`, using `createRequire` in `.mjs` scripts to import native CommonJS binaries (`sharp`, Playwright) is the correct and supported Node.js practice.

---

### Finding AUD-TS-07: Dual Sign-Off & Assessment API Routes
* **Category:** Dead / Spike Code Verification
* **Severity:** Informational
* **Files:**
  - `src/app/api/clinical-dual-signoff/route.ts`
  - `src/components/ward-management/clinical-dual-signoff-panel.tsx`
  - `tests/clinical-assessment-api-route.test.ts`
* **Status:** **Non-Existent (No Action Required)**

#### Technical Context & Verification
These three files were audited for loose `any` types and unlinked form labels.
During adversarial checks:
- `git ls-tree -r origin/main` returned no matching entries.
- Filesystem checks via `Test-Path` returned `False` for all three paths.
- Conclusion: These files were created during an exploratory spike that was cleaned or stashed prior to this session. They do not exist in the working tree or upstream and require no maintenance.

---

## 4. Current Repository & Working Tree Drift Analysis

### Divergence from `origin/main`
* Branch `feat/movement-drawer-audit-and-actions` is **11 commits ahead** and **32 commits behind** `origin/main`.
* Upstream commits include mobile layout polish (PR #125), documentation repairs (PR #124), and phone viewport adaptations (PR #122).
* None of the 32 upstream commits modified the eight files changed in our audit remediation.

### Pre-Existing In-Flight Edits in Working Tree
The working tree contains pre-existing edits from another agent or feature:
- [`tests/ward-referral-screens.dom.test.tsx`](file:///d:/Repos/Ward-Flow/tests/ward-referral-screens.dom.test.tsx): Modified to test Decision D-32 FIFO queue order.
- This test file currently has discrepancies with `referral-board.tsx` and should be kept separate from the TypeScript audit commit.

---

## 5. Summary of Modified Files

| File | Purpose of Change | Checks Run |
| :--- | :--- | :--- |
| [`tsconfig.json`](file:///d:/Repos/Ward-Flow/tsconfig.json) | Exclude `tmp/**` from compilation | `tsc -p tsconfig.json` |
| [`tsconfig.typecheck.json`](file:///d:/Repos/Ward-Flow/tsconfig.typecheck.json) | Exclude `tmp/**` from source typecheck | `tsc -p tsconfig.typecheck.json` (0 errors) |
| [`src/components/ward-management/community/community-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/community/community-screen.tsx) | Provide valid `Referral` object, remove `as unknown as Referral` | 48 Vitest DOM tests passing |
| [`src/components/ward-management/search/patient-search.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-search.tsx) | Replace `homeRegion === "Community"` with `source === "community"` | 27 Vitest search tests passing |
| [`src/components/ward-management/search/record-preview.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/record-preview.tsx) | Replace `homeRegion === "Community"` with `source === "community"` | Full typecheck passing |
| [`src/components/ward-management/search/search-filters.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/search-filters.ts) | Replace `homeRegion === "Community"` with `source === "community"` | Full typecheck passing |
| [`src/components/ward-management/ward-event-log.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-event-log.ts) | Return `EventLogEntry[]`, drop `as unknown as WardFlowEvent` | 4 Vitest event-log DOM tests passing |
| [`src/components/ward-management/ward-modal-focus.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-modal-focus.ts) | Capture `returnFocusElement` at effect setup | ESLint passing, 4 DOM tests passing |

---

## 6. Recommendations & Next Steps

1. **Commit the Audit Fixes as an Isolated Unit:**
   Stage exclusively the eight files listed in the table above and commit them with a focused message:
   `fix(types): resolve compiler leaks, referral fallback typing, and dead search filter logic`
   *(Do not use `git add -A` to avoid capturing unrelated in-flight test or mockup files).*

2. **Isolate the In-Flight Decision D-32 Tests:**
   Reconcile or stash `tests/ward-referral-screens.dom.test.tsx` until the Decision D-32 FIFO queue order feature is formally completed.

3. **Rebase Branch onto `origin/main`:**
   After committing the audit fixes, run `git fetch origin` and `git rebase origin/main` to integrate the 32 upstream commits, verifying that our type safety fixes continue to pass smoothly.
