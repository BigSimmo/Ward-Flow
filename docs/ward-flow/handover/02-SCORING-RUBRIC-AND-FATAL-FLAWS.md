# 02 — The Sovereign Dual-Authority Scoring Rubric & Fatal Flaws Manual

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## Standard Operating Procedure for Gemini-Native Visual & Clinical Verification

**Target Audience**: Sovereign UI/UX Engineers, Clinical Frontend Architects, Headless Verification Probes  
**Execution Environment**: Gemini (Antigravity) with Native `chrome-devtools-mcp`, Vitest & Node Harnesses  
**Prerequisites**: WCAG 2.1 AA Luminance Math, WA Mental Health Act 2014 Invariants, DOM Bounding Geometry  
**Parent Document**: [`README.md`](README.md)

---

> 🔴 **BEFORE SCORING ANYTHING WITH THIS DOCUMENT, READ THIS. THREE OF ITS CRITERIA NOW PRODUCE
> THE WRONG VERDICT ON A CORRECT SCREEN, AND ONE OF THEM AWARDS A 0 / 200.** The original wording is
> kept everywhere, because this is the record of what past sessions were scored against. The
> corrections sit beside it, and they outrank it.
>
> | Criterion                             | What it does now                                                                                                                                                           | Corrected at                  |
> | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
> | **FF4** horizontal page overflow      | Its `scrollWidth > innerWidth` test **fabricates a fatal flaw** on a page that cannot overflow. It produced a P1 in the 17 September audit against a screen already fixed. | the note after the CF details |
> | **CF3** statutory timeline distortion | Scores the app against expiry windows **it deliberately does not model**, and names Form 5A wrongly.                                                                       | the note after the CF details |
> | **L1** statutory legal fidelity       | Awards up to 25 points for **countdown timers the product removed on purpose**.                                                                                            | the annotation inside L1      |
>
> ⚠️ **A rubric is an instrument, and a broken instrument is worse than none** — it reports with
> a number's confidence. Two sessions have now reasoned from these lines and had to be argued out of
> them, so the corrections are at the top rather than only where the criteria sit.

---

## 1. Objective Evaluation Philosophy & The Gemini-Native Standard

Subjective design critique ("looks clean", "feels modern", "good spacing") is toxic to clinical software engineering. In psychiatric bed flow, a low-contrast badge, clipped patient identifier, or confusing layout is an **operational defect that jeopardizes patient placement and statutory compliance**.

To prevent regressions, every mockup and production screen is governed by a **Dual-Authority 200-Point Mathematical Evaluation System**:

1. **Engine 1: Sovereign Visual Design, Craft & Ergonomics (100 Points)**
2. **Engine 2: Clinical UX, Domain Logic & Statutory Safety (100 Points)**

### The Non-Negotiable Gate

- **Certification Threshold**: Both engines must score **$\ge 95 / 100$ (9.5 / 10.0)** independently.
- **Zero Fatal Flaws**: Any single Visual Fatal Flaw (FF1–FF8) or Clinical Fatal Flaw (CF1–CF6) drops the overall score to **0 / 200**, immediately halting implementation.

---

## 2. The Gemini-Native Execution Advantage

Earlier iterations attempted to orchestrate multiple distributed subagents for auditing, creating context fragmentation, background task timeouts, and process fragility.

Under the **Gemini-Native Standard**, the entire lifecycle executes within Gemini's direct cognitive and tool loop:

- **Single-Session Continuity**: Eliminates handoff loss and server restart dropouts.
- **Direct Headless Probing**: Executes deterministic JavaScript assertions via `chrome-devtools-mcp` (`evaluate_script`, `resize_page`, `emulate`, `list_console_messages`, `take_screenshot`).
- **Instant Red-Team Iteration**: The same sovereign agent identifies defects, writes the programmatic fix, and re-probes within seconds.

---

