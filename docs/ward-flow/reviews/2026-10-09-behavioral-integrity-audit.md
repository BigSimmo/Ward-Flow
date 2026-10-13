# Ward Flow: Comprehensive Behavioral Integrity & Dead-Ends Audit Report

**Date:** 9 October 2026  
**Target Repository:** `BigSimmo/Ward-Flow`  
**Auditor:** Antigravity (Advanced Agentic Pair Programmer)  
**Evaluation Scope:** Interaction completeness, navigation wayfinding, drawer/sheet escape hatches, empty state recovery, AST control wiring, and console/runtime health.

---

## 1. Executive Summary

This audit evaluated the Ward Flow application to ensure **zero dead ends** and complete behavioral integrity. In clinical psychiatric bed flow management, a "dead end" is defined as any interface state where a user clicks and nothing happens, is trapped inside an overlay, encounters an unannounced disabled control without knowing what information is missing, or reaches a blank void with no recovery path.

### Summary of Audit Findings
Overall, Ward Flow demonstrates an exceptionally disciplined codebase with zero dummy `#` anchor links, zero inert unhandled buttons, and 100% adherence to core view routing under `src/components/ward-management/ward-nav.ts`. 

However, rigorous static AST inspection and runtime testing identified **8 specific issues requiring resolution**:
1. **Critical Accessibility Traps (2 issues):** Focus loss on drawer unmount ([`sheet.tsx`](../../src/components/ui/sheet.tsx)) and missing focus return on the Daily Sheet modal ([`ward-screen.tsx`](../../src/components/ward-management/ward/ward-screen.tsx)).
2. **Clinical Logic & Type Defects (2 issues):** An impossible `"Community"` region comparison silently breaking patient search ([`patient-search.tsx`](../../src/components/ward-management/search/patient-search.tsx)) and an unsafe type-cast masking data discrepancies in audit logging ([`ward-event-log.ts`](../../src/components/ward-management/ward-event-log.ts)).
3. **Clinician Ergonomics & Recovery Friction (2 issues):** Absence of an in-situ "Clear service filter" recovery button on the Movements worklist ([`movements-screen.tsx`](../../src/components/ward-management/movements/movements-screen.tsx)) and an unexplained multi-requirement block on referral dispatch ([`patient-transit-operations.tsx`](../../src/components/ward-management/patients/patient-transit-operations.tsx)).
4. **Environment & Routing Polish (2 issues):** React DOM warning during test execution caused by link prefetch mocking ([`on-call-screen.tsx`](../../src/components/ward-management/on-call/on-call-screen.tsx)) and direct top-level domain route 404s for users manually typing URLs outside `/mockups/ward-flow/`.

---

## 2. Detailed Findings & Resolution Register

```
┌──────────┬────────────────────────────────────────────────────────┬─────────────┬──────────────────────────┐
│ Issue ID │ Description                                            │ Severity    │ Status on Current Branch │
├──────────┼────────────────────────────────────────────────────────┼─────────────┼──────────────────────────┤
│ WF-AUD-01│ Keyboard Focus Drop on Drawer Unmount                  │ High (A11y) │ Patched & Verified       │
│ WF-AUD-02│ Missing Focus Target on Daily Sheet Modal Dismissal   │ High (A11y) │ Patched & Verified       │
│ WF-AUD-03│ Flawed "Community" Geographic Region Comparison       │ Medium      │ Patched & Verified       │
│ WF-AUD-04│ Unsafe Event Log History Type Cast                     │ Low (Type)  │ Patched & Verified       │
│ WF-AUD-05│ Test Harness Console Pollution via Link Prefetch Prop  │ Low (Test)  │ Ready for Fix            │
│ WF-AUD-06│ Movements Screen Missing In-Situ "Clear Filter" Button │ Medium (UX) │ Ready for Fix            │
│ WF-AUD-07│ Unexplained Multi-Condition Block on Referral Dispatch │ Medium (UX) │ Ready for Fix            │
│ WF-AUD-08│ Direct Domain-Root URL Routing & Missing Aliases       │ Low (Infra) │ Ready for Fix            │
└──────────┴────────────────────────────────────────────────────────┴─────────────┴──────────────────────────┘
```

