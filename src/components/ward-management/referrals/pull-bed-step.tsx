"use client";

// Wave 4 (H4, H5; ruling items 1 and 3): the Pull the bed step as one reusable part. Home and Alerts
// open it from their act-now rows; the Ward page can open it before an arrival. It owns the sheet,
// the toast with Undo, the pulled rows kept for the Undo window, and where focus goes after a pull.

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { Sheet, useOptionalToast } from "@/components/wf";

import { withLoadRetry } from "../load-retry";
import type { Instant } from "../ward-clock";
import { wardRaise } from "../ward-flow-raise";
import { useOptionalWardFlowSelect, useWardFlowClock } from "../ward-flow-provider";
import type { Movement } from "../ward-model";
import { UNDO_TOAST_MS } from "../ward-operational-defaults";
import type { WardCommandDispatch } from "../ward-shared-client";
import { useWardCommandCompletion, wardCommandFailure } from "../ward/use-ward-command-completion";
import type { AcceptedAwaitingPull } from "./accepted-awaiting-pull";
import {
  clockText,
  pulledMovement,
  pullStageIndex,
  pullStillUndoable,
  pullUndoUntil,
  type PulledBed,
} from "./pull-bed-facts";

// WS-03: the one-step pull loads only when someone opens it.
const PullAcceptedReferral = dynamic(
  withLoadRetry(() => import("./pull-accepted-referral").then((m) => m.PullAcceptedReferral)),
  { loading: () => null },
);

/** Marks a kept pulled row, so focus after a pull skips it. */
export const PULLED_ROW_ATTRIBUTE = "data-pulled-referral-id";

/** Said when a kept row's Undo can no longer release the pull it was offered for. */
const PULL_UNDO_GONE = "Undo is unavailable: the bed pull has changed since, or its time has passed.";

/**
 * Ruling 3 (D-191): after a pull, focus goes to the next row's first control, skipping kept pulled
 * rows; with none left, to the list's own region (Act now).
 */
function nextRowControl(referralId: string): HTMLElement | null {
  const kept = document.querySelector<HTMLElement>(`[${PULLED_ROW_ATTRIBUTE}="${CSS.escape(referralId)}"]`);
  if (!kept) return null;
  const region = kept.closest<HTMLElement>("section, [role='region']") ?? kept.parentElement;
  if (!region) return null;
  const rows = Array.from(region.querySelectorAll<HTMLElement>("li"));
  const after = rows.slice(rows.indexOf(kept) + 1).filter((row) => !row.hasAttribute(PULLED_ROW_ATTRIBUTE));
  for (const row of after) {
    const control = row.querySelector<HTMLElement>("button:not([disabled]), a[href]");
    if (control) return control;
  }
  if (!region.hasAttribute("tabindex")) {
    // Takes focus for this hand-over only, so it never joins the tab order.
    region.setAttribute("tabindex", "-1");
    region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
  }
  return region;
}

export type PullBedStep = {
  /** The accepted referral whose sheet is open. */
  pulling: AcceptedAwaitingPull | undefined;
  /** Opens the step for an accepted referral. */
  setPulling: (entry: AcceptedAwaitingPull | undefined) => void;
  /** The sheet to render once on the page. */
  sheet: ReactNode;
  /** Beds pulled in the last few minutes, kept on their row with "Undo pull · until HH:MM". */
  kept: readonly PulledBed[];
  /** Releases a kept pull as made in error (the engine's own audited reverse). */
  undo: (pulled: PulledBed) => void;
};

/**
 * The Pull the bed step. Render `sheet` once, open it with `setPulling(entry)`, and pass `kept` and
 * `undo` to the rows (`AcceptedPullRows`). A ward desk passes its own units as `ownUnitIds`, and the
 * sheet then acts for the ward pulled for when it is one of them (D-197 item 7).
 * Works outside a Ward Flow provider too (it then keeps no rows), so a page's tests can stub it.
 */