## 3. The 14 Zero-Tolerance Fatal Flaws (Immediate 0 / 200 Rejection)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             THE 14 FATAL FLAWS (ZERO TOLERANCE)                                 │
├─────┬─────────────────────────────────┬─────────────────────────────────────────────────────────┤
│ ID  │ FATAL FLAW                      │ DETECTION METHOD & INVARIANT                            │
├─────┼─────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ FF1 │ Text Truncation / Glyph Clip    │ `el.scrollWidth > el.clientWidth` without ellipsis CSS  │
│ FF2 │ Unmapped Hardcoded Hex/RGB      │ Regex search for `#...` or `rgb()` outside `:root`       │
│ FF3 │ Contrast Ratio < 4.5:1          │ WCAG 2.1 AA luminance formula across Dark AND Light     │
│ FF4 │ Horizontal Page-Level Overflow  │ `scrollWidth > innerWidth` at 1440, 1024, 820, or 390px │
│ FF5 │ Magic Number Math / Layout      │ Hardcoded arbitrary pixel offsets instead of calc/grid  │
│ FF6 │ Component Downgrading           │ Substituting rich components with crude HTML primitives │
│ FF7 │ Keyboard Trap / Escape Failure  │ Leaked focus; `Escape` fails to dismiss overlay/drawer  │
│ FF8 │ Missing Synthetic Disclosure    │ DOM missing sovereign clinical prototype disclosure     │
├─────┼─────────────────────────────────┼─────────────────────────────────────────────────────────┤
│ CF1 │ Absence Rendered as Measurement │ Showing '0' for unsearchable/excluded clinical states    │
│ CF2 │ Category / Population Error     │ Movement filters applied to people or waiting referrals │
│ CF3 │ Statutory Timeline Distortion   │ Misrepresenting WA MHA 2014 Form 1A/4A/5A expiry rules  │
│ CF4 │ Unsanctioned Clinical Scoring   │ Inventing AI severity scores or clinical prioritization │
│ CF5 │ False Destination Equivalence   │ Conflating physical beds with allocatable capacity      │
│ CF6 │ Silent Data / Refusal Omission  │ Hiding refused searches without explanatory live banner │
└─────┴─────────────────────────────────┴─────────────────────────────────────────────────────────┘
```

### Visual Fatal Flaws (FF1 – FF8) Details:

- **FF1: Text Truncation / Glyph Clip**: Any text truncated mid-glyph or clipped without explicit `text-overflow: ellipsis`.
- **FF2: Unmapped Hardcoded Hex/RGB**: Raw `#hex` or `rgb()` used in CSS rules instead of `var(--token)`.
- **FF3: Contrast Ratio < 4.5:1**: Any text or interactive icon below 4.5:1 (normal) or 3.0:1 (large/bold) in either theme.
- **FF4: Horizontal Page Overflow**: Page width exceeds viewport at 1440px, 1024px, 820px, or 390px (`scrollWidth > innerWidth`).
- **FF5: Magic Number Math**: Hardcoded pixel positioning (e.g. `left: 47.3px`) that breaks upon container resize.
- **FF6: Component Downgrading**: Replacing multi-axis facets, drawers, or timeline bars with plain static lists.
- **FF7: Keyboard Trap & Escape Failure**: Inability to close modals with `Escape` or focus escaping overlay containers.
- **FF8: Missing Synthetic Disclosure**: Omitting the statutory prototype notice (`Synthetic records only. Not a medical device`).

### Clinical Fatal Flaws (CF1 – CF6) Details:

- **CF1: Absence Rendered as Measurement**: Conflating "not found" with "never existed" (e.g., displaying `Arrived: 0` when arrived movements are excluded by design).
- **CF2: Category & Population Error**: Asserting movement attributes (e.g., "accepted ward", "transport escort") onto a person directory record or queued referral.
- **CF3: Statutory Timeline Distortion**: Inaccurate portrayal of WA Mental Health Act 2014 statutory windows:
  - Form 1A: 24-hour ED referral for examination window.
  - Form 4A: Transport order requirement and escort mandate.
  - Form 5A: Involuntary inpatient order (requires Authorised Hospital destination).
- **CF4: Unsanctioned Clinical Prioritization**: Creating clinical severity or triage ranking algorithms. Ward Flow coordinates _operational placement fit_, never clinical diagnosis or acuity.
- **CF5: False Destination Equivalence**: Treating all referral addressings as wards (an addressing can be an ED, Community Team, or Inpatient Ward) or conflating physically empty beds with allocatable beds.
- **CF6: Silent Omission & Unexplained Refusal**: Dropping records or refusing non-indexed searches (e.g. diagnostic keywords, acuity scores) without clear, explainable banners and access audit logging.