---

### WF-AUD-01: Keyboard Focus Drop on Drawer Unmount

* **File:** [`src/components/ui/sheet.tsx:332-345`](../../src/components/ui/sheet.tsx)
* **Severity:** High (WCAG 2.1 AA Keyboard Navigation Violation)
* **Status:** Verified on `origin/main`; Patched on local branch.

#### Context & Clinical Impact
When a clinician opens an overlay sheet (e.g. Bed Dossier Drawer, Patient Movement Drawer) and closes it, their keyboard focus must return to the exact card or table row that opened it. If a component is conditionally unmounted (e.g. `{isOpen && <Sheet ... />}`), `unmountingRef.current` is set to `true`. On `origin/main`, line 335 executes `if (unmountingRef.current) return;`, which aborts the focus restoration callback. Consequently, keyboard focus is dumped to `document.body`. A clinician using keyboard navigation or a screen reader loses their place on the bed matrix and has to re-tab from the top of the entire screen.

#### Code Evidence (`origin/main`)
```tsx
// src/components/ui/sheet.tsx (origin/main)
if (unmountingRef.current) return; // ❌ Aborts focus restoration!
restoreTimers.frame = window.requestAnimationFrame(() => {
  const restoreTarget = resolveConnectedRestoreTarget();
  if (restoreTarget?.isConnected) restoreTarget.focus();
});
```

#### Remediation & Verification
Immediately restore focus synchronously if unmounting, before the trigger reference is disconnected:
```tsx
// Patched implementation
if (unmountingRef.current) {
  const restoreTarget = resolveConnectedRestoreTarget();
  if (typeof document !== "undefined" && restoreTarget?.isConnected && canRestoreFocusTo(restoreTarget)) {
    restoreTarget.focus({ preventScroll: true });
  }
  return;
}
```
*Verification:* Tested and passing in [`tests/ward-screen-modal-focus.dom.test.tsx`](../../tests/ward-screen-modal-focus.dom.test.tsx).

---

### WF-AUD-02: Missing Focus Target on Daily Sheet Modal Dismissal

* **File:** [`src/components/ward-management/ward/ward-screen.tsx:318, 3830-3845`](../../src/components/ward-management/ward/ward-screen.tsx)
* **Severity:** High (WCAG 2.1 AA Focus Trap / Loss)
* **Status:** Verified on `origin/main`; Patched on local branch.

#### Context & Clinical Impact
The "Daily Sheet" modal is opened via a dedicated button (`data-testid="ward-open-daily-sheet-btn"`). On `origin/main`, dismissing the modal (via `Escape` or the close button) simply toggled `setDailySheetOpen(false)`. Unlike the Capacity Confirmation modal, it had no `returnFocusRef` or focus restoration orchestration, causing keyboard focus to vanish into the document root.

#### Code Evidence (`origin/main`)
```tsx
// src/components/ward-management/ward/ward-screen.tsx (origin/main)
// Escape listener only closed state:
} else if (dailySheetOpen) {
  setDailySheetOpen(false); // ❌ No focus restoration to trigger
}
```

#### Remediation & Verification
Integrate the Daily Sheet modal with `useWardModalFocus` and pass an explicit `dailySheetTriggerRef`:
```tsx
const dailySheetModalRef = useRef<HTMLDivElement | null>(null);
const dailySheetTriggerRef = useRef<HTMLButtonElement | null>(null);

useWardModalFocus(
  dailySheetOpen, 
  dailySheetModalRef, 
  () => setDailySheetOpen(false), 
  dailySheetTriggerRef
);
```
*Verification:* Verified via unit test:
```bash
npx vitest run tests/ward-screen-modal-focus.dom.test.tsx
# ✓ traps focus in Daily Sheet modal and restores focus on close button (592ms)
# ✓ restores focus to trigger on Escape key dismissal of Daily Sheet modal (402ms)
```

---

