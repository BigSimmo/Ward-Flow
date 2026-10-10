"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { Frac, ToastView } from "@/components/wf";

import styles from "./discharge-ready-to-leave.module.css";

/**
 * Ready to leave (v10 Discharges, row panel > Milestones). Five items a release needs before the
 * person goes. The items come from the coordinator brief and the starting ticks are invented for
 * the demo (open for Josh: wording, and whether each item needs an owner and a time). Ticking is
 * page state only; it never changes a release, a record or the engine.
 */
export const READY_TO_LEAVE_ITEMS = [
  { id: "crisis-plan", label: "Crisis plan" },
  { id: "medicines", label: "Medicines" },
  { id: "carer", label: "Patient and carer involved" },
  { id: "housing", label: "Housing and handover" },
  { id: "follow-up", label: "Follow up booked" },
] as const;

export type ReadyToLeaveItemId = (typeof READY_TO_LEAVE_ITEMS)[number]["id"];

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
}: {
  ticked: readonly ReadyToLeaveItemId[];
  onToggle: (itemId: ReadyToLeaveItemId) => void;
  lastChange: ReadyToLeaveUndo | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const headingId = useId();
  const done = READY_TO_LEAVE_ITEMS.filter((item) => ticked.includes(item.id)).length;
  const changedLabel = lastChange
    ? READY_TO_LEAVE_ITEMS.find((item) => item.id === lastChange.itemId)?.label
    : undefined;
  return (
    <section className={styles.ready} aria-labelledby={headingId} data-testid="ward-discharge-ready-to-leave">
      <header className={styles.head}>
        <h3 id={headingId} className={styles.title}>
          Ready to leave
        </h3>
        <Frac
          done={done}
          total={READY_TO_LEAVE_ITEMS.length}
          label="ready to leave items done"
          tone={done === READY_TO_LEAVE_ITEMS.length ? "success" : undefined}
        />
      </header>
      <ul className={styles.list}>
        {READY_TO_LEAVE_ITEMS.map((item) => {
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
                <span className={styles.box} aria-hidden="true">
                  {on ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                </span>
                <span className={styles.label}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>Synthetic demo ticks. Items and starting ticks are pending confirmation.</p>
      {lastChange && changedLabel ? (
        <ToastView
          className={styles.toast}
          tone="info"
          title={`${changedLabel} ${lastChange.ticked ? "ticked" : "unticked"}`}
          meta={`${done} of ${READY_TO_LEAVE_ITEMS.length}`}
          action={{ label: "Undo", onAction: onUndo }}
          onClose={onDismiss}
          closeLabel="Dismiss"
          data-testid="ward-discharge-ready-toast"
        />
      ) : null}
    </section>
  );
}
