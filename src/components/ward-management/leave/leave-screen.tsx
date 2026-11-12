"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHead,
  FilterChip,
  Hero,
  HeroFigures,
  HeroTop,
  LiveChip,
  ShowMoreRow,
  StatusGlyph,
  foldHidden,
  foldLimit,
  tableClasses,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import {
  formatInstant,
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { ListPrintButton } from "@/components/ward-management/ward-list-print-button";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { wardNames } from "@/components/ward-management/tools/ward-tool-remind-store";
import pageTopStyles from "@/components/ward-management/page-top-title.module.css";
import { LEAVE_STATUS_LABEL, leaveTrackerRows, type LeaveStatus } from "./leave-tracker";
import styles from "./leave-screen.module.css";

/** Red for act now, as the Tools sheet's Due back already marks it: a person missing or overdue back. */
const STATUS_TONE: Record<LeaveStatus, WfTone> = {
  absent: "danger",
  overdue: "danger",
  due_today: "info",
  on_leave: "neutral",
};

/** The clock face in mono, the day words ("yesterday") in the text face. */
function LeaveTime({ instant, now }: { instant: Instant; now: Instant }) {
  const text = formatInstantWithDay(instant, now);
  const space = text.indexOf(" ");
  if (space < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, space)}
      <span className={styles.day}>{text.slice(space)}</span>
    </>
  );
}

/**
 * The ward page's Leave monitoring, where leave is ended: `#ward-leave-bed-form` opens the ward's
 * All discharges view (ward-screen.tsx reads the hash), the same address the ward's own links use.
 */
const leaveOnWardHref = (unitId: string) => `${unitHref(unitId)}#ward-leave-bed-form`;

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const LEAVE_ROWS = 8;

/**
 * Feature 23 (Josh, 9 Nov 2026): everyone on leave across the desk's wards, with where their bed is,
 * the kind of leave, when they left, when they are expected back and the status. Read only; leave is
 * recorded and ended from the ward's own page, which an overdue or absent row opens (Open ward).
 * Print uses the browser's own print, as the other lists do. Synthetic records only.
 */