### WF-AUD-03: Flawed "Community" Geographic Region Comparison

* **File:** [`src/components/ward-management/search/patient-search.tsx:266, 280, 411, 2003`](../../src/components/ward-management/search/patient-search.tsx)
* **Severity:** Medium (Clinical Data Retrieval Bug)
* **Status:** Verified on `origin/main`; Patched on local branch.

#### Context & Clinical Impact
The Patient Search console allows coordinators to filter patients by stream (e.g. Inpatient vs Community). On `origin/main`, the filtering predicate checked:
```tsx
(result.referral.homeRegion as unknown as string) === "Community"
```
In Ward Flow's architecture (governed by Owner Decision Q-2 in [`ward-service-scope.ts`](../../src/components/ward-management/ward-service-scope.ts)), `homeRegion` represents one of ten geographic health regions (`"Perth Metropolitan"`, `"Kimberley"`, `"South West"`, `"Wheatbelt"`, etc.). It is **never** `"Community"`. The forced TypeScript assertion (`as unknown as string`) silenced compiler type errors, but the condition was impossible and always evaluated to `false`. As a result, community referrals were misclassified and filtered out of community views.

#### Code Evidence (`origin/main`)
```tsx
// patient-search.tsx lines 266-269 (origin/main)
const isComm =
  result.referral.originSiteCode.includes("CMHT") ||
  result.referral.originSiteCode.includes("Clinic") ||
  (result.referral.homeRegion as unknown as string) === "Community"; // ❌ Dead code / always false
```

#### Remediation & Verification
Inspect the true clinical origin property on the referral model:
```tsx
const isComm =
  result.referral.originSiteCode.includes("CMHT") ||
  result.referral.originSiteCode.includes("Clinic") ||
  result.referral.source === "community"; // ✅ Clean union type comparison
```
*Verification:* Tested and verified against synthetic data in [`patient-search.tsx`](../../src/components/ward-management/search/patient-search.tsx).

---

### WF-AUD-04: Unsafe Event Log History Type Cast

* **File:** [`src/components/ward-management/ward-event-log.ts:56-58`](../../src/components/ward-management/ward-event-log.ts)
* **Severity:** Low (Architectural Hygiene / Type Safety)
* **Status:** Verified on `origin/main`; Patched on local branch.

#### Context & Clinical Impact
`EventLogEntry` is an audit ledger record stored in session history containing sanitized telemetry (`type`, `role`, `now`, `accepted`, `recordId`). A `WardFlowEvent` is an active reducer action with discriminated union payloads (e.g. `ACCEPT_REFERRAL` requires `unitId`, `notes`, `priority`). On `origin/main`, `acceptedEventsForHistory` cast `EventLogEntry` directly to `WardFlowEvent` using `entry as unknown as WardFlowEvent`. This forced cast hid structural differences and could lead to runtime errors if downstream history selectors expected reducer-specific action payloads.

#### Code Evidence (`origin/main`)
```tsx
// ward-event-log.ts lines 56-58 (origin/main)
export function acceptedEventsForHistory(log: readonly EventLogEntry[]): WardFlowEvent[] {
  return log.filter((entry) => entry.accepted).map((entry) => entry as unknown as WardFlowEvent);
}
```

#### Remediation & Verification
Update the signature to return `EventLogEntry[]` accurately:
```tsx
export function acceptedEventsForHistory(log: readonly EventLogEntry[]): EventLogEntry[] {
  return log.filter((entry) => entry.accepted);
}
```
*Verification:* Unit test suite [`tests/ward-event-log.dom.test.tsx`](../../tests/ward-event-log.dom.test.tsx) passes cleanly.

---

### WF-AUD-05: Test Harness Console Pollution via Link Prefetch Prop

* **File:** [`src/components/ward-management/on-call/on-call-screen.tsx:532`](../../src/components/ward-management/on-call/on-call-screen.tsx)
* **Severity:** Low (Test Harness / React DOM Warning)
* **Status:** Confirmed on `origin/main`.

