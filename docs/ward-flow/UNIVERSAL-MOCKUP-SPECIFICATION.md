# Ward Flow — Universal Mockup Specification & Visual QA Protocol

> **HISTORICAL MOCKUP SPECIFICATION — current application authority clarified 2 October 2026.**
> Preserve the current accepted Ward Flow app. This document does not commission a redesign or
> reinstate old card, stripe, typography, scroll-mask, header or six-view requirements. Follow
> [the entry point](README.md), [the active screen checklist](SCREEN-DEFINITION-OF-DONE.md) and the
> selected repository gates. Copy/punctuation prescriptions here do not govern typed narrative or
> ordinary documentation. Keep status understandable, measured zeros numeric and absence truthful.

> **DESIGN AUTHORITY:** The authoritative token dictionary and rules standard is [`docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`](mockups/WARD-FLOW-DESIGN-SYSTEM.md) (Third Edition). Where tokens or palette hex codes below conflict, the Third Edition standard governs.
> **Owner Ruling (9 September 2026):** Coloured bars along edges of rows, cards, or candidates and top highlights on panels are strictly banned. Radii follow `--r1` (10px panel) and `--r2` (6px controls).

This document is a reference specification for building, styling, and verifying mockups across the Ward Flow suite.

---

## 1. The 8 Sovereign Design Commandments

Every screen must strictly enforce these 8 visual and operational laws:

1. **State is a Word First (Zero Color-Only Reliance)**:
   - Every status (e.g. _Breached, Escalated, Pending, Discharged, Stable_) MUST display the literal word on screen.
   - Color tints, borders, and dot indicators only ever repeat what is already stated in text. A reader with complete color blindness or a black-and-white printout must lose zero clinical or operational information (WCAG 2.1 AA).
2. **Tabular Numerals & Zero as "none"**:
   - All quantities, counts, percentages, timestamps, durations, and metrics must use `font-family: var(--mono)` with `font-variant-numeric: tabular-nums`.
   - A measured zero remains numeric `0`. A count of absent work may use `none`; unknown or unrecorded measurements must say `Not recorded`, rather than being converted to zero or `none`.
3. **Absence is Stated, Never Blank**:
   - Never render empty table cells, blank panels, or empty lists. Always use explicit absence statements: `"No movements waiting"`, `"Not tracked at this facility"`, `"No destination confirmed"`.
4. **Strict 7-Step Typographic Floor & Tracking**:
   - Never set any text below `12px` (`var(--t-0)`).
   - Uppercase labels/eyebrows must use `letter-spacing: 0.08em` to `0.12em` with `text-transform: uppercase` and `font-weight: 600`.
   - Headings use slight negative tracking (`letter-spacing: -0.02em`).
   - Titles use the display token at weight `600`. Only loaded weights are allowed: `Geist` (400, 500, 600, 700) and `Geist Mono` (400, 500, 600).
5. **Single Elevation Step with Fall of Light**:
   - Panels are lifted off the ground canvas using **one single elevation step**: an alpha hairline border (`var(--line)`), a subtle bottom edge weight, and one long, low, slate-tinted shadow (`var(--lift)`).
   - **Nothing inside a panel is elevated again** (no nested cards with drop shadows).
   - Light falls from the top: the window canvas is slightly lighter at the top than the bottom. A fixed 3px deep slate brand stripe (`var(--stripe)`) runs across the top window edge (`body::before`).
6. **Inward-Stepped Radii Scale**:
   - Corner radiuses step inwards strictly:
     - Outer Panels: `10px` (`var(--r3)`)
     - Inner header/footer strips: `9px`
     - Interactive controls, buttons, and inputs: `6px` (`var(--r2)`)
     - Status badges and metadata tags: `9999px` (Pill chip)
7. **Edge-Fading Scroll Masks**:
   - Any vertically scrolling container (queue list, drawer body, table) must apply CSS mask gradients (`--fade-top`, `--fade-bottom`) so overflowing text fades gently into the edge rather than abruptly clipping.
8. **Synthetic Prototype Provenance Disclaimer**:
   - The historical header uses the synthetic badge: `<span class="chip mark"><span class="long">Synthetic </span>prototype</span>`. A disclosure identifies invented content; a badge does not establish regulatory status. Preserve the current app's disclosure presentation.

---

## 2. The 8 Fatal Flaws (Automatic Rejection Criteria)

Any mockup exhibiting one or more of these flaws fails visual verification immediately:

