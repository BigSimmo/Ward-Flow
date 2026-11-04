"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button, Drawer, buttonClass, durMinutes } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { forecastLeverRecords, type ForecastLever } from "@/components/ward-management/forecast/forecast-levers";

import type { NetworkWardRow } from "./capacity-derivations";
import { HELD_UP_HREF } from "./capacity-held-up";
import styles from "./capacity-page.module.css";

const DISCHARGES_HREF = "/ward-flow/discharges";

/** A row of "What would help tomorrow": one of the forecast's levers, or one of the page's own. */
export type HelpItem =
  | { kind: ForecastLever["kind"]; title: string; uplift: number; detail: string }
  | { kind: "stale_counts"; title: string; rows: NetworkWardRow[] }
  | { kind: "being_made_ready"; title: string; rows: NetworkWardRow[] };

/**
 * Capacity issue 3 (Josh, 3 Nov 2026): each "What would help tomorrow" line opens here instead of
 * leaving the page. The pop-up lists the stays or wards behind the line, each opening its patient
 * or ward, and the full page is one button at the foot.
 */
export function LeverPopup({
  item,
  now,
  onClose,
  onWard,
  onAskWard,
}: {
  item: HelpItem | null;
  now: number;
  onClose: () => void;
  onWard: (unitId: string) => void;
  onAskWard?: (unitId: string) => void;
}) {
  const { units, bedReleases, admissions } = useWardFlowSelect("units", "bedReleases", "admissions");
  const patientOf = usePatientOf();
  const canOpen = useCanOpenHref();
  const records = useMemo(
    () =>
      item && (item.kind === "clear_held_up" || item.kind === "confirm_dates" || item.kind === "review_overdue")
        ? forecastLeverRecords(item.kind, units, bedReleases, admissions, now)
        : [],
    [item, units, bedReleases, admissions, now],
  );
  const pageHref = item?.kind === "clear_held_up" ? HELD_UP_HREF : DISCHARGES_HREF;
  const wardLevel = item?.kind === "stale_counts" || item?.kind === "being_made_ready";
  return (
    <Drawer
      open={item !== null}
      onClose={onClose}
      title={item?.title ?? "What would help tomorrow"}
      description={item ? describe(item) : undefined}
      testId="capacity-lever-popup"
      footer={
        !wardLevel && canOpen(pageHref) ? (
          <div className={styles.popFoot}>
            <Link href={pageHref} className={buttonClass({ variant: "pri" })}>
              Open Discharges
            </Link>
          </div>
        ) : undefined
      }
    >
      {item ? (
        <div className={styles.popBody}>
          {wardLevel ? (
            <ul className={styles.popList}>
              {item.rows.map((row) => (
                <li key={row.unit.id} className={styles.popRowWrap}>
                  <button type="button" className={styles.popRow} onClick={() => onWard(row.unit.id)}>
                    <span className={styles.popMain}>
                      <span className={styles.popName}>
                        <SpelledCodes text={row.unit.name} />
                      </span>
                      <span className={styles.mutedXs}>
                        {item.kind === "stale_counts"
                          ? `Count ${durMinutes(Math.max(0, now - row.confirmedAt))} old`
                          : `${row.pendingPreparation ?? 0} being made ready · ${row.ready} ready now`}
                      </span>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" className={styles.helpChevron} />
                  </button>
                  {item.kind === "stale_counts" && onAskWard ? (
                    <Button size="sm" variant="sec" onClick={() => onAskWard(row.unit.id)}>
                      Ask the ward
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : records.length === 0 ? (
            <p className={styles.popEmpty}>Nothing on record for this now.</p>
          ) : (
            <ul className={styles.popList}>
              {records.map((record) => {
                const who = patientOf(record.admission);
                const href = who.patient ? patientHref(who.patient.id) : null;
                const passed = record.at !== null && record.at < now;
                const inner = (
                  <>
                    <span className={styles.popMain}>
                      <span className={styles.popName}>{who.formalName}</span>
                      <span className={styles.mutedXs}>
                        <SpelledCodes text={record.unit.name} /> ·{" "}
                        {record.at === null ? "Date not recorded" : `Expected ${formatInstantWithDay(record.at, now)}`}
                      </span>
                    </span>
                    {record.blocker ? (
                      <span className={`${styles.tag} ${styles.wdTagWarn}`}>{record.blocker}</span>
                    ) : passed ? (
                      <span className={`${styles.tag} ${styles.wdTagWarn}`}>Date passed</span>
                    ) : null}
                  </>
                );
                return (
                  <li key={record.admission.id}>
                    {href && canOpen(href) ? (
                      <Link href={href} className={styles.popRow}>
                        {inner}
                        <ChevronRight size={14} aria-hidden="true" className={styles.helpChevron} />
                      </Link>
                    ) : (
                      <span className={styles.popRow}>{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

function describe(item: HelpItem): string {
  switch (item.kind) {
    case "clear_held_up":
      return item.uplift > 0
        ? `Clearing these could add up to ${item.uplift} to tomorrow's figure.`
        : "Held up by the blockers shown. Clearing them widens tomorrow's range only.";
    case "confirm_dates":
      return "Dates recorded on the stay but not yet on the discharge list. Confirming them firms up tomorrow.";
    case "review_overdue":
      return "Discharge dates have passed with nothing holding them up. Each needs a new date or a discharge.";
    case "stale_counts":
      return "These wards have not confirmed their beds within their threshold, so their ready figure may be out.";
    case "being_made_ready":
      return "Beds being cleaned or prepared. They already count as ready, so finishing them makes the count true rather than adding to it.";
  }
}
