"use client";

import { UserCheck } from "lucide-react";
import { useRef, useState } from "react";

import { Dialog, useOptionalToast } from "@/components/wf";
import { UNDO_TOAST_MS } from "./ward-operational-defaults";

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
  // Rows confirmed but still inside their Undo window, so the button does not offer them twice.
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const offered = ids.filter((id) => !held.has(id));

  function release(chosen: readonly string[]) {
    setHeld((current) => new Set([...current].filter((id) => !chosen.includes(id))));
  }

  function confirm() {
    const chosen = asking ?? [];
    setAsking(null);
    if (chosen.length === 0) return;
    if (!toast) return onAcknowledge(chosen);
    setHeld((current) => new Set([...current, ...chosen]));
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
        <button ref={triggerRef} type="button" className={classes.btn} onClick={() => setAsking(offered)}>
          <UserCheck aria-hidden="true" />
          Acknowledge visible
          <span className={classes.count}>{offered.length}</span>
        </button>
      ) : null}
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Acknowledge ${count} alerts?`}
        size="sm"
        returnFocusRef={triggerRef}
        primary={{ label: `Acknowledge ${count}`, onAction: confirm }}
        secondary={[{ label: "Cancel", onAction: () => setAsking(null) }]}
        data-testid="tasks-acknowledge-visible-confirm"
      />
    </>
  );
}
