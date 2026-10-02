> **Historical source boundary — 2 October 2026.** The preserved material below
> describes the former Database/PsychSift workflow or a completed task. Its commands,
> hosting and appearance claims are not current Ward instructions. Use the
> [repository boundary](../../../AGENTS.md) and [Ward entry point](../README.md) for current work.

<!-- docs-script-refs:historical-start -->

# 06 — Cross-Project Onboarding & Execution Runbook

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## The Turnkey Integration Guide for Future Projects

**Target Audience**: Team Leads, Staff Engineers, Infrastructure Leads, Autonomous Agents  
**Scope**: Applicable to any Next.js, React, or TypeScript frontend repository  
**Parent Document**: [`README.md`](README.md)

---

## 1. Onboarding Overview: Adopting this System in a New Repo

To adopt this design and verification architecture in a new project (e.g. migrating from `ward-lead` to another clinical workspace), follow this step-by-step setup guide. It requires zero external SaaS subscriptions and runs 100% locally or inside standard GitHub Actions CI.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       30-MINUTE ADOPTION RUNBOOK                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Copy Handover Package to docs/design-system/handover/ (gone — that handover folder was removed)             │
│ Step 2: Copy CSS Tokens to Global Styles (src/styles/tokens.css (gone — tokens live under the app globals / design-system paths now))          │
│ Step 3: Add Verification Scripts to `package.json`                          │
│ Step 4: Initialize `screen-verification.json`                               │
│ Step 5: Execute Test Run of Verification Script                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step 1: Repository Structure Setup

Create the following standardized folders in your new project root:

```bash
mkdir -p docs/mockups
mkdir -p docs/screen-verification
mkdir -p scripts/design-verify
mkdir -p tests/visual
```

Copy the template assets from `docs/ward-flow/handover/templates/`:

- `template-mockup.html` -> docs/mockups/starter-mockup.html (gone — starter mockup removed)
- `template-verify-visual.mjs` -> scripts/design-verify/verify-visual.mjs (gone — design-verify visual script removed)
- `template-component.tsx` -> horizon-gantt.tsx (gone — horizon gantt retired)
- `template-component.module.css` -> horizon-gantt.module.css (gone — horizon gantt retired)
- `template-derivations.ts` -> horizon-derivations.ts (gone — horizon gantt retired)
- `template-visual.dom.test.tsx` -> horizon-visual.dom.test.tsx (gone — horizon gantt retired)

---

## 3. Step 2: Global Design System Tokens Setup

Add the Sovereign Design System tokens to your root stylesheet or layout:

```css
/* src/styles/tokens.css */
@import "./tokens/surfaces.css";
@import "./tokens/colors.css";
@import "./tokens/typography.css";
```

Ensure your root layout (`app/layout.tsx` or `pages/_app.tsx`) applies `data-theme="dark"` or `data-theme="light"` at the `<html>` or `<body>` element.

---

## 4. Step 3: `package.json` Script Additions

Add these npm scripts to standardise verification commands across all developers and agents:

```json
{
  "scripts": {
    "mockups:serve": "python -m http.server 60178 --directory docs/mockups",
    "verify:visual": "node scripts/design-verify/verify-visual.mjs",
    "test:visual": "vitest run tests/visual",
    "verify:screen": "npm run verify:visual && npm run test:visual",
    "verify:estate": "npm run test:visual && npm run typecheck && npm run lint"
  }
}
```

---

## 5. Step 4: The 10-Step Feature Execution Lifecycle

When commissioned to build or overhaul a screen, follow this chronological workflow:

```
[DAY 1: PROTOTYPING]
  │
  ├─► 1. Craft Standalone Mockup: Copy `starter-mockup.html`, implement layout.
  ├─► 2. Serve Mockup: Run `npm run mockups:serve` (available at port 60178).
  ├─► 3. Self-Score: Evaluate against 100-Point Rubric in Doc 02.
  │
[DAY 2: ADVERSARIAL ATTACK]
  │
  ├─► 4. Launch Auditor Subagent: Run 4 viewports (1440, 1024, 820, 390).
  ├─► 5. Launch Investigator Subagent: Check token purity and statutory forms.
  ├─► 6. Fix Defects: Iterate until Score >= 9.5 and Fatal Flaws == 0.
  ├─► 7. Freeze Drawing: Compute SHA-256 hash of `.html` file.
  │
[DAY 3: PRODUCTION BUILD & TEST]
  │
  ├─► 8. Port to React: Extract CSS module and pure math derivations.
  ├─► 9. Run Verification Ladder:
  │      - Tier 1: `npm run test:visual` (Vitest)
  │      - Tier 2: `npm run verify:visual` (Node.js Math Script)
  │      - Tier 3: `npm run verify:estate` (Regression & Typecheck)
  │      - Tier 4: Headless Chrome DevTools inspection
  │
[DAY 4: RELEASE & PROVENANCE]
  │
  └─► 10. Record Provenance: Commit record to `screen-verification.json`.
```

---

## 6. Real-World Lessons Learned (From the `RULES.md` Archive)

Before shipping code, beware these real traps documented in historical post-mortems:

1. **`scrollWidth > clientWidth` on Table Headers**:
   - _The Trap_: Setting a table header to `white-space: nowrap` without a minimum container width causes silent text clipping in iframe embeds.
   - _The Fix_: Always enforce `min-width` on multi-column headers and apply the 3-tier adaptive typography contract.
2. **The "Files Handed In != Files That Ran" False Green**:
   - _The Trap_: A test runner exits with code `0`, but a syntax error prevented 2 of the 10 test files from being evaluated.
   - _The Fix_: Never trust exit codes alone; parse the stdout summary line to prove that every registered test file executed.
3. **Contrast Flaws Under Translucent Alpha Backdrops**:
   - _The Trap_: Calculating contrast against `rgba(21, 31, 45, 0.88)` as if it were an opaque surface.
   - _The Fix_: Blend the alpha overlay mathematically over the underlying `--bg` before computing relative luminance.
4. **Focus Leaks in Custom Modal Overlays**:
   - _The Trap_: Adding an `onClick` overlay without trapping keyboard `Tab` cycles, leaving blind or keyboard-only users stranded.
   - _The Fix_: Use an explicit `useEffect` focus trap with cleanup and `Escape` key restoration.

---

## 7. Sign-Off & Release Gate Template

Include this sign-off block in your final Pull Request description:

```markdown
## Sovereign Visual & Verification Gate Sign-Off

- [x] Mockup Served & Frozen: `docs/mockups/[name].html` (SHA-256: `[HASH]`)
- [x] 100-Point Design Score: `9.7 / 10.0` (0 Fatal Flaws)
- [x] Dual Subagent Audit Passed: Adversarial & Investigator findings resolved
- [x] Tier 1 DOM Tests: `tests/visual/[name].dom.test.tsx` (ALL PASS)
- [x] Tier 2 Visual Script: `scripts/design-verify/verify-[name].mjs` (100% PASS)
- [x] Tier 3 Estate Regression: Clean run, files handed in == files that ran
- [x] Tier 4 Browser Inspection: 1440px, 820px, 390px in Light & Dark (0 console errors)
- [x] Provenance Recorded: Added to `docs/ward-flow/screen-verification.json`
```

<!-- docs-script-refs:historical-end -->
