# 04 — React / Next.js / TypeScript Porting & Engineering Bridge

> **SUPERSEDED on 17–21 Sept 2026 by `docs/ward-flow/README.md` and `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`.**
> Kept for historical reference. The "Sovereign" tokens, 100-point numerical scoring rubric, and 4-tier ladder described herein are retired. All visual work follows the 3rd Edition Design System and the September 17 & 21 speed rules in `docs/ward-flow/HOW-WE-WORK.md`.

## Phase 4 Standard Operating Procedure

**Target Audience**: React Engineers, Next.js Architects, TypeScript Developers  
**Prerequisites**: React 19 / Next.js App Router, CSS Modules, TypeScript 5+, Accessibility Standards  
**Parent Document**: [`README.md`](README.md)

---

## 1. The Porting Discipline: Visual Authority vs Engine Authority

When translating a frozen standalone mockup (`.html`) into production React components, engineers frequently make two fatal errors:

1. **Visual Downgrade**: Simplifying CSS Grid into plain HTML tables or dropping tabs to save time. (Violates Visual Authority).
2. **Logic Pollution**: Rewriting clinical state machines or backend schemas to match dummy mockup data. (Violates Engine Authority).

### The Invariant Contract:

- **The Mockup is authoritative on visual layout, CSS classes, typography, and spacing.**
- **The Engine is authoritative on data models, statutory rules, and event permissions.**
- If the mockup shows a 7-lane Gantt chart, production must render a 7-lane Gantt chart. If the engine provides 4 real events and 3 synthetic ones, production renders that real engine state within the mockup's visual container.

---

## 2. Directory & Module File Layout

Every ported screen in `src/components/ward-management/[feature]/` follows this four-tier architecture:

```
src/components/ward-management/[feature]/
├── [feature]-screen.tsx          # Tier A: Screen orchestrator & panel layout
├── [component-name].tsx          # Tier B: Presentation & interactive UI component
├── [component-name].module.css   # Tier C: Scoped CSS module with tokens
└── [feature]-derivations.ts      # Tier D: Pure coordinate math & data derivations
```

### Real-World Example (Movements Horizon):

- Screen Orchestrator: `src/components/ward-management/movements/movements-screen.tsx`
- UI Component: `src/components/ward-management/movements/movement-horizon-gantt.tsx`
- Scoped Styles: `src/components/ward-management/movements/movement-horizon.module.css`
- Pure Math Derivations: `src/components/ward-management/movements/movements-derivations.ts`

---

## 3. Isolating Pure Derivations (`*-derivations.ts`)

> 🔴 **GOLDEN RULE**: Never calculate timeline coordinates, duration percentages, date filters, or sorting logic inside a React component's JSX render function.

All layout math must reside in a standalone, pure TypeScript file (`*-derivations.ts`). This allows:

1. **Deterministic Unit Testing**: Math can be tested against 100 edge cases in 2 milliseconds without mounting DOM.
2. **Zero Render Churn**: Functions can be wrapped in `useMemo` with primitive dependency arrays.
3. **Reusability**: Shared between screen views, export generators, and automated verification scripts.

### Concrete Implementation Pattern:

```typescript
// movements-derivations.ts

export type MovementType = "admit" | "transit" | "leave" | "discharge" | "delay" | "predicted";

export interface HorizonEvent {
  id: string;
  patientId: string;
  patientName: string;
  wardId: string;
  type: MovementType;
  startHour: number; // Hours relative to NOW anchor (-24 to +48)
  durationHours: number; // Duration of event in hours
  statusLabel: string;
  escortRequired?: string;
  formType?: string; // e.g. "Form 4A", "Form 5A"
}

export interface HorizonBarLayout {
  leftPct: number;
  widthPct: number;
  labelMode: "id" | "compact" | "full";
  isPast: boolean;
}

/**
 * Computes exact subpixel positioning and typography tier for a horizon event.
 * Pure mathematical function — zero side-effects.
 */
export function computeHorizonBarLayout(
  event: HorizonEvent,
  zoomHours: number,
  nowOffsetHours: number = 0,
): HorizonBarLayout {
  const effectiveStart = event.startHour - nowOffsetHours;

  // Bounded left percentage [0%, 100%]
  const leftPct = Math.max(0, Math.min(100, (effectiveStart / zoomHours) * 100));

  // Calculate relative width with a 2.5% minimum hit-target floor
  const rawWidthPct = (event.durationHours / zoomHours) * 100;
  const widthPct = Math.max(2.5, Math.min(100 - leftPct, rawWidthPct));

  // Adaptive Typography Contract:
  // Short events (<16% width): Show only MRN / ID
  // Medium events (16% to 32% width): Show ID + Status Badge
  // Wide events (>=32% width): Show Full Name and Ward
  let labelMode: "id" | "compact" | "full" = "full";
  if (widthPct < 16) {
    labelMode = "id";
  } else if (widthPct < 32) {
    labelMode = "compact";
  }

  return {
    leftPct: Number(leftPct.toFixed(3)),
    widthPct: Number(widthPct.toFixed(3)),
    labelMode,
    isPast: event.startHour + event.durationHours < 0,
  };
}
```

