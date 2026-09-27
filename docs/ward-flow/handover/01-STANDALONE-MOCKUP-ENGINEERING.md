# 01 — Standalone Mockup Engineering & Design System Architecture

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## Phase 1 Standard Operating Procedure

**Target Audience**: Frontend Engineers, Clinical UX Architects, Design System Engineers  
**Prerequisites**: Modern Web Standards (HTML5, CSS Custom Properties, CSS Container Queries, ES6+)  
**Parent Document**: [`README.md`](README.md)

---

## 1. The Standalone Prototyping Philosophy

In traditional feature development, designers sketch in Figma and hand off static exports to developers, who then struggle with Next.js compilation, routing layers, and complex data dependencies. This creates a severe lag in visual iteration.

**The Sovereign Solution**:
Every new screen or major redesign begins as a **zero-dependency, single-file HTML/CSS document** stored under `docs/ward-flow/mockups/` (e.g. `movement-third-edition.html`).

### Why Standalone Prototypes Win:

1. **Zero-Lag Visual Iteration**: Edit CSS and refresh in 50ms without waiting for Webpack or Turbopack rebuilds.
2. **Subpixel Precision**: Directly manipulate box models, 1px alpha-borders, subgrid alignments, and cubic-bezier transitions in raw CSS.
3. **No Environmental Interference**: Strips away API latency, auth tokens, React render cascades, and state hydrations to focus 100% on spatial density, typography, and accessibility.
4. **Permanent Visual Baseline**: The HTML file serves as an immutable, checkable artifact whose SHA hash is recorded to detect design drift over time.

---

## 2. Serving Requirement: The `file://` Prohibition

> 🔴 **CRITICAL RULE**: Never view or test mockups by double-clicking or opening `file:///path/to/mockup.html`. Mockups must ALWAYS be served via a local HTTP daemon.

### Why `file://` Destroys Verification:

- **CORS & Font Metric Collisions**: Modern web fonts (`Geist`, `Geist Mono`, `Inter`) fail to load under `file://` in Chromium due to local security origins, falling back to system serif/sans fonts that distort bounding box widths by 15-25%.
- **CSS Variable Evaluation Glitches**: Certain Chromium engine versions miscalculate CSS container query dimensions (`cqw`, `cqh`) when running without an HTTP origin.
- **JavaScript Dynamic Chrome**: Many mockups build their navigation rail, sidebar links, or header controls dynamically via vanilla JavaScript. Under `file://`, relative path resolution breaks, causing panels to render out of order or chrome to vanish completely. A false "does not match mockup" bug was historically reported in this repository from exactly this mistake.

### Approved Serving Commands:

```powershell
# Option A: Python 3 built-in server (recommended)
python -m http.server 60178 --directory "D:\Worktrees\Database\ward-lead\docs\ward-flow\mockups"

# Option B: Node.js http-server
npx http-server "D:\Worktrees\Database\ward-lead\docs\ward-flow\mockups" -p 60178 -c-1

# Option C: Bun static server
bun x serve "D:\Worktrees\Database\ward-lead\docs\ward-flow\mockups" -p 60178
```

Access in your browser or DevTools at: `http://127.0.0.1:60178/[mockup-filename].html`.

---

## 3. The Complete Design Token Hierarchy

Every element must resolve to a semantic CSS custom property. Hardcoding raw `#hex` or `rgb()` colors inside component classes is an **immediate Fatal Flaw (FF2)**.

### Master CSS Token Sheet (`:root` and `[data-theme="light"]`)

