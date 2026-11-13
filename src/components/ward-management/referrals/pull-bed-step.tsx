"use client";

// Wave 4 (H4, H5; ruling items 1 and 3): the Pull the bed step as one reusable part. Home and Alerts
// open it from their act-now rows; the Ward page can open it before an arrival. It owns the sheet,
// the toast with Undo, the pulled rows kept for the Undo window, and where focus goes after a pull.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

/** The kept row for a pulled referral, while it shows. */
function keptRow(referralId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${PULLED_ROW_ATTRIBUTE}="${CSS.escape(referralId)}"]`);
}

/** The list a row sits in (Act now): its own section or region. */
function rowRegion(row: HTMLElement): HTMLElement | null {
  return row.closest<HTMLElement>("section, [role='region']") ?? row.parentElement;
}

/** A list region takes focus for this hand-over only, so it never joins the tab order. */
function focusableRegion(region: HTMLElement): HTMLElement {
  if (!region.hasAttribute("tabindex")) {
    region.setAttribute("tabindex", "-1");
    region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
  }
  return region;
}

/**
 * Ruling 3 (D-191): after a pull, focus goes to the next row's first control (its name, the row's
 * open control), skipping kept pulled rows; with none left, to the list's own region (Act now).
 */
function nextRowControl(referralId: string): HTMLElement | null {
  const kept = keptRow(referralId);
  if (!kept) return null;
  const region = rowRegion(kept);
  if (!region) return null;
  const rows = Array.from(region.querySelectorAll<HTMLElement>("li"));
  const after = rows.slice(rows.indexOf(kept) + 1).filter((row) => !row.hasAttribute(PULLED_ROW_ATTRIBUTE));
  for (const row of after) {
    const control = row.querySelector<HTMLElement>("button:not([disabled]), a[href]");
    if (control) return control;
  }
  return focusableRegion(region);
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
  // Review FR-1: each pull's own toast, so the row's Undo can close it (its Undo would act twice).
  const pullToasts = useRef(new Map<string, string>());
  // Review FA-2: after Undo pull the kept row and its button go, so focus would drop to the page.
  // Once the row has redrawn, focus moves to its Pull the bed again; if it has left, to the list.
  const focusAfterUndo = useRef<{ referralId: string; region: HTMLElement | null } | null>(null);
  useEffect(() => {
    const pending = focusAfterUndo.current;
    if (!pending || typeof document === "undefined") return;
    if (keptRow(pending.referralId)) return; // The kept row has not gone yet; try after the next render.
    focusAfterUndo.current = null;
    const restored = Array.from(
      document.querySelectorAll<HTMLElement>(`li[data-referral-id="${CSS.escape(pending.referralId)}"]`),
    )
      .map((row) => row.querySelector<HTMLElement>("[data-placement-action]:not([disabled])"))
      .find((control): control is HTMLElement => control !== null);
    const region = pending.region?.isConnected ? focusableRegion(pending.region) : null;
    (restored ?? region)?.focus();
  });
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
          const referralId = pulled.entry.referral.id;
          const row = keptRow(referralId);
          // Only when focus was on the kept row (its Undo) or already lost; never pulled from elsewhere.
          const active = document.activeElement;
          if (row && (row.contains(active) || active === document.body || active === null))
            focusAfterUndo.current = { referralId, region: rowRegion(row) };
          const toastId = pullToasts.current.get(referralId);
          if (toastId !== undefined) {
            pullToasts.current.delete(referralId);
            toast?.dismiss(toastId);
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
      const toastId = toast?.push({
        tone: "success",
        title: `Bed pulled at ${pulled.entry.unitName} for ${pulled.name}`,
        body: `Undo until ${until}`,
        undo: { durationMs: UNDO_TOAST_MS, onUndo: () => undo(pulled) },
      });
      if (toastId !== undefined) pullToasts.current.set(pulled.entry.referral.id, toastId);
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
