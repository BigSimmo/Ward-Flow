"use client";

// Wave 4 (D-191), ruling 11: the Ward page's pull step, which asks which of this ward's ready beds
// the person is going into. Loaded on first open from ward-pull-then-arrive.tsx.

import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";

import { Button, Radio, Sheet } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import { boardBedFits, fitReason, type BoardBed, type BoardPick } from "./ward-bed-board-logic";
import styles from "./ward-pull-then-arrive.module.css";

/** The lock line under a "not yet" Pull the bed. */
export const CHOOSE_BED_LINE = "Choose a bed first";

const pad = (bed: number) => String(bed).padStart(2, "0");

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