#### Context & Clinical Impact
In Next.js production builds, `<Link prefetch={false}>` is properly handled by Next's routing runtime. However, in our unit and SSR tests ([`tests/ward-nav.test.ts:33`](../../tests/ward-nav.test.ts)), `next/link` is mocked by spreading props directly onto an HTML `<a>` tag:
```tsx
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }) => createElement("a", { href, ...rest }, children),
}));
```
Because `prefetch={false}` is passed through to `<a>`, React DOM emits an explicit warning during test execution:
```
Received 'false' for a non-boolean attribute 'prefetch'.
If you want to write it to the DOM, pass a string instead: prefetch="false"
```

#### Remediation
In [`on-call-screen.tsx:532`](../../src/components/ward-management/on-call/on-call-screen.tsx), remove the redundant `prefetch={false}` (Next.js App Router default prefetching behavior already suffices), eliminating noisy test console output.

---

### WF-AUD-06: Movements Screen Missing In-Situ "Clear Filter" Button

* **File:** [`src/components/ward-management/movements/movements-screen.tsx:795-835`](../../src/components/ward-management/movements/movements-screen.tsx)
* **Severity:** Medium (Clinician Usability / Friction)
* **Status:** Confirmed on `origin/main`.

#### Context & Clinical Impact
When a coordinator uses the global service scope selector (e.g. filtering to "South Metro Health Service") and navigates to the Movements worklist, if that service currently has zero patients at a particular stage, the screen renders:
```html
<p class="absent">No movements at this stage in South Metro Health Service.</p>
```
Unlike the Delays screen and Capacity screen, which provide an inline button to clear the filter or view statewide data, the Movements screen provides no inline recovery button. A busy clinician must manually scroll to the top header bar, click the service dropdown, and reselect "All Services" to regain full context.

#### Remediation
Enhance the empty stage banner with an actionable reset button:
```tsx
<div className={styles.emptyStage}>
  <h3 className={styles.emptyStageTitle}>{stage.label}</h3>
  <p className={styles.absent}>No movements at this stage{inServiceSuffix(service)}.</p>
  {service && (
    <button
      type="button"
      className={styles.btnClearFilter}
      onClick={() => setServiceScope(null)}
    >
      Show statewide movements
    </button>
  )}
</div>
```

---

### WF-AUD-07: Unexplained Multi-Condition Block on Referral Dispatch

* **File:** [`src/components/ward-management/patients/patient-transit-operations.tsx:336-342`](../../src/components/ward-management/patients/patient-transit-operations.tsx)
* **Severity:** Medium (Clinician Cognitive Load & Workflow Dead End)
* **Status:** Confirmed on `origin/main`.

#### Context & Clinical Impact
On the Transit Operations dashboard, the button "Refer to selected wards" is governed by three compound requirements:
```tsx
disabled={
  !canRefer || 
  selectedTargets.length === 0 || 
  (needsGenderPlacement && (!genderReason || !wardChecked))
}
```
If a patient requires a specific gender placement consideration, the button becomes disabled until:
1. At least one target ward is checked.
2. A placement rationale is selected from a dropdown.
3. The confirmation checkbox "Placement checked with the ward" is ticked.

Because there is no inline helper text explaining *which* requirement is unfulfilled, clinicians can select target wards and find the primary action button inert, creating frustration and confusion.

#### Remediation
Provide immediate, accessible feedback beneath the button:
```tsx
{selectedTargets.length === 0 && (
  <span className={styles.helperText}>Select at least one destination ward above.</span>
)}
{needsGenderPlacement && (!genderReason || !wardChecked) && (
  <span className={styles.helperText}>
    Gender placement agreement must be documented and verified above before dispatch.
  </span>
)}
```

---

### WF-AUD-08: Direct Domain-Root URL Routing & Missing Aliases

* **File:** [`next.config.ts`](../../next.config.ts) / [`src/app/page.tsx`](../../src/app/page.tsx)
* **Severity:** Low (Direct Wayfinding)
* **Status:** Confirmed on `origin/main`.

