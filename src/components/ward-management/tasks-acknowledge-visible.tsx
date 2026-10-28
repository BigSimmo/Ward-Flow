"use client";

import { UserCheck } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Dialog, SrOnly, useOptionalToast } from "@/components/wf";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";

// Rows confirmed but still inside their Undo window. Held outside the component so closing and
// reopening the drawer inside the window keeps them pending (Josh, 27 Oct 2026, 10:41 PM AWST).
let heldRows: ReadonlySet<string> = new Set();
const heldListeners = new Set<() => void>();
function setHeldRows(next: ReadonlySet<string>) {
  heldRows = next;
  heldListeners.forEach((listener) => listener());
}
function subscribeHeld(listener: () => void) {
  heldListeners.add(listener);
  return () => {
    heldListeners.delete(listener);
  };
}
const readHeld = () => heldRows;

/**
 * P017 (Josh, 27 Oct 2026, 8:35 PM AWST): the Tasks drawer's bulk "Acknowledge visible" asks first
 * ("Acknowledge {n} alerts?") and then offers Undo. Undo holds the acknowledgements back: nothing is
 * recorded until the Undo window ends (the timer, the X or a newer toast), so Undo leaves no record.
 * Where no toast region exists (a screen rendered alone) the confirmed rows are recorded at once.
 */
export function AcknowledgeVisibleButton({
  ids,
  onAcknowledge,
  classes,
}: {
  /** The visible rows still to acknowledge (act-now rows are already left out by the caller). */
  ids: readonly string[];
  /** Records the acknowledgements; called once, after the Undo window ends without Undo. */
  onAcknowledge: (ids: readonly string[]) => void;
  classes: { readonly [key: string]: string };
}) {
  const toast = useOptionalToast();
  const [asking, setAsking] = useState<readonly string[] | null>(null);
  const held = useSyncExternalStore(subscribeHeld, readHeld, readHeld);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const scopeId = useId();
  const offered = ids.filter((id) => !held.has(id));

  function release(chosen: readonly string[]) {
    setHeldRows(new Set([...heldRows].filter((id) => !chosen.includes(id))));
  }

  function confirm() {
    const chosen = asking ?? [];
    setAsking(null);
    if (chosen.length === 0) return;
    if (!toast) return onAcknowledge(chosen);
    setHeldRows(new Set([...heldRows, ...chosen]));
    toast.push({
      tone: "success",
      title: `${chosen.length} alerts acknowledged.`,
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => release(chosen),
        onExpire: () => {
          onAcknowledge(chosen);
          release(chosen);
        },
      },
    });
  }

  if (offered.length === 0 && !asking) return null;
  const count = asking?.length ?? offered.length;
  return (
    <>
      {offered.length > 0 ? (
        <button
          ref={triggerRef}
          type="button"
          className={classes.btn}
          title="Unacknowledged alerts in the current filtered list. Act now alerts are excluded."
          aria-describedby={scopeId}
          onClick={() => setAsking(offered)}
        >
          <UserCheck aria-hidden="true" />
          Acknowledge visible
          <span className={classes.count}>{offered.length}</span>
        </button>
      ) : null}
      <SrOnly id={scopeId}>
        Includes alerts below the screen in the current filtered list. Act now alerts and previously acknowledged alerts
        are excluded.
      </SrOnly>
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Acknowledge ${count} alerts?`}
        description="Applies to unacknowledged alerts in the current filtered list, including those below the screen. Act now alerts are excluded. Acknowledging records that you have seen an alert; it does not resolve the underlying condition."
        size="sm"
        returnFocusRef={triggerRef}
        primary={{ label: `Acknowledge ${count}`, onAction: confirm }}
        secondary={[{ label: "Cancel", onAction: () => setAsking(null) }]}
        data-testid="tasks-acknowledge-visible-confirm"
      />
    </>
  );
}
