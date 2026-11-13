"use client";

// Wave 4 (D-191), ruling 11 and approved build answer (d), review F-2: on the Ward page, Confirm
// arrival on a row with no pulled bed first opens a pull step that asks which ready bed. Only this
// ward's beds that are ready and fit are offered; a closed bed never is. The step sends the existing
// PULL_PATIENT, records the chosen bed with the existing PLACE_IN_BED, then opens the arrival. A
// refused pull opens nothing. Ruling 3: a bed pulled from a row keeps "Undo pull · until HH:MM" on
// that row for the Undo window; Undo is the existing RELEASE_PULL as "pull made in error", fenced
// to that exact pull (`expectedPull`). No engine or event change.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { useOptionalToast } from "@/components/wf";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { BoardBed } from "./ward-bed-board-logic";
import { useWardCommandCompletion, wardCommandFailure } from "./use-ward-command-completion";

// The bed choice opens only from a row's Confirm arrival, so it loads then (phone size limit, 13 Nov 2026).
const PullBedChoiceSheet = dynamic(
  withLoadRetry(() => import("./ward-pull-bed-choice-sheet").then((m) => m.PullBedChoiceSheet)),
  { ssr: false },
);

/** A pull sent from a Ward row. Its kept Undo and its arrival are read from the record, never guessed. */
type SentPull = {
  /** The movement's stage changes when the pull was sent: the pull made here is the first after these. */
  stageCount: number;
  /** The bed chosen in the pull step; the arrival opens once the pull is recorded. */
  arriveBed?: number;
};

const pad = (bed: number) => String(bed).padStart(2, "0");

/**
 * The pull made here: the first `to: "pulled"` stage change after `since`, while it is still the
 * movement's latest step. Undefined before it is recorded, after a refusal, and once released or
 * replaced, so an Undo never releases a different pull.
 */
export function pullMadeHere(
  movement: Movement | undefined,
  since: number,
): { stageIndex: number; at: Instant } | undefined {
  if (!movement || movement.closure || movement.stage !== "pulled") return undefined;
  const index = movement.stageChanges.findIndex((change, at) => at >= since && change.to === "pulled");
  const change = movement.stageChanges[index];
  return change && index === movement.stageChanges.length - 1 ? { stageIndex: index, at: change.at } : undefined;
}

export type WardPullThenArrive = {
  /** The movement whose pull step is open, if any. */
  asking: string | undefined;
  /** Confirm arrival on a row with no pulled bed: opens the pull step. */
  onPullThenArrive: (movementId: string) => void;
  /** Pull the bed from a row, keeping its inline Undo once the pull is recorded. */
  pullAndKeep: (movementId: string) => void;
  /** The pull step's answer: pull into this bed, then open the arrival. */
  choose: (bedNumber: number) => void;
  cancel: () => void;
  /** "Undo pull · until 10:46" for a row pulled here, while that exact pull stands and the window is open. */
  undoPullFor: (movementId: string) => { label: string; run: () => void } | null;
};

/** The ward screen's own steps the pull step runs: its Pull the bed (refusal and override form unchanged). */
type WardScreenSteps = {
  handlePullPatient: (movementId: string, unitId: string, report?: (recorded?: boolean) => void) => void;
  openArrival: (movementId: string) => void;
};