---

> 🔴 **FF4's DETECTION METHOD IS WRONG FOR THIS CODEBASE AND WILL FABRICATE A 0 / 200.**
> `document.documentElement.scrollWidth` is not evidence of horizontal overflow here. `globals.css`
> sets `overflow-x: clip` on both `html` and `body`, so that figure reports an unclipped descendant
> box inside a working scroller — a box no user can scroll to and nothing is cut off by.
>
> Measured on `/mockups/ward-flow/ed/rph-ed` at tip `6fd766d37c`: `documentElement.scrollWidth` read
> **2040** in a **1425px** viewport, while `document.body.scrollWidth` read **1425** — the viewport
> exactly — and a sweep of every element whose right edge passed the viewport found **zero** outside
> a scrollable ancestor. The 17 September audit used the documentElement figure and reported a P1
> against a screen that had already been repaired; acting on it would have dismantled a working
> horizontal scroller that **the owner asked for** (the bed board scrolls sideways on narrow
> screens, no columns dropped).
>
> ✅ **Score FF4 with one of these two instead**, at 1440, 1024, 820 and 390px:
>
> 1. `document.body.scrollWidth` against `document.documentElement.clientWidth`; or
> 2. count elements whose `getBoundingClientRect().right` passes the viewport **and** which have no
>    ancestor that is a live `overflow-x: auto|scroll` scroller. Zero means clean.
>
> Prove a scroller genuinely scrolls by setting `scrollLeft` and reading it back. **A table wider
> than its wrapper is the design, not the defect — the defect is the PAGE moving.** FF1 carries a
> milder form of the same fault: `el.scrollWidth > el.clientWidth` is true of every healthy
> scroller, so read it as "inspect this", never as a violation on its own.

> 🔴 **CF3 SCORES THE APP AGAINST BEHAVIOUR IT DELIBERATELY DOES NOT HAVE, AND NAMES A FORM
> WRONGLY.** Legal plan T1/T2/T6 removed computed statutory limits: **an expiry is a value a
> clinician typed, or it is not shown, and the app never calculates how long a form has left.** So
> "inaccurate portrayal of statutory windows" scores a capability that was removed on purpose, and a
> screen behaving correctly fails it.
>
> The form descriptions under CF3 are also wrong, and appeared verbatim in shipped code before being
> corrected on 2026-09-18. **Form 5A is a Community Treatment Order**, not an involuntary inpatient
> order, and is not bound to authorised hospitals; the inpatient treatment order is **Form 6A**. The
> register is `src/lib/form-register.ts`, transcribed from the Chief Psychiatrist's published list:
> 1A "Referral for examination by a psychiatrist", 4A "Transport order", 5A "Community Treatment
> Order". "24-hour ED referral window" and "escort mandate" are not register text.
>
> ✅ **What CF3 should catch now — close to the opposite of what it says.** The fatal flaw is
> the app **asserting a legal consequence it cannot compute**: a countdown, a derived deadline, a
> "statutory breach", an Act section number, or a form title not taken from the register. The ward
> `authorisation` gate, the Voluntary/Involuntary status labels and the clinician-typed expiry are
> facts the app legitimately holds and must never be scored against. Live rules, which outrank this
> file: `AGENTS.md`, `src/lib/form-register.ts`, and the guard
> `tests/ward-form-labels-from-register.test.ts`, which fails on any hand-written form title under
> `src/components/ward-management`.

---

## 4. Engine 1: Sovereign Visual Design Rubric (100 Points)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CATEGORY V1: Visual Polish, Craft & Surface Elevation     (25 Points)      │
│ CATEGORY V2: Micro-Typography, Hierarchy & Tabular Math   (25 Points)      │
│ CATEGORY V3: Spatial Density & Responsive Ergonomics      (25 Points)      │
│ CATEGORY V4: Micro-Interactions, State Feedback & Motion  (15 Points)      │
│ CATEGORY V5: Accessibility, Contrast & Focus Trapping     (10 Points)      │
├────────────────────────────────────────────────────────────────────────────┤
│ ENGINE 1 TOTAL: 100 Points | Minimum Gate to Pass: 95.0 Points (9.5 / 10)  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Breakdown of Visual Categories:

