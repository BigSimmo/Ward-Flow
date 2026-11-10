"use client";

import { UserCheck } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Dialog, SrOnly, useOptionalToast } from "@/components/wf";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";
import { useOptionalWardFlowSelect } from "./ward-flow-provider";
import { registerHeldActions, type HeldActionPurpose } from "./ward-held-actions";
import { plural } from "./ward-plural";
import type { WardCommandOutcome } from "./ward-shared-client-types";

// Rows confirmed but still inside their Undo window. Held outside the component so closing and
// reopening the drawer inside the window keeps them pending (Josh, 27 Oct 2026, 10:41 PM AWST).
// `end` closes the batch's Undo toast, which records it through the toast's own `onExpire`.
// `recorded` resolves with what `onAcknowledge` returned (or `false` after Undo or a drop), and
// `refused` tells the person why a sign-out or role switch did not go ahead (D-125).
type DeferredBatch = {
  ids: readonly string[];
  isCurrent: () => boolean;
  end?: () => void;
  recorded?: Promise<unknown>;
  refused?: (purpose: HeldActionPurpose) => void;
};
const heldBatches = new Map<symbol, DeferredBatch>();
let heldRows: ReadonlySet<string> = new Set();
const heldListeners = new Set<() => void>();
function publishHeld() {
  syncLeaveFlush();
  heldListeners.forEach((listener) => listener());
}

/**
 * Audit M8: a held batch lived only in this tab, so closing, reloading or leaving the page inside
 * the Undo window lost confirmed acknowledgements without a word. Leaving now ends the window
 * early and records them, and `beforeunload` also asks the browser to warn while that save goes.
 * Undo itself is unchanged while the page stays open, including while the tab is hidden.
 */
function flushHeldOnLeave(event: Event) {
  let flushed = false;
  for (const batch of [...heldBatches.values()]) {
    if (!batch.end || !batch.isCurrent()) continue;
    batch.end();
    flushed = true;
  }
  if (flushed && event.type === "beforeunload") {
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = "";
  }
}
/** Every acknowledgement was accepted. A void result (a screen rendered alone) counts as recorded. */
async function confirmedAll(result: unknown): Promise<boolean> {
  if (result === false) return false;
  if (!Array.isArray(result)) return true;
  const outcomes = (await Promise.all(result)) as (WardCommandOutcome | void)[];
  return outcomes.every((outcome) => !outcome || outcome.status === "accepted");
}

/**
 * D-125 (Josh, 10 Nov 2026; audit M8 gap B): a voluntary sign-out or role switch inside the Undo
 * window used to drop the batch, because the session ended before the window did. Now it ends the
 * window first, sends the batch and waits for every acknowledgement to be confirmed. When one is
 * refused or fails, the sign-out or switch does not go ahead and a toast says why.
 */
const currentHeld = () => [...heldBatches].filter(([, batch]) => batch.end && batch.isCurrent());
async function sendHeldBeforeLeaving(purpose: HeldActionPurpose): Promise<boolean> {
  const entries = currentHeld();
  for (const [, batch] of entries) batch.end!();
  // A window that did not end (its toast had already gone) never records: report it, never wait on it.
  const results = await Promise.all(
    entries.map(([id, batch]) =>
      heldBatches.has(id) || !batch.recorded ? false : batch.recorded.then(confirmedAll).catch(() => false),
    ),
  );
  entries.forEach(([, batch], index) => {
    if (!results[index]) batch.refused?.(purpose);
  });
  return results.every(Boolean);
}
let unregisterHeld: (() => void) | null = null;
let leaveFlushListening = false;
function syncLeaveFlush() {
  if (typeof window === "undefined") return;
  const needed = heldBatches.size > 0;
  if (needed === leaveFlushListening) return;
  leaveFlushListening = needed;
  unregisterHeld?.();
  unregisterHeld = needed
    ? registerHeldActions({ waiting: () => currentHeld().length > 0, send: sendHeldBeforeLeaving })
    : null;
  for (const type of ["beforeunload", "pagehide"] as const) {
    if (needed) window.addEventListener(type, flushHeldOnLeave);
    else window.removeEventListener(type, flushHeldOnLeave);
  }
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
  /**
   * Records the acknowledgements; called once, after the Undo window ends without Undo. Returning
   * each command's outcome lets a sign-out or role switch wait for them to be confirmed (D-125).
   */
  onAcknowledge: (ids: readonly string[]) => unknown;
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
    if (!toast) {
      onAcknowledge(batch.ids);
      return;
    }
    const batchId = Symbol("acknowledgements");
    let settle: (result: unknown) => void = () => {};
    const recorded = new Promise<unknown>((resolve) => (settle = resolve));
    heldBatches.set(batchId, batch);
    publishHeld();
    const count = plural(batch.ids.length, "alert", "alerts");
    const toastId = toast.push({
      tone: "success",
      title: `${count} acknowledged.`,
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          settle(false);
          release(batchId);
        },
        onExpire: () => {
          settle(batch.isCurrent() ? onAcknowledge(batch.ids) : false);
          release(batchId);
        },
      },
    });
    if (heldBatches.has(batchId))
      heldBatches.set(batchId, {
        ...batch,
        end: () => toast.dismiss(toastId),
        recorded,
        refused: (purpose) =>
          toast.push({
            tone: "danger",
            title: purpose === "sign-out" ? "You are still signed in." : "Your role was not switched.",
            body: `${count} could not be confirmed as acknowledged. Check the alerts, then ${
              purpose === "sign-out" ? "sign out" : "switch role"
            } again.`,
            wrap: true,
          }),
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
          title="Act now alerts and alerts still in their Undo window are excluded."
          aria-describedby={scopeId}
          onClick={() => setAsking({ ids: offered, isCurrent: capture?.() ?? (() => true) })}
        >
          <UserCheck aria-hidden="true" />
          Acknowledge visible
          <span className={classes.count}>{offered.length}</span>
        </button>
      ) : null}
      <SrOnly id={scopeId}>
        Includes alerts below the screen. Act now, already acknowledged and Undo window alerts are excluded.
      </SrOnly>
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Acknowledge ${plural(count, "alert", "alerts")}?`}
        description="Includes alerts below the screen. Act now alerts are excluded, as are those still in their Undo window. This does not resolve the underlying condition."
        size="sm"
        returnFocusRef={triggerRef}
        primary={{ label: `Acknowledge ${count}`, onAction: confirm }}
        secondary={[{ label: "Cancel", onAction: () => setAsking(null) }]}
        data-testid="tasks-acknowledge-visible-confirm"
      />
    </>
  );
}
