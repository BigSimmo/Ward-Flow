"use client";

import { UserCheck } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Dialog, SrOnly, useOptionalToast } from "@/components/wf";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";
import { useOptionalWardFlowSelect } from "./ward-flow-provider";

// Rows confirmed but still inside their Undo window. Held outside the component so closing and
// reopening the drawer inside the window keeps them pending (Josh, 27 Oct 2026, 10:41 PM AWST).
type DeferredBatch = { ids: readonly string[]; isCurrent: () => boolean };
const heldBatches = new Map<symbol, DeferredBatch>();
let heldRows: ReadonlySet<string> = new Set();
const heldListeners = new Set<() => void>();
function publishHeld() {
  heldListeners.forEach((listener) => listener());
}
function subscribeHeld(listener: () => void) {
  heldListeners.add(listener);
  return () => {
    heldListeners.delete(listener);
  };
}
function readHeld() {
  for (const [id, batch] of heldBatches) if (!batch.isCurrent()) heldBatches.delete(id);
  const next = new Set([...heldBatches.values()].flatMap((batch) => batch.ids));
  if (next.size !== heldRows.size || [...next].some((id) => !heldRows.has(id))) heldRows = next;
  return heldRows;
}

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
  const [asking, setAsking] = useState<DeferredBatch | null>(null);
  // Subscribe to generation changes so an open drawer drops an old world's held rows.
  const capture = useOptionalWardFlowSelect("captureCommandLifetime", "worldGeneration")?.captureCommandLifetime;
  const held = useSyncExternalStore(subscribeHeld, readHeld, readHeld);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const scopeId = useId();
  const offered = ids.filter((id) => !held.has(id));

  function release(batchId: symbol) {
    heldBatches.delete(batchId);
    publishHeld();
  }

  function confirm() {
    const batch = asking;
    setAsking(null);
    if (!batch || batch.ids.length === 0 || !batch.isCurrent()) return;
    if (!toast) return onAcknowledge(batch.ids);
    const batchId = Symbol("acknowledgements");
    heldBatches.set(batchId, batch);
    publishHeld();
    toast.push({
      tone: "success",
      title: `${batch.ids.length} alerts acknowledged.`,
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => release(batchId),
        onExpire: () => {
          if (batch.isCurrent()) onAcknowledge(batch.ids);
          release(batchId);
        },
      },
    });
  }

  if (offered.length === 0 && !asking) return null;
  const count = asking?.ids.length ?? offered.length;
  return (
    <>
      {offered.length > 0 ? (
        <button
          ref={triggerRef}
          type="button"
          className={classes.btn}
          title="Unacknowledged alerts in the current filtered list. Act now alerts are excluded, as are alerts still in their Undo window."
          aria-describedby={scopeId}
          onClick={() => setAsking({ ids: offered, isCurrent: capture?.() ?? (() => true) })}
        >
          <UserCheck aria-hidden="true" />
          Acknowledge visible
          <span className={classes.count}>{offered.length}</span>
        </button>
      ) : null}
      <SrOnly id={scopeId}>
        Includes alerts below the screen in the current filtered list. Act now alerts, previously acknowledged alerts
        and alerts still in their Undo window are excluded.
      </SrOnly>
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Acknowledge ${count} alerts?`}
        description="Applies to unacknowledged alerts in the current filtered list, including those below the screen. Act now alerts are excluded, as are alerts still in their Undo window. Acknowledging records that you have seen an alert; it does not resolve the underlying condition."
        size="sm"
        returnFocusRef={triggerRef}
        primary={{ label: `Acknowledge ${count}`, onAction: confirm }}
        secondary={[{ label: "Cancel", onAction: () => setAsking(null) }]}
        data-testid="tasks-acknowledge-visible-confirm"
      />
    </>
  );
}
