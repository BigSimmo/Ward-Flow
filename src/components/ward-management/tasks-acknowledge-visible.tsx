"use client";

import { UserCheck } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Dialog, SrOnly, useOptionalToast } from "@/components/wf";
import bulkStyles from "./ward/ward-decisions-bulk-confirm.module.css";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";
import { useOptionalWardFlowSelect } from "./ward-flow-provider";
import { registerHeldActions, type HeldActionPurpose } from "./ward-held-actions";
import { plural } from "./ward-plural";
import type { WardCommandDispatch } from "./ward-shared-client-types";

/** One alert the bulk confirm lists (M37): the person by name and UMRN, and what the alert says. */
export type AcknowledgeVisibleRow = {
  id: string;
  /** The person's name, or `undefined` when the alert names no linked person. */
  name?: string;
  umrn?: string;
  /** The alert's own title, such as "Transport awaiting departure". */
  what: string;
};

/** The confirm list's row for an alert, from the person the drawer already resolved for it. */
export function acknowledgeVisibleRow(
  item: { id: string; title: string },
  patient: { formalName: string; umrn: string; patient?: unknown } | undefined,
): AcknowledgeVisibleRow {
  return patient?.patient
    ? { id: item.id, name: patient.formalName, umrn: patient.umrn, what: item.title }
    : { id: item.id, what: item.title };
}

