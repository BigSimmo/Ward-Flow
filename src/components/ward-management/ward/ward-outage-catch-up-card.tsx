"use client";

import { Button, Card, CardHead, StatusGlyph, useOptionalToast } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { Unit } from "@/components/ward-management/ward-model";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { savedAtToast } from "@/components/ward-management/ward-saved-at-toast";
import { useWardOutageCatchUp } from "@/components/ward-management/use-outage-catch-up";

import { useWardCommandCompletion, wardCommandFailure } from "./use-ward-command-completion";
import styles from "./ward-outage-catch-up-card.module.css";

export type WardCatchUpActions = {
  /** Arrivals and admissions (the ward's Coming in list). */
  onAdmissions: () => void;
  /** The ward's discharges. */
  onDischarges: () => void;
  /** Place or move (the bed board). */
  onMoves: () => void;
  /** The full bed list, where a bed is closed, opened or cleaned. */
  onBedChanges: () => void;
};

/**
 * CATCH UP AFTER THE OUTAGE (Batch 4 item 25, Josh approved the drawing 11 Nov 2026, D-142). My
 * ward's card, shown only once the coordinator has recorded an outage (`RECORD_OUTAGE_WINDOW`) and
 * until this ward confirms its beds since it ended. Each row opens the ward's existing place for that
 * work; Beds still correct is the existing confirmation (`CONFIRM_CAPACITY`, today's figure, as the
 * ward). Only the ward's own confirmation clears it, so a site bed manager viewing the ward is not
 * shown the card. A prompt only: it changes no bed figure and guesses nothing.
 */
export function WardOutageCatchUpCard({
  unit,
  now,
  actions,
}: {
  unit: Unit;
  now: Instant;
  actions: WardCatchUpActions;
}) {
  const routeRole = useRouteRole();
  const catchUp = useWardOutageCatchUp(unit, now);
  const raise = useWardRaise("ward");
  const completeCommand = useWardCommandCompletion();
  const toast = useOptionalToast();
  if (catchUp === null || catchUp.caughtUp || routeRole === "bed_manager") return null;
  const { outage } = catchUp;
  const by = WARD_FLOW_ROLE_LABELS[outage.by]?.toLowerCase() ?? "the coordinator";
  const rows = [
    {
      id: "admissions",
      title: "Admissions",
      sub: "People admitted on paper",
      action: "Add admission",
      run: actions.onAdmissions,
    },
    {
      id: "discharges",
      title: "Discharges",
      sub: "People who left on paper",
      action: "Record discharge",
      run: actions.onDischarges,
    },
    { id: "moves", title: "Moves", sub: "Bed or ward moves on paper", action: "Record move", run: actions.onMoves },
    {
      id: "beds",
      title: "Bed changes",
      sub: "Beds closed, opened or cleaned",
      action: "Change a bed",
      run: actions.onBedChanges,
    },
  ];
  const confirm = () => {
    const figure = unit.allocatable;
    completeCommand(
      "capacity-rollup",
      () =>
        raise("CONFIRM_CAPACITY", {
          unitId: unit.id,
          actingUnitId: unit.id,
          value: figure.value,
          expectedRevision: figure.revision ?? 0,
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) toast?.push({ tone: "warning", title: failure });
        else savedAtToast(toast, `Beds confirmed: ${figure.value} of ${unit.beds}`, now);
      },
    );
  };
  return (
    <Card aria-labelledby="ward-catch-up-title" className={styles.card} data-testid="ward-outage-catch-up">
      <CardHead
        id="ward-catch-up-title"
        title="Catch up after the outage"
        meta={`Down ${formatInstantWithDay(outage.from, now)} to ${formatInstantWithDay(outage.to, now)} · recorded by the ${by}`}
      />
      <p className={styles.lead}>
        {catchUp.lastPackPrintedAt === null ? (
          "Enter admissions, discharges, moves and bed changes done on paper."
        ) : (
          <>
            Since your pack at <b>{formatInstantWithDay(catchUp.lastPackPrintedAt, now)}</b>, enter admissions,
            discharges, moves and bed changes done on paper.
          </>
        )}
      </p>
      <ul className={styles.rows} aria-label="Done on paper">
        {rows.map((row) => (
          <li key={row.id} className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{row.title}</span>
              <span className={styles.rowSub}>{row.sub}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={row.run} data-testid={`ward-catch-up-open-${row.id}`}>
              {row.action}
            </Button>
          </li>
        ))}
      </ul>
      <div className={styles.foot}>
        <span className={styles.footNote} data-testid="ward-catch-up-beds">
          <StatusGlyph tone="neutral" size={9} />
          {unit.beds} {unit.beds === 1 ? "bed" : "beds"} not confirmed since the outage
        </span>
        <Button variant="pri" size="sm" onClick={confirm} data-testid="ward-catch-up-confirm">
          Beds still correct
        </Button>
      </div>
    </Card>
  );
}
