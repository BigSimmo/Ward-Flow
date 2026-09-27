# Sovereign Screen Design & Production Engineering Handover

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/README.md`.** Kept for history; do not follow. This package is not the Ward Flow entry point.

## Master Handover Package for Cross-Project UI/UX Systems

**Target Audience**: Lead Frontend Engineers, Clinical UX Architects, Design System Engineers, and Autonomous Coding Agents  
**Reference Implementations**: `ward-lead` (Movements Screen, 48-Hour Bed Movement Horizon)  
**Version**: 1.0.0 (Comprehensive Handover Edition)  
**Package Directory**: `docs/ward-flow/handover/`

---

## 1. Executive Summary & Purpose of this Handover

This package is the complete, self-contained standard operating procedure, engineering specification, and automated verification harness developed to solve a critical, recurring failure mode in complex clinical and enterprise software:

> **The Disconnect Problem**:  
> Codebases pass 5,000+ unit tests while screens **look nothing like their mockups**, suffer from unreadable contrast, clip vital clinical patient identifiers, break on mobile/tablet viewports, drop essential tabs or card grids, or quietly mutate statutory business logic to fit a simplified HTML sketch.

This handover provides an exhaustive, repeatable 5-phase system that guarantees any screen designed as a high-fidelity mockup is scored harshly, attacked adversarially, engineered cleanly into React/Next.js/TypeScript, and verified through a 4-tier testing ladder before landing in production.

```
   ┌─────────────────────────────────────────────────────────────────────────────────────────┐
   │                            THE COMPLETE 5-PHASE LIFECYCLE                              │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       ▼                                                                                 ▼
  [ 01-MOCKUP-ENGINEERING ]                                                    [ 02-SCORING-RUBRIC ]
  • Standalone HTML/CSS Canvas                                                 • Dual-Authority 200-Pt Rubric
  • Zero dependencies, local HTTP server                                       • 14 Zero-Tolerance Fatal Flaws
  • Token-driven palette & elevations                                          • 100-Pt Visual + 100-Pt Clinical
  • 34px/20px Gantt & console density                                          • Target: Both >= 95 / 100 to pass
       │                                                                                 │
       └────────────────────────────────────────┬────────────────────────────────────────┘
                                                ▼
                                   [ 03-ADVERSARIAL-AUDIT ]
                                   • Gemini-Native Synchronous Probes:
                                     - Lens 1: Adversarial UI/UX Auditor
                                     - Lens 2: Clinical Systems Investigator
                                   • Automated clipping & viewport probes
                                                ▼
                                   [ 04-REACT-PORTING-BRIDGE ]
                                   • Clean CSS Modules (`*.module.css`)
                                   • Pure Derivations (`*-derivations.ts`)
                                   • Backwards-compatible `<WardPanel>` contract
                                   • Single-source synthetic state
                                                ▼
                                   [ 05-VERIFICATION-LADDER ]
                                   • Tier 1: Vitest Visual DOM Test Suite
                                   • Tier 2: Automated Node.js Inspector Script
                                   • Tier 3: Estate Regression (`run-ward-tests`)
                                   • Tier 4: Headless Chrome DevTools MCP Checks
                                                ▼
                                   [ PROVENANCE & RELEASE ]
                                   • Record drawing SHA in `screen-verification.json`
                                   • 10-Point Screen Definition of Done Sign-off
```

---

## 2. Directory Structure of this Handover Package

This folder contains all documentation, runbooks, and reusable code templates required to bootstrap this system in a new project:

```
docs/ward-flow/handover/
├── README.md                                       # This master specification index
├── 01-STANDALONE-MOCKUP-ENGINEERING.md             # Phase 1: Mockup architecture & tokens
├── 02-SCORING-RUBRIC-AND-FATAL-FLAWS.md            # Phase 2: The 100-point rubric & fatal flaws
├── 03-ADVERSARIAL-AUDIT-AND-INVESTIGATION.md       # Phase 3: Multi-agent adversarial runbook
├── 04-REACT-PORTING-AND-ENGINEERING-BRIDGE.md      # Phase 4: React, CSS modules & derivations
├── 05-FOUR-TIER-VERIFICATION-LADDER.md             # Phase 5: Vitest, scripts, estate regression
└── templates/
    ├── template-mockup.html                        # Production-grade standalone HTML/CSS mockup
    ├── template-component.tsx                      # React container & presentation component
    ├── template-component.module.css               # Scoped CSS module with tokens & layout
    ├── template-derivations.ts                     # Pure mathematical coordinate & state engine
    ├── template-verify-visual.mjs                  # Standalone automated visual inspector script
    └── template-visual.dom.test.tsx                # Vitest / React Testing Library DOM suite