// Rows confirmed but still inside their Undo window. Held outside the component so closing and
// reopening the drawer inside the window keeps them pending (Josh, 27 Oct 2026, 10:41 PM AWST).
// `end` closes the batch's Undo toast, which records it through the toast's own `onExpire`.
// `recorded` resolves with every save's answer (or `false` after Undo or a drop), and
// `refused` tells the person why a sign-out or role switch did not go ahead (D-125).
type DeferredBatch = {
  rows: readonly AcknowledgeVisibleRow[];
  isCurrent: () => boolean;
  end?: () => void;
  recorded?: Promise<Settled[] | false>;
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
/** Every acknowledgement was accepted. A save with no answer (a legacy dispatch) counts as recorded. */
function confirmedAll(result: readonly Settled[] | false): boolean {
  if (result === false) return false;
  return result.every((entry) => entry.state === "done" || entry.state === "unknown");
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
  const next = new Set([...heldBatches.values()].flatMap((batch) => batch.rows.map((row) => row.id)));
  if (next.size !== heldRows.size || [...next].some((id) => !heldRows.has(id))) heldRows = next;
  return heldRows;
}

type Settled = { row: AcknowledgeVisibleRow; state: "done" | "refused" | "unconfirmed" | "unknown" };

/** A person named in a result, or the alert itself when it names nobody. */
const named = (row: AcknowledgeVisibleRow) => (row.name ? `${row.name} (${row.what})` : row.what);
const names = (rows: readonly Settled[]) => rows.map((entry) => named(entry.row)).join("; ");

/**
 * M13/M37/M114 (D-129, 10 Nov 2026): what the person is told once every save has its answer. Only
 * a confirmed save counts as done, and the message names each alert that was not acknowledged, as
 * Sign off N does (Q93). `null` when no save gave an answer (a legacy dispatch): the rows say.
 */
function acknowledgeVisibleReport(results: readonly Settled[]): { tone: "success" | "warning"; title: string } | null {
  if (results.length === 0 || results.every((entry) => entry.state === "unknown")) return null;
  const n = results.length;
  const done = results.filter((entry) => entry.state === "done");
  const refused = results.filter((entry) => entry.state === "refused");
  const unconfirmed = results.filter((entry) => entry.state === "unconfirmed" || entry.state === "unknown");
  if (done.length === n) return { tone: "success", title: `${plural(n, "alert", "alerts")} acknowledged and saved.` };
  const parts = [
    done.length === 0 ? "Nothing was acknowledged." : `${done.length} of ${n} acknowledged: ${names(done)}.`,
    refused.length > 0 ? `Not recorded, nothing changed for ${names(refused)}.` : "",
    unconfirmed.length > 0 ? `Not confirmed for ${names(unconfirmed)}. Check before acknowledging again.` : "",
  ];
  return { tone: "warning", title: parts.filter(Boolean).join(" ") };
}

/**
 * P017 (Josh, 27 Oct 2026, 8:35 PM AWST): the Tasks drawer's bulk "Acknowledge visible" asks first
 * ("Acknowledge {n} alerts?") and then offers Undo. Undo holds the acknowledgements back: nothing is
 * recorded until the Undo window ends (the timer, the X or a newer toast), so Undo leaves no record.
 * Where no toast region exists (a screen rendered alone) the confirmed rows are recorded at once.
 * M37 (D-129): the confirm lists each person with their UMRN, and once the saves answer the drawer
 * says how many were acknowledged and names any that were not.
 */
export function AcknowledgeVisibleButton({
  rows,
  onAcknowledge,
  classes,
}: {
  /** The visible rows still to acknowledge (act-now rows are already left out by the caller). */
  rows: readonly AcknowledgeVisibleRow[];
  /**
   * Records one acknowledgement and returns its command's answer; called for each row after the
   * Undo window ends without Undo. The answers let a sign-out or role switch wait for them (D-125).
   */
  onAcknowledge: (id: string) => ReturnType<WardCommandDispatch>;
  classes: { readonly [key: string]: string };
}) {
  const toast = useOptionalToast();
  const [asking, setAsking] = useState<DeferredBatch | null>(null);
  // Subscribe to generation changes so an open drawer drops an old world's held rows.
  const capture = useOptionalWardFlowSelect("captureCommandLifetime", "worldGeneration")?.captureCommandLifetime;
  const held = useSyncExternalStore(subscribeHeld, readHeld, readHeld);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const scopeId = useId();
  const offered = rows.filter((row) => !held.has(row.id));

  function release(batchId: symbol) {
    heldBatches.delete(batchId);
    publishHeld();
  }

  /** Sends one save per row, in order, and reports once every one has its answer. */
  function record(batch: DeferredBatch): Promise<Settled[]> {
    const answers = batch.rows.map(async (row): Promise<Settled> => {
      try {
        const outcome = await onAcknowledge(row.id);
        if (!outcome) return { row, state: "unknown" };
        if (outcome.status === "accepted") return { row, state: "done" };
        return { row, state: outcome.status === "failed" ? "unconfirmed" : "refused" };
      } catch {
        return { row, state: "unconfirmed" };
      }
    });
    const settled = Promise.all(answers);
    if (toast)
      void settled.then((results) => {
        const report = batch.isCurrent() ? acknowledgeVisibleReport(results) : null;
        if (report) toast.push({ ...report, wrap: true });
      });
    return settled;
  }

  function confirm() {
    const batch = asking;
    setAsking(null);
    if (!batch || batch.rows.length === 0 || !batch.isCurrent()) return;
    if (!toast) {
      void record(batch);
      return;
    }
    const batchId = Symbol("acknowledgements");
    let settle: (result: Promise<Settled[]> | false) => void = () => {};
    const recorded = new Promise<Settled[] | false>((resolve) => (settle = resolve));
    heldBatches.set(batchId, batch);
    publishHeld();
    const count = plural(batch.rows.length, "alert", "alerts");
    const toastId = toast.push({
      tone: "success",
      title: `${count} acknowledged.`,
      // M114: nothing is recorded yet, so the toast does not let it read as done.
      body: "Nothing is saved until the Undo time ends and each save is confirmed.",
      undo: {
        durationMs: UNDO_TOAST_MS,
        onUndo: () => {
          settle(false);
          release(batchId);
        },
        onExpire: () => {
          settle(batch.isCurrent() ? record(batch) : false);
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
  const listed = asking?.rows ?? offered;
  const count = listed.length;
  return (
    <>
      {offered.length > 0 ? (
        <button
          ref={triggerRef}
          type="button"
          className={classes.btn}
          title="Act now alerts and alerts still in their Undo window are excluded."
          aria-describedby={scopeId}
          onClick={() => setAsking({ rows: offered, isCurrent: capture?.() ?? (() => true) })}
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
      >
        {asking ? (
          // M37 (D-129): each person by name and UMRN before anything is sent, as Sign off N lists them.
          <ul className={bulkStyles.list} aria-label="Alerts to acknowledge">
            {asking.rows.map((row) => (
              <li key={row.id} className={bulkStyles.person}>
                <span className={bulkStyles.name}>{row.name ?? "Patient not linked"}</span>
                <span className={bulkStyles.identity}>{row.umrn ? `${row.umrn} · ${row.what}` : row.what}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>
    </>
  );
}
