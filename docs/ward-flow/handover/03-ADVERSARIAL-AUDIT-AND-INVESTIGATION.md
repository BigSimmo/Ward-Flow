# 03 — Adversarial Review & Multi-Agent Investigation Runbook

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## Phase 3 Standard Operating Procedure

**Target Audience**: Quality Assurance Architects, Lead Engineers, Autonomous Multi-Agent Systems  
**Prerequisites**: Chrome DevTools MCP Tooling, Subagent Orchestration, Automated Scripting  
**Parent Document**: [`README.md`](README.md)

---

## 1. The Adversarial Audit Philosophy & Gemini-Native Execution

Human designers and original authors suffer from **confirmation bias**: they know how the UI is _supposed_ to work, so they subconsciously test only the "happy path" at their own monitor's resolution, with clean synthetic data, and without keyboard edge cases.

To achieve pristine sovereign quality, **the mockup must be aggressively attacked through two rigorous adversarial perspectives** before any code is written for production:

1. **LENS 1: Adversarial UI/UX & Responsive Auditor** (Viewport stress, text clipping, focus traps, contrast).
2. **LENS 2: Design Systems & Clinical Logic Investigator** (Token purity, statutory MHA 2014 forms, caseload separation, zero data states).

### The Gemini-Native Direct Execution Advantage

While these two lenses can conceptually be delegated to separate subagents, **spawning distributed background subagents introduces context fragmentation, serialization latency, and server-restart fragility**.

Under the **Gemini-Native Standard**, the primary Gemini agent executes both adversarial lenses **directly and synchronously**:

- Direct headless browser commands via `chrome-devtools-mcp` (`resize_page`, `emulate`, `evaluate_script`, `list_console_messages`).
- Automated programmatic probes run in milliseconds without spawning detached threads.
- Consolidated defect ledger generated in-context with immediate fix and re-verify loops.

```
                              ┌─────────────────────────────┐
                              │   STANDALONE MOCKUP READY   │
                              │   (Self-Scored >= 9.5)      │
                              └──────────────┬──────────────┘
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
      ┌───────────────────────────────┐             ┌───────────────────────────────┐
      │            LENS 1             │             │            LENS 2             │
      │   Adversarial UI/UX Auditor   │             │   Design Systems & Clinical   │
      │   (Gemini Headless Probes)    │             │         Investigator          │
      └───────────────┬───────────────┘             └───────────────┬───────────────┘
                      │                                             │
                      │ • Viewport Stress (390px-1440px)            │ • Token Purity & Magic Numbers
                      │ • Extreme Data Injections                   │ • Platform Modernity (@container)
                      │ • Keyboard Trap & Esc Leaks                 │ • WA Mental Health Act Forms
                      │ • Automated Contrast Probes                 │ • DOM Render Efficiency at Scale
                      │                                             │
                      └───────────────────────┬─────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────┐
                              │  CONSOLIDATED DEFECT LEDGER   │
                              │  - Severity: Fatal / Deduct   │
                              │  - Exact DOM Selectors & CSS  │
                              └───────────────┬───────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────┐
                              │     REMEDIATION & RE-SCORE    │
                              │   (Iterate until 0 defects)   │
                              └───────────────────────────────┘
```

---

## 2. Subagent 1: Adversarial UI/UX Auditor

### Mission Profile:

The Adversarial Auditor acts as a hostile user attempting to break layouts, leak keyboard focus, induce horizontal scrollbars, and identify unreadable color combinations.

### Execution Tooling:

- **Chrome DevTools MCP**: `resize_page`, `evaluate_script`, `take_screenshot`, `list_console_messages`, `press_key`.

### Master Invocation Prompt (Copy-Paste Ready):

```markdown
You are an elite Adversarial UI/UX Auditor. Your mission is to ruthlessly attack the standalone mockup:
URL: http://127.0.0.1:60178/[MOCKUP_FILE].html
File: [ABSOLUTE_PATH_TO_MOCKUP]

Audit the page against the 100-Point Design Scoring Rubric and the 8 Fatal Flaws. Specifically execute these 5 attack vectors:

1. VIEWPORT STRESS-TESTING:
   - Call `resize_page` to width 1440, height 900 (Desktop Baseline).
   - Call `resize_page` to width 1024, height 768 (Small Desktop / Laptop).
   - Call `resize_page` to width 820, height 1180 (Tablet Portrait).
   - Call `resize_page` to width 390, height 844 (Mobile Phone).
   - At each size, execute script: `document.documentElement.scrollWidth > window.innerWidth`.
   - Report any horizontal page-level overflow or card collisions.

2. TEXT CLIPPING & OVERLAP COLLISION:
   - Execute script in DevTools to find any element where `scrollWidth > clientWidth` with `overflow: hidden`.
   - Inspect event bars: Do event titles collide with adjacent event bars or end-caps?
   - Test extreme data: Injected patient name with 45 characters; event duration of 0.5 hours.

3. KEYBOARD TRAP & ESCAPE KEY RIGOR:
   - Click to open the detail drawer or any modal dialog.
   - Send key press "Tab" 15 times. Does focus stay inside the drawer, or does it leak to the background?
   - Send key press "Escape". Does the drawer close immediately? Does focus return to the trigger button?

4. WCAG 2.1 AA COLOR CONTRAST PROBING:
   - Toggle theme between Dark and Light.
   - For every event swatch, badge, and muted label, calculate exact relative luminance contrast against its direct parent background.
   - Flag any combination below 4.5:1 (normal text) or 3.0:1 (large text/icons).

5. RUBRIC SCORING:
   - Score the screen against the 100-Point Rubric. Report any Fatal Flaws immediately.
   - Provide exact CSS selectors and line numbers for all defects.
```

---

