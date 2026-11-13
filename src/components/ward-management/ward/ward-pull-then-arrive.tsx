"use client";

// Wave 4 (D-191), ruling 11 and approved build answer (d), review F-2: on the Ward page, Confirm
// arrival on a row with no pulled bed first opens a pull step that asks which ready bed. Only this
// ward's beds that are ready and fit are offered; a closed bed never is. The step sends the existing
// PULL_PATIENT, records the chosen bed with the existing PLACE_IN_BED, then opens the arrival. A
// refused pull opens nothing. Ruling 3: a bed pulled from a row keeps "Undo pull · until HH:MM" on
// that row for the Undo window; Undo is the existing RELEASE_PULL as "pull made in error", fenced
// to that exact pull (`expectedPull`). No engine or event change.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";

import { Button, Radio, Sheet, useOptionalToast } from "@/components/wf";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { boardBedFits, fitReason, type BoardBed, type BoardPick } from "./ward-bed-board-logic";
import { useWardCommandCompletion, wardCommandFailure } from "./use-ward-command-completion";
import styles from "./ward-pull-then-arrive.module.css";

/** The lock line under a "not yet" Pull the bed. */
export const CHOOSE_BED_LINE = "Choose a bed first";

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

/** Which of this ward's ready beds the person is going into. */
export function PullBedChoiceSheet({
  movement,
  name,
  unitName,
  beds,
  isMixed,
  onChoose,
  onCancel,
}: {
  movement: Movement;
  name: string;
  unitName: string;
  beds: readonly BoardBed[];
  isMixed: boolean;
  onChoose: (bedNumber: number) => void;
  onCancel: () => void;
}) {
  const [bed, setBed] = useState<number | undefined>();
  const pick: BoardPick = {
    kind: "movement",
    movementId: movement.id,
    name,
    secureBedNeeded: movement.security === "Secure",
  };
  // The Bed board's own rule: ready, not held for anyone, not being made ready, the right kind.
  const offered = beds.filter((candidate) => boardBedFits(beds, candidate, pick, isMixed));
  const closed = beds
    .filter((candidate) => candidate.status === "closed")
    .map((candidate) => Number(candidate.bedNumber));
  const closedLine =
    closed.length === 0
      ? undefined
      : closed.length === 1
        ? `Bed ${pad(closed[0]!)} is closed and not listed.`
        : `${closed.length} closed beds are not listed.`;
  const ready = bed !== undefined && offered.some((candidate) => Number(candidate.bedNumber) === bed);
  const lockLine = offered.length === 0 ? `No ready bed fits at ${unitName}.` : CHOOSE_BED_LINE;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) onChoose(bed);
  }

  return (
    <Sheet
      open
      onClose={onCancel}
      title="Pull the bed"
      description={`No bed is pulled for ${name} at ${unitName}. Choose the bed they are going into, then confirm the arrival.`}
      testId="ward-pull-then-arrive"
    >
      <form onSubmit={submit} className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Bed</legend>
          {offered.length === 0 ? (
            <p className={styles.none}>{lockLine}</p>
          ) : (
            <div className={styles.choices}>
              {offered.map((candidate) => {
                const number = Number(candidate.bedNumber);
                return (
                  <Radio
                    key={number}
                    className={styles.choice}
                    name={`ward-pull-bed-${movement.id}`}
                    value={String(number)}
                    checked={bed === number}
                    onChange={() => setBed(number)}
                    label={
                      <span>
                        Bed {pad(number)} <span className={styles.why}>· {fitReason(candidate, pick, isMixed)}</span>
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
          {closedLine ? <p className={styles.note}>{closedLine}</p> : null}
        </fieldset>
        <div className={styles.foot}>
          <span className={ready ? undefined : styles.notYet}>
            <Button
              variant="pri"
              size="md"
              type="submit"
              data-placement-action
              disabledReason={ready ? undefined : lockLine}
              reasonDisplay="tooltip"
              onClick={(event) => {
                if (!ready) event.preventDefault();
              }}
            >
              Pull the bed
            </Button>
            {ready ? null : (
              <span className={styles.lock} aria-hidden="true">
                <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
                {lockLine}
              </span>
            )}
          </span>
          <Button variant="ghost" size="md" type="button" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