```css
/* ==========================================================================
   SOVEREIGN DESIGN SYSTEM TOKENS — DARK & LIGHT THEMES
   ========================================================================== */

:root {
  /* Surface & Background Hierarchy */
  --bg: #090d12; /* Primary viewport background */
  --surface: #0f1620; /* Card, panel, and table canvas */
  --surface-raised: #151f2d; /* Header, active row, elevated panel */
  --surface-overlay: rgba(21, 31, 45, 0.88); /* Drawer & modal backdrops */
  --surface-sunken: #06090d; /* Track wells, code blocks, sunken areas */

  /* Hairline Borders (1px Alpha-Layered for Subpixel Contrast) */
  --border-subtle: rgba(255, 255, 255, 0.07); /* Inner dividers, grid lines */
  --border-medium: rgba(255, 255, 255, 0.14); /* Card borders, panel frames */
  --border-prominent: rgba(255, 255, 255, 0.24); /* Active cards, focus outlines */

  /* Text & Typography Scales */
  --text-primary: #f0f4f8; /* High-contrast headings and clinical IDs */
  --text-secondary: #94a3b8; /* Subtitles, labels, secondary metadata */
  --text-muted: #64748b; /* Timestamps, empty state captions */

  /* Brand & Status Accents (Strictly Calibrated for >= 4.5:1 WCAG AA) */
  --accent: #2563eb; /* Primary interactive action */
  --accent-soft: rgba(37, 99, 235, 0.16);
  --on-accent: #ffffff;

  /* Clinical Event Tokens — Dark Theme Calibrations */
  --admit-bg: #7ea3bf; /* Admission / Intake event bar */
  --admit-text: #08131a; /* 7.04:1 contrast ratio */
  --transit-bg: #9381b0; /* Inter-hospital transit */
  --transit-text: #120d1e; /* 5.45:1 contrast ratio */
  --leave-bg: #282319; /* MHA 2014 statutory leave (AWOL risk) */
  --leave-border: #7c6833;
  --leave-text: #ffd885; /* 11.46:1 contrast ratio */
  --discharge-bg: #4e9b7a; /* Confirmed clinical discharge */
  --discharge-text: #0b1510; /* 5.57:1 contrast ratio */
  --delay-bg: #b54938; /* Discharge delay / bed block */
  --delay-text: #ffffff; /* 5.28:1 contrast ratio */
  --predicted-bg: #282319; /* Speculative / Predicted departure */
  --predicted-border: #6d5b2c;
  --predicted-text: #fedb88; /* 11.68:1 contrast ratio */

  /* Typography Stacks */
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", Menlo, Consolas, monospace;

  /* Spacing Primitives */
  --space-xxs: 2px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-xxl: 32px;

  /* Elevations & Box Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
  --shadow-drawer: -8px 0 32px rgba(0, 0, 0, 0.75);
}

[data-theme="light"] {
  /* Surface & Background Hierarchy */
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-raised: #f1f5f9;
  --surface-overlay: rgba(255, 255, 255, 0.92);
  --surface-sunken: #e2e8f0;

  /* Hairline Borders */
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-medium: rgba(0, 0, 0, 0.12);
  --border-prominent: rgba(0, 0, 0, 0.22);

  /* Text & Typography Scales */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* Brand Accents */
  --accent: #1d4ed8;
  --accent-soft: rgba(29, 78, 216, 0.12);
  --on-accent: #ffffff;

  /* Clinical Event Tokens — Light Theme Calibrations (>= 4.5:1 AA) */
  --admit-bg: #e0f2fe;
  --admit-text: #03456b; /* 6.82:1 contrast ratio */
  --transit-bg: #f3e8ff;
  --transit-text: #581c87; /* 7.15:1 contrast ratio */
  --leave-bg: #fef9c3;
  --leave-border: #eab308;
  --leave-text: #713f12; /* 7.84:1 contrast ratio */
  --discharge-bg: #dcfce7;
  --discharge-text: #14532d; /* 7.02:1 contrast ratio */
  --delay-bg: #fee2e2;
  --delay-text: #991b1b; /* 7.42:1 contrast ratio */
  --predicted-bg: #fef3c7;
  --predicted-border: #f59e0b;
  --predicted-text: #78350f; /* 8.11:1 contrast ratio */

  /* Elevations */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.14);
  --shadow-drawer: -8px 0 32px rgba(0, 0, 0, 0.18);
}
```

---

## 4. Spatial Density Engineering: The 34px/20px Gantt Standard

In high-acuity healthcare environments, operators need maximum data density without visual claustrophobia. The standard layout dimensions for timelines and tabular charts are strictly specified:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ LANE CONTAINER: 34px Total Height                                           │
 │                                                                             │
 │  ▲ 7px margin-top                                                           │
 │  ▼                                                                          │
 │ ┌─────────────────────────────────────────────────────────────────────────┐ │
 │ │ EVENT BAR: 20px Height (Border-radius: 4px)                             │ │
 │ │ [ID] [Patient Name] [Clinical Status Badge]                             │ │
 │ └─────────────────────────────────────────────────────────────────────────┘ │
 │  ▲ 7px margin-bottom                                                        │
 │  ▼                                                                          │
 └─────────────────────────────────────────────────────────────────────────────┘
