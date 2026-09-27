# Ward Flow Next.js React Engine Synchronization Analysis (Option B)

**Date:** 2026-09-16  
**Architect:** Antigravity React & Systems Architecture Suite  
**Target Codebase:** `src/components/ward-management/` and `src/app/mockups/ward-flow/`  
**Reference Source of Truth:** Authoritative Third-Edition HTML Mockups (`docs/ward-flow/mockups/`)  
**Repository Constraint:** 🔴 **WARD FLOW IS STRICTLY LOCAL DISK ONLY — NEVER PUSHED TO ORIGIN/MAIN**

---

## 1. Executive Summary & Strategic Decision

### The Decision

🟢 **RECOMMENDED: Proceed with Option B via a Three-Phase Incremental Synchronization Pipeline.**

**Rationale:**
The 18 HTML mockups in `docs/ward-flow/mockups/` have achieved **100/100 visual perfection and complete interactive wiring**. However, `docs/ward-flow/README.md` establishes that:

> _"The drawings in `docs/ward-flow/mockups/` are authoritative on design; the working engine is authoritative on behaviour."_

The Next.js React codebase (`src/app/mockups/ward-flow/` and `src/components/ward-management/`) already has an extensive foundation of **36 routes and 152 component files**. Synchronizing the React codebase with the third-edition mockups is entirely feasible and high-value, but attempting a single monolithic rewrite would risk breaking passing DOM tests and regression guards. A disciplined, three-phase approach allows us to update the design system tokens, shell layout, and interactive modal state machines while keeping the test suite green at every step.

---

## 2. Codebase Inventory & Current Architecture

### Route Coverage (`src/app/mockups/ward-flow/`)

The Next.js App Router already defines 36 route pages:

- **Core Operations**: `/` (Command), `/movements`, `/capacity`, `/wards`, `/board/[unitId]`, `/delays`
- **Logistics**: `/ward/[unitId]/answer`, `/discharges`, `/out-of-area`, `/transport/officer`, `/on-call`, `/people/new` (Add a Patient)
- **Governance & Legal**: `/legal-forms`, `/governance`, `/alerts`, `/settings`
- **Analytics & History**: `/statistics`, `/statistics/compare`, `/statistics/overview`, `/statistics/service/[serviceId]`, `/handover`
- **Authentication**: `/mockups/ward-flow-sign-in`

### Component Modules (`src/components/ward-management/`)

The component tree is organized into 27 functional subdirectories:

- `shell/`: Universal application shell, headers, navigation rail, and activity tally.
- `coordinator/`: Command center flow diagrams, queue lists, candidate shortlist panels.
- `capacity/`: Bed maps, hospital pressure strips, capacity derivations.
- `discharges/`: Discharge boards, barrier tables, egress logs.
- `governance-registers.tsx`: Statutory override records, clinical audit endorsements.
- `legal-forms/`: MHA 2014 form tracking and validity registers.
- `officer/`: Transport officer MDT, custody handover records.
- `ward-tokens.module.css`: Token definitions for colors, typography, elevations, and radii.

---

## 3. Gap Analysis: HTML Mockups vs. Next.js React

| Dimension                      | Third-Edition HTML Mockups                                                                                                                                    | Current Next.js React Codebase                                                                                                                          | Delta & Required Synchronization                                                                                                 |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| **Design System Tokens**       | Platinum Raised Cool: `--surface`, `--surface-2`, `--sunk`, `--accent: #2f4c66`, `--gilt: #7d612a`, `--good: #227550`, `--warn: #825d10`, `--danger: #b03b2e` | Defined in `ward-tokens.module.css`, but several component-level `.module.css` files retain older hex values or custom padding                          | Harmonize component CSS modules to import and resolve tokens from `ward-tokens.module.css` exclusively; eliminate raw hex values |
| **Edge-Color Bar Ban**         | 100% compliant: zero colored left/top bars on cards, rows, or panels. Status sits on words, pills, or surface washes.                                         | Mostly compliant, but legacy borders exist in older subtrees (e.g. `alerts.module.css`, `decline-register.module.css`)                                  | Remove all colored edge-borders in React CSS modules to match `WARD-FLOW-DESIGN-SYSTEM.md`                                       |
| **Step-Inward Radii**          | Canonical step-inward hierarchy: `--r1: 10px` (panels), `--r1i: 9px` (headers), `--r2: 6px` (controls), `--pill: 9999px`                                      | Inconsistent radii across older components (e.g. 4px, 8px, 12px mixed)                                                                                  | Standardize all container, header, and control border-radii across CSS modules                                                   |
| **Navigation Rail & Shell**    | 13-item standardized rail; 3px top brand stripe; responsive `<1000px` sticky horizontal rail with zero overflow                                               | Rail items defined in `ward-nav.ts` and `ward-sidebar-content.tsx`, but order differs from third-edition mockups; phone scroll behavior needs alignment | Synchronize `ward-nav.ts` to match third-edition rail groups; ensure sticky mobile phone rail under 1000px                       |
| **Interactive Modals & State** | Rich client-side state: Bed 04 intake allocation (100% saturation), Form 4A 48h extension, 4-stage transit stepper, barrier resolution                        | Components have data structures in `ward-flow-reducer.test.ts`, but interactive modal popups in React are partially unmounted or stubbed                | Wire modal state hooks (`useState` / context) in React screens to mirror the mockups' live transitions                           |