#### Context & Clinical Impact
Ward Flow was transitioned to become the dedicated application in this repository. All primary screens are hosted under the App Router path `/mockups/ward-flow/*` (e.g. `/mockups/ward-flow/capacity`, `/mockups/ward-flow/movements`). The root path `/` redirects to `/mockups/ward-flow`. 

However, if an external user or clinician types `http://localhost:3000/capacity` or `http://localhost:3000/movements` directly into their browser, Next.js returns a 404 because no top-level alias redirect exists in `next.config.ts`. Every internal button and navigation link works perfectly, but external direct entrypoints fail.

#### Remediation
Add standard rewrite/redirect rules in `next.config.ts`:
```ts
async redirects() {
  return [
    {
      source: "/:path((?!mockups|api|_next|favicon|icons).*)",
      destination: "/mockups/ward-flow/:path*",
      permanent: false,
    },
  ];
}
```

---

## 3. Adversarial Analysis & De-escalation Register

To avoid unnecessary churn or regressing intentional architecture, the following 4 suspected issues from initial scans were **adversarially scrutinized and refuted**:

```
┌───────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Suspected Issue                       │ Adversarial Finding & Justification                                    │
├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 1. Form Action Buttons with Native    │ REFUTED: docs/wiring-conventions.md §2 explicitly rules that form      │
│    `disabled` (e.g. decline reason)   │ action buttons awaiting validity should use native `disabled`. Making  │
│                                       │ them `aria-disabled` would create noisy, redundant screen-reader speech│
│                                       │ when form inputs above already explain the requirement.                │
├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 2. Internal Application 404s          │ REFUTED: All internal links generated by WARD_VIEWS and ward-nav.ts    │
│                                       │ resolve to /mockups/ward-flow/* and return HTTP 200. No user inside the│
│                                       │ app encounters a 404.                                                  │
├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 3. Patient Typeahead Dropdown Trapping│ REFUTED: patient-typeahead.tsx handles Escape key dismissal cleanly    │
│    on Zero Results                    │ (lines 228-235) and provides an explicit "Clear" button. Pressing      │
│                                       │ Enter on empty deliberately preserves input for form submission.       │
├───────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 4. Movement Summary Links Skipping    │ REFUTED: Native `disabled` on zero-count stages intentionally allows   │
│    Empty Categories                   │ keyboard users to Tab straight to active stages rather than tabbing    │
│                                       │ through 6 empty counters.                                              │
└───────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Proposed Implementation Flight Plan

1. **Phase 1: Commit and Lock Local Core Fixes**
   - Stage and commit the existing verified patches for **WF-AUD-01** ([`sheet.tsx`](../../src/components/ui/sheet.tsx)), **WF-AUD-02** ([`ward-screen.tsx`](../../src/components/ward-management/ward/ward-screen.tsx)), **WF-AUD-03** ([`patient-search.tsx`](../../src/components/ward-management/search/patient-search.tsx)), and **WF-AUD-04** ([`ward-event-log.ts`](../../src/components/ward-management/ward-event-log.ts)).
   - Verify via `npx vitest run tests/ward-screen-modal-focus.dom.test.tsx` and `tests/ward-referral-screens.dom.test.tsx`.

2. **Phase 2: Implement Clinician UX & Recovery Enhancements**
   - Add inline "Show statewide movements" button to [`movements-screen.tsx`](../../src/components/ward-management/movements/movements-screen.tsx) (**WF-AUD-06**).
   - Add inline prerequisite helper guidance to [`patient-transit-operations.tsx`](../../src/components/ward-management/patients/patient-transit-operations.tsx) (**WF-AUD-07**).
   - Remove noisy `prefetch={false}` prop in [`on-call-screen.tsx`](../../src/components/ward-management/on-call/on-call-screen.tsx) (**WF-AUD-05**).

3. **Phase 3: Top-Level Wayfinding Aliases**
   - Add redirect configuration in [`next.config.ts`](../../next.config.ts) for direct root URL navigation (**WF-AUD-08**).
   - Run end-to-end user journeys via `npm run test:e2e:ward-journeys`.
