# High-Fidelity Design to Production Playbook

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/HOW-WE-WORK.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.** Kept for historical reference; do not follow.
> **Active operating rules:** Numerical scoring and 4-tier verification ladders are inactive (`SCREEN-DEFINITION-OF-DONE.md`). Mockups are served via `node scripts/ward-flow/serve-mockups.mjs` (not ad-hoc Python/Vite servers). The Owner's September 17 and 21 UI speed rules (single desktop light view by default) strictly govern.

## The Standard Operating Procedure for Creating, Scoring, Adversarially Iterating, and Engineering Production Screens

**Scope**: Historical reference for screen engineering and design-to-production workflows.  
**Author**: Engineering & Clinical UX Design System Architecture  
**Status**: Historical Standard Operating Procedure (SOP)

---

## Executive Summary & Core Philosophies

In clinical and high-stakes operational software, **visual design is not decoration; it is a clinical safety instrument**. When bed coordinators, psychiatrists, and triage nurses manage patient admissions, transfers, statutory leaves, and discharge delays, an unpolished UI, truncated label, misaligned timeline, or low-contrast status badge introduces cognitive friction that leads directly to operational error.

This playbook codifies the complete, battle-tested end-to-end process developed during the engineering of the **48-Hour Bed Movement Horizon** and **Ward Flow Systems**:

