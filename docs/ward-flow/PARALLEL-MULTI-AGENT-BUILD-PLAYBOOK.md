# Ward Flow — Multi-Agent Parallel Build Playbook

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/HOW-WE-WORK.md`.** Kept for historical reference; do not follow.
> **Active operating rules:** Whichever session talks to Josh is Ward Lead (`this-chat-is-ward-lead.md`). Ephemeral role names (Astra, Sol, Ward Verifier) are retired. Focused tests (`scripts/run-vitest.mjs <files>`) are used during building, and the Owner's September 17 and 21 UI speed rules (single desktop light view by default) strictly govern.

## Safe Concurrent Screen Engineering, Adversarial Auditing & 4-Tier Verification

**Scope**: Historical operational manual for orchestrating multiple subagents in parallel.  
**Authority**: Superseded by `docs/ward-flow/HOW-WE-WORK.md` and `docs/ward-flow/README.md`.

---

## 1. The Core Architecture & Concurrency Invariants

When orchestrating multiple subagents concurrently, uncoordinated file access and conflicting test executions will corrupt git trees, overwrite shared styles, and trip over Windows process locks. To prevent this, every parallel session strictly enforces **four concurrency invariants**:

```
                              ┌───────────────────────────────────┐
                              │     ORCHESTRATOR / CONTROLLER     │
                              │       (Astra - Primary Agent)     │
                              └─────────────────┬─────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
│ BUILDER SUBAGENT │                  │ BUILDER SUBAGENT │                  │ BUILDER SUBAGENT │
│ (Sol-1: Screen A)│                  │ (Sol-2: Screen B)│                  │ (Sol-3: Screen C)│
└────────┬─────────┘                  └────────┬─────────┘                  └────────┬─────────┘
         │                                      │                                      │
         │ [Isolated Scope]                     │ [Isolated Scope]                     │ [Isolated Scope]
         │ `discharges/`                        │ `legal-forms/`                       │ `capacity/`
         │ Local focused DOM test               │ Local focused DOM test               │ Local focused DOM test
         │                                      │                                      │
         └──────────────────────────────────────┼──────────────────────────────────────┘
                                                │
                                                ▼ (Handoff to Controller)
                              ┌───────────────────────────────────┐
                              │     ADVERSARIAL QA & VERIFIER     │
                              │    (Chrome DevTools + Tier 1-4)   │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │   CONSOLIDATED ESTATE REGRESSION  │
                              │   `scripts/run-ward-tests.mjs`    │
                              └───────────────────────────────────┘
