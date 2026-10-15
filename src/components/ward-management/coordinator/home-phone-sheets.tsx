"use client";

import { useMemo, useState } from "react";

import { Button, Sheet, StackBar, StatusGlyph, durMinutes, type StackSegment } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { shortlistCandidates } from "@/components/ward-management/ward-derivations";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { fitKind, type FitKind } from "./home-fit";
import { queueWaitThresholds } from "./priority-queue";
import styles from "./home.module.css";
/** People listed in a ward sheet, in queue order (mockup A ward sheet). */
const WARD_SHEET_PEOPLE = 6;

type BedsProps = {
  units: Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
};

function readyOf(unit: Unit, { admissions, bedReleases, leaveBeds }: Omit<BedsProps, "units">) {
  return bedStates(unit, admissions, bedReleases, leaveBeds);
}

type WardSheetProps = BedsProps & {
  unitId: string | undefined;
  queue: Movement[];
  now: Instant;
  onClose: () => void;
  /** Offer this ward to the chosen person (a fit with a bed): the screen's Offer with Undo. */
  onOffer: (movement: Movement, unit: Unit) => void;
  /** Open the chosen person's patient sheet (a review needs Placement and a reason). */
  onOpenPatient: (movementId: string) => void;
};

/**
 * Phone ward sheet (v10 Home, mockup A): the ward's beds as a bar and four facts, then who fits
 * it in queue order, and one primary at the foot: Offer to that person, or Open them when the fit
 * needs a review and a recorded reason.
 */
export function HomeWardSheet({
  unitId,
  units,
  admissions,
  bedReleases,
  leaveBeds,
  queue,
  now,
  onClose,
  onOffer,
  onOpenPatient,
}: WardSheetProps) {
  const patientOf = usePatientOf();
  const unit = unitId ? units.find((candidate) => candidate.id === unitId) : undefined;
  const fitting = useMemo(() => {
    if (!unit) return [];
    const found: { movement: Movement; kind: FitKind }[] = [];
    for (const movement of queue) {
      const candidate = shortlistCandidates(movement, [unit], now)[0];
      if (!candidate) continue;
      const kind = fitKind(candidate, movement);
      if (kind === "bed" || kind === "review") found.push({ movement, kind });
      if (found.length >= WARD_SHEET_PEOPLE) break;
    }
    return found;
  }, [unit, queue, now]);
  const [pick, setPick] = useState<string | undefined>(undefined);
  const chosen = fitting.find((row) => row.movement.id === pick) ?? fitting[0];

  if (!unit) return null;
  const states = readyOf(unit, { admissions, bedReleases, leaveBeds });
  const segments: StackSegment[] = [
    { id: "ready", value: states.ready, fill: "ready", label: "Ready" },
    { id: "pulled", value: states.pulled, hatch: true, label: "Pulled" },
    { id: "closed", value: states.closed, fill: "closed", label: "Closed" },
    { id: "occupied", value: states.occupied, fill: "data-3", label: "Occupied" },
  ];
  const chosenWho = chosen ? patientOf(chosen.movement) : undefined;

  return (
    <Sheet
      open
      onClose={onClose}
      title={unit.name}
      description={`${unit.cohort} · ${unit.beds} beds · ${siteByCode(unit.siteCode)?.service ?? "Health service not resolved"}`}
      mobilePlacement="bottom"
      testId="ward-home-ward-sheet"
      footer={
        chosen && chosenWho ? (
          chosen.kind === "bed" ? (
            <Button variant="pri" onClick={() => onOffer(chosen.movement, unit)}>
              Offer to {chosenWho.displayName}
            </Button>
          ) : (
            <Button variant="pri" onClick={() => onOpenPatient(chosen.movement.id)}>
              Open {chosenWho.displayName}
            </Button>
          )
        ) : (
          <p className={styles.emptyLine}>No one in the queue fits this ward now.</p>
        )
      }
    >
      <div className={styles.sheetBody}>
        <StackBar label={`${unit.name} beds`} segments={segments} />
        <dl className={styles.sheetFacts}>
          <div>
            <dt>Ready</dt>
            <dd className={styles.mono}>
              <StatusGlyph tone="success" size={9} />
              {states.ready}
            </dd>
          </div>
          <div>
            <dt>Being made ready</dt>
            <dd className={styles.mono}>{states.beingMadeReady}</dd>
          </div>
          <div>
            <dt>Pulled</dt>
            <dd className={styles.mono}>{states.pulled}</dd>
          </div>
          <div>
            <dt>Closed</dt>
            <dd className={styles.mono}>{states.closed}</dd>
          </div>
        </dl>
        <h3 className={styles.sheetSection}>
          Who fits, in queue order <span className={styles.mono}>{fitting.length}</span>
        </h3>
        <div role="radiogroup" aria-label="Who fits" className={styles.sheetPicks}>
          {fitting.map(({ movement, kind }) => {
            const who = patientOf(movement);
            const on = chosen?.movement.id === movement.id;
            const waited = Math.max(0, now - movement.openedAt);
            const overdue = waited >= queueWaitThresholds(movement.urgency).overdue;
            return (
              <button
                key={movement.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={styles.sheetPick}
                data-fit={kind}
                onClick={() => setPick(movement.id)}
              >
                <span className={styles.sheetPickName}>{who.formalName}</span>
                <span className={styles.sheetPickSub}>
                  T{movement.urgency} · <span className={styles.mono}>{durMinutes(waited)}</span>{" "}
                  {overdue ? "overdue" : "waiting"}
                </span>
                <span className={styles.sheetPickFit}>
                  <StatusGlyph tone={kind === "bed" ? "success" : "neutral"} size={9} />
                  {kind === "bed" ? "Fits" : "Review"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