1. **V1: Visual Polish, Craft & Surface Elevation (25 pts)**
   - Platinum Raised Cool lighting model: `--bg` $\rightarrow$ `--surface` $\rightarrow$ `--surface-raised`.
   - 1px hairline alpha dividers (`border: 1px solid var(--border-subtle)`).
   - Restrained chromatic discipline: semantic hues reserved strictly for clinical state (green = discharge, red = breaching wait, amber = holding/alert, blue = active intake).
2. **V2: Micro-Typography, Hierarchy & Tabular Math (25 pts)**
   - Mandatory `font-variant-numeric: tabular-nums` and `--font-mono` on all clocks, timers, counts, and identifiers.
   - Optical kerning: headers tightened (`letter-spacing: -0.015em`), uppercase badges tracked out (`letter-spacing: +0.035em`).
   - Strict optical baseline alignment between icons, text, and counter pills.
3. **V3: Spatial Density & Responsive Ergonomics (25 pts)**
   - Maximum clinical yield above the 900px fold on 1440px desktop.
   - Clean column collapsing at 1024px and 820px tablet.
   - Seamless 390px mobile view with $\ge 44 \times 44\text{px}$ touch targets and zero horizontal scroll.
4. **V4: Micro-Interactions, State Feedback & Motion (15 pts)**
   - Instant visual response on hover and active click ($<150\text{ms}$ transitions).
   - In-page search shortcut (`/`), clear shortcut (`Esc`), and roving tab index on facet ribbons.
   - Smooth accordion and drawer slide-overs without layout reflow jitter.
5. **V5: Accessibility, Contrast & Focus Trapping (10 pts)**
   - Dual-theme WCAG 2.1 AA luminance ratio $\ge 4.5:1$ across both `:root` and `[data-theme="light"]`.
   - Unambiguous `:focus-visible` outline rings (`2px solid var(--accent)`).
   - Semantic ARIA roles (`role="tablist"`, `role="status"`, `aria-live="polite"`).

---

## 5. Engine 2: Clinical UX & Domain Logic Rubric (100 Points)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CATEGORY L1: Statutory Legal Fidelity & Governance        (25 Points)      │
│ CATEGORY L2: Caseload Taxonomy & Population Integrity     (25 Points)      │
│ CATEGORY L3: Search Triage, Facet Math & Query Ergonomics (20 Points)      │
│ CATEGORY L4: Transparency, Refusals & Audit Trails        (15 Points)      │
│ CATEGORY L5: Actionability, Decision Support & Handoff    (15 Points)      │
├────────────────────────────────────────────────────────────────────────────┤
│ ENGINE 2 TOTAL: 100 Points | Minimum Gate to Pass: 95.0 Points (9.5 / 10)  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Breakdown of Clinical Logic Categories:

1. **L1: Statutory Legal Fidelity & Governance (25 pts)**
   - WA Mental Health Act 2014 forms modeled with countdown timers and expiry states:
     - Form 1A (ED 24h referral window).
     - Form 4A (Transport Order & authorized escort).
     - Form 5A (Involuntary Inpatient Order bound to Authorised Hospitals).
   - Clear legal status badges with statutory reference citations.

   > 🔴 **ANNOTATION — 2026-09-18, owner-directed. THE FOUR LINES ABOVE ARE WRONG AND MUST NOT BE
   > BUILT FROM.** The original text is left exactly as written, because this is a record of what
   > a past session was scored against, not a live specification. Read it as history.
   >
   > **Form 5A is a Community Treatment Order** — a person living in the community under
   > conditions. It is not an involuntary inpatient order and is not bound to authorised hospitals.
   > "Inpatient treatment order in authorised hospital" is **Form 6A**. The register is
   > `src/lib/form-register.ts`, transcribed from the Chief Psychiatrist's published list; its
   > titles for these three are:
   >
   > | Code | Register title                             |
   > | ---- | ------------------------------------------ |
   > | 1A   | Referral for examination by a psychiatrist |
   > | 4A   | Transport order                            |
   > | 5A   | Community Treatment Order                  |
   >
   > The parenthetical descriptions above are not register titles. "ED 24h referral window",
   > "authorized escort" and the 5A gloss were all invented here, and **all three then appeared
   > verbatim in shipped code** — `ward-referral-drawer.tsx` carried "Form 1A (Referral for
   > Examination · 24h Strict Limit)", "Form 4A (Transport Order · Authorized Escort)" and
   > "Form 5A (Involuntary Inpatient Treatment Order)" until 2026-09-18, and a demo patient was
   > recorded as "Form 5A Inpatient Order" while being placed into a secure inpatient bed. The
   > lineage is this list, in this order. That is why the annotation is here rather than only in
   > the code: two separate sessions reasoned from these lines and had to be argued out of them.
   >
   > ⚠️ **"modeled with countdown timers and expiry states" is also no longer what this product
   > does.** Legal plan T1/T2/T6 removed computed statutory limits: an expiry is a typed, recorded
   > value or it is not shown, and the app does not calculate how long a form has left. A rubric
   > that awards points for countdown timers rewards the exact behaviour those tasks removed.
   >
   > Current rules, which outrank this file: `AGENTS.md`, the register in
   > `src/lib/form-register.ts`, and the guard `tests/ward-form-labels-from-register.test.ts`,
   > which fails on any hand-written form title under `src/components/ward-management`.
   >
   > ✅ **WHAT L1'S 25 POINTS ARE SCORED ON NOW.** The four original lines above tell a scorer to
   > reward countdown timers, invented form glosses and Act citations — every one of which the
   > product removed on purpose, so a correct screen scores badly and a reverted one scores well.
   > Score these instead:
   >
   > |     | Criterion                                                                                                                                                                                                                        | Worth |
   > | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
   > | a   | **Every form title comes from the register** (`src/lib/form-register.ts`), never hand-written, and the code is spelled as the register spells it.                                                                                | 8     |
   > | b   | **No computed legal time anywhere.** An expiry is shown only where a clinician typed one, and it is never counted down, never turned into "overdue", and never used to block an action.                                          | 8     |
   > | c   | **No claim of legal authority.** No Act section number, no "statutory breach", no "registry", no wording presenting the app as enforcing the Act rather than recording what somebody wrote.                                      | 5     |
   > | d   | **The facts it legitimately holds are kept and explained** — the ward `authorisation` gate and why it refused, the Voluntary / Involuntary status, the typed expiry. Removing these is as much a defect as inventing the others. | 4     |
   >
   > ⚠️ **(d) is there because the obvious reading of this correction is "delete the legal
   > words", and that breaks working clinical logic** — the engine refuses a bed on the
   > authorisation gate and must still be able to say why.

2. **L2: Caseload Taxonomy & Three-Population Integrity (25 pts)**
   - Absolute structural separation between:
     1. _People Directory_ (system-known identities, even with no active placement).
     2. _Queued Crisis Referrals_ (pre-decision, unplaced patients awaiting bed offers).
     3. _Open Bed Movements_ (accepted patients progressing through transit/admission).
   - Summary yield strips that accurately sum distinct populations without double-counting.
3. **L3: Search Triage, Facet Math & Query Ergonomics (20 pts)**
   - Real-time reactive facet counts: pill counts reflect _exact yield if clicked_.
   - Multi-axis filtering: Health Service, Setting (ED/Ward/Transit), Legal Status, Wait Band.
   - Instant 1-click clinical quick chips for high-acuity crisis triage.
4. **L4: Transparency, Refusals & Audit Trails (15 pts)**
   - Proactive search refusal engine: refuses clinical severity scores, diagnostic labels, and arrived movements with explicit explanatory banners.
   - Ephemeral session-only search access audit ledger recording user query terms and timestamps upon `Enter`.
   - Absolute provenance: explicit source declarations for all capacity figures.
5. **L5: Actionability, Decision Support & Safe Handoff (15 pts)**
   - Direct 1-click routing into _Patient Workspace_ (`/people/[id]`), _Movements_, or _Bed Board_.
   - Deep inspection drawer revealing complete destination decline histories (distinguishing wards, EDs, and community teams).
   - Timeline milestone events tracking triage, referral, bed hold, and transit handoff.