```

### Invariant 1: Strictly Disjoint Directory Ownership

- Each Builder Subagent is assigned **exclusive write access** to exactly one feature directory under `src/components/ward-management/[feature]/` and its matching test file `tests/ward-[feature]-*.test.tsx`.
- **Zero Cross-Talk**: Worker A may NEVER touch Worker B's directory or test files.

### Invariant 2: Shared Infrastructure Write-Lock (Controller-Only)

- No subagent may modify shared files:
  - `src/components/ward-management/shell/*` (Header, Rail, Navigation, Search Shell)
  - `src/components/ward-management/ward-flow-reducer.ts` (Core state machine)
  - Global CSS tokens or CSS resets
- If a subagent discovers a missing shared primitive, it must report it to the Controller as a requested interface addition rather than modifying shared files directly.

### Invariant 3: Scheduled Verification Gates (No Competing Runners)

- Subagents run **only their focused local DOM test** (e.g. `npx vitest run tests/ward-[feature].dom.test.tsx`).
- Estate-wide test suites (`node scripts/run-ward-tests.mjs`) and TypeScript compilation checks (`npx tsc -p tsconfig.typecheck.json --noEmit`) are **strictly scheduled by the Controller** sequentially after workers return ownership. Competing Vitest processes on Windows will lock temporary files and produce false negatives.

### Invariant 4: The Dual-Authority Contract

- **The Drawing Leads on Visuals**: Layout, micro-typography, panel sequence, elevation step, and token styling must replicate the served HTML mockup in `docs/ward-flow/mockups/`.
- **The Engine Leads on Behavior**: Invariants `I-01` to `I-14` (statutory forms, irreversible arrivals, bed capacity arithmetic, D-14 default-deny privacy) must be preserved. Any conflict between drawing and engine must be explicitly documented, never resolved silently.

---

## 2. Safe Parallel Batching Matrix

Subagents can be dispatched concurrently only across **disjoint batches**. Based on our full-estate audit, here is the concurrency matrix:

| Batch Slot               | Feature Directory                             | Authoritative Mockup                     | Can Run Concurrently With          | Must NOT Run With              |
| :----------------------- | :-------------------------------------------- | :--------------------------------------- | :--------------------------------- | :----------------------------- |
| **Discharges**           | `src/components/ward-management/discharges/`  | `mockups/discharges-third-edition.html`  | Legal Forms, Capacity, Out-of-Area | Reducer changes                |
| **Legal Forms**          | `src/components/ward-management/legal-forms/` | `mockups/legal-forms-third-edition.html` | Discharges, Capacity, On-Call      | Emergency Dept (Form 1A logic) |
| **Capacity / Bed Board** | `src/components/ward-management/capacity/`    | `mockups/bed-board-third-edition.html`   | Discharges, Legal Forms, Handover  | Movements (bed allocation)     |
| **Handover**             | `src/components/ward-management/handover/`    | `mockups/handover-third-edition.html`    | Legal Forms, Capacity, Out-of-Area | Wards overview                 |
| **Out of Area**          | `src/components/ward-management/out-of-area/` | `mockups/out-of-area-third-edition.html` | Discharges, Handover, On-Call      | Referrals intake               |
| **On-Call / Alerts**     | `src/components/ward-management/on-call/`     | `mockups/on-call-third-edition.html`     | Discharges, Legal Forms, Capacity  | Shell header                   |

---

## 3. Subagent Dispatch Instructions & Prompt Templates

When launching subagents in Antigravity or any agentic system, use the following standardized prompt contracts.

### Step 1: Dispatching the Builder Subagent

Call `invoke_subagent` with `TypeName: "self"`, `Role: "Ward Flow Screen Engineer"`, `Model: "inherit"`, and `Workspace: "inherit"`.

```markdown
You are a Senior UI/UX Engineer and Systems Architect building a live production Ward Flow screen.

YOUR EXCLUSIVE OWNED SCOPE:

- Target Component Directory: src/components/ward-management/[FEATURE_NAME]/
- Target DOM Test: tests/ward-[FEATURE_NAME]-visual.dom.test.tsx
- Target CSS Module: src/components/ward-management/[FEATURE_NAME]/[FEATURE_NAME]-third-edition.module.css

AUTHORITATIVE INPUTS:

- Authoritative Design Drawing: docs/ward-flow/mockups/[MOCKUP_NAME]-third-edition.html
- Universal Mockup Specification: docs/ward-flow/UNIVERSAL-MOCKUP-SPECIFICATION.md
- Design Playbook: docs/ward-flow/HIGH-FIDELITY-DESIGN-TO-PRODUCTION-PLAYBOOK.md

STRICT CONSTRAINTS & INVARIANTS:

1. Touch ONLY files in your owned scope. NEVER edit shared files (`shell/`, `ward-flow-reducer.ts`, root CSS).
2. Follow the 8 Sovereign Commandments:
   - State is a word first (no bare color pills).
   - Tabular numerals with zero rendered as lowercase "none".
   - Stated absence (never blank cells; e.g. "No pending orders").
   - 12px type floor; inward stepped radii; single elevation step (`--lift`); edge-fading scroll masks.
   - Zero hardcoded hex codes. Use CSS variables (`var(--surface)`, `var(--sunk)`, `var(--accent)`, `var(--line)`).
3. Pure Derivations Isolation: Isolate layout/timeline/filtering math into `[FEATURE_NAME]-derivations.ts`.
4. Backwards Compatibility: Preserve `<WardPanel>` wrappers, accessible role landmarks, and existing test IDs.
5. Verification:
   - Implement the component and CSS module.
   - Write or update `tests/ward-[FEATURE_NAME]-visual.dom.test.tsx` asserting lanes, headers, status badges, and tab interactions.
   - Run ONLY your local test: `npx vitest run tests/ward-[FEATURE_NAME]-visual.dom.test.tsx`.
6. Return a comprehensive handoff report detailing changed files, local test passes, and any visual deviations from the drawing.
```

### Step 2: Dispatching the Adversarial QA Subagent

Once the Builder subagent completes, dispatch the Adversarial Reviewer to audit the screen against the running local app server.

```markdown
You are an Adversarial UI/UX Auditor. Your mission is to ruthlessly attack the newly built screen:

- Local App Route: [INSERT ROUTE, e.g. /mockups/ward-flow/discharges]
- Component Path: src/components/ward-management/[FEATURE_NAME]/
- Authoritative Drawing: docs/ward-flow/mockups/[MOCKUP_NAME]-third-edition.html

EXECUTE THESE ADVERSARIAL AUDITS:

1. Responsive Stress-Testing (via Chrome DevTools MCP):
   - Audit at Desktop (1440px), Tablet (820px), and Mobile (390px).
   - Check `scrollWidth <= innerWidth`. Flag ANY horizontal page spill immediately (Fatal Flaw FF1).
2. Token Purity & Contrast Audit:
   - Scan component CSS for raw hex or rgb literals (Fatal Flaw FF2).
   - Verify WCAG 2.1 AA contrast (>= 4.5:1 text, >= 3.0:1 UI boundaries) in BOTH Dark (`data-theme="dark"`) and Light (`data-theme="light"`).
3. Keyboard & Focus Trapping:
   - Verify interactive drawers trap Tab focus and dismiss cleanly via Escape.
4. Structural Fidelity:
   - Confirm panel sequence and panel types match the mockup exactly (tables stay tables; tabs stay tabs).
5. Score the build against the 100-Point Design Rubric in `HIGH-FIDELITY-DESIGN-TO-PRODUCTION-PLAYBOOK.md`.
   Report any Fatal Flaws or deductions with exact line numbers.
```

---

## 4. The 4-Tier Verification Ladder (Execution Protocol)

Every parallel build must be validated through all four tiers before sign-off:

```
[ TIER 1: Visual DOM Tests ] ────────► vitest run tests/ward-[feature]-visual.dom.test.tsx
      │
[ TIER 2: Visual Inspector Script ] ──► node scripts/ward-flow/verify-[feature].mjs
      │
[ TIER 3: Estate Regression Gate ] ───► node scripts/run-ward-tests.mjs + tsc --noEmit
      │
[ TIER 4: Headless Chrome DevTools ] ─► Viewports (1440/820/390) + Dual Themes + 0 Console Errors
```

### Tier 1: Visual DOM Unit Tests

Run the component's focused visual DOM test suite:

```powershell
npx vitest run tests/ward-[feature]-visual.dom.test.tsx
```

### Tier 2: Automated Visual Inspector Script

Run the dedicated visual math and contrast script:

```powershell
node scripts/ward-flow/verify-[feature].mjs
```

_Must confirm relative luminance contrast >= 4.5:1, scrubber limits [0.0, 1.0], and zero label truncation._

### Tier 3: Estate Regression & Build Gates

Run the full Ward Flow test suite and TypeScript compiler gate:

```powershell
# 1. Full Ward test suite (Offline)
node scripts/run-ward-tests.mjs

# 2. TypeScript compilation check (Strict)
npx tsc -p tsconfig.typecheck.json --noEmit
```

> **CRITICAL VERIFICATION RULE**: In `run-ward-tests.mjs`, never rely on exit codes alone. Confirm the summary line: **`files handed in` must equal `files that ran`** with **0 failures**.

### Tier 4: Headless Chrome DevTools Inspection

Using Chrome DevTools MCP against the local server (`npm run ensure`):

1. Verify `390px` mobile viewport has zero horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
2. Verify `820px` tablet viewport reflows cleanly.
3. Verify `1440px` desktop viewport renders full elevation and tabular spacing.
4. Verify console messages: `list_console_messages` must show **0 errors and 0 hydration warnings**.

---

## 5. Screen Sign-Off & Verification Record

When a screen passes all 4 tiers with a score >= 9.5/10:

1. Append or update the verification entry in `docs/ward-flow/screen-verification.json`:

```json
{
  "screen": "[feature-name]",
  "drawing": "docs/ward-flow/mockups/[feature]-third-edition.html",
  "drawingHash": "[SHA256_OF_DRAWING]",
  "verifiedDate": "YYYY-MM-DD",
  "score": 9.7,
  "verdict": "PASS",
  "tier1DomTests": "tests/ward-[feature]-visual.dom.test.tsx",
  "tier2VisualScript": "scripts/ward-flow/verify-[feature].mjs",
  "tier3EstateStatus": "Passed (files handed in == files that ran)",
  "tier4BrowserStatus": "Clean viewports (1440/820/390) & dual themes"
}
```

2. Regenerate the markdown verification report:

```powershell
node scripts/ward-flow/screen-verification.mjs
```