---

## 4. CSS Modules Architecture (`*.module.css`)

Never import unscoped global CSS files into components. CSS Modules provide strict encapsulation while supporting native CSS custom properties and modern platform features.

### CSS Module Guidelines:

1. **CamelCase Class Names**: Use `.timelineTrack`, `.eventBar`, `.scrubberThumb` to allow clean TypeScript object access (`styles.timelineTrack`).
2. **Variable Inheritance**: Consume tokens defined in `:root` (`var(--surface)`, `var(--admit-bg)`, `var(--font-mono)`).
3. **No Magic Numbers**: Layout heights and padding must use standard constants (`height: 34px`, `height: 20px`).

```css
/* movement-horizon.module.css */

.horizonContainer {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  overflow: hidden;
}

.timelineHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
}

.laneRow {
  display: grid;
  grid-template-columns: 180px 1fr;
  height: 34px; /* The 34px Lane Standard */
  border-bottom: 1px solid var(--border-subtle);
  align-items: center;
}

.laneTrack {
  position: relative;
  height: 100%;
  background: var(--surface-sunken);
  overflow: hidden;
}

.eventBar {
  position: absolute;
  top: 7px; /* Vertical centering: (34 - 20) / 2 = 7px */
  height: 20px; /* The 20px Event Bar Standard */
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    filter 0.1s ease;
  user-select: none;
}

.eventBar:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
  z-index: 10;
}

/* Event Types Mapped to Semantic Tokens */
.eventBarAdmit {
  background: var(--admit-bg);
  color: var(--admit-text);
}

.eventBarDischarge {
  background: var(--discharge-bg);
  color: var(--discharge-text);
}

.eventBarLeave {
  background: var(--leave-bg);
  border: 1px solid var(--leave-border);
  color: var(--leave-text);
}

.eventBarDelay {
  background: var(--delay-bg);
  color: var(--delay-text);
}
```

---

## 5. Focus Management & Accessible Drawers

When clicking an event opens a detail drawer or modal, accessibility requirements mandate **Focus Trapping, Escape Key Dismissal, and Focus Restoration**.

### Accessible Drawer React Implementation:

```tsx
import React, { useEffect, useRef } from "react";
import styles from "./drawer.module.css";

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export function DetailDrawer({ isOpen, onClose, title, triggerRef, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Move focus to drawer on open
    const drawerEl = drawerRef.current;
    if (drawerEl) {
      const focusable = drawerEl.querySelector<HTMLElement>('button, [tabindex="0"], a');
      focusable?.focus();
    }

    // 2. Escape Key Listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        // 3. Restore focus to trigger element
        triggerRef?.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus on unmount
      triggerRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.drawerHeader}>
          <h3 id="drawer-title">{title}</h3>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close detail drawer">
            ✕
          </button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </div>
  );
}
```

---

## 6. Backwards Compatibility with Panel Wrappers

In `ward-lead` and similar architectures, screens are composed of standardized `<WardPanel>` wrappers that manage collapsibility, help tooltips, and region landmarks.

```tsx
<WardPanel title="Today’s traffic" badge={`${totalMovements} active`} variant="default">
  <MovementHorizonGantt events={horizonEvents} onSelectEvent={handleEventClick} />
</WardPanel>
```

> **PANEL ORDER INVARIANT**: Always maintain the exact panel sequence established in the mockup. Never move secondary panels above primary KPI banners or split a unified dashboard without written approval.
