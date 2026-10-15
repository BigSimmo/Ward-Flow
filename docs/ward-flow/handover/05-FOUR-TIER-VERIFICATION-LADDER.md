# 05 — The 4-Tier Verification Ladder & Release Gate

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## Phase 5 Standard Operating Procedure

**Target Audience**: Release Engineers, QA Automation Leads, Frontend Engineers  
**Prerequisites**: Vitest, React Testing Library, Node.js ES Modules, Chrome DevTools MCP  
**Parent Document**: [`README.md`](README.md)

---

## 1. The Verification Pyramid: Why One Test Tier Fails

In typical web development, teams rely solely on unit tests or Jest snapshots. In complex clinical software, **unit tests fail silently to catch visual and layout defects**:

- A component can pass 50 unit tests while its text is completely clipped.
- A component can pass snapshot tests while having an unreadable 1.8:1 contrast ratio.
- A component can pass end-to-end tests while spilling horizontally off the viewport on tablet screens.

To solve this permanently, we mandate the **4-Tier Verification Ladder**:

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                    THE 4-TIER VERIFICATION LADDER                     │
   └────────────────────────────────────────────────────────────────────────┘
        │
        ├─► [ TIER 1: Visual DOM Tests ] ─────────────────► Vitest + RTL
        │   Role bindings, lane topology, zoom toggling, aria-valuenow
        │
        ├─► [ TIER 2: Automated Visual Inspector Script ] ─► Standalone Node.js
        │   Relative luminance math (WCAG 4.5:1), zero clipping, scrubber bounds
        │
        ├─► [ TIER 3: Estate Regression Suite ] ──────────► `run-ward-tests`
        │   Handed-in == Ran contract, zero skipped regressions, tsc --noEmit
        │
        └─► [ TIER 4: Headless Chrome DevTools Inspection ] ► MCP Browser
            Live rendering: 1440px, 820px, 390px in Light & Dark; 0 console errors