---

## 6. Point Deduction Schedule for Sub-Fatal Defects

Any detected flaw that does not trigger an instant 0/200 Fatal Flaw incurs deductions according to this mathematical schedule:

| Penalty      | Defect Classification & Description                                                               |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **-1.0 pt**  | Minor optical misalignment (1–2px icon/label baseline drift).                                     |
| **-1.0 pt**  | Lack of positive tracking (`+0.035em`) on an uppercase badge.                                     |
| **-2.0 pts** | Missing tabular numerals (`font-variant-numeric: tabular-nums`) on non-critical counters.         |
| **-2.0 pts** | Sub-optimal keyboard focus ring contrast (between 3.0:1 and 4.49:1).                              |
| **-3.0 pts** | Inconsistent card padding (e.g. 12px on one panel, 16px on an adjacent panel).                    |
| **-3.0 pts** | Missing quick-filter chips for high-frequency clinical workflows.                                 |
| **-4.0 pts** | Choppy CSS transition ($>250\text{ms}$ duration or visible coordinate stutter).                   |
| **-5.0 pts** | Mobile layout crowding at 820px or 390px requiring internal horizontal scroll on non-table cards. |
| **-5.0 pts** | Missing decline history breakdown on a queued referral inspection panel.                          |
| **-5.0 pts** | Text contrast between 4.0:1 and 4.49:1 on secondary/muted metadata.                               |

---

## 7. Gemini-Native Automated Inspection Script

Gemini executes this automated headless probe in `chrome-devtools-mcp` via `evaluate_script` to calculate the mathematical score deterministically:

```javascript
(function evaluateSovereignMockup() {
  const results = {
    fatalFlaws: [],
    visualDeductions: 0,
    clinicalDeductions: 0,
    metrics: {},
  };

  // FF1: Text Clipping Probe
  const clippedElements = Array.from(document.querySelectorAll("*")).filter((el) => {
    return (
      el.scrollWidth > el.clientWidth &&
      getComputedStyle(el).overflow === "hidden" &&
      getComputedStyle(el).textOverflow !== "ellipsis" &&
      el.children.length === 0
    );
  });
  if (clippedElements.length > 0)
    results.fatalFlaws.push(`FF1: Text clipping detected in ${clippedElements.length} elements`);

  // FF4: Horizontal Overflow Probe
  if (document.documentElement.scrollWidth > window.innerWidth) {
    results.fatalFlaws.push(
      `FF4: Horizontal scrollbar detected (doc: ${document.documentElement.scrollWidth}px > win: ${window.innerWidth}px)`,
    );
  }

  // FF3: WCAG 2.1 AA Contrast Probing
  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function parseRgb(rgbStr) {
    const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [255, 255, 255];
  }

  const textNodes = Array.from(
    document.querySelectorAll("p, span, h1, h2, h3, h4, th, td, button, a, label, strong"),
  ).filter((el) => el.innerText && el.innerText.trim().length > 0 && el.children.length === 0);

  let contrastFailures = 0;
  textNodes.forEach((el) => {
    const style = getComputedStyle(el);
    let parent = el.parentElement;
    let bg = style.backgroundColor;
    while (parent && (bg === "transparent" || bg === "rgba(0, 0, 0, 0)")) {
      bg = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    const [fr, fg, fb] = parseRgb(style.color);
    const [br, bg_, bb] = parseRgb(bg);
    const l1 = getLuminance(fr, fg, fb);
    const l2 = getLuminance(br, bg_, bb);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) contrastFailures++;
  });
  if (contrastFailures > 0) results.fatalFlaws.push(`FF3: ${contrastFailures} contrast ratio violations (< 4.5:1)`);

  // Tabular Numbers Check
  const numbersWithoutTabular = Array.from(document.querySelectorAll(".stat, .time, .badge, [data-tabular]")).filter(
    (el) => {
      return getComputedStyle(el).fontVariantNumeric !== "tabular-nums";
    },
  );
  if (numbersWithoutTabular.length > 0) results.visualDeductions += numbersWithoutTabular.length * 1.0;

  results.metrics = {
    clippedCount: clippedElements.length,
    contrastFailures,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    visualScore: results.fatalFlaws.length > 0 ? 0 : Math.max(0, 100 - results.visualDeductions),
    clinicalScore: results.fatalFlaws.length > 0 ? 0 : Math.max(0, 100 - results.clinicalDeductions),
  };

  return results;
})();
```

