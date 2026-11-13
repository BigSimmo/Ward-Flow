"use client";

// Wave 4 (D-191), ruling 11: the Ward page's pull step, which asks which of this ward's ready beds
// the person is going into. Loaded on first open from ward-pull-then-arrive.tsx.
// D-188 (tightened 13 Nov): when the record holds no observation level ("Not recorded", also from
// the ED board), the step asks for one first, in the Home pull form's words and choices, with
// nothing chosen. Review P4-3: a bed already held for this person is offered first and chosen.

import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";

import { Button, Radio, Sheet } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  observationAt,
  observationIsRecorded,
  observationLevelName,
  type Observation,
} from "@/components/ward-management/ward-observation";
import { CHOOSE_INTERVAL_LINE } from "@/components/ward-management/pull-bed-facts";
import { chooseFactsLine, pullFactSource, pullFactSourceText } from "@/components/ward-management/pull-bed-facts";
import { boardBedFits, fitReason, type BoardBed, type BoardPick } from "./ward-bed-board-logic";
import styles from "./ward-pull-then-arrive.module.css";

/** The lock line under a "not yet" Pull the bed. */
export const CHOOSE_BED_LINE = "Choose a bed first";

/** Beside a bed already held for this person (review P4-3). */
const HELD_FOR_THEM = "Held for them";

const pad = (bed: number) => String(bed).padStart(2, "0");

/** A level a person can choose ("not recorded" is not a level). */
type ChosenLevel = (typeof OBSERVATION_LEVELS)[number];

/** The step's answer: the bed (when asked) and the observation level (when the record had none). */
export type PullStepChoice = { bedNumber?: number; observation?: Observation };

/** Which of this ward's ready beds the person is going into, and their level when none is recorded. */
export function PullBedChoiceSheet({
  movement,
  name,
  unitName,
  beds,
  isMixed,
  askBed,
  heldBed,
  onChoose,
  onCancel,
}: {
  movement: Movement;
  name: string;
  unitName: string;
  beds: readonly BoardBed[];
  isMixed: boolean;
  /** False for a row's Pull the bed: only the observation level is asked. */
  askBed: boolean;
  /** The bed this ward already holds for this person, if any. */
  heldBed?: number;
  onChoose: (choice: PullStepChoice) => void;
  onCancel: () => void;
}) {
  const askLevel = !observationIsRecorded(movement.observation);
  const pick: BoardPick = {
    kind: "movement",
    movementId: movement.id,
    name,
    secureBedNeeded: movement.security === "Secure",
  };
  // Review P4-3: the bed already held for them is theirs, so it is offered first and chosen. Its tile
  // reads Incoming (held) or Ready; an occupied, away or closed bed is never offered.
  const held =
    heldBed === undefined
      ? undefined
      : beds.find(
          (candidate) =>
            Number(candidate.bedNumber) === heldBed &&
            (candidate.status === "ready" || candidate.status === "incoming"),
        );
  // The Bed board's own rule: ready, not held for anyone, not being made ready, the right kind.
  const offered = [
    ...(held ? [held] : []),
    ...beds.filter((candidate) => candidate !== held && boardBedFits(beds, candidate, pick, isMixed)),
  ];
  const [bed, setBed] = useState<number | undefined>(held ? Number(held.bedNumber) : undefined);
  const [level, setLevel] = useState<ChosenLevel | "">("");
  // D-187 "Intermittent blank": "Check every" opens with nothing chosen.
  const [intervalMinutes, setIntervalMinutes] = useState<number | "">("");
  const closed = beds
    .filter((candidate) => candidate.status === "closed")
    .map((candidate) => Number(candidate.bedNumber));
  const closedLine =
    closed.length === 0
      ? undefined
      : closed.length === 1
        ? `Bed ${pad(closed[0]!)} is closed and not listed.`
        : `${closed.length} closed beds are not listed.`;
  const bedReady = !askBed || (bed !== undefined && offered.some((candidate) => Number(candidate.bedNumber) === bed));
  const bedLine = offered.length === 0 ? `No ready bed fits at ${unitName}.` : CHOOSE_BED_LINE;
  const lockLine = askLevel
    ? (chooseFactsLine(level === "" ? ["observation"] : []) ??
      (level === "intermittent" && intervalMinutes === "" ? CHOOSE_INTERVAL_LINE : undefined) ??
      (bedReady ? undefined : bedLine))
    : bedReady
      ? undefined
      : bedLine;
  const ready = lockLine === undefined;
  const levelSource = pullFactSourceText(pullFactSource(false, level !== "", "", "ward"));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    const observation: Observation | undefined =
      !askLevel || level === ""
        ? undefined
        : level === "intermittent" && intervalMinutes !== ""
          ? { ...observationAt(level), intervalMinutes }
          : observationAt(level);
    onChoose({ ...(askBed ? { bedNumber: bed } : {}), ...(observation ? { observation } : {}) });
  }

  const description = askBed
    ? `No bed is pulled for ${name} at ${unitName}. Choose ${askLevel ? "their observation level and " : ""}the bed they are going into, then confirm the arrival.`
    : `No observation level is recorded for ${name}. Choose one before the bed is pulled at ${unitName}.`;

  return (
    <Sheet open onClose={onCancel} title="Pull the bed" description={description} testId="ward-pull-then-arrive">
      <form onSubmit={submit} className={styles.form}>
        {askLevel ? (
          <fieldset className={styles.fieldset} data-testid="ward-pull-then-arrive-observation">
            <legend className={styles.legend}>
              Observation level <span className={styles.source}>{levelSource}</span>
            </legend>
            <div className={styles.choices}>
              {OBSERVATION_LEVELS.map((choice) => (
                <Radio
                  key={choice}
                  className={styles.choice}
                  name={`ward-pull-observation-${movement.id}`}
                  value={choice}
                  checked={level === choice}
                  onChange={() => setLevel(choice)}
                  label={observationLevelName(choice)}
                />
              ))}
            </div>
            {level === "intermittent" ? (
              // Q36: kit radio choices, like the level above, rather than a browser drop-down; nothing
              // is chosen until the person picks one (D-187 "Intermittent blank").
              <fieldset
                className={`${styles.fieldset} ${styles.interval}`}
                data-testid="ward-pull-then-arrive-interval"
              >
                <legend className={styles.legend}>Check every</legend>
                <div className={styles.choices}>
                  {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                    <Radio
                      key={minutes}
                      className={styles.choice}
                      name={`ward-pull-interval-${movement.id}`}
                      value={String(minutes)}
                      checked={intervalMinutes === minutes}
                      onChange={() => setIntervalMinutes(minutes)}
                      label={`${minutes} minutes`}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}
          </fieldset>
        ) : null}
        {askBed ? (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Bed</legend>
            {offered.length === 0 ? (
              <p className={styles.none}>{bedLine}</p>
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
                          Bed {pad(number)}{" "}
                          <span className={styles.why}>
                            · {candidate === held ? HELD_FOR_THEM : fitReason(candidate, pick, isMixed)}
                          </span>
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
            {closedLine ? <p className={styles.note}>{closedLine}</p> : null}
          </fieldset>
        ) : null}
        <div className={styles.foot}>
          <span className={ready ? undefined : styles.notYet}>
            <Button
              variant="pri"
              size="md"
              type="submit"
              data-placement-action
              disabledReason={lockLine}
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