```

Every tier catches what the lower tiers cannot. A screen is only done when **all 4 tiers are 100% green**.

---

## 2. Tier 1: Visual DOM Test Suite (`tests/*-visual.dom.test.tsx`)

Tier 1 executes inside Vitest using `@testing-library/react`. It validates component rendering, accessible landmarks, user interactions, and dynamic state transitions.

### Key Assertions to Include:

1. **Lanes & Topologies**: Assert that all expected health services (e.g. SMHS, EMHS, NMHS, WACHS) or ward lanes exist.
2. **Zoom Range Switching**: Simulate clicking `12h`, `24h`, `48h` and assert that active button states update.
3. **Scrubber ARIA Attributes**: Assert that the slider input carries `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
4. **Adaptive Typography Classes**: Verify that event elements carry the correct CSS classes (`mode-id`, `mode-compact`, `mode-full`) matching their duration.
5. **Interactive Click-to-Drawer**: Click an event bar and assert that the detail drawer mounts with the exact patient MRN and clinical data.

### Concrete Test Suite Pattern:

```tsx
// tests/ward-movement-horizon-visual.dom.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

describe("48-Hour Bed Movement Horizon (Gantt Chart)", () => {
  it("renders all 7 receiving unit lanes across WA health services", () => {
    render(
      <WardFlowProvider>
        <MovementsScreen />
      </WardFlowProvider>,
    );

    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    expect(trafficPanel).toBeInTheDocument();

    const expectedUnits = ["FSH · Ward 4A", "RPH · Ward 2K", "Graylands · W3", "Albany / WACHS"];
    for (const unit of expectedUnits) {
      expect(within(trafficPanel).getByTitle(unit)).toBeInTheDocument();
    }
  });

  it("switches zoom ranges between 12h, 24h, and 48h", () => {
    render(
      <WardFlowProvider>
        <MovementsScreen />
      </WardFlowProvider>,
    );

    const btn24 = screen.getByRole("button", { name: "24h" });
    fireEvent.click(btn24);
    expect(btn24).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the detail drawer when an event bar is clicked", () => {
    render(
      <WardFlowProvider>
        <MovementsScreen />
      </WardFlowProvider>,
    );

    const eventBar = screen.getByRole("button", { name: /MRN-4012/i });
    fireEvent.click(eventBar);

    const drawer = screen.getByRole("dialog", { name: /Movement Detail/i });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("Form 4A Transport Order")).toBeInTheDocument();
  });
});
```

---

## 3. Tier 2: Automated Visual Inspector Script (`scripts/ward-flow/verify-*.mjs`)

Tier 2 is a pure Node.js verification script that runs in CI or locally. It audits visual mathematics without needing a browser or DOM emulator.

### What Tier 2 Tests:

1. **WCAG 2.1 AA Relative Luminance & Contrast Math**: Computes exact contrast ratios for all event swatches against dark and light surface tokens. Fails if `< 4.5:1`.
2. **Coordinate & Scrubber Invariants**: Proves that for all zoom ranges (12h, 24h, 48h) and scrubber steps, the computed offset fraction is strictly bounded to `[0.0, 1.0]` with zero NaN or infinite coordinates.
3. **Adaptive Typography Classification**: Proves that short events (<16% width) produce `id-only` mode to guarantee zero text clipping.
4. **File Manifest Integrity**: Asserts that all required screen orchestrators, components, CSS modules, and derivations exist on disk.

### Command:

```powershell
node scripts/ward-flow/verify-[feature].mjs
```

---

## 4. Tier 3: Estate Regression & Build Gates

A new screen must never break existing screens or degrade type safety across the repository.

### The 3 Commands:

```powershell
# 1. Full Ward Flow Test Harness
node scripts/run-ward-tests.mjs

# 2. TypeScript Compiler Check
npx tsc -p tsconfig.typecheck.json --noEmit

# 3. Code Linter Gate
npx eslint src/components/ward-management/[feature]/**
```

### 🔴 The Handed-In == Ran Contract:

> **LESSON FROM `RULES.md`**: Never trust an exit code alone. Always inspect the test runner's printed summary:
>
> ```
> Test Files   6 passed (6)   -- "files handed in" (6) EQUALS "files that ran" (6)
> Tests        89 passed (89)
> ```
>
> If `run-ward-tests.mjs` was handed 6 files and reports 5 passed, **it is a red run wearing a green face**. The missing file may have failed to compile or silently timed out.

---

## 5. Tier 4: Headless Chrome DevTools MCP Verification

Tier 4 verifies real-world pixel rendering using headless Chrome. It ensures that computed styles, subgrid tracks, and media queries render cleanly without console warnings.

### Step-by-Step Execution:

#### 1. Navigate to Local Route

```json
{
  "ToolName": "navigate_page",
  "Arguments": { "url": "http://localhost:3000/mockups/ward-flow/movements" }
}
```

#### 2. Test 4 Standard Viewports

Use `resize_page` and capture screenshots:

- **Desktop Baseline**: `width: 1440, height: 900`
- **Small Laptop**: `width: 1024, height: 768`
- **Tablet (iPad)**: `width: 820, height: 1180`
- **Mobile Phone (iPhone)**: `width: 390, height: 844`

#### 3. Audit Browser Console Logs

Call `list_console_messages`. The message list must show:

- **0 unhandled JavaScript exceptions**.
- **0 React hydration mismatch warnings**.
- **0 404 resource errors** (e.g. missing fonts or images).

---

## 6. Provenance & Stale-Truth Decay Prevention

A common bug in large projects is "stale-truth decay": a screen is verified against a mockup in week 1, but someone changes the mockup or code in week 3, leaving the verification record falsely claiming "verified".

### The Fix: SHA-256 Drawing Hashes

Whenever a screen passes Tier 4 verification, compute the SHA-256 hash of the mockup drawing and record it in `docs/ward-flow/screen-verification.json`:

```json
{
  "screen": "movements",
  "route": "/mockups/ward-flow/movements",
  "mockupDrawing": "docs/ward-flow/mockups/movement-third-edition.html",
  "drawingSha256": "8f3b61a9c4e2d7e8...",
  "verifiedDate": "2026-09-14",
  "verifiedBy": "Engineering & Visual System",
  "score": 9.7,
  "viewportsChecked": [1440, 820, 390],
  "themesChecked": ["dark", "light"],
  "tier1DomSuite": "tests/ward-movement-horizon-visual.dom.test.tsx",
  "tier2VisualScript": "scripts/ward-flow/verify-movement-horizon.mjs",
  "tier3SuitePassed": true,
  "verdict": "SOVEREIGN_PASS"
}
```

If anyone edits the mockup file in the future, its SHA-256 changes, immediately marking the screen as **STALE** in automated checks until re-verified.

---

## 7. Master Screen Definition of Done (The 10-Point Checklist)

Before merging any PR or closing a feature ticket, check every box:

- [ ] **1. Mockup Provenance**: Standalone HTML mockup exists in `docs/ward-flow/mockups/` and was served via HTTP.
- [ ] **2. 100-Point Score >= 9.5**: Evaluated against the rubric with zero fatal flaws.
- [ ] **3. Dual-Agent Audit Passed**: Adversarial Auditor and Design Systems Investigator findings addressed.
- [ ] **4. Panel Structure Matches**: Panel order, panel types, and tab behaviors match the mockup.
- [ ] **5. Design Token Fidelity**: Zero hardcoded hex colors; dual-theme CSS variables used exclusively.
- [ ] **6. WCAG 2.1 AA Compliant**: All text and status badges meet >= 4.5:1 contrast in dark and light modes.
- [ ] **7. Tier 1 DOM Tests Pass**: Vitest visual DOM suite passes with 100% assertion success.
- [ ] **8. Tier 2 Visual Inspector Passes**: Automated script confirms zero clipping and bounded math.
- [ ] **9. Tier 3 Estate Regression Clean**: `run-ward-tests.mjs` runs with files handed in == files that ran. Typecheck and lint pass cleanly.
- [ ] **10. Tier 4 Browser Verified**: Screen inspected at 1440px, 820px, and 390px in Chrome DevTools; zero console errors; recorded in `screen-verification.json`.