1. **Conception & Standalone Mockup Crafting** (pure HTML/CSS, semantic design tokens, glassmorphism, responsive density).
2. **The Meticulous 100-Point Scoring System** (harsh, objective aesthetic and structural rubric with 8 zero-tolerance fatal flaws).
3. **Adversarial & Investigative Iteration Loop** (stress-testing viewports, clipping thresholds, focus trapping, statutory forms).
4. **The Engineering Bridge** (translating static HTML/CSS into React / Next.js / TypeScript CSS Modules while preserving backwards compatibility).
5. **The 4-Tier Verification Ladder** (DOM unit tests, automated visual inspector scripts, estate regression gates, and headless Chrome browser audits).

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                        THE END-TO-END PIPELINE                        │
   └────────────────────────────────────────────────────────────────────────┘
        │
        ▼
   [ PHASE 1: Mockup Crafting ] ────────► Pure HTML/CSS Prototype with Tokens
        │                                  (Served via localhost, not file://)
        ▼
   [ PHASE 2: 100-Point Scoring ] ──────► Rubric Audit: 8 Fatal Flaws Check
        │                                  (Must score >= 9.5 / 10 to proceed)
        ▼
   [ PHASE 3: Adversarial Loop ] ───────► Dual-Agent Attack:
        │                                  - Adversarial UI/UX Auditor
        │                                  - Design Systems Investigator
        ▼
   [ PHASE 4: Engineering Bridge ] ─────► Port to React / Next.js / TypeScript
        │                                  - CSS Modules (zero global leaks)
        │                                  - Pure Derivations (*-derivations.ts)
        │                                  - Panel backwards compatibility
        ▼
   [ PHASE 5: 4-Tier Verification ] ────► 1. Visual DOM Tests (Vitest)
        │                                 2. Automated Visual Inspector (Script)
        │                                 3. Estate Regression (`run-ward-tests`)
        │                                 4. Live Headless Chrome DevTools (MCP)
        ▼
   [ RELEASE & RECORDING ] ─────────────► Update `screen-verification.json`
                                           with Drawing Hashes
```

---

## Core Tenet: The Dual-Authority Contract

When moving from design to code, conflicting incentives often produce either a brittle build that breaks existing engine logic, or an ugly build that fails to honor the design:

> ### 🔴 THE DUAL-AUTHORITY INVARIANT
>
> 1. **The Mockup is authoritative on visual design, typography, spacing, and layout density.**  
>    Engineers may not substitute components (e.g., turning card grids into plain tables, flattening tabs into stacked lists, or stripping badges) because of implementation convenience.
> 2. **The Working Engine is authoritative on runtime behavior, statutory state machines, and business logic.**  
>    Engineers may not alter validated clinical flow (e.g., WA Mental Health Act statutory status, bed occupancy formulas) to match a static mockup drawing.
> 3. **Any divergence between visual intent and engine behavior must be explicitly documented in the PR, screen verification record, and commit ledger.** Never resolve a divergence silently.

---

## Phase 1: High-Fidelity Mockup Engineering

Every screen begins as a standalone, zero-dependency HTML/CSS document in `docs/ward-flow/mockups/`. This isolates visual iteration from complex Next.js compilation, enabling instantaneous previewing, pixel-level manipulation, and ruthless scrutiny.

### 1. The Serving Requirement (Never Use `file://`)

Mockups use modern CSS variables, CSS grid subgrid, container queries, and often dynamic JavaScript for tab switching or theme toggling. Opening a mockup via `file://` causes CORS issues, broken font metrics, and disabled interactive logic.

- **Standard**: Always serve mockups via a local web server (e.g., `python -m http.server 60178` or Vite/Caddy).

### 2. Design Token Discipline

Every visual property must link to a defined semantic token. **Hardcoded hex colors, arbitrary padding values, and magic numbers are strictly forbidden.**

#### The Sovereign Theme Palette (CSS Custom Properties)

```css
:root {
  /* Surfaces & Elevations */
  --bg: #090d12;
  --surface: #0f1620;
  --surface-raised: #151f2d;
  --surface-overlay: rgba(21, 31, 45, 0.85);

  /* Hairline Borders (1px Alpha-Layered) */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-medium: rgba(255, 255, 255, 0.14);
  --border-prominent: rgba(255, 255, 255, 0.22);

  /* Text Hierarchies */
  --text-primary: #f0f4f8;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Semantic Clinical Event Tokens */
  --admit-bg: #7ea3bf;
  --admit-text: #08131a;
  --transit-bg: #9381b0;
  --transit-text: #120d1e;
  --leave-bg: #282319;
  --leave-border: #7c6833;
  --leave-text: #ffd885;
  --discharge-bg: #4e9b7a;
  --discharge-text: #0b1510;
  --delay-bg: #b54938;
  --delay-text: #ffffff;
  --predicted-bg: #282319;
  --predicted-border: #6d5b2c;
  --predicted-text: #fedb88;

  /* Typography */
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", Menlo, Consolas, monospace;
}

[data-theme="light"] {
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-raised: #f1f5f9;
  --surface-overlay: rgba(255, 255, 255, 0.9);
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-medium: rgba(0, 0, 0, 0.12);
  --border-prominent: rgba(0, 0, 0, 0.2);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* Light Theme Tuned Swatches (Meeting >= 4.5:1 WCAG AA) */
  --admit-bg: #e0f2fe;
  --admit-text: #03456b;
  --transit-bg: #f3e8ff;
  --transit-text: #581c87;
  --leave-bg: #fef9c3;
  --leave-border: #eab308;
  --leave-text: #713f12;
  --discharge-bg: #dcfce7;
  --discharge-text: #14532d;
  --delay-bg: #fee2e2;
  --delay-text: #991b1b;
  --predicted-bg: #fef3c7;
  --predicted-border: #f59e0b;
  --predicted-text: #78350f;
}
```

### 3. Spatial Density & Ergonomics

- **The 34px Lane / 20px Event Bar Rule**: In Gantt or timeline views, each lane height must be precisely 34px, with event bars at 20px height, vertically centered (7px top/bottom margin). This provides high data density without crowding.
- **Monospace Tabular Numerals**: All timestamps, durations, counts, beds, and metric values must use `font-variant-numeric: tabular-nums` with `--font-mono`. This prevents layout jitter during live updates or scrubbing.
- **Disclosure Footer**: Every clinical mockup must include the sovereign disclosure footer specifying synthetic vs real telemetry:
  ```html
  <footer class="disclosureFooter" role="contentinfo">
    <span>Synthetic Clinical Demonstration</span>
    <span class="dot">•</span>
    <span>WA Health Mental Health Act 2014 Topology</span>
    <span class="dot">•</span>
    <span>All Patient Names & Identifiers are Procedurally Generated</span>
  </footer>
  ```

---

## Phase 2: The Meticulous 100-Point Design Scoring Rubric

To ensure sovereign aesthetic perfection, subjective opinion is replaced by a rigorous, mathematical 100-point rubric with **Zero-Tolerance Fatal Flaws**.

### The 8 Zero-Tolerance Fatal Flaws

Any occurrence of the following causes an **IMMEDIATE SCORE OF 0 / 10**, halting the pipeline until repaired:

| #       | Fatal Flaw                                 | Detection Criteria                                                                                                                                                          |
| ------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FF1** | **Text Truncation or Clipping**            | Any text colliding with boundaries, obscured by sibling elements, or cut off mid-glyph without an intentional, accessible ellipsis container.                               |
| **FF2** | **Hardcoded / Unmapped Color Tokens**      | Any raw `#hex` or `rgb()` color declared inline or in CSS outside of `:root` / `[data-theme]` design tokens.                                                                |
| **FF3** | **Contrast Failure (< 4.5:1 Normal Text)** | Any foreground text vs background failing WCAG 2.1 AA in either Dark or Light mode (3.0:1 for large/bold text).                                                             |
| **FF4** | **Horizontal Page-Level Overflow**         | Unintended horizontal scrolling caused by layout elements spilling beyond the viewport at 1440px, 1024px, 820px, or 390px.                                                  |
| **FF5** | **Magic Number Math**                      | Coordinate math or positioning relying on arbitrary offsets (e.g. `left: 17.3px`) rather than derived ratios/fractions (`left: calc(var(--offset) / var(--total) * 100%)`). |
| **FF6** | **Component Downgrading / Dropping**       | Replacing a design component with an inferior primitive (e.g. converting a Gantt timeline to a static table, or omitting tab headers).                                      |
| **FF7** | **Keyboard Trap or Escape Key Failure**    | Opening a modal or drawer that cannot be dismissed via `Escape`, or keyboard `Tab` focus leaking outside the overlay into inert background elements.                        |
| **FF8** | **Missing Clinical Realism / Disclosure**  | Failing to display status indicators, legal form badges, or the synthetic clinical disclosure notice.                                                                       |

---

### The 100-Point Rubric Breakdown

```
TOTAL SCORE = Category 1 (35) + Category 2 (20) + Category 3 (20) + Category 4 (15) + Category 5 (10)
FINAL GRADE: Total / 10 (Target: >= 9.5 / 10.0)
```

#### Category 1: Visual Polish, Craft & Aesthetic Maturity (35 Points)

- **1.1 Fall of Light & Elevation Step (10 pts)**: Consistent lighting model; surfaces step up naturally (`--surface` -> `--surface-raised`); subtle 1px border highlights; no harsh, muddy drop shadows.
- **1.2 Micro-Typography & Tabular Numerals (10 pts)**: Exact font hierarchy; clean letter-spacing (`-0.01em` on headers, `+0.02em` on small caps); all counters, timestamps, and percentages use tabular monospace numbers.
- **1.3 Chromatic Discipline & Status Accents (10 pts)**: Restrained use of color. Color is reserved for state (green = discharge, red = delay, amber = warning, blue = admission); background surfaces remain neutral.
- **1.4 Optical Alignment & Padding Cohesion (5 pts)**: Icons optically centered with text baselines; uniform padding across cards (e.g. 16px outer, 12px inner); zero pixel drift.

#### Category 2: Spatial Density & Responsive Ergonomics (20 Points)

- **2.1 Viewport Adaptability (8 pts)**: Flawless fluid reflow across 1440px (desktop), 1024px (small desktop), 820px (tablet), and 390px (mobile); drawers transition to bottom sheets on mobile.
- **2.2 Information Density Balance (7 pts)**: High clinical scannability without feeling cramped; critical information visible above the fold; non-essential metadata tucked into drawers.
- **2.3 Adaptive Content Rules (5 pts)**: Text containers adapt dynamically (e.g. Gantt bars displaying `ID-only` when short (<16%), `ID + Status` when medium (16-32%), and `Full Title` when wide (>32%)).

#### Category 3: Contrast, Accessibility & WCAG 2.1 AA (20 Points)

- **3.1 Dual-Theme Contrast Verification (10 pts)**: Every text element, badge, and icon meets >= 4.5:1 contrast against its background in **both** Dark and Light themes.
- **3.2 ARIA Semantics & Screen Reader Ergonomics (5 pts)**: Correct `role="region"`, `aria-label`, `aria-valuenow`, `aria-expanded`, and live region announcements for dynamic changes.
- **3.3 Touch Target Compliance (5 pts)**: All interactive buttons, scrubber handles, tabs, and toggles meet minimum touch target boundaries (>= 44x44px target area or adequate hit-box padding).

#### Category 4: Operational Realism & Clinical State (15 Points)

- **4.1 Statutory & Domain Fidelity (8 pts)**: Complete depiction of WA Mental Health Act 2014 forms (Form 1A, Form 4A, Form 5A), transport escort requirements, and legal authorization states.
- **4.2 Temporal Logic & Time Anchoring (4 pts)**: Clear visual representation of "NOW", past vs future events, elapsed delay indicators, and distinct predicted vs confirmed movements.
- **4.3 Edge Case Resilience (3 pts)**: Gracefully handles overlapping events, simultaneous discharges, long patient names, and zero-data empty states.

#### Category 5: Micro-Interactions, Transitions & Focus (10 Points)

- **5.1 Smooth Scrubbing & Zooming (4 pts)**: Timeline scrubbing and range toggles (12h/24h/48h) react smoothly without layout tearing or coordinate lag.
- **5.2 Focus Management & Trap (3 pts)**: Detail drawers trap focus; closing drawer restores focus to the trigger element; visible `:focus-visible` rings with high-contrast outlines.
- **5.3 Hover & Selection States (3 pts)**: Clear, instantaneous visual feedback on hover, press, and active selection states without shifting sibling elements.

---

### Scoring Calibration Scale

- **9.5 – 10.0 (Sovereign Quality)**: Ready for live production deployment. Exquisite visual hierarchy, zero text clipping, perfect contrast in both themes, complete keyboard accessibility, robust edge handling.
- **9.0 – 9.4 (Near Production)**: Minor cosmetic tuning required (e.g. 1-2px padding asymmetry or slight hover transition delay). Zero fatal flaws.
- **8.0 – 8.9 (Draft Quality)**: Decent structure, but contains readability defects, dense clustering, or incomplete responsive tuning. Needs another iteration.
- **< 8.0 (Unacceptable)**: Reject. Re-architect mockup before proceeding.

---

## Phase 3: The Adversarial Review & Investigation Loop

Never score or approve your own design in isolation. Before any mockup is approved for implementation, spawn two independent, specialized AI subagents to attack and investigate the design.

```
                  ┌───────────────────────────────┐
                  │    STANDALONE MOCKUP READY    │
                  └───────────────┬───────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
   ┌───────────────────────────┐     ┌───────────────────────────┐
   │ SUBAGENT 1:               │     │ SUBAGENT 2:               │
   │ Adversarial UI/UX Auditor │     │ Design Systems & Clinical │
   │                           │     │ Investigator              │
   └─────────────┬─────────────┘     └─────────────┬─────────────┘
                 │                                 │
                 │   • Break viewports (390px)     │   • Token leaks & purity
                 │   • Overlap event collisions    │   • Container queries/subgrid
                 │   • Check text clipping         │   • WA Mental Health forms
                 │   • Trap keyboard focus         │   • Scalability & rendering
                 │   • Audit WCAG contrast         │   • Coordinate math invariants
                 │                                 │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
                   ┌───────────────────────────────┐
                   │    CONSOLIDATED AUDIT REPORT  │
                   │  - Severity-Ranked Findings   │
                   │  - Score Deductions           │
                   │  - Specific Line Fixes        │
                   └───────────────┬───────────────┘
                                  │
                                  ▼
                   ┌───────────────────────────────┐
                   │     APPLY FIXES & ITERATE     │
                   │     (Score >= 9.5 Achieved)   │
                   └───────────────────────────────┘
```

### 1. Subagent Prompt: Adversarial UI/UX Auditor

Use this exact prompt when delegating the adversarial audit:

```markdown
You are an elite Adversarial UI/UX Auditor. Your mission is to ruthlessly attack:
Mockup URL: [INSERT URL, e.g. http://127.0.0.1:60178/my-screen.html]
File: [INSERT ABSOLUTE PATH]

Probe and report on:

1. Viewport & Responsive Stress-Testing:
   - Resize page to 1440px, 1024px, 820px, and 375px using Chrome DevTools MCP.
   - Look for horizontal scrollbar leaks, card collisions, or broken layouts.
2. Text Clipping & Overlap Edge Cases:
   - Inspect elements for text overflow, ellipsis failures, or overlapping bars.
3. Interactive & Focus Trapping Rigor:
   - Trigger dialogs/drawers. Does pressing Escape close them? Is focus trapped?
   - Can keyboard users tab out into inert background elements?
4. WCAG 2.1 AA Color Contrast:
   - Calculate exact contrast ratios of all badge, text, and button swatches against their backgrounds in BOTH Dark and Light themes.
5. Score the design against the 100-Point Rubric. Report any Fatal Flaws immediately.
```

### 2. Subagent Prompt: Design Systems & Clinical Investigator

Use this exact prompt when delegating the system and clinical investigation:

```markdown
You are a Principal Design Systems Architect and Clinical UX Specialist. Your mission is to investigate:
Mockup URL: [INSERT URL]
File: [INSERT ABSOLUTE PATH]

Investigate and report on:

1. Design Token Discipline:
   - Search for hardcoded hex colors, magic pixel numbers, or untracked CSS rules.
   - Verify that CSS variables scale properly between Light and Dark themes.
2. Clinical Workflow & Mental Model:
   - Does the screen accurately reflect the coordinator's workflow?
   - Verify statutory compliance (e.g. WA Mental Health Act 2014 forms, escorts, transfer authorities).
   - Are predictive/speculative states clearly distinguished from confirmed states?
3. Architecture & Scalability:
   - Evaluate performance if scaled to 50+ items or 15+ wards.
   - Recommend modern CSS platform features (Container Queries @container, Subgrid, dvh).
```

---

## Phase 4: Production Porting & Engineering Bridge

Once the mockup achieves **>= 9.5 / 10.0**, engineering implementation begins. The static HTML/CSS is translated into React / Next.js / TypeScript.

### 1. Architecture Directory Structure

Follow the established module architecture:

```
src/
├── components/
│   └── ward-management/
│       └── [feature-name]/
│           ├── [feature]-screen.tsx          # Screen container & panel orchestrator
│           ├── [component-name].tsx          # Interactive UI component
│           ├── [component-name].module.css   # Scoped CSS Module
│           └── [feature]-derivations.ts      # Pure transformation functions
tests/
└── ward-[feature]-visual.dom.test.tsx        # Tier 1 Visual DOM test suite
scripts/ward-flow/
└── verify-[feature].mjs                      # Tier 2 Automated Visual Inspector
```

### 2. The CSS Module Scoping Rule

- Never import global CSS or write unscoped style sheets for components.
- Use CSS Modules (`*.module.css`).
- Map classes cleanly using camelCase in CSS Modules:
  ```tsx
  import styles from "./movement-horizon.module.css";

  <div className={styles.horizonContainer}>
    <div className={styles.timelineTrack} />
  </div>;
  ```

### 3. Pure Derivations Isolation (`*-derivations.ts`)

Do not embed complex business math, timeline coordinate calculation, or filtering inside React render functions. Isolate them in pure, independently testable derivation functions:

```typescript
// movements-derivations.ts
export interface HorizonEvent {
  id: string;
  patientId: string;
  patientName: string;
  type: "admit" | "transit" | "leave" | "discharge" | "delay" | "predicted";
  startHour: number;
  durationHours: number;
}

export function computeHorizonLayout(
  event: HorizonEvent,
  zoomRangeHours: number,
  containerWidthPx: number,
): { leftPct: number; widthPct: number; labelMode: "id" | "compact" | "full" } {
  const leftPct = Math.max(0, Math.min(100, (event.startHour / zoomRangeHours) * 100));
  const rawWidthPct = (event.durationHours / zoomRangeHours) * 100;
  const widthPct = Math.max(2.5, Math.min(100 - leftPct, rawWidthPct));

  let labelMode: "id" | "compact" | "full" = "full";
  if (widthPct < 16) labelMode = "id";
  else if (widthPct < 32) labelMode = "compact";

  return { leftPct, widthPct, labelMode };
}
```

### 4. Backwards Compatibility & Panel Preservation

- Never break existing panel wrappers: Use `<WardPanel title="..." variant="...">`.
- Maintain existing test IDs and accessible landmarks (`role="region"`).
- If replacing an older component (e.g. replacing a spaghetti chart with the Gantt horizon), ensure that detail selection, click-to-open drawer props, and parent filters remain fully wired.

---

## Phase 5: The 4-Tier Verification Ladder

Before any code is committed, pushed, or marked as complete, it must pass all 4 tiers of verification.

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                    THE 4-TIER VERIFICATION LADDER                     │
   └────────────────────────────────────────────────────────────────────────┘
        │
        ├─► [ TIER 1: Visual DOM Tests ]
        │   Vitest + Testing Library: Role bindings, lanes, zooms, aria-*
        │
        ├─► [ TIER 2: Automated Visual Inspector Script ]
        │   Pure Node.js math: WCAG luminance, zero clipping, scrubber limits
        │
        ├─► [ TIER 3: Estate Regression Suite ]
        │   `node scripts/run-ward-tests.mjs` (Summary: Handed In == Ran)
        │   `npx tsc --noEmit` (0 type errors) & `eslint`
        │
        └─► [ TIER 4: Headless Chrome DevTools Inspection ]
            Live rendering: 1440px, 820px, 390px in Light & Dark modes
```

### Tier 1: Visual DOM Test Suite (`tests/*-visual.dom.test.tsx`)

Vitest tests that inspect structural fidelity, ARIA bindings, and responsive toggle states:

- Assert all expected lanes/headers are rendered.
- Assert zoom buttons toggle active states.
- Assert scrubber input updates `aria-valuenow`.
- Assert clicking an event opens the detail drawer with matching patient information.

### Tier 2: Automated Visual Inspector Script (`scripts/ward-flow/verify-*.mjs`)

A standalone Node.js script that computes visual mathematics without human error:

- **Relative Luminance & Contrast Math**: Computes contrast ratios for all event swatches against dark and light backgrounds. Fails if `< 4.5:1`.
- **Scrubber Bound Invariants**: Verifies timeline scrubber math produces fractions strictly in `[0.0, 1.0]`.
- **Text Truncation Tiers**: Verifies duration-to-width classification prevents label clipping.

#### Exemplary Inspector Script Template

```javascript
#!/usr/bin/env node
import fs from "node:fs";

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const parseHex = (hex) => {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Perform audits...
```

### Tier 3: Estate Regression & Build Gates

Run the full suite:

```powershell
# 1. Full Ward Test Harness
node scripts/run-ward-tests.mjs

# 2. TypeScript Compilation Gate
npx tsc -p tsconfig.typecheck.json --noEmit

# 3. Lint Gate
npx eslint src/components/ward-management/[feature]/**
```

> **CRITICAL RULE**: In `run-ward-tests.mjs`, always verify the printed summary line:  
> **`files handed in` must equal `files that ran`**. An exit code alone is not sufficient proof.

### Tier 4: Headless Chrome DevTools MCP Verification

1. Start local dev server (`npm run dev` or local preview).
2. Use Chrome DevTools MCP to navigate to the screen route.
3. Test viewports:
   - `resize_page` to `width: 1440, height: 900` -> inspect layout, take screenshot.
   - `resize_page` to `width: 820, height: 1180` (tablet) -> verify drawer reflow.
   - `resize_page` to `width: 390, height: 844` (mobile) -> verify zero horizontal spill.
4. Toggle theme:
   - Switch between Dark (`data-theme="dark"`) and Light (`data-theme="light"`).
   - Ensure visual contrast and borders remain crisp.
5. Verify browser console logs: `list_console_messages` must show **0 unhandled errors or hydration warnings**.

---

## Phase 6: Provenance & The Screen Verification Record

To prevent "stale-truth decay" (where a screen was verified once, edited later, and falsely assumed to be verified), record the verification with the drawing's hash in `screen-verification.json`.

### Updating `screen-verification.json`

```json
{
  "screen": "movements",
  "drawing": "docs/ward-flow/mockups/movement-third-edition.html",
  "drawingHash": "sha256-a1b2c3d4e5f6...",
  "verifiedDate": "2026-09-14",
  "verifiedBy": "Engineering & Visual System",
  "viewports": ["1440px", "820px", "390px"],
  "themes": ["dark", "light"],
  "score": 9.7,
  "verdict": "PASS",
  "tier1DomTests": "tests/ward-movement-horizon-visual.dom.test.tsx",
  "tier2VisualScript": "scripts/ward-flow/verify-movement-horizon.mjs",
  "tier3SuiteStatus": "89/89 tests passing, 0 regressions"
}
```

Run `node scripts/ward-flow/generate-screen-verification-md.mjs` (if configured) to regenerate `docs/ward-flow/SCREEN-VERIFICATION.md`.

---

## Master Screen Definition of Done (The 10-Point Checklist)

Before closing any screen design or build task, verify every box:

- [ ] **1. Mockup Provenance**: High-fidelity HTML mockup exists in `docs/ward-flow/mockups/` and was served via HTTP.
- [ ] **2. 100-Point Score >= 9.5**: Evaluated against the rubric with zero fatal flaws.
- [ ] **3. Dual-Agent Audit Passed**: Adversarial Auditor and Design Systems Investigator findings addressed.
- [ ] **4. Panel Structure Matches**: Panel order, panel types, and tab behaviors match the mockup.
- [ ] **5. Design Token Fidelity**: Zero hardcoded hex colors; dual-theme CSS variables used exclusively.
- [ ] **6. WCAG 2.1 AA Compliant**: All text and status badges meet >= 4.5:1 contrast in dark and light modes.
- [ ] **7. Tier 1 DOM Tests Pass**: Vitest visual DOM suite passes with 100% assertion success.
- [ ] **8. Tier 2 Visual Inspector Passes**: Automated script confirms zero clipping and bounded math.
- [ ] **9. Tier 3 Estate Regression Clean**: `run-ward-tests.mjs` runs with files handed in == files that ran. Typecheck and lint pass cleanly.
- [ ] **10. Tier 4 Browser Verified**: Screen inspected at 1440px, 820px, and 390px in Chrome DevTools; zero console errors; recorded in `screen-verification.json`.