/** Called before the ward screen's not-found return, with that screen's own pull and arrival steps. */
export function useWardPullThenArrive(unitId: string, raise: WardRaise, screen: WardScreenSteps): WardPullThenArrive {
  const { movements, admissions, resolvePatientIdentity } = useWardFlowSelect(
    "movements",
    "admissions",
    "resolvePatientIdentity",
  );
  const now = useWardFlowClock();
  const [asking, setAsking] = useState<string | undefined>();
  const [sent, setSent] = useState<Readonly<Record<string, SentPull>>>({});
  const complete = useWardCommandCompletion();
  const toast = useOptionalToast();
  const latest = useRef({ admissions, screen, raise });
  useEffect(() => {
    latest.current = { admissions, screen, raise };
  });
  // Arrivals already opened for a pull made here, so each opens once.
  const arrived = useRef(new Set<string>());
  // Review FA-2: after Undo pull the row's Undo button is gone, so focus would drop to the page. Once
  // the row shows Pull the bed again, focus moves there; if the row has left the list, to the
  // Arrivals heading.
  const focusAfterUndo = useRef<string | undefined>(undefined);
  useEffect(() => {
    const movementId = focusAfterUndo.current;
    if (movementId === undefined || typeof document === "undefined") return;
    const row = document.querySelector(`[data-testid="ward-coming-row-${CSS.escape(movementId)}"]`);
    const pull = row?.querySelector<HTMLElement>("[data-placement-action]");
    if (row && !pull) return; // The row has not redrawn yet; try after the next render.
    focusAfterUndo.current = undefined;
    (pull ?? document.getElementById("ward-coming-arrivals"))?.focus();
  });

  const forget = (movementId: string) =>
    setSent((current) => {
      const rest = { ...current };
      delete rest[movementId];
      return rest;
    });

  function send(movementId: string, arriveBed?: number) {
    const movement = movements.find((candidate) => candidate.id === movementId);
    if (!movement) return;
    const stageCount = movement.stageChanges.length;
    setSent((current) => ({
      ...current,
      [movementId]: { stageCount, ...(arriveBed === undefined ? {} : { arriveBed }) },
    }));
    screen.handlePullPatient(movementId, unitId, (recorded) => {
      if (recorded === false) forget(movementId);
    });
  }

  // Once the record shows a pull sent from the pull step: record the chosen bed, then open the arrival.
  useEffect(() => {
    for (const [movementId, entry] of Object.entries(sent)) {
      if (entry.arriveBed === undefined) continue;
      const movement = movements.find((candidate) => candidate.id === movementId);
      const pulled = pullMadeHere(movement, entry.stageCount);
      const key = `${movementId}:${entry.stageCount}`;
      if (!pulled || arrived.current.has(key)) continue;
      arrived.current.add(key);
      const bed = entry.arriveBed;
      const { admissions: stays, screen: steps, raise: place } = latest.current;
      const admission = stays.find((stay) => stay.id === movement?.admissionId);
      if (!admission || admission.bedNumber === bed) {
        steps.openArrival(movementId);
        continue;
      }
      complete(
        `pull-then-arrive:${movementId}`,
        () => place("PLACE_IN_BED", { admissionId: admission.id, bedNumber: bed, actingUnitId: unitId }),
        (outcome) => {
          const failure = wardCommandFailure(outcome);
          // The bed stays pulled either way; a refused bed number is said, and the arrival still opens.
          if (failure)
            toast?.push({
              tone: "warning",
              title: `The bed is pulled, but Bed ${pad(bed)} is not recorded. Choose the bed on the Bed board.`,
              body: failure,
            });
          steps.openArrival(movementId);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the record or the sent pulls change; the screen's steps are read through `latest`.
  }, [movements, sent]);

  function undoPullFor(movementId: string) {
    const entry = sent[movementId];
    if (!entry) return null;
    const movement = movements.find((candidate) => candidate.id === movementId);
    const pulled = pullMadeHere(movement, entry.stageCount);
    const until = pulled ? pulled.at + UNDO_WINDOW_MINUTES : undefined;
    if (!pulled || until === undefined || now > until) return null;
    return {
      label: `Undo pull · until ${formatInstant(until)}`,
      run: () =>
        complete(
          `pull-undo:${movementId}`,
          () =>
            raise("RELEASE_PULL", {
              movementId,
              actingUnitId: unitId,
              reason: "pull_made_in_error",
              expectedPull: { unitId, stageIndex: pulled.stageIndex },
            }),
          (outcome) => {
            const failure = wardCommandFailure(outcome);
            if (failure) {
              toast?.push({ tone: "warning", title: failure });
              return;
            }
            focusAfterUndo.current = movementId;
            forget(movementId);
            const who = resolvePatientIdentity(movement).formalName;
            toast?.push({ tone: "success", title: `Bed pull undone for ${who}. The movement stays open.` });
          },
        ),
    };
  }

  return {
    asking,
    onPullThenArrive: setAsking,
    pullAndKeep: (movementId) => send(movementId),
    choose: (bedNumber) => {
      const movementId = asking;
      setAsking(undefined);
      if (movementId) send(movementId, bedNumber);
    },
    cancel: () => setAsking(undefined),
    undoPullFor,
  };
}

/** The pull step, open while `step.asking` names a movement on the record. */
export function WardPullBedChoice({
  step,
  unitName,
  beds,
  isMixed,
}: {
  step: WardPullThenArrive;
  unitName: string;
  beds: readonly BoardBed[];
  isMixed: boolean;
}) {
  const { movements, resolvePatientIdentity } = useWardFlowSelect("movements", "resolvePatientIdentity");
  const movement = step.asking ? movements.find((candidate) => candidate.id === step.asking) : undefined;
  if (!movement) return null;
  return (
    <PullBedChoiceSheet
      key={movement.id}
      movement={movement}
      name={resolvePatientIdentity(movement).formalName}
      unitName={unitName}
      beds={beds}
      isMixed={isMixed}
      onChoose={step.choose}
      onCancel={step.cancel}
    />
  );
}