| Flaw Code | Description             | Failure Indicator                                                    | Required Prevention                                                                                           |
| :-------- | :---------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **FF1**   | Text/Layout Overflow    | Horizontal scrollbar on viewport (`scrollWidth > innerWidth`)        | `min-width: 0` on flex/grid child items; single-column collapse at `<=1000px`.                                |
| **FF2**   | Token Drift / Raw Hex   | Hardcoded hex codes (`#2f4c66`, `#ff8b76`) in styles or SVGs         | 100% token usage via `var(--...)` or `currentColor`.                                                          |
| **FF3**   | Color-Only State        | Bare colored dot, pill, or border without an explicit text label     | Add unambiguous status word adjacent to the color indicator.                                                  |
| **FF4**   | Missing Meta / Encoding | Mojibake characters (`Â·`, `â€“`) or unscaled mobile viewport        | Explicit `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width, initial-scale=1">`. |
| **FF5**   | Inaccessible / Inert UI | Button without `type="button"`, unlabeled icons, non-keyboard drawer | Explicit `aria-label`, `type="button"`, `/` search focus, `[` rail toggle, `Esc` dismiss.                     |
| **FF6**   | Unstated Absence        | Blank table cell (`<td></td>`) or empty unstated panel               | Render explicit text: `"none"`, `"Not tracked"`, `"No movements"`.                                            |
| **FF7**   | Nested Card Elevation   | Cards inside panels having their own drop-shadows                    | One elevation step only: inner elements sit on `--surface-2` or `--sunk` with borders, no shadows.            |
| **FF8**   | Missing Prototype Badge | Absence of synthetic disclaimer in the masthead                      | Include `<span class="chip mark">...</span>` persistently in the top bar.                                     |

---

## 3. Design Tokens (CSS Variables)

All styles must use CSS custom properties. **Never use hardcoded hex values in component styles or SVGs.**

```css
:root {
  color-scheme: light dark;
  --display: "Geist", system-ui, -apple-system, sans-serif;
  --body: "Geist", system-ui, -apple-system, sans-serif;
  --mono: "Geist Mono", ui-monospace, monospace;

  /* Typographic scale (12px floor) */
  --t-0: 12px;
  --t-1: 13px;
  --t-2: 14px;
  --t-3: 15px;
  --t-4: 17px;
  --t-5: 20px;
  --t-6: 24px;

  /* Inward Radii */
  --r1: 4px;
  --r2: 6px;
  --r3: 10px;
  --pill: 9999px;

  /* Universal Shell Geometry */
  --railw: 236px;
  --railw-closed: 84px;
}

/* Light Theme: Platinum Raised Cool */
:root,
:root[data-theme="light"] {
  --ground: #e6eaef;
  --surface: #fdfdfe;
  --surface-2: #f2f5f8;
  --sunk: #e9edf2;
  --ink: #14161a;
  --ink-soft: #384250;
  --muted: #5b6470;
  --accent: #2f4c66;
  --accent-ink: #1e354a;
  --accent-soft: #dfe7f0;
  --on-accent: #ffffff;
  --stripe: #2f4c66;
  --gilt: #7d612a;
  --gilt-soft: #f1ebdf;
  --good: #227550;
  --good-soft: #e2f0e8;
  --warn: #825d10;
  --warn-soft: #f6eeda;
  --danger: #b03b2e;
  --danger-soft: #f8e6e2;
  --danger-ink: #973121;
  --line: rgba(22, 30, 40, 0.11);
  --line-strong: rgba(22, 30, 40, 0.22);
  --lift: 0 4px 20px -2px rgba(32, 44, 58, 0.08), 0 1px 3px rgba(32, 44, 58, 0.04);
  --scrim: rgba(15, 20, 26, 0.45);

  --svc-east: #2f4c66;
  --svc-north: #685a94;
  --svc-south: #356a70;
  --svc-wachs: #8c5a3c;
}

/* Dark Theme: High-Contrast Night Duty */
:root[data-theme="dark"] {
  --ground: #0f1216;
  --surface: #171b21;
  --surface-2: #1f242c;
  --sunk: #13161b;
  --ink: #e8ebef;
  --ink-soft: #b0b8c4;
  --muted: #7e8998;
  --accent: #a7bcd2;
  --accent-ink: #c8d8e8;
  --accent-soft: #232c37;
  --on-accent: #0f1216;
  --stripe: #a7bcd2;
  --gilt: #d3b77e;
  --gilt-soft: #2a2418;
  --good: #6fd39b;
  --good-soft: #172820;
  --warn: #d4a34b;
  --warn-soft: #2b2314;
  --danger: #ff8b76;
  --danger-soft: #321915;
  --danger-ink: #ffb4a6;
  --line: rgba(255, 255, 255, 0.09);
  --line-strong: rgba(255, 255, 255, 0.18);
  --lift: 0 6px 24px -4px rgba(0, 0, 0, 0.45);
  --scrim: rgba(0, 0, 0, 0.7);

  --svc-east: #6b8fae;
  --svc-north: #a596d6;
  --svc-south: #599fa8;
  --svc-wachs: #c98e6b;
}

body::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--stripe);
  z-index: 45;
  pointer-events: none;
}
```

---

## 4. Universal Shell & Responsive Breakpoints

- **Layout Structure**:
  - Desktop (>1400px): `grid-template-columns: var(--railw) minmax(0, 1fr)`.
  - Rail: Sticky left navigation `236px` open, `84px` collapsed (toggled via `[` hotkey).
  - Header: Persistent `44px` bar with search composer (`/` hotkey), service scope filter, activity/tasks/tools drawers, and primary action split button.
