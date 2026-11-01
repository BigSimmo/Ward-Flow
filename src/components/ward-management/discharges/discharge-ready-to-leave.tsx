"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { Frac, StatusGlyph, ToastView, cx, useIsPhone } from "@/components/wf";

import styles from "./discharge-ready-to-leave.module.css";

/**
 * Ready to leave (v10 Discharges, row panel > Milestones). Five items a release needs before the
 * person goes. The items come from the coordinator brief and the starting ticks are invented for
 * the demo (open for Josh: wording, and whether each item needs an owner and a time). Ticking is
 * page state only; it never changes a release, a record or the engine.
 */
const READY_TO_LEAVE_ITEMS = [
  { id: "crisis-plan", label: "Crisis plan" },
  { id: "medicines", label: "Medicines" },
  { id: "carer", label: "Patient and carer involved" },
  { id: "housing", label: "Housing and handover" },
  { id: "follow-up", label: "Follow up booked" },
] as const;

/**
 * S-29 (Josh, audit round 2): a person on a community treatment order gets one more line, the
 * community team or GP handover. It warns while open and never blocks the discharge.
 */
const CTO_HANDOVER_ITEM = { id: "cto-handover", label: "Community team or GP told" } as const;

export type ReadyToLeaveItemId = (typeof READY_TO_LEAVE_ITEMS)[number]["id"] | typeof CTO_HANDOVER_ITEM.id;

/** Invented starting ticks: a stable count from the release id, so every load shows the same demo. */
export function demoReadyTicks(releaseId: string): ReadyToLeaveItemId[] {
  let hash = 0;
  for (const char of releaseId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return READY_TO_LEAVE_ITEMS.slice(0, hash % READY_TO_LEAVE_ITEMS.length).map((item) => item.id);
}

export type ReadyToLeaveUndo = { itemId: ReadyToLeaveItemId; ticked: boolean };

export function ReadyToLeave({
  ticked,
  onToggle,
  lastChange,
  onUndo,
  onDismiss,
  onCto = false,
}: {
  ticked: readonly ReadyToLeaveItemId[];
  /** A community treatment order is in force, so the community team or GP line is added. */
  onCto?: boolean;
  onToggle: (itemId: ReadyToLeaveItemId) => void;
  lastChange: ReadyToLeaveUndo | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const headingId = useId();
  // v10 phone: a glyph list (green tick or open circle), not checkbox squares.
  const isPhone = useIsPhone();
  const items: readonly { id: ReadyToLeaveItemId; label: string }[] = onCto
    ? [...READY_TO_LEAVE_ITEMS, CTO_HANDOVER_ITEM]
    : READY_TO_LEAVE_ITEMS;
  const done = items.filter((item) => ticked.includes(item.id)).length;
  const changedLabel = lastChange ? items.find((item) => item.id === lastChange.itemId)?.label : undefined;
  return (
    <section className={styles.readyPanel} aria-labelledby={headingId} data-testid="ward-discharge-ready-to-leave">
      <header className={styles.head}>
        <h3 id={headingId} className={cx(styles.title, isPhone && styles.phTitle)}>
          Ready to leave
        </h3>
        <Frac
          done={done}
          total={items.length}
          label="ready to leave items done"
          tone={done === items.length ? "success" : undefined}
        />
      </header>
      <div className={styles.progress} aria-hidden="true">
        <span
          style={{ width: `${Math.round((done / items.length) * 100)}%` }}
          data-done={done === items.length || undefined}
        />
      </div>
      <ul className={styles.list}>
        {items.map((item) => {
          const on = ticked.includes(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={styles.item}
                aria-pressed={on}
                onClick={() => onToggle(item.id)}
                data-testid={`ward-discharge-ready-${item.id}`}
              >
                {isPhone ? (
                  <span className={styles.glyph} aria-hidden="true">
                    <StatusGlyph tone={on ? "success" : "neutral"} size={12} />
                  </span>
                ) : (
                  <span className={styles.box} aria-hidden="true">
                    {on ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                  </span>
                )}
                <span className={styles.label}>{item.label}</span>
                {item.id === CTO_HANDOVER_ITEM.id && !on ? (
                  <span className={styles.glyph} aria-hidden="true">
                    <StatusGlyph tone="warning" size={9} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {lastChange && changedLabel ? (
        <ToastView
          className={styles.toast}
          tone="info"
          title={`${changedLabel} ${lastChange.ticked ? "ticked" : "unticked"}`}
          meta={`${done} of ${items.length}`}
          action={{ label: "Undo", onAction: onUndo }}
          onClose={onDismiss}
          closeLabel="Dismiss"
          data-testid="ward-discharge-ready-toast"
        />
      ) : null}
    </section>
  );
}
