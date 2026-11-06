"use client";

import { useMemo } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { dayOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EmptyState, StatusGlyph } from "@/components/wf";
import { wardNames } from "./ward-tool-remind-store";
import styles from "./ward-tool-leave-due.module.css";

type DueRow = { id: string; bedLabel: string; dueAt: Instant; overdue: boolean };
type DueWard = { unitId: string; name: string; rows: DueRow[] };

/**
 * Leave beds due back by the end of today, and any already overdue. An absence without leave is
 * left out: that bed is not "due back", and the ward's own page carries it.
 */
function dueToday(leave: LeaveBed, now: Instant): boolean {
  return !leave.absentWithoutLeave && dayOf(leave.expectedReturn) <= dayOf(now);
}

/**
 * The bed a leave record holds. The ward's recorded bed number when it has one; otherwise the bed
 * board's own order (ready beds first, then each leave record), so the label matches the board.
 */
function leaveBedLabels(
  unit: Unit,
  unitLeave: readonly LeaveBed[],
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
): Map<string, string> {
  const ready = bedStates(unit, admissions, bedReleases, leaveBeds).ready;
  const labels = new Map<string, string>();
  unitLeave.forEach((leave, index) => {
    const recorded = admissions.find((admission) => admission.id === leave.admissionId)?.bedNumber;
    const number = recorded ?? ready + index + 1;
    labels.set(leave.id, `Bed ${String(number).padStart(2, "0")}`);
  });
  return labels;
}

function useLeaveDue(): DueWard[] {
  const { leaveBeds, units, admissions, bedReleases } = useWardFlowSelect(
    "leaveBeds",
    "units",
    "admissions",
    "bedReleases",
  );
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  return useMemo(() => {
    const own = access.scope.kind === "ward" ? new Set(access.scope.unitIds) : new Set<string>();
    const names = wardNames(units);
    const wards: DueWard[] = [];
    for (const unit of units) {
      const unitLeave = leaveBeds.filter((leave) => leave.unitId === unit.id);
      const due = unitLeave.filter((leave) => dueToday(leave, now));
      if (due.length === 0) continue;
      const labels = leaveBedLabels(unit, unitLeave, admissions, bedReleases, leaveBeds);
      wards.push({
        unitId: unit.id,
        name: names.get(unit.id) ?? unit.name,
        rows: due
          .map((leave) => ({
            id: leave.id,
            bedLabel: labels.get(leave.id) ?? "Bed on leave",
            dueAt: leave.expectedReturn,
            overdue: leave.expectedReturn < now,
          }))
          .sort((left, right) => left.dueAt - right.dueAt),
      });
    }
    // A ward desk's own ward first, then the rest in network order.
    return wards.sort((left, right) => Number(own.has(right.unitId)) - Number(own.has(left.unitId)));
  }, [leaveBeds, units, admissions, bedReleases, now, access]);
}

/** Leave beds due back today, for the Tools row count. */
export function useLeaveDueCount(): number {
  return useLeaveDue().reduce((sum, ward) => sum + ward.rows.length, 0);
}

/** Q326: who is due back from leave today, by ward. Beds only, never a name. */
export function ToolLeaveDue({ onNavigate }: { onNavigate: () => void }) {
  void onNavigate;
  const wards = useLeaveDue();
  const now = useWardFlowClock();
  if (wards.length === 0) return <EmptyState title="Nobody due back today." />;
  return (
    <div className={styles.tool}>
      {wards.map((ward) => (
        <section key={ward.unitId} className={styles.ward} aria-labelledby={`leave-due-${ward.unitId}`}>
          <h4 className={styles.wardName} id={`leave-due-${ward.unitId}`}>
            {ward.name}
            <span className={styles.count}>{ward.rows.length}</span>
          </h4>
          <ul className={styles.list}>
            {ward.rows.map((row) => (
              <li key={row.id} className={styles.row}>
                <span className={styles.bed}>{row.bedLabel}</span>
                <span className={styles.due}>
                  {row.overdue ? (
                    <span className={styles.overdue}>
                      <StatusGlyph tone="danger" size={9} />
                      Overdue
                    </span>
                  ) : (
                    <span className={styles.back}>Back</span>
                  )}
                  <span className={styles.time}>{formatInstantWithDay(row.dueAt, now)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
