"use client";

import { useMemo } from "react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import Link from "next/link";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { leaveBedLabels, leaveDueToday } from "@/components/ward-management/leave/leave-tracker";
import { WARD_LEAVE_HREF } from "@/components/ward-management/ward-nav";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EmptyState, StatusGlyph } from "@/components/wf";
import { wardNames } from "./ward-tool-remind-store";
import styles from "./ward-tool-leave-due.module.css";

type DueRow = { id: string; bedLabel: string; dueAt: Instant; overdue: boolean };
type DueWard = { unitId: string; name: string; rows: DueRow[] };

function useLeaveDue(): { wards: DueWard[]; absent: number } {
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
      const due = unitLeave.filter((leave) => leaveDueToday(leave, now));
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
    // An absence without leave is not "due back"; the panel says how many it leaves to the Leave page.
    const absent = leaveBeds.filter((leave) => leave.absentWithoutLeave).length;
    // A ward desk's own ward first, then the rest in network order.
    return {
      wards: wards.sort((left, right) => Number(own.has(right.unitId)) - Number(own.has(left.unitId))),
      absent,
    };
  }, [leaveBeds, units, admissions, bedReleases, now, access]);
}

/** Leave beds due back today, for the Tools row count. */
export function useLeaveDueCount(): number {
  return useLeaveDue().wards.reduce((sum, ward) => sum + ward.rows.length, 0);
}

/** Q326: who is due back from leave today, by ward. Beds only, never a name. */
export function ToolLeaveDue({ onNavigate }: { onNavigate: () => void }) {
  const { wards, absent } = useLeaveDue();
  const now = useWardFlowClock();
  // Feature 23: the full Leave page, everyone on leave with their status. Polish (9 Nov 2026): the
  // page also lists anyone absent without leave, so the panel says why its count is smaller.
  const seeAll = (
    <>
      {absent > 0 ? (
        <p className={styles.absentNote} data-testid="tool-leave-due-absent">
          {absent} absent without leave, not counted here.
        </p>
      ) : null}
      <Link href={WARD_LEAVE_HREF} className={styles.seeAll} onClick={onNavigate}>
        See all leave
      </Link>
    </>
  );
  if (wards.length === 0)
    return (
      <div className={styles.tool}>
        <EmptyState title="Nobody due back today." />
        {seeAll}
      </div>
    );
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
      {seeAll}
    </div>
  );
}