## 3. Subagent 2: Design Systems & Clinical Investigator

### Mission Profile:

The Design Systems Investigator acts as the guardian of architectural purity, design token discipline, and clinical statutory compliance.

### Master Invocation Prompt (Copy-Paste Ready):

```markdown
You are a Principal Design Systems Architect and Clinical UX Specialist. Your mission is to deeply investigate:
URL: http://127.0.0.1:60178/[MOCKUP_FILE].html
File: [ABSOLUTE_PATH_TO_MOCKUP]

Investigate and report on these 4 architectural vectors:

1. DESIGN TOKEN DISCIPLINE & ZERO-MAGIC-NUMBERS:
   - Scan the entire `<style>` block. Are there any hardcoded hex (`#...`) or rgb colors outside `:root` or `[data-theme="light"]`?
   - Are there any magic pixel positioning coordinates (e.g. `left: 37px`, `margin-top: 14px`) rather than derived ratios or token variables?
   - Are all borders 1px alpha-layered hairlines?

2. MODERN WEB PLATFORM ADOPTION:
   - Could the timeline or grid benefit from CSS Container Queries (`@container`)?
   - Is CSS Grid Subgrid used where multi-column baselines align?
   - Are dynamic viewport units (`dvh`) used instead of `vh` to prevent mobile address bar jumping?

3. CLINICAL WORKFLOW & STATUTORY FIDELITY:
   - Does the screen accurately reflect the Western Australia Mental Health Act 2014 statutory forms (Form 1A referral, Form 4A transport order, Form 5A involuntary inpatient)?
   - Are transport escorts (WA Police, RFDS, Mental Health Transport Service) correctly categorized?
   - Does the screen clearly distinguish confirmed movements from speculative/predicted departures?

4. DOM SCALABILITY & PERFORMANCE:
   - How does the DOM scale if 50 movements or 15 wards are displayed?
   - Are tabular numerals (`tabular-nums`) enforced on all counters and timestamps to eliminate layout jitter?
```

---

## 4. The 5 Adversarial Attack Vectors (Execution Scripts)

Below are the exact JavaScript snippets to evaluate inside the headless browser via `evaluate_script`:

### Attack Vector 1: Detecting Horizontal Viewport Spill

```javascript
(() => {
  const docWidth = document.documentElement.scrollWidth;
  const winWidth = window.innerWidth;
  const spilledElements = [];

  if (docWidth > winWidth) {
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > winWidth) {
        spilledElements.push({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          right: rect.right,
          overflowAmount: rect.right - winWidth,
        });
      }
    });
  }

  return {
    hasSpill: docWidth > winWidth,
    docWidth,
    winWidth,
    spilledCount: spilledElements.length,
    spilledElements: spilledElements.slice(0, 5),
  };
})();
```

### Attack Vector 2: Detecting Unintended Text Truncation & Clipping

```javascript
(() => {
  const clipped = [];
  document.querySelectorAll("*").forEach((el) => {
    // Check if element has text content directly
    if (el.children.length === 0 && el.textContent.trim().length > 0) {
      const style = window.getComputedStyle(el);
      const isClipped = el.scrollWidth > el.clientWidth;
      const hasEllipsis = style.textOverflow === "ellipsis";
      const isHidden = style.overflow === "hidden" || style.overflowX === "hidden";

      if (isClipped && isHidden && !hasEllipsis) {
        clipped.push({
          selector: el.tagName + (el.className ? "." + el.className.split(" ").join(".") : ""),
          text: el.textContent.trim().substring(0, 30),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          gapPx: el.scrollWidth - el.clientWidth,
        });
      }
    }
  });
  return { count: clipped.length, clippedItems: clipped };
})();
```

### Attack Vector 3: Automated In-Browser WCAG Contrast Probing

```javascript
(() => {
  function getLuminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function parseRGB(str) {
    const match = str.match(/\d+/g);
    return match ? match.slice(0, 3).map(Number) : [0, 0, 0];
  }

  const failures = [];
  document.querySelectorAll("span, p, h1, h2, h3, button, a").forEach((el) => {
    const style = window.getComputedStyle(el);
    const fg = parseRGB(style.color);
    let parent = el.parentElement;
    let bgStr = style.backgroundColor;

    while (parent && (bgStr === "rgba(0, 0, 0, 0)" || bgStr === "transparent")) {
      bgStr = window.getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }

    const bg = parseRGB(bgStr);
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const fontSize = parseFloat(style.fontSize);
    const isBold = parseInt(style.fontWeight, 10) >= 700;
    const minRatio = fontSize >= 18 || (fontSize >= 14 && isBold) ? 3.0 : 4.5;

    if (ratio < minRatio && el.textContent.trim().length > 0) {
      failures.push({
        text: el.textContent.trim().substring(0, 25),
        ratio: ratio.toFixed(2),
        required: minRatio,
        fg: style.color,
        bg: bgStr,
        element: el.tagName + "." + el.className,
      });
    }
  });

  return { failureCount: failures.length, failures: failures.slice(0, 10) };
})();
```

---

## 5. The 3-Pass Iteration & Freeze Rule

Never iterate indefinitely. Follow the **3-Pass Convergence Rule**:

1. **Pass 1 (Conception & Self-Score)**: The designer/engineer crafts the mockup and self-scores >= 9.5.
2. **Pass 2 (The Adversarial Attack)**: Both subagents run the 5 attack vectors and return defect ledgers. The engineer fixes 100% of reported issues.
3. **Pass 3 (Verification & Freeze)**: Re-run both subagents. If score >= 9.5 and Fatal Flaws = 0, **the mockup design is frozen**. The file's SHA-256 hash is computed and recorded. No visual changes may occur during React implementation unless re-scoring is triggered.