```

---

## 3. The Dual-Authority Invariant (Non-Negotiable Rule)

Any project adopting this methodology must enforce this invariant across both engineering and design teams:

1. **The Mockup is authoritative on visual design, typography, spacing, and layout density.**  
   Developers may not substitute components (e.g. turning card grids into plain tables, flattening tabs into stacked lists, or stripping badges) because of implementation convenience.
2. **The Working Engine is authoritative on runtime behavior, statutory state machines, and business logic.**  
   Developers may not alter validated clinical flow (e.g. WA Mental Health Act statutory status, bed occupancy formulas) to match a static mockup drawing.
3. **Every divergence between visual intent and engine behavior must be explicitly documented in the PR, screen verification record, and commit ledger.** Never resolve a divergence silently.

---

## 4. Quick-Start Guide for a New Screen

Follow these sequential steps when building a new screen:

| Step   | Action                                               | Documentation                                                                              | Template                                                                           |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **1**  | Create standalone HTML/CSS prototype in `mockups/`   | [`01-STANDALONE-MOCKUP-ENGINEERING.md`](01-STANDALONE-MOCKUP-ENGINEERING.md)               | [`templates/template-mockup.html`](templates/template-mockup.html)                 |
| **2**  | Serve via HTTP and score against the 100-pt rubric   | [`02-SCORING-RUBRIC-AND-FATAL-FLAWS.md`](02-SCORING-RUBRIC-AND-FATAL-FLAWS.md)             | Score sheet in Doc 02                                                              |
| **3**  | Spawn Adversarial & Investigator subagents to attack | [`03-ADVERSARIAL-AUDIT-AND-INVESTIGATION.md`](03-ADVERSARIAL-AUDIT-AND-INVESTIGATION.md)   | Subagent prompts in Doc 03                                                         |
| **4**  | Iterate until Score >= 9.5 with 0 Fatal Flaws        | [`02-SCORING-RUBRIC-AND-FATAL-FLAWS.md`](02-SCORING-RUBRIC-AND-FATAL-FLAWS.md)             | Polish checklist                                                                   |
| **5**  | Port layout & styling to React CSS Modules           | [`04-REACT-PORTING-AND-ENGINEERING-BRIDGE.md`](04-REACT-PORTING-AND-ENGINEERING-BRIDGE.md) | [`templates/template-component.tsx`](templates/template-component.tsx)             |
| **6**  | Isolate layout math & filters in pure derivations    | [`04-REACT-PORTING-AND-ENGINEERING-BRIDGE.md`](04-REACT-PORTING-AND-ENGINEERING-BRIDGE.md) | [`templates/template-derivations.ts`](templates/template-derivations.ts)           |
| **7**  | Create Tier 1 Vitest Visual DOM test suite           | [`05-FOUR-TIER-VERIFICATION-LADDER.md`](05-FOUR-TIER-VERIFICATION-LADDER.md)               | [`templates/template-visual.dom.test.tsx`](templates/template-visual.dom.test.tsx) |
| **8**  | Create Tier 2 Automated Visual Inspector script      | [`05-FOUR-TIER-VERIFICATION-LADDER.md`](05-FOUR-TIER-VERIFICATION-LADDER.md)               | [`templates/template-verify-visual.mjs`](templates/template-verify-visual.mjs)     |
| **9**  | Execute Tier 3 Estate Regression & Typecheck         | [`05-FOUR-TIER-VERIFICATION-LADDER.md`](05-FOUR-TIER-VERIFICATION-LADDER.md)               | Test runner check                                                                  |
| **10** | Perform Tier 4 Chrome DevTools MCP verification      | [`05-FOUR-TIER-VERIFICATION-LADDER.md`](05-FOUR-TIER-VERIFICATION-LADDER.md)               | Viewport test scripts                                                              |
| **11** | Record drawing hash in `screen-verification.json`    | [`05-FOUR-TIER-VERIFICATION-LADDER.md`](05-FOUR-TIER-VERIFICATION-LADDER.md)               | JSON schema in Doc 05                                                              |
