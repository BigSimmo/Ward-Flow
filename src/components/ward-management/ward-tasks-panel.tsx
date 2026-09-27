"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";

import styles from "./ward-tasks-panel.module.css";

/**
 * **THE GLOBAL TASKS PANEL — what mounts `WardTasksDrawer` and what decides when it is open.**
 *
 * The drawer itself is deliberately dumb: it takes the items already computed, the two reducer
 * maps, and a `dispatch`, and renders them. **Everything that requires knowing where we are — which
 * movements are open, where a row's link should land, whether the panel is showing — lives here**,
 * so the drawer stays a thing a test can render with a fixture and no router.
 *
 * ⚠️ **SCOPED TO OPEN MOVEMENTS, THE SAME WAY `coordinator-screen.tsx` ALREADY DOES IT.**
 * `buildActionInbox` does not filter: hand it every movement and closed cases reappear as live work.
 * The scoping is the caller's job and this is the caller.
 *
 * 🔴 **THE ROW LINK CARRIES THE MOVEMENT, AND THAT IS THE WHOLE POINT OF IT.** `InboxItem` already
 * holds `movementId`, so a row can reach the record it is about. **An `href` that reaches the right
 * screen having dropped the patient renders perfectly, throws nothing and fails no test** — it is
 * the failure this project has spent the night learning to look for. The destination route guards
 * the `WF-` prefix and renders a named not-found rather than an empty record, so a wrong id is
 * loud rather than blank.
 *
 * ⚠️ **`role="coordinator"` IS NOT A GUESS AND IT IS NOT A GATE.** `ward-flow-events.ts` allows
 * these three events for `["coordinator"]` only, recorded as a floor rather than a ceiling — the
 * day the drawer reaches a ward screen the event's role list widens, not this line. **The gate is
 * the reducer's own role check**, which records a `Rejection` rather than silently succeeding, so a
 * wrong role here fails safely and visibly instead of writing something nobody asked for.
 */
export function WardTasksPanel() {
  const router = useRouter();
  const { movements, units, dispatch, inboxAcknowledgements, inboxCompletions } = useWardFlow();
  const now = useWardFlowClock();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => buildActionInbox(movements.filter(isOpen), now, units), [movements, now, units]);

  const openMovement = useCallback(
    (movementId: string) => {
      router.push(`/mockups/ward-flow/movements/${movementId}`);
    },
    [router],
  );

  if (!open) {
    return (
      <button type="button" className={styles.opener} onClick={() => setOpen(true)} data-testid="ward-tasks-opener">
        Tasks
        {/*
         * ⚠️ **THE COUNT IS STATED IN WORDS AS WELL AS SHOWN**, because a bare number beside a label
         * is read as a badge and a badge is read as "new". These are standing facts, not
         * notifications: an item leaves when the fact resolves, never when somebody looks at it.
         */}
        <span className={styles.count}>{items.length}</span>
        <span className={styles.openerNote}>
          {items.length === 1 ? "item needs attention" : "items need attention"}
        </span>
      </button>
    );
  }

  return (
    <WardTasksDrawer
      items={items}
      acknowledgements={inboxAcknowledgements}
      completions={inboxCompletions}
      role="coordinator"
      now={now}
      dispatch={dispatch}
      onClose={() => setOpen(false)}
      onSelectMovement={openMovement}
      withBackdrop
    />
  );
}