export function usePullBedStep({ ownUnitIds }: { ownUnitIds?: readonly string[] } = {}): PullBedStep {
  const [pulling, setPullingState] = useState<AcceptedAwaitingPull | undefined>();
  const [kept, setKept] = useState<readonly PulledBed[]>([]);
  const focusAfter = useRef<string | null>(null);
  const flow = useOptionalWardFlowSelect("movements", "dispatch");
  const now = useWardFlowClock(0);
  const toast = useOptionalToast();
  const complete = useWardCommandCompletion();

  // The toast's Undo runs after this render, so it reads the newest state through these refs.
  const latest = useRef<{
    movements: readonly Movement[];
    dispatch: WardCommandDispatch | undefined;
    now: Instant;
    complete: typeof complete;
  }>({ movements: [], dispatch: undefined, now, complete });
  useLayoutEffect(() => {
    latest.current = { movements: flow?.movements ?? [], dispatch: flow?.dispatch, now, complete };
  });

  const undo = useCallback(
    (pulled: PulledBed) => {
      const { movements, dispatch, now: at, complete: run } = latest.current;
      const movement = pulledMovement(movements, pulled);
      const stageIndex = movement ? pullStageIndex(movement, pulled) : undefined;
      if (!dispatch || !movement || stageIndex === undefined || at > pullUndoUntil(pulled)) {
        toast?.push({ tone: "warning", title: PULL_UNDO_GONE });
        return;
      }
      run(
        `pull-undo:${movement.id}`,
        () =>
          wardRaise(
            dispatch,
            pulled.desk,
            at,
          )("RELEASE_PULL", {
            movementId: movement.id,
            reason: "pull_made_in_error",
            ...(pulled.actingUnitId ? { actingUnitId: pulled.actingUnitId } : {}),
            expectedPull: { unitId: pulled.entry.unitId, stageIndex },
          }),
        (outcome) => {
          const failure = wardCommandFailure(outcome);
          if (failure) {
            toast?.push({ tone: "warning", title: failure });
            return;
          }
          setKept((rows) => rows.filter((row) => row !== pulled));
          // The released pull leaves its movement open without a bed, as the patient page's Undo does.
          toast?.push({ tone: "success", title: `Bed pull undone for ${pulled.name}. The movement stays open.` });
        },
      );
    },
    [toast],
  );

  const onPulled = useCallback(
    (pulled: PulledBed) => {
      focusAfter.current = pulled.entry.referral.id;
      setKept((rows) => [pulled, ...rows.filter((row) => row.entry.referral.id !== pulled.entry.referral.id)]);
      const until = clockText(pullUndoUntil(pulled));
      // Shared parts spec item 4: one clock time in the words, no countdown; Undo stays on the row.
      toast?.push({
        tone: "success",
        title: `Bed pulled at ${pulled.entry.unitName} for ${pulled.name}`,
        body: `Undo until ${until}`,
        undo: { durationMs: UNDO_TOAST_MS, onUndo: () => undo(pulled) },
      });
    },
    [toast, undo],
  );

  const setPulling = useCallback((entry: AcceptedAwaitingPull | undefined) => {
    if (entry) focusAfter.current = null;
    setPullingState(entry);
  }, []);
  const close = useCallback(() => setPullingState(undefined), []);
  // Read once the sheet goes: after a pull, the next row; after Cancel, the opener (the sheet's own).
  const resolveReturnFocusTarget = useCallback(
    () => (focusAfter.current ? nextRowControl(focusAfter.current) : null),
    [],
  );

  const sheet = pulling ? (
    <Sheet
      open
      onClose={close}
      title="Pull the bed"
      description={`${pulling.unitName} has accepted. Check the facts, then pull.`}
      testId="home-pull-accepted-sheet"
      resolveReturnFocusTarget={resolveReturnFocusTarget}
    >
      <PullAcceptedReferral
        item={pulling}
        onDone={close}
        onPulled={flow ? onPulled : undefined}
        onCancel={close}
        actingUnitId={ownUnitIds?.includes(pulling.unitId) ? pulling.unitId : undefined}
      />
    </Sheet>
  ) : null;
  const shown = flow ? kept.filter((pulled) => pullStillUndoable(flow.movements, pulled, now)) : [];
  return { pulling, setPulling, sheet, kept: shown, undo };
}