- **Responsive Collapse (≤1000px)**:
  - `.app` collapses to single-column (`grid-template-columns: 1fr`).
  - The rail converts to a top horizontal scrolling strip (`position: static; height: auto; flex-direction: row`).
  - Eyebrows, footers, and pinned drawers hide cleanly.
  - Multi-column tables/cards stack into a single column (`grid-template-columns: minmax(0, 1fr)`).
  - Zero horizontal page overflow down to `320px` viewport width.

---

## 5. Anti-Degradation & Structural Integrity Rules

1. **No Panel Substitution**:
   - A data table is NOT a card grid. A card grid is NOT a list.
   - If the design specifies a table, render an accessible `<table>` with `<thead>` and tabular cells.
2. **Tabbed Panels Stay Tabbed**:
   - Never flatten tabbed panels into stacked continuous sections. Implement proper `aria-selected` tab switches.
3. **No Code Truncation**:
   - Never use placeholder comments (`/* add more rows here */` or `<!-- remaining cards -->`). Output the complete, working code with rich realistic datasets (minimum 10-15 rows).
4. **Serve to View**:
   - Mockups build their navigation with JavaScript. They must be viewed via an active local web server (e.g. `http://127.0.0.1:60178/`), never as bare `file://` URLs.

---

## 6. Visual Review & Quality Assurance Protocol

To avoid poorly built designs, every screen must undergo two verification checks:

### 1. Embedded Visual QA Sentinel Script

This historical diagnostic example checks overflow, metadata and inline hex usage only. It is not
a visual, accessibility or clinical acceptance gate and need not be added to the current app.

```html
<script id="qa-sentinel">
  (function () {
    window.addEventListener("load", () => {
      const issues = [];
      // 1. Check for horizontal overflow (FF1)
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        issues.push(
          `Horizontal overflow detected (${document.documentElement.scrollWidth}px > ${window.innerWidth}px)`,
        );
      }
      // 2. Check for missing charset or viewport (FF4)
      if (!document.querySelector("meta[charset]")) issues.push("Missing <meta charset='utf-8'>");
      if (!document.querySelector('meta[name="viewport"]')) issues.push("Missing responsive viewport meta");
      // 3. Check for hardcoded hex colors in inline styles and SVGs (FF2)
      const allEls = document.querySelectorAll("*");
      for (let el of allEls) {
        const style = el.getAttribute("style") || "";
        if (/#[0-9a-fA-F]{3,8}/.test(style)) {
          issues.push(`Raw hex in style on <${el.tagName.toLowerCase()} class="${el.className}">`);
          break;
        }
        if (el.tagName.toLowerCase() === "svg" || el.tagName.toLowerCase() === "path") {
          const fill = el.getAttribute("fill") || "";
          const stroke = el.getAttribute("stroke") || "";
          if (/#[0-9a-fA-F]{3,8}/.test(fill) || /#[0-9a-fA-F]{3,8}/.test(stroke)) {
            issues.push(`Raw hex in SVG <${el.tagName.toLowerCase()}>`);
            break;
          }
        }
      }
      // 4. Render Sovereign Diagnostic Badge
      const badge = document.createElement("div");
      badge.id = "qa-badge";
      badge.style.cssText =
        "position:fixed;bottom:12px;right:12px;padding:6px 10px;font:12px/1.2 var(--mono);background:var(--surface);border:1px solid var(--line-strong);border-radius:4px;box-shadow:var(--lift);z-index:99999;pointer-events:none;display:flex;align-items:center;gap:6px;";
      if (issues.length === 0) {
        badge.innerHTML =
          '<span style="width:7px;height:7px;border-radius:50%;background:var(--good)"></span><span style="color:var(--good);font-weight:600">No issues in the limited structural checks</span>';
      } else {
        badge.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:var(--danger)"></span><span style="color:var(--danger);font-weight:600">QA ISSUES: ${issues.length}</span>`;
        console.warn("Ward Flow QA Sentinel Issues:", issues);
      }
      document.body.appendChild(badge);
    });
  })();
</script>
```

### 2. Post-Build Visual Confirmation Report

The output must conclude with an explicit confirmation table verifying visual checks at **390px, 820px, and 1440px** in both **Light and Dark** themes:

```markdown
### Visual Review & Confirmation Report

| Verification Dimension          | Standard                       | Status               | Evidence                                           |
| :------------------------------ | :----------------------------- | :------------------- | :------------------------------------------------- |
| **Panel Sequence & Types**      | Matches authoritative drawing  | ✅ CONFIRMED         | Panels, tabs, and tables preserve exact hierarchy  |
| **Responsive (390, 820, 1440)** | Zero horizontal overflow       | ✅ CONFIRMED         | Validated against mobile and desktop viewports     |
| **Theme Parity**                | Light & Dark contrast >= 4.5:1 | ✅ CONFIRMED         | All tokens resolve to Platinum / Night Duty scale  |
| **Typographic Floor**           | Minimum 12px; Geist / Mono     | ✅ CONFIRMED         | Uppercase tracked, numbers tabular, zero as "none" |
| **State is a Word**             | No color-only status           | ✅ CONFIRMED         | All statuses carry explicit text labels            |
| **Limited structural checks**   | Diagnostic example only        | Record actual result | Does not prove visual or accessibility acceptance  |
```