---

## 4. Phased Implementation Roadmap (Option B)

### Phase 1: Foundation, Tokens & Universal Shell (Low Risk · 1 Session)

- **Objective**: Ensure the shared container, typography, and navigation match the third-edition mockups across all 36 routes.
- **Tasks**:
  1. Audit and update `ward-tokens.module.css` to match `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` byte-for-byte.
  2. Update `src/components/ward-management/ward-nav.ts` and `ward-sidebar-content.tsx` to match the exact 13-screen third-edition navigation hierarchy.
  3. Implement the `<1000px` sticky horizontal rail in `ward-sidebar.module.css` and `ward-shell.module.css`.
  4. Run `npm run test` on `tests/ward-nav.test.ts` and `tests/ward-shell-third-edition.dom.test.tsx`.

### Phase 2: Core Command, Capacity & Ward Directory (Medium Risk · 1-2 Sessions)

- **Objective**: Synchronize the primary clinical operational consoles.
- **Tasks**:
  1. Refactor `src/components/ward-management/coordinator/` (Command Center) with third-edition candidate shortlist cards and KPI strips.
  2. Update `src/components/ward-management/capacity/` and `src/app/mockups/ward-flow/wards/page.tsx` with the 23-ward directory keystroke search and cluster filters.
  3. Wire the Bed 04 intake response in `src/app/mockups/ward-flow/ward/[unitId]/answer/page.tsx` to dynamically update occupancy and ready vacancy.
  4. Verify against `tests/ward-command-third-edition.dom.test.tsx` and `tests/ward-capacity-screen.dom.test.tsx`.

### Phase 3: Logistics, Statutory Legal Forms & Governance (Low-Medium Risk · 1 Session)

- **Objective**: Implement the interactive clinical state machines across the remaining specialized screens.
- **Tasks**:
  1. Update `src/components/ward-management/legal-forms/` with the digital Form 4A renewal modal and statutory breach banner clearance.
  2. Update `src/components/ward-management/discharges/` with the NDIS/accommodation barrier resolution modal.
  3. Update `src/components/ward-management/officer/` with the 4-stage transit stepper and digital custody handover.
  4. Update `src/components/ward-management/governance-registers.tsx` with the clinical override audit endorsement modal.

---

## 5. Risk Assessment & Safety Boundaries

1. **🔴 Push Guard Protection**:
   - Ward Flow code exists exclusively on local disk. No commits or changes to Ward Flow files are ever pushed to `origin/main` (which auto-deploys to the production clinical KB database).
2. **Regression Prevention**:
   - The repository contains hundreds of existing tests for ward flow (`tests/ward-*.test.ts`). Every phase must run `npx vitest run tests/ward-*.test.ts` to guarantee zero test regressions.
3. **Rollback Simplicity**:
   - By structuring Option B into three discrete phases, any phase can be reverted independently using local git branches/worktrees without disturbing the baseline.

---

## 6. Final Recommendation

**Begin with Phase 1 of Option B (Tokens, Shell & Navigation Rail Alignment).**  
Phase 1 immediately gives the entire React application the perfected third-edition visual identity, typography, and responsive mobile navigation without altering underlying business logic or risking state regressions.