```

### Layout Math Rules:

1. **Total Lane Height**: Exactly `34px`.
2. **Event Bar Height**: Exactly `20px`.
3. **Vertical Margin**: `7px` top and bottom (`margin: 7px 0;` or flexbox centered).
4. **Border Radius**: `4px` on event bars; `6px` on inner cards; `8px` on outer panels.
5. **Horizontal Hairlines**: 1px subtle divider between lanes (`border-bottom: 1px solid var(--border-subtle)`).
6. **Subpixel Fractional Widths**:
   Always compute bar offsets as relative percentages of the timeline track:
   ```css
   left: calc(var(--offset-hours) / var(--total-zoom-hours) * 100%);
   width: calc(var(--duration-hours) / var(--total-zoom-hours) * 100%);
   ```
   _Never_ use hardcoded pixel widths (`width: 142px`) for timeline events.

---

## 5. Micro-Typography & Tabular Numerals

When counters, durations, timestamps, or percentages update dynamically, standard proportional fonts shift element widths, causing jarring layout reflows (Layout Jitter).

### Typography Rules:

1. **Monospace Tabular Numerals**: Every number, date, clock time, duration, bed identifier, and percentage must declare:
   ```css
   font-family: var(--font-mono);
   font-variant-numeric: tabular-nums;
   ```
2. **Letter-Spacing Standards**:
   - Primary Headings (`h1`, `h2`): `letter-spacing: -0.015em` (tight, authoritative).
   - Body & Clinical Data (`p`, `span`): `letter-spacing: normal`.
   - Small Caps, Status Pills, and Badges: `text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: +0.035em`.
3. **Contrast Floor**: Never drop below 12px for readable text (11px is permitted only for uppercase status badges with bold weight).

---

## 6. The Adaptive Event Label System (Zero-Clipping Contract)

Event durations vary from 30 minutes to 48 hours. A single static label template causes severe text clipping on short events. All event bars must implement the **Adaptive Typography Tri-Tier Rule**:

```
 ┌───────────────────────────────────────┐
 │ Duration Fraction │ Display Format    │ Example                             │
 ├───────────────────┼───────────────────┼─────────────────────────────────────┤
 │ Width < 16%       │ ID-Only           │ "MRN-4012"                          │
 │ 16% <= Width < 32%│ ID + Status Badge │ "MRN-4012 · ADMIT"                  │
 │ Width >= 32%      │ Full Title & Name │ "MRN-4012 · C. Higgins (FSH W4A)"   │
 └───────────────────┴───────────────────┴─────────────────────────────────────┘
```

In CSS / HTML, this is implemented using container queries or CSS utility classes:

```css
.eventBar.mode-id .eventExtra,
.eventBar.mode-id .eventStatus {
  display: none;
}

.eventBar.mode-compact .eventExtra {
  display: none;
}

.eventBar.mode-compact .eventStatus {
  display: inline-block;
}

.eventBar.mode-full .eventExtra,
.eventBar.mode-full .eventStatus {
  display: inline-block;
}
```

---

## 7. The Mandatory Disclosure Footer

Every clinical mockup must terminate with the sovereign disclosure footer. This is a clinical safety requirement ensuring that viewers, testers, and reviewers are never misled by synthetic data:

```html
<footer class="disclosureFooter" role="contentinfo">
  <div class="disclosureInner">
    <span class="disclosureBadge">PROTOTYPE</span>
    <span class="disclosureText">Synthetic Clinical Demonstration — WA Mental Health Act 2014 Topology</span>
    <span class="disclosureDot">•</span>
    <span class="disclosureText">All patient names, URMs, and encounter identifiers are algorithmically generated</span>
  </div>
</footer>
```

```css
.disclosureFooter {
  margin-top: var(--space-xxl);
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-sunken);
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
}

.disclosureInner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.disclosureBadge {
  background: var(--border-medium);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.disclosureDot {
  color: var(--border-prominent);
}
```

---

## 8. Standalone Prototype Checklist

Before declaring a standalone mockup complete and ready for scoring:

- [ ] File is saved in `docs/ward-flow/mockups/[name].html`.
- [ ] Served via HTTP daemon on port `60178` (never opened via `file://`).
- [ ] Contains all tokens for both `:root` (dark) and `[data-theme="light"]`.
- [ ] Zero raw hex/rgb colors outside `:root` and `[data-theme="light"]`.
- [ ] All timestamps and counts use `--font-mono` with `tabular-nums`.
- [ ] Timeline lanes adhere to the 34px lane / 20px event bar standard.
- [ ] Adaptive typography tiers are applied to dynamic event bars.
- [ ] The disclosure footer is present and prominently displayed.
- [ ] Theme switcher toggle is implemented and tested.