export function LeaveScreen() {
  const { leaveBeds, units, admissions, bedReleases, resolvePatientIdentity, dayZero } = useWardFlowSelect(
    "leaveBeds",
    "units",
    "admissions",
    "bedReleases",
    "resolvePatientIdentity",
    "dayZero",
  );
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  const canOpenHref = useCanOpenHref();
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const isPhone = useIsPhone();
  const [showAll, setShowAll] = useState(false);
  // Paper prints every row, whatever the screen folds (the browser's own print command too).
  useEffect(() => {
    let wasOpen: boolean | null = null;
    const openAll = () =>
      flushSync(() =>
        setShowAll((open) => {
          wasOpen = open;
          return true;
        }),
      );
    const putBack = () => {
      if (wasOpen !== null) setShowAll(wasOpen);
      wasOpen = null;
    };
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", putBack);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", putBack);
    };
  }, []);
  const rows = useMemo(() => {
    const places = wardPlaceLookup(units);
    const names = wardNames(units);
    return leaveTrackerRows(
      { leaveBeds, units, admissions, bedReleases },
      now,
      (unitId) => unitInScope(access.scope, unitId, places),
      (unit) => names.get(unit.id) ?? unit.name,
    );
  }, [leaveBeds, units, admissions, bedReleases, now, access]);
  const needsAction = rows.filter((row) => row.status === "absent" || row.status === "overdue");
  const shown = needsActionOnly ? needsAction : rows;
  const dueToday = rows.filter((row) => row.status === "due_today").length;
  // Someone absent without leave is not "on leave"; they are counted under "overdue or absent".
  const onLeave = rows.filter((row) => row.status !== "absent").length;
  const hidden = showAll ? 0 : foldHidden(shown.length, LEAVE_ROWS);
  const visible = hidden > 0 ? shown.slice(0, foldLimit(shown.length, LEAVE_ROWS)) : shown;
  return (
    <main id="main-content" className={styles.main} data-testid="ward-leave-screen">
      <h1 className="sr-only">Leave</h1>
      <Hero
        testId="ward-leave-hero"
        className={pageTopStyles.hero}
        title="People on leave"
        aside={<LiveChip state="live" onHero age={formatInstant(now)} />}
      >
        <HeroTop
          testId="ward-leave-top"
          figures={
            <HeroFigures
              label="Leave figures"
              items={[
                { id: "on", value: onLeave, label: "on leave", testId: "ward-leave-figure-on" },
                { id: "today", value: dueToday, label: "due back today", testId: "ward-leave-figure-today" },
                {
                  id: "act",
                  value: needsAction.length,
                  label: "overdue or absent",
                  // Red only when someone is missing or overdue back: act now.
                  tone: needsAction.length > 0 ? "danger" : undefined,
                  testId: "ward-leave-figure-act",
                },
              ]}
            />
          }
        />
      </Hero>
      {/* On paper only: what the list holds and when, as the other printed lists say. */}
      <p className={styles.printScope} data-testid="ward-leave-print-scope">
        {needsActionOnly ? "Overdue or absent only" : "Everyone on leave"} · As at{" "}
        {formatSheetMoment(now, dayZero, { includeYearAndZone: true })} · Identifiers may be included
      </p>
      <Card aria-labelledby="ward-leave-list" className={styles.listCard}>
        <CardHead
          id="ward-leave-list"
          title="On leave"
          action={
            // Print sits with the list it prints, as on Legal forms and Movements, so the page title
            // keeps its own line height. On a phone the printer alone keeps the head on one line.
            <>
              <FilterChip pressed={needsActionOnly} onPressedChange={setNeedsActionOnly} count={needsAction.length}>
                Overdue or absent
              </FilterChip>
              <ListPrintButton iconOnly={isPhone} disabled={shown.length === 0} testId="ward-leave-print" />
            </>
          }
        />
        <CardBody flush>
          {shown.length === 0 ? (
            <p className={styles.empty}>{needsActionOnly ? "Nobody is overdue or absent." : "Nobody is on leave."}</p>
          ) : (
            <div className={styles.scroll}>
              <table
                id="ward-leave-table"
                className={`${tableClasses.table} ${styles.table}`}
                aria-labelledby="ward-leave-list"
              >
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Ward and bed</th>
                    <th scope="col">Leave</th>
                    <th scope="col">Left</th>
                    <th scope="col">Expected back</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const person = row.admission ? resolvePatientIdentity(row.admission) : undefined;
                    const name = person?.formalName ?? "Not recorded";
                    const patientId = person?.patient?.id;
                    return (
                      <tr
                        key={row.id}
                        data-testid={`ward-leave-row-${row.id}`}
                        data-status={row.status}
                        className={
                          row.status === "absent" || row.status === "overdue" ? tableClasses.actNow : undefined
                        }
                      >
                        <th scope="row" className={styles.person}>
                          {patientId ? <Link href={patientHref(patientId)}>{name}</Link> : name}
                          {person?.umrn ? <span className={styles.umrn}>{person.umrn}</span> : null}
                        </th>
                        <td className={styles.ward}>
                          {row.wardName}
                          <span className={styles.sub}>{row.bedLabel}</span>
                          {(row.status === "absent" || row.status === "overdue") &&
                          canOpenHref(unitHref(row.unitId)) ? (
                            <Link
                              href={leaveOnWardHref(row.unitId)}
                              className={styles.wardLink}
                              aria-label={`Open ward ${row.wardName}, where leave is ended`}
                              data-print-hide
                              data-testid={`ward-leave-open-ward-${row.id}`}
                            >
                              Open ward
                            </Link>
                          ) : null}
                        </td>
                        <td className={styles.kind}>{row.kind}</td>
                        <td className={styles.time}>
                          <span className={styles.phoneLabel}>Left </span>
                          <LeaveTime instant={row.leftAt} now={now} />
                        </td>
                        <td className={styles.time}>
                          <span className={styles.phoneLabel}>Back </span>
                          <LeaveTime instant={row.expectedReturn} now={now} />
                        </td>
                        <td className={styles.statusCell}>
                          <span className={styles.status}>
                            <StatusGlyph tone={STATUS_TONE[row.status]} size={9} />
                            {LEAVE_STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {foldHidden(shown.length, LEAVE_ROWS) > 0 ? (
            <div data-print-hide>
              <ShowMoreRow onClick={() => setShowAll((open) => !open)} expanded={showAll} controls="ward-leave-table">
                {showAll ? "Show fewer" : `Show ${hidden} more`}
              </ShowMoreRow>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <WardPrototypeFooter testId="ward-leave-footer" />
    </main>
  );
}
