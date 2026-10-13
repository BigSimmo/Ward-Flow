# Comprehensive Audit Report: Sitemap Reachability & DOM Architecture

**Repository**: `BigSimmo/Ward-Flow` (`d:\Repos\Ward-Flow`)  
**Audit Date**: 9 October 2026  
**Auditor**: Antigravity Architecture & Verification Agent  
**Branch Context**: `feat/movement-drawer-audit-and-actions`  
**Status**: Completed & Adversarially Confirmed  

---

## 1. Executive Summary & Context

A comprehensive architectural and accessibility audit was executed across the entire Next.js App Router route hierarchy (`src/app/**`) and component library (`src/components/ward-management/**`) within the Ward Flow repository. 

The audit evaluated two primary operational domains:
1. **Sitemap & Route Reachability**: App Router filesystem discovery, parity with `docs/site-map.md`, route-to-component bindings, redirect stubs, dead ends, and orphan route discovery.
2. **DOM Architecture & Accessibility Semantics**: DOM landmark hierarchy (`<main>`, `<header>`, `<nav>`), skip-link integrity (`#main-content`), heading structures (WCAG 2.1 AA 1.3.1), table keyboard scrollability, form control semantics, button typing hygiene, and runtime attribute safety.

Every identified issue was subjected to **adversarial review**, actively testing against the live source code to separate genuine runtime/structural defects from static analysis artifacts or deliberate prototype design choices.

### Key Metrics at a Glance
* **Total Routes on Disk**: 45 `page.tsx` routes + 4 Route Handlers (`route.ts`/`route.tsx`).
* **Sitemap Currency**: 100% synchronized with `docs/site-map.md` (`npm run sitemap:check` exits 0).
* **Interactive Button Hygiene**: 100% compliant (`type="button"` or `type="submit"` explicitly set; 0 bare buttons).
* **Interactive Element Nesting**: 0 violations (no `<button>` inside `<a>` or `<a>` inside `<button>`).
* **Confirmed Defects**: 14 distinct issues across landmarks, heading hierarchy, route reachability, URI resilience, table scrollers, and test harness blind spots.
* **Debunked / Nuanced Findings**: 2 static duplicate ID flags proved mutually exclusive at runtime; 1 orphan route proved to be an intentional standalone demonstration screen.

---

## 2. Adversarial Review & Classification Matrix

| ID | Category | Severity | Issue Summary | Adversarial Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A-01** | Landmark / A11y | **High** | Broken `#main-content` target on Sign-In screen | **Confirmed Defect** |
| **A-02** | Landmark / A11y | **High** | Dynamic duplicate `<h1>` landmark violation on Referral Board | **Confirmed Defect** |
| **A-03** | Route Reachability | **Medium** | Orphan Route: `/mockups/ward-flow/sovereign` completely unlinked | **Confirmed Defect** |
| **A-04** | Route Reachability | **Low** | Standalone Route: `/mockups/ward-flow-sign-in` unlinked in UI | **Nuanced / Intentional Bypass** |
| **A-05** | Route Resilience | **Medium** | Missing error boundary on Sign-In screen directory | **Confirmed Defect** |
| **A-06** | Server Resilience | **Medium** | Unguarded `decodeURIComponent` in 8 dynamic route segments | **Confirmed Defect** |
| **H-01** | Heading Hierarchy | **Medium** | Delays Screen jumps `<h1>` &rarr; `<h4>` with zero `<h2>` or `<h3>` | **Confirmed Defect** |
| **H-02** | Heading Hierarchy | **Medium** | Movements Screen contains zero `<h2>` elements (`<h1>` &rarr; `<h3>`) | **Confirmed Defect** |
| **H-03** | Heading Hierarchy | **Low** | Legal Forms Screen jumps `<h1>` &rarr; `<h3>` in main body | **Confirmed Defect** |
| **H-04** | Heading Hierarchy | **Low** | Add Patient Form renders `<h3>` before first `<h2>` | **Confirmed Defect** |
| **H-05** | Heading Hierarchy | **Low** | Referral Board renders timeline `<h3>` before detail `<h2>` | **Confirmed Defect** |
| **H-06** | Heading Hierarchy | **Low** | Sovereign Showcase contains zero `<h2>` elements (`<h1>` &rarr; `<h3>`) | **Confirmed Defect** |
| **T-01** | Table A11y | **Medium** | Handover table scroller lacks `tabIndex={0}`, `role="region"` | **Confirmed Defect** |
| **T-02** | Table A11y | **Medium** | Governance register table scroller lacks keyboard attributes | **Confirmed Defect** |
| **T-03** | Table Architecture | **Low** | 36 raw `<table>` instances bypass canonical `WardTable` primitive | **Confirmed Architectural Drift** |
| **D-01** | React / DOM | **Low** | Leaked boolean `prefetch={false}` attribute on On-Call `<Link>` | **Confirmed Defect** |
| **D-02** | DOM Static ID | **Informational** | Static duplicate `id="cardTriageBadge"` in Community Screen | **Debunked at Runtime (Ternary)** |
| **D-03** | DOM Static ID | **Informational** | Static duplicate `id` in Referral Match decline selects | **Debunked at Runtime (View Mode)** |
| **V-01** | Test Harness | **Medium** | Component binding test pins error stub (`WardMovementNotFound`) | **Confirmed Test Flaw** |
| **V-02** | Test Harness | **Medium** | Landmark test suite omits Sign-In and unselected Referral state | **Confirmed Test Flaw** |