---

## 8. Master Scorecard Output Template

Every mockup inspection must produce this standardized evaluation block:

> 🔴 **THIS TEMPLATE SHIPPED WITH ALL FOURTEEN BOXES TICKED AND "0 Violations (ALL CLEAR)"
> ALREADY WRITTEN IN, corrected 2026-09-20.** Every other field in it is a blank to fill —
> `[SHA256_HASH]`, `[YYYY-MM-DD]`, `____ / 25` — so the ticks were not a recorded result, they were a
> default. A scorer copying it inherited fourteen passes nobody measured, and the one line a reader
> checks first said ALL CLEAR before the screen had been opened. **A pre-flight audit that starts at
> PASS can only ever be downgraded by someone who happens to look**, which is the opposite of a gate.

```markdown
# Sovereign Dual-Authority Scorecard

**Screen Name**: [e.g. Ward Flow Patient Search Console]  
**Mockup URL**: `http://127.0.0.1:60178/[mockup].html`  
**Drawing SHA-256**: `[SHA256_HASH]`  
**Evaluator**: Sovereign Lead UI/UX Engineer (Gemini Native)  
**Date**: [YYYY-MM-DD]

---

### 1. Fatal Flaws Pre-Flight Audit (14 Invariants)

- [ ] FF1: Text Truncation / Glyph Clip: ____
- [ ] FF2: Unmapped Hardcoded Hex/RGB: ____
- [ ] FF3: Contrast Ratio < 4.5:1: ____
- [ ] FF4: Horizontal Page Overflow: ____
- [ ] FF5: Magic Number Math: ____
- [ ] FF6: Component Downgrading: ____
- [ ] FF7: Keyboard Trap & Escape Handling: ____
- [ ] FF8: Missing Synthetic Disclosure: ____
- [ ] CF1: Absence Rendered as Measurement: ____
- [ ] CF2: Category / Population Error: ____
- [ ] CF3: Statutory Timeline Distortion: ____
- [ ] CF4: Unsanctioned Clinical Scoring: ____
- [ ] CF5: False Destination Equivalence: ____
- [ ] CF6: Silent Data / Refusal Omission: ____
      **Fatal Flaws Status**: **\____ Violations**

---

### 2. Engine 1: Sovereign Visual Design Rubric (100 Points)

- **V1: Visual Polish & Elevation (Max 25)**: ____ / 25
- **V2: Micro-Typography & Tabular Math (Max 25)**: ____ / 25
- **V3: Spatial Density & Responsiveness (Max 25)**: ____ / 25
- **V4: Micro-Interactions & State Motion (Max 15)**: ____ / 15
- **V5: Accessibility, Contrast & Focus (Max 10)**: ____ / 10
  **ENGINE 1 SCORE**: **\____ / 100** (Normalized: ____ / 10.0)

---

### 3. Engine 2: Clinical UX & Operational Logic Rubric (100 Points)

- **L1: Statutory Legal Fidelity & Governance (Max 25)**: ____ / 25  
  ⚠️ Score L1 on the four criteria in its annotation, **not** on the original four lines.
- **L2: Caseload Taxonomy & Three Populations (Max 25)**: ____ / 25
- **L3: Search Triage & Facet Ergonomics (Max 20)**: ____ / 20
- **L4: Transparency, Refusals & Audit Trails (Max 15)**: ____ / 15
- **L5: Actionability & Clinical Handoff (Max 15)**: ____ / 15
  **ENGINE 2 SCORE**: **\____ / 100** (Normalized: ____ / 10.0)

---

### 4. Certification Verdict

- **Combined Score**: **\____ / 200**
- **Certification Threshold**: $\ge 95 / 100$ on BOTH engines with 0 Fatal Flaws
- **Verdict**: **[SOVEREIGN CERTIFIED FOR PRODUCTION / REJECTED FOR ITERATION]**
```
