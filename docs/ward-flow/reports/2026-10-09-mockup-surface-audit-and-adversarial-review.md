# Comprehensive Mockup Surface Review Audit & Adversarial Analysis

**Repository:** `BigSimmo/Ward-Flow`  
**Current Branch:** `feat/movement-drawer-audit-and-actions`  
**Date of Audit:** 9 October 2026  
**Auditor / Review System:** Antigravity Autonomous Systems (`/audit`, `/review`, `/review-swarm`, `/boost`, `/competing-hypotheses`)  
**Scope:** Complete forensic audit and adversarial stress-test of all mockups, prototypes, visual assets, and capture scripts across the codebase.

---

## Table of Contents

1. [Executive Summary & Architectural Landscape](#1-executive-summary--architectural-landscape)
2. [Domain 1: Next.js App Router Application Prototypes (`src/app/mockups/**`)](#2-domain-1-nextjs-app-router-application-prototypes)
3. [Domain 2: Public Standalone HTML Mockups (`public/*.html`)](#3-domain-2-public-standalone-html-mockups)
4. [Domain 3: Ephemeral Visual Artifacts & Ad-hoc Scripts (`public/screenshots/**` & `scripts/**`)](#4-domain-3-ephemeral-visual-artifacts--ad-hoc-scripts)
5. [Domain 4: Historical Third Edition Specification Drawings (`docs/ward-flow/mockups/**`)](#5-domain-4-historical-third-edition-specification-drawings)
6. [Domain 5: Historical Design Prototypes Lineage (`docs/ward-flow/design/prototypes/**`)](#6-domain-5-historical-design-prototypes-lineage)
7. [Domain 6: Architectural Screen Coverage & Unreachable Screen Modules](#7-domain-6-architectural-screen-coverage--unreachable-screen-modules)
8. [Action Log: Remediations Executed](#8-action-log-remediations-executed)
9. [Verification & Policy Proofs](#9-verification--policy-proofs)
10. [Strategic Governance & Long-Term Recommendations](#10-strategic-governance--long-term-recommendations)

---

## 1. Executive Summary & Architectural Landscape

A comprehensive review audit of `BigSimmo/Ward-Flow` was conducted to identify, evaluate, clean up, and organise all mockup surfaces. An adversarial verification pass subsequently cross-examined every finding against the live working tree, AST imports, cryptographic hashes, and git history.

### The Six Distinct Mockup Domains

A critical initial discovery is that mockups in this repository do not inhabit a single folder or serve a single purpose. They exist across **six architecturally distinct domains**:

```
d:\Repos\Ward-Flow\
├── src/app/mockups/              [Domain 1: Active Next.js React Prototype App (33 routes)]
├── public/                       [Domain 2: Standalone HTML Studies & Prototypes (16 active + 1 index)]
│   └── screenshots/ (deleted)    [Domain 3: Ephemeral Visual Comparison PNGs (82 files)]
├── scripts/                      [Domain 4: Capture & Verification Tooling (31 scratch scripts removed)]
└── docs/ward-flow/
    ├── mockups/                  [Domain 5: Third Edition Specification Drawings (68 hashed files)]
    │   ├── reference/            [  └── Visual Reference Snapshots (20 files)]
    │   └── third-edition-kit/    [  └── Test Harness, Standards & WebFonts]
    └── design/prototypes/        [Domain 6: Early Design Lineage (54 tested prototype files)]
```

### Key Quantitative Findings

- **Total HTML/Mockup Files Audited**: 144 files across 5 directories.
- **Deleted Stale/Duplicate Mockups**: 6 files (including 1 tracked duplicate via `git rm`).
- **Deleted Visual Scratch Artifacts**: 82 temporary PNG files.
- **Deleted Obsolete Scratch Scripts**: 31 one-off capture and graphic generation scripts.
- **Identical SHA256 Duplicate Pairs in Docs**: 3 pairs (6 files) in `docs/ward-flow/mockups/`.
- **Unreachable Screen Components Identified**: 4 modules in `src/components/ward-management/`.
- **Gated Prototype Routes Protected**: 33 active React prototype routes preserved without modification.

---

## 2. Domain 1: Next.js App Router Application Prototypes

**Location:** [`src/app/mockups/`](file:///d:/Repos/Ward-Flow/src/app/mockups)  
**Classification:** **Active Application Prototype (Out of Scope for Cleanup)**  
**Governing Documents:** [`mockups/README.md`](file:///d:/Repos/Ward-Flow/mockups/README.md), [`docs/mockup-retirement-policy.md`](file:///d:/Repos/Ward-Flow/docs/mockup-retirement-policy.md)

### Detailed Findings & Context

1. **Active Application Code vs Disposable Design Scratch**:
   - The directory `src/app/mockups/ward-flow/**` contains **~30 operational routes** (`/capacity`, `/board/[unitId]`, `/movements`, `/referrals`, `/delays`, `/hub`, `/search`, `/settings`, etc.).
   - Under the **Owner Direction of 5 October 2026** (recorded in `AGENTS.md`), these routes constitute the official, interactive React + TypeScript demonstration prototype for Western Australia psychiatric bed flow. They mount shared state reducers, synthetic patient datasets, and responsive CSS modules.
   - They are mounted in production behind [`DeveloperAreaGate`](file:///d:/Repos/Ward-Flow/src/lib/developer-area/headers.ts) (declared in `DEVELOPER_GATED_PATH_PREFIXES`) via `src/proxy.ts`. They return 404 for unauthenticated public traffic but are live for administrative review.

2. **Strict Tier B Policy Protection**:
   - The repository's [Mockup Retirement Policy](file:///d:/Repos/Ward-Flow/docs/mockup-retirement-policy.md) categorizes these routes as **Tier B: Developer-Gated Applications**.
   - The policy script [`scripts/check-mockup-retirement.mjs`](file:///d:/Repos/Ward-Flow/scripts/check-mockup-retirement.mjs) programmatically enforces that no developer-gated route can be removed without an itemized entry in the owner decision register under `## Retired developer-gated routes (owner decisions)` in [`mockups/README.md`](file:///d:/Repos/Ward-Flow/mockups/README.md).
   - Deleting any route here during cleanup causes `npm run check:mockups` to fail closed.

3. **Runtime Dependency on Static Markdown/HTML**:
   - The route handler [`src/app/mockups/ward-flow-digest/route.ts`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow-digest/route.ts) directly calls:
     ```typescript
     await readFile(path.join(process.cwd(), "docs/ward-flow/mockups/ward-flow-digest.html"), "utf8");
     ```
   - This makes the documentation file [`docs/ward-flow/mockups/ward-flow-digest.html`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/ward-flow-digest.html) an active runtime dependency. Deleting or relocating it breaks `/mockups/ward-flow-digest` with an unhandled 500 runtime error.

---

## 3. Domain 2: Public Standalone HTML Mockups

**Location:** [`public/*.html`](file:///d:/Repos/Ward-Flow/public)  
**Classification:** Standalone High-Fidelity Design Studies & Prototypes  
**Pre-Cleanup Count:** 22 files | **Post-Cleanup Count:** 16 files + 1 master index portal

### Detailed Findings & Context

1. **Root Directory Clutter & Route Exposure**:
   - 22 loose HTML files were deposited directly in `public/`.
   - Because Next.js automatically maps all files in `public/` to the web root, files like `public/delays-header-options.html` were publicly resolvable at `http://localhost:3000/delays-header-options.html`.
   - There was no top-level index or navigation structure, making it difficult for stakeholders to know which mockups were current versus superseded.

2. **100% Identical Byte-for-Byte Duplicate**:
   - [`public/mockup.html`](file:///d:/Repos/Ward-Flow/public/mockup.html) (33,201 bytes, tracked in Git) was compared against [`public/capacity-table-mockup.html`](file:///d:/Repos/Ward-Flow/public/capacity-table-mockup.html).
   - `git diff --no-index` confirmed 0 byte differences between the two files. `mockup.html` was an orphaned alias created on 30 September 2026 during initial layout commits.

3. **Obsolete Early Explorations**:
   - `public/movement-patient-popup-mockups.html` (50.7 KB): Contained early v1 modal experiments. An adversarial diff against [`public/movement-patient-popup-mockup-v2.html`](file:///d:/Repos/Ward-Flow/public/movement-patient-popup-mockup-v2.html) showed 2,299 lines altered (`+1466 / -833`), with v2 introducing the 3 finalized clinical layouts (Minimal, Focused, Comprehensive).
   - `public/delays-header-options.html` (40.2 KB) and `public/header-navigation-options.html` (42.5 KB): Isolated early header drafts, fully superseded by the comprehensive design system in [`public/perfected-headers.html`](file:///d:/Repos/Ward-Flow/public/perfected-headers.html).
   - `public/patient-search-bar-mockup.html` (59.4 KB) and `public/patient-search-console-alternatives.html` (66.8 KB): Early KPI bar and search console alternatives, fully superseded by the 3-direction studio in [`public/patient-search-directions-studio.html`](file:///d:/Repos/Ward-Flow/public/patient-search-directions-studio.html).

4. **Unanchored Relative Links in Delays Visualizations**:
   - In all four Delays data visualization mockups ([`delays-mockup-catchment.html`](file:///d:/Repos/Ward-Flow/public/delays-mockup-catchment.html), [`delays-mockup-histogram.html`](file:///d:/Repos/Ward-Flow/public/delays-mockup-histogram.html), [`delays-mockup-matrix.html`](file:///d:/Repos/Ward-Flow/public/delays-mockup-matrix.html), [`delays-mockup-runway.html`](file:///d:/Repos/Ward-Flow/public/delays-mockup-runway.html)), line 2429 contains:
     ```html
     <a href="mockups/ward-flow/delays" style="...">Back to App →</a>
     ```
   - Notice the lack of a leading forward slash (`/`). If these files had been moved into a subdirectory (e.g. `public/showcase/`), this link would resolve to `http://localhost:3000/showcase/mockups/ward-flow/delays`, returning a 404.
   - Leaving the 16 active mockups in `public/` and creating a centralized directory portal ([`public/mockups-index.html`](file:///d:/Repos/Ward-Flow/public/mockups-index.html)) avoided breaking these relative navigation paths.

---

## 4. Domain 3: Ephemeral Visual Artifacts & Ad-hoc Scripts

**Locations:** [`public/screenshots/`](file:///d:/Repos/Ward-Flow/public/screenshots) (deleted), [`scripts/`](file:///d:/Repos/Ward-Flow/scripts)  
**Classification:** Scratch Screenshot Captures & One-off Test Scripts

### Detailed Findings & Context

1. **82 Ephemeral PNG Comparison Crops**:
   - The untracked directory `public/screenshots/` held 82 PNG files (`mockup-concept1.png`, `before_and_after_comparison.png`, `live-flightdeck-verified-fresh.png`, etc.).
   - Investigation proved these were generated between 4 October and 6 October 2026 by Playwright automation scripts to visually compare live DOM renderings against mockup drawings.
   - Grep verification across `src/` and `tests/` confirmed **zero references** in production code, tests, or documentation.

2. **31 Obsolete Scratch Scripts**:
   - 21 `scripts/capture-*.mjs` and `scripts/take-*.mjs` scripts (e.g., `capture-dark-telemetry-mockup.mjs`, `capture-full-beds-mockup.mjs`).
   - 10 `scripts/generate-*.mjs` and `scripts/make-*.mjs` image diff generator scripts (e.g., `generate-before-after.mjs`, `make-ooa-comparisons.mjs`).
   - None of these scripts were tracked in Git (`git ls-files` returned empty), and none were called by npm scripts.

3. **Critical Preserved Script: `scripts/run-preview-smoke.mjs`**:
   - An adversarial scan checked every untracked script in `scripts/` against [`package.json`](file:///d:/Repos/Ward-Flow/package.json) before deletion.
   - [`package.json#L63`](file:///d:/Repos/Ward-Flow/package.json#L63) explicitly binds:
     ```json
     "test:e2e:preview": "node scripts/run-preview-smoke.mjs"
     ```
   - Had all untracked scripts been deleted wholesale, `npm run test:e2e:preview` would have broken. `scripts/run-preview-smoke.mjs` was deliberately preserved.

---

## 5. Domain 4: Historical Third Edition Specification Drawings

**Location:** [`docs/ward-flow/mockups/`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups)  
**Classification:** Historical Third Edition Design Specifications & Reference  
**Total Drawing Files:** 68 files + 2 subdirectories (`reference/`, `third-edition-kit/`)  
**Governing Manifest:** [`docs/ward-flow/mockups/MANIFEST.json`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/MANIFEST.json)

### Detailed Findings & Context

1. **Three Exact SHA256 Duplicate Pairs**:
   Cryptographic hash verification (`sha256-lf`) revealed three pairs of identical files in the specification directory:
   - **Referrals Pair**:
     - `raise-a-referral-perfected-third-edition.html`: `879EFAA10810AD49206727ADA234616FFF0AFC18B62467ABDC0D73B9DFC01365`
     - `raise-a-referral-third-edition.html`: `879EFAA10810AD49206727ADA234616FFF0AFC18B62467ABDC0D73B9DFC01365`
   - **Search Pair**:
     - `patient-search-perfected-third-edition.html`: `8F12E902F6DEE260912D4F9BB8082D23D538B3EC63B00924A4B335AFD414451E`
     - `patient-search-third-edition.html`: `8F12E902F6DEE260912D4F9BB8082D23D538B3EC63B00924A4B335AFD414451E`
   - **Ward Pair**:
     - `ward-perfected-third-edition.html`: `CDFC0FE2C73BF059AFFBC5313DE0C30B3A384D936B7953893885BF8CFBCD93E9`
     - `ward-third-edition.html`: `CDFC0FE2C73BF059AFFBC5313DE0C30B3A384D936B7953893885BF8CFBCD93E9`

2. **Superseded Drafts Kept in Roster**:
   - `docs/ward-flow/mockups/add-a-patient-third-edition-claude-draft.html`: Intermediate working draft from Claude. Diff against [`add-a-patient-third-edition.html`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/add-a-patient-third-edition.html) showed 1,264 line differences (+622 / -642).
   - `docs/ward-flow/mockups/patient-now-original-third-edition.html`: Initial draft superseded by `patient-now-third-edition.html` and `patient-now-perfected.html`.
   - `patient-search-console.html` and `patient-search-working.html`: Formally flagged in [`docs/ward-flow/SCREEN-MAP.md#L88-L92`](file:///d:/Repos/Ward-Flow/docs/ward-flow/SCREEN-MAP.md#L88-L92) under _"## Superseded — never build from these"_.

3. **Header Typographic Sprawl**:
   - 7 standalone HTML files exist solely to test minor font, badge, and capsule variations from mid-September:
     - `header-text-5-variations.html`
     - `header-text-inside-capsule-variations.html`
     - `header-text-perfected-variations.html`
     - `header-text-redesign-mockups.html`
     - `header-text-clean-perfected.html`
     - `header-text-perfected-specification.html`
     - `header-badge-size-variations.html`

4. **Cryptographic Manifest Locking**:
   - The script [`scripts/ward-flow/mockup-manifest.mjs`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/mockup-manifest.mjs) runs during verification.
   - Deleting or editing any file in `docs/ward-flow/mockups/` without running `node scripts/ward-flow/mockup-manifest.mjs` updates [`MANIFEST.json`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/MANIFEST.json) will cause `--check` to fail with exit code 1.
   - Furthermore, [`scripts/ward-flow/screen-pairs.mjs`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/screen-pairs.mjs) maps every drawing in this directory; modifying the files requires updating `screen-pairs.mjs` and regenerating `docs/ward-flow/SCREEN-MAP.md`.

5. **External Published Artifact Popover Offset**:
   - As documented in [`docs/ward-flow/mockups/README.md#L147-L150`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/README.md#L147-L150), external published Claude artifact URLs for the 33 third-edition pages have a 125px popover offset defect on mobile viewports (<1001px).
   - This bug was corrected in the repository's local HTML files on 11 September 2026, but the external Claude artifacts have not yet been republished.

---

## 6. Domain 5: Historical Design Prototypes Lineage

**Location:** [`docs/ward-flow/design/prototypes/`](file:///d:/Repos/Ward-Flow/docs/ward-flow/design/prototypes)  
**Classification:** Tested Historical Lineage & Token Baseline  
**File Count:** 54 files

### Detailed Findings & Context

1. **Automated Vitest Token Resolution Suite**:
   - This directory contains 54 early prototype iterations (e.g. `mockup-referral-intake-v1.html` through `v6`, `mockup-ward-home-v2.html` through `v4`, `mockup-statistics-ed-v1.html` through `v4`).
   - The test suite [`tests/ward-mockup-tokens-resolve.test.ts`](file:///d:/Repos/Ward-Flow/tests/ward-mockup-tokens-resolve.test.ts) uses dynamic file discovery (`readdirSync`) over this folder. It parses every CSS rule across all 54 files to verify that every `var(--*)` custom property resolves outside forced-colors media blocks.
   - Deleting or altering files here causes test failures unless the test suite itself is modified.

2. **Prettier Formatting Exclusion**:
   - [`.prettierignore#L45`](file:///d:/Repos/Ward-Flow/.prettierignore#L45) explicitly locks `docs/ward-flow/design/prototypes/` because the files are checked byte-for-byte against `statistics-language-*.css`.
   - Running automated whole-tree formatting across this folder fails test guards.

---

## 7. Domain 6: Architectural Screen Coverage & Unreachable Screen Modules

**Authoritative File:** [`docs/ward-flow/SCREEN-MAP.md`](file:///d:/Repos/Ward-Flow/docs/ward-flow/SCREEN-MAP.md)  
**Mapping Engine:** [`scripts/ward-flow/screen-map.mjs`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/screen-map.mjs)

### Detailed Findings & Adversarial Clarifications

1. **Adversarial Root-Cause on the "9 Undrawn Routes"**:
   `SCREEN-MAP.md` reports that 9 routes have no corresponding mockup drawing. An adversarial code inspection revealed the exact architectural reason for each:
   - **`/command`**: Not a missing screen. [`src/app/mockups/ward-flow/command/page.tsx`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow/command/page.tsx) is an intentional redirect alias to `/mockups/ward-flow` (the coordinator home), which is fully drawn as `command-third-edition.html`.
   - **`/escalation`**, **`/exceptions`**, and **`/queue`**: Not missing screens. Under Merge 01 (approved 5 September 2026), the priority queue, exceptions inbox, and escalation board were unified into [`DelaysScreen`](file:///d:/Repos/Ward-Flow/src/components/ward-management/delays/delays-screen.tsx). These three routes exist as bookmark/deep-link aliases redirecting to `/mockups/ward-flow/delays?from=*`, which is fully drawn as `delays-third-edition.html`.
   - **`/ed`**: A route backstop redirecting to `/mockups/ward-flow/ed/peel-ed`, which is fully drawn as `emergency-department-third-edition.html`.
   - **`/transport`**: A route backstop redirecting to `/mockups/ward-flow/transport/officer`, which is fully drawn as `transport-officer-third-edition.html`.
   - **`/community`**: Mounts [`CommunityIndex`](file:///d:/Repos/Ward-Flow/src/components/ward-management/community/community-index.tsx), which dynamically renders statewide community mental health teams. The individual team view is fully drawn as `community-team-third-edition.html`.
   - **`/constellation`** and **`/movements/[movementId]`**: Truly undrawn individual screens without dedicated standalone drawings.

2. **The 4 Unreachable Screen Modules**:
   An AST and import grep across all of `src/app/` proved that four screen components in [`src/components/ward-management/`](file:///d:/Repos/Ward-Flow/src/components/ward-management) are **imported by zero routes repo-wide**:
   - [`src/components/ward-management/community/community-home.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/community/community-home.tsx) (`CommunityHome`): Route `/community` mounts `CommunityIndex` instead.
   - [`src/components/ward-management/ed/ed-home.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ed/ed-home.tsx) (`EdHome`): Route `/ed/[edId]` mounts `EdScreen` instead.
   - [`src/components/ward-management/escalation/escalation-board.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/escalation/escalation-board.tsx) (`EscalationBoardPage`): Replaced by `DelaysScreen`; route `/escalation` redirects to `/delays`.
   - [`src/components/ward-management/governance/governance-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/governance/governance-screen.tsx) (`GovernanceScreen`): Route `/governance` mounts `WardModeWorkspace` instead.
   - _Current Status_: These 4 components cannot be reached by a user in the live application. They are kept alive solely because unit tests (such as `tests/ward-ed-home.dom.test.tsx` and `tests/ward-escalation.dom.test.tsx`) mount them directly as isolated test fixtures.

---

## 8. Action Log: Remediations Executed

The following actions were executed and verified:

### Phase 1: Deletion of Stale & Duplicate Mockups

- `public/mockup.html` (33,201 bytes) — Removed from Git index via `git rm public/mockup.html`.
- `public/movement-patient-popup-mockups.html` (50,700 bytes) — Deleted.
- `public/delays-header-options.html` (40,200 bytes) — Deleted.
- `public/header-navigation-options.html` (42,500 bytes) — Deleted.
- `public/patient-search-bar-mockup.html` (59,400 bytes) — Deleted.
- `public/patient-search-console-alternatives.html` (66,800 bytes) — Deleted.

### Phase 2: Elimination of Ephemeral Visual Clutter

- `public/screenshots/` — Deleted entire directory containing 82 temporary PNG comparison captures.
- `scripts/` — Deleted 31 untracked scratch capture and comparison scripts (`capture-*.mjs`, `take-*.mjs`, `generate-*.mjs`). Preserved `scripts/run-preview-smoke.mjs`.

### Phase 3: Organization & Central Directory Portal

- Created [`public/mockups-index.html`](file:///d:/Repos/Ward-Flow/public/mockups-index.html):
  - Structured catalog linking all 16 active high-fidelity mockups.
  - Organized into 4 logical groups: Master Consolidated Showcases, Delays Visual Analytics Suite, Navigation & Search Studios, and Ward Beds & Daily Sheet Overhauls.
  - Built-in light/dark theme toggle matching the application's Geist design tokens.
  - Integrated one-click jump to the live Next.js prototype application (`/mockups/ward-flow`).

---

## 9. Verification & Policy Proofs

All automated repository verification gates and integrity tests were run following the execution:

1. **Mockup Retirement Gate (`npm run check:mockups`)**:

   ```
   > node scripts/check-mockup-retirement.mjs --self-test && node scripts/check-mockup-retirement.mjs && node scripts/check-mockup-retirement.mjs --diff auto
   [mockup-retirement] self-test passed.
   [mockup-retirement] PASS — 2 mockup route(s) indexed, 42 recorded as retired.
   [mockup-retirement] PASS — 0 deleted mockup file(s), each recorded and unreferenced.
   ```

   _Verdict:_ **PASS**. Clean exit with zero policy violations.

2. **Mockup Manifest Integrity Check (`node scripts/ward-flow/mockup-manifest.mjs --check`)**:

   ```
   mockup manifest is current - 68 drawings.
   ```

   _Verdict:_ **PASS**. All 68 drawings in `docs/ward-flow/mockups/` match their registered SHA256-LF signatures.

3. **Vitest Token Resolution & Retirement Test Suite**:

   ```
   RUN  v4.1.11 D:/Repos/Ward-Flow
   ✓  node  tests/mockup-retirement.test.ts (70 tests) 1149ms
   ✓  node  tests/ward-mockup-tokens-resolve.test.ts (2 tests) 4244ms
   Test Files  2 passed (2)
        Tests  72 passed (72)
   ```

   _Verdict:_ **PASS**. All 72 tests passed. Every CSS custom property across the 54 prototype files resolves correctly.

4. **Working Tree Status**:
   `git status -s public/` confirms only `D public/mockup.html` (staged deletion) and `?? public/mockups-index.html` (untracked directory portal), with the 16 useful mockups untouched.

---

## 10. Strategic Governance & Long-Term Recommendations

1. **Maintain `public/mockups-index.html` as the Authoritative Public Registry**:
   - Any new standalone visual study added to `public/` must be registered in [`public/mockups-index.html`](file:///d:/Repos/Ward-Flow/public/mockups-index.html).
   - All internal links within new mockups must use absolute web paths (e.g. `/mockups/ward-flow/delays`) rather than unanchored relative paths to prevent routing failures.

2. **Future Clean-up of `docs/ward-flow/mockups/` (Planned PR)**:
   - When project priorities permit a dedicated documentation cleanup PR:
     1. Retire the 3 exact byte-duplicate files (`raise-a-referral-perfected-third-edition.html`, `patient-search-perfected-third-edition.html`, `ward-perfected-third-edition.html`).
     2. Move the 7 header variation files into an `archive/` subfolder.
     3. Remove the formally superseded drawings (`patient-search-console.html`, `patient-search-working.html`).
     4. Update [`scripts/ward-flow/screen-pairs.mjs`](file:///d:/Repos/Ward-Flow/scripts/ward-flow/screen-pairs.mjs), regenerate [`docs/ward-flow/SCREEN-MAP.md`](file:///d:/Repos/Ward-Flow/docs/ward-flow/SCREEN-MAP.md), and regenerate [`MANIFEST.json`](file:///d:/Repos/Ward-Flow/docs/ward-flow/mockups/MANIFEST.json) via `node scripts/ward-flow/mockup-manifest.mjs`.

3. **Lifecycle Resolution for the 4 Unreachable Screen Modules**:
   - Decide whether to formally decommission [`community-home.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/community/community-home.tsx), [`ed-home.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ed/ed-home.tsx), [`escalation-board.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/escalation/escalation-board.tsx), and [`governance-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/governance/governance-screen.tsx).
   - If decommissioned, retire their respective DOM tests (`tests/ward-ed-home.dom.test.tsx`, `tests/ward-escalation.dom.test.tsx`) in the same commit to keep the test runner clean.

4. **External Claude Artifact Synchronization**:
   - The 33 third-edition specifications published to Claude artifact URLs should be republished using the fixed local sources to resolve the 125px mobile popover offset defect for mobile-width reviews.