---

## 3. Comprehensive Issue Details & Remediation Specifications

### Category A: DOM Landmark & Route Reachability

#### Issue A-01: Broken Root Skip-Link Target on Sign-In Screen
* **Severity**: High (WCAG 2.1 AA — 2.4.1 Bypass Blocks)
* **Location**: [`src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx:158`](file:///d:/Repos/Ward-Flow/src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx#L158)
* **Context**: Root layout [`src/app/layout.tsx:120-125`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx#L120-L125) renders `<a href="#main-content">Skip to main content</a>`. When navigating to `/mockups/ward-flow-sign-in`, keyboard users pressing Tab and Enter hit an inert anchor because `<main className={styles.wrap}>` omits `id="main-content"`.
* **Adversarial Analysis**: While `tests/ward-landmarks.test.ts` passed 75/75 tests, it hardcodes `ROUTES_DIR = "src/app/mockups/ward-flow"`, completely ignoring `src/app/mockups/ward-flow-sign-in`.
* **Remediation**:
  ```tsx
  // src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx line 158
  // Before:
  return <main className={styles.wrap}>
  // After:
  return <main id="main-content" className={styles.wrap}>
  ```

#### Issue A-02: Dynamic Duplicate `<h1>` Landmark Violation on Referral Board
* **Severity**: High (WCAG 2.1 AA — 1.3.1 Info and Relationships; Repository Rule D7)
* **Location**: [`src/components/ward-management/referrals/referral-board.tsx:805`](file:///d:/Repos/Ward-Flow/src/components/ward-management/referrals/referral-board.tsx#L805)
* **Context**: 
  - Line 497 renders the top-level screen heading: `<h1 className={styles.pageTitle}>Referral board</h1>`.
  - When any patient referral card is selected, line 805 mounts `<h1 className={styles.ptName}>{selectedPatientInfo.displayName}</h1>` inside the selected referral inspector panel within the *exact same* `<main id="main-content">` landmark.
* **Adversarial Proof**: `tests/ward-landmarks.test.ts` missed this defect because it renders `ReferralBoard` in its initial state where `selectedReferralId = null`. When `selectedReferral` is falsy, lines 796–806 are unmounted. At runtime, as soon as a user clicks a referral card, two simultaneous `<h1>` elements coexist in the DOM.
* **Remediation**:
  ```tsx
  // src/components/ward-management/referrals/referral-board.tsx line 805
  // Before:
  <h1 className={styles.ptName}>{selectedPatientInfo.displayName}</h1>
  // After:
  <h2 className={styles.ptName}>{selectedPatientInfo.displayName}</h2>
  ```

#### Issue A-03: Orphan Route — Sovereign Showcase Unlinked in UI
* **Severity**: Medium (Reachability & Sitemap Integrity)
* **Location**: [`src/app/mockups/ward-flow/sovereign/page.tsx`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/sovereign/page.tsx)
* **Context**: 
  - In [`src/components/ward-management/ward-nav.ts:441-456`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-nav.ts#L441-L456), the contract explicitly states: *"UNLISTED here means NO RAIL ITEM, not UNREACHABLE — Settings is reached three ways today: Tools drawer, rail footer, and search."*
  - An exhaustive AST sweep confirms that unlike Settings, `/mockups/ward-flow/sovereign` has **0 incoming `<Link>` or `<a>` tags** in the entire application. It is completely unreachable from the UI without manual URL bar entry.
* **Remediation**: Add a navigation entry point in the Tools drawer or Developer Hub within [`src/components/ward-management/shell/ward-bar.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/shell/ward-bar.tsx).

#### Issue A-04: Standalone Demonstration Route — Sign-In Screen Unlinked
* **Severity**: Low (Architectural Documentation / Reachability)
* **Location**: [`src/app/mockups/ward-flow-sign-in/page.tsx`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow-sign-in/page.tsx)
* **Context**: [`signInHref()`](file:///d:/Repos/Ward-Flow/src/components/ward-management/shell/ward-facade.ts#L287) is defined in `ward-facade.ts`, but has zero callers across `src/components/`. 
* **Adversarial Finding**: Header comments on `ward-flow-sign-in-screen.tsx:35-43` explain this is an intentional prototype role-picker demonstration page without the interactive Ward shell. Calling this an accidental bug misrepresents developer intent. However, linking it under the "Reference page" section in `ward-bar.tsx` (next to `digestHref()`) resolves its orphan status while respecting its demonstrator role.
* **Remediation**:
  ```tsx
  // src/components/ward-management/shell/ward-bar.tsx line 1664
  <a href={signInHref()} className={styles.toolItem}>
    <LogIn aria-hidden="true" />
    <span>
      Demonstration Sign-In<em>Explore prototype role assignments</em>
    </span>
    <ChevronRight aria-hidden="true" />
  </a>
  ```

#### Issue A-05: Missing Route Error Boundary on Sign-In Route
* **Severity**: Medium (Runtime Resilience)
* **Location**: `src/app/mockups/ward-flow-sign-in/`
* **Context**: Unlike routes under `mockups/ward-flow/` which benefit from child error boundaries, `mockups/ward-flow-sign-in/` has no `error.tsx` boundary. Any client component crash crashes directly to the generic Next.js root error screen.
* **Remediation**: Create `src/app/mockups/ward-flow-sign-in/error.tsx` rendering the standard prototype error recovery panel.

#### Issue A-06: Unguarded URI Decoding on 8 Dynamic Routes
* **Severity**: Medium (Crash Prevention)
* **Locations**:
  1. [`src/app/mockups/ward-flow/board/[unitId]/page.tsx:13`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/board/[unitId]/page.tsx#L13)
  2. [`src/app/mockups/ward-flow/ward/[unitId]/page.tsx:26, 43`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/ward/[unitId]/page.tsx#L26)
  3. [`src/app/mockups/ward-flow/community/[teamId]/page.tsx:14`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/community/[teamId]/page.tsx#L14)
  4. [`src/app/mockups/ward-flow/ed/[edId]/page.tsx:14`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/ed/[edId]/page.tsx#L14)
  5. [`src/app/mockups/ward-flow/statistics/ward/[unitId]/page.tsx:13`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/statistics/ward/[unitId]/page.tsx#L13)
  6. [`src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx:13`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx#L13)
  7. [`src/app/mockups/ward-flow/statistics/community/[teamId]/page.tsx:13`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/statistics/community/[teamId]/page.tsx#L13)
  8. [`src/app/mockups/ward-flow/statistics/service/[serviceId]/page.tsx:13`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/statistics/service/[serviceId]/page.tsx#L13)
* **Context**: [`people/[patientId]/page.tsx:28-32`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/people/[patientId]/page.tsx#L28-L32) wraps decoding in `try / catch`:
  ```tsx
  let id: string;
  try {
    id = decodeURIComponent(patientId);
  } catch {
    return <WardMovementNotFound requestedId={patientId} reason="not-a-person-id" />;
  }
  ```
  The other 8 routes execute bare `decodeURIComponent(id)`. Passing malformed percent-encoding (e.g. `%E0%A4%A`) throws an unhandled `URIError: URI malformed` during SSR, triggering an unexpected 500 error boundary.
* **Remediation**: Standardize parameter decoding using the `try / catch` pattern across all 8 dynamic routes.

---

### Category H: Heading Hierarchy & Document Structure

#### Issue H-01: Delays Screen Direct Jump from `<h1>` to `<h4>`
* **Severity**: Medium (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/delays/delays-screen.tsx:1095`](file:///d:/Repos/Ward-Flow/src/components/ward-management/delays/delays-screen.tsx#L1095)
* **Code Proof**: An AST grep reveals *only two headings* in the entire file:
  - Line 354: `<h1 className={styles.pageTitle}>Delays</h1>`
  - Line 1095: `<h4 className={styles.dossierSectionTitle}>Candidate Wards Shortlist</h4>`
  There are zero `<h2>` or `<h3>` elements in `delays-screen.tsx`.
* **Remediation**: Change line 1095 from `<h4>` to `<h2>`.

#### Issue H-02: Movements Screen Omits `<h2>` Across Entire Screen
* **Severity**: Medium (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/movements/movements-screen.tsx:614, 747, 796, 829, 1109`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movements-screen.tsx#L614)
* **Code Proof**: The file contains:
  - Line 570: `<h1 className={styles.pageTitle}>`
  - Lines 614, 747, 796, 829, 1109: All render `<h3>` tags (`Worth your attention`, `causeGroupTitle`, `emptyStageTitle`, `Next to review`).
  There is **not a single `<h2>`** on the entire page.
* **Remediation**: Promote section headings (such as line 614 `Worth your attention` and line 1109 `Next to review`) to `<h2>`.

#### Issue H-03: Legal Forms Screen Heading Level Jump
* **Severity**: Low (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/legal-forms/legal-forms-screen.tsx:483`](file:///d:/Repos/Ward-Flow/src/components/ward-management/legal-forms/legal-forms-screen.tsx#L483)
* **Code Proof**: Screen has `<h1 className={styles.srOnly}>Legal forms</h1>` at line 323, and jumps directly to `<h3>Recorded forms (demo)</h3>` at line 483.
* **Remediation**: Change line 483 to `<h2>`.

#### Issue H-04: Add Patient Form Inverted Heading Flow
* **Severity**: Low (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/patients/add-patient.tsx:402`](file:///d:/Repos/Ward-Flow/src/components/ward-management/patients/add-patient.tsx#L402)
* **Code Proof**: Line 402 renders `<h3>From your search</h3>` *before* the first `<h2>` section heading appears at line 438 (`<h2 className={styles.panelHeading} id="apIdH">Identity & Demographics</h2>`).
* **Remediation**: Adjust line 402 to an `<h2>` or styled `<div>` to maintain monotonic heading depth.

#### Issue H-05: Referral Board Inverted Heading Flow
* **Severity**: Low (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/referrals/referral-board.tsx:1129`](file:///d:/Repos/Ward-Flow/src/components/ward-management/referrals/referral-board.tsx#L1129)
* **Code Proof**: Line 1129 renders `<h3 className={styles.timelineHeading}>Referral Timeline & Milestones</h3>` before `<h2 id="ward-referral-detail-heading">` at line 1340.
* **Remediation**: Adjust the timeline heading to `<h2>` or nest it inside an appropriate `<h2>` section container.

#### Issue H-06: Sovereign Showcase Omits `<h2>` Elements
* **Severity**: Low (WCAG 2.1 AA 1.3.1)
* **Location**: [`src/components/ward-management/sovereign/sovereign-showcase-screen.tsx:153, 163, 189, 250`](file:///d:/Repos/Ward-Flow/src/components/ward-management/sovereign/sovereign-showcase-screen.tsx#L153)
* **Code Proof**: Line 82 renders `<h1 id="showcase-title">Design system showcase</h1>`, followed directly by multiple `<h3>` tags with zero intervening `<h2>` headings.
* **Remediation**: Change showcase category titles (e.g. `Six status chips`, `Service kinds`, `Shared table`) to `<h2>`.

---

### Category T: Table Accessibility & Architectural Primitives

#### Issue T-01 & T-02: Missing Keyboard Scroll Regions on Raw Table Scrollers
* **Severity**: Medium (WCAG 2.1 AA 2.1.1 Keyboard Accessibility)
* **Locations**: 
  - [`src/components/ward-management/handover/handover-page.tsx:1721-1722`](file:///d:/Repos/Ward-Flow/src/components/ward-management/handover/handover-page.tsx#L1721)
  - [`src/components/ward-management/governance-registers.tsx:1228-1229`](file:///d:/Repos/Ward-Flow/src/components/ward-management/governance-registers.tsx#L1228)
* **Context**:
  When data tables overflow their horizontal containers, keyboard users cannot pan across columns unless the container is focusable. In `handover-page.tsx:1721`:
  ```tsx
  <div className={isTableEnlarged ? pageStyles.enlargedTableScroll : pageStyles.tableScrollPassthrough}>
    <table className={pageStyles.snapSheet}>
  ```
  The wrapper lacks `tabIndex={0}`, `role="region"`, and an `aria-label`.
* **Remediation**:
  ```tsx
  <div
    className={isTableEnlarged ? pageStyles.enlargedTableScroll : pageStyles.tableScrollPassthrough}
    tabIndex={0}
    role="region"
    aria-label="Shift handover patient snap sheet"
  >
    <table className={pageStyles.snapSheet}>
  ```

#### Issue T-03: 36 Raw `<table>` Instances Bypassing `WardTable` Primitive
* **Severity**: Low (Design System & Contract Consistency)
* **Context**: [`src/components/ward-management/ward-table/ward-table.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-table/ward-table.tsx) defines the canonical shared table primitive with built-in `tabIndex={0}`, `role="region"`, and scroll threshold indicators. 36 raw `<table>` instances bypass this component in `handover-page.tsx`, `governance-registers.tsx`, `delays-data-views.tsx`, and `settings-screen.tsx`.
* **Remediation**: Gradually refactor raw tables to compose `<WardTable>` directly.

---

### Category D: React DOM Warnings & Static ID Audits

#### Issue D-01: Leaked Non-Boolean `prefetch={false}` Attribute
* **Severity**: Low (React Warning / DOM Hygiene)
* **Location**: [`src/components/ward-management/on-call/on-call-screen.tsx:532`](file:///d:/Repos/Ward-Flow/src/components/ward-management/on-call/on-call-screen.tsx#L532)
* **Context**:
  ```tsx
  <Link
    className={styles.workspaceLink}
    href={edHref(department.id)}
    prefetch={false}
    aria-label={`Open ${department.name} workspace`}
  >
  ```
  During test runs and static SSR, `prefetch={false}` leaks onto the underlying HTML `<a>` tag, triggering the stderr warning:
  `Received 'false' for a non-boolean attribute 'prefetch'.`
* **Remediation**: Remove `prefetch={false}` from line 532.

#### Issues D-02 & D-03: Static Analysis ID Collisions (Debunked at Runtime)
* **Status**: **False Positive at Runtime**
* **Locations**: 
  - `src/components/ward-management/community/community-screen.tsx:1543, 1555` (`id="cardTriageBadge"`)
  - `src/components/ward-management/referrals/referral-match.tsx:713, 1762` (`id="ward-referral-match-decline-reason-community_team"`)
* **Adversarial Finding**: Both instances reside inside mutually exclusive branches:
  - In `community-screen.tsx`, it is an `isDemoMode && !hasAnyReferralsForTeam ? (...) : (...)` ternary.
  - In `referral-match.tsx`, it separates addressing mode from legacy mode.
  Neither produces duplicate IDs in a single rendered DOM tree.

---

### Category V: Test Harness Blind Spots & Architectural Drift

#### Issue V-01: Component Binding Test Falsely Pinning Error Stubs
* **Severity**: Medium (Test Suite Integrity)
* **Location**: [`tests/ward-route-component-binding.test.ts:107, 110`](file:///d:/Repos/Ward-Flow/tests/ward-route-component-binding.test.ts#L107)
* **Context**:
  The test uses a simple regex (`/<([A-Z][A-Za-z0-9]*)/u`) that matches the *first* JSX tag in the default export. In [`people/[patientId]/page.tsx`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/people/[patientId]/page.tsx) and [`movements/[movementId]/page.tsx`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/movements/[movementId]/page.tsx), the first JSX tag is the early-return error fallback `<WardMovementNotFound>`.
  The test author pinned `"WardMovementNotFound"` in the test expectations rather than fixing the parser. As a result, the test suite asserts that those routes render error stubs rather than their true production screen (`PatientNowScreen`).
* **Remediation**: Refactor the test parser to inspect the terminal return statement of the route component.

#### Issue V-02: Landmark Test Incomplete Coverage
* **Severity**: Medium (Regression Guarding)
* **Location**: [`tests/ward-landmarks.test.ts`](file:///d:/Repos/Ward-Flow/tests/ward-landmarks.test.ts)
* **Context**: 
  1. Only scans `src/app/mockups/ward-flow/`, completely omitting `src/app/mockups/ward-flow-sign-in/`.
  2. Renders `ReferralBoard` only with `selectedReferralId = null`, allowing the duplicate `<h1>` on selected referrals to pass undetected.
* **Remediation**: Add `mockups/ward-flow-sign-in` to the scanned routes, and add an explicit test case rendering `ReferralBoard` with a selected referral.

---

## 4. Prioritized Action Plan

### Phase 1: High-Priority Accessibility & Console Cleanliness (Quick Wins)
1. Add `id="main-content"` to `<main>` in `ward-flow-sign-in-screen.tsx:158`.
2. Change patient inspector name in `referral-board.tsx:805` from `<h1>` to `<h2>`.
3. Remove `prefetch={false}` from `on-call-screen.tsx:532`.

### Phase 2: Heading Structure & Route Inbound Links
1. Correct heading jumps (`<h1>` &rarr; `<h2>`) in `delays-screen.tsx:1095` and `movements-screen.tsx:614`.
2. Align heading hierarchy in `legal-forms-screen.tsx`, `add-patient.tsx`, and `sovereign-showcase-screen.tsx`.
3. Add a link to `/mockups/ward-flow/sovereign` and `/mockups/ward-flow-sign-in` in the Tools drawer of `ward-bar.tsx`.
4. Add `error.tsx` to `src/app/mockups/ward-flow-sign-in/`.

### Phase 3: Resilience, Table Scrollers & Test Suite Fixes
1. Wrap `decodeURIComponent()` in `try / catch` across the 8 dynamic routes.
2. Add `tabIndex={0}`, `role="region"`, and `aria-label` to table scroll wrappers in `handover-page.tsx:1721` and `governance-registers.tsx:1228`.
3. Update `tests/ward-route-component-binding.test.ts` and `tests/ward-landmarks.test.ts` to assert real components and selected states.

---

## 5. Verification Sign-Off

* **Sitemap check**: Confirmed clean via `npm run sitemap:check` (45 page routes, 4 route handlers).
* **DOM landmarks test**: Currently passing on static initial states (`npx vitest run tests/ward-landmarks.test.ts` 75/75 passed); dynamic defect confirmed via manual component inspection.
* **Working tree safety**: All audit checks were executed non-destructively; no product code was altered during the investigation.
