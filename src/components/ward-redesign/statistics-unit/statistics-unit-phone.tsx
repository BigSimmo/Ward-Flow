"use client";
// One ward on a phone, split out of statistics-unit-redesign.tsx to keep that file under the line cap.

import { useState } from "react";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";

import { Button, PhoneListRow, Segmented, StatusGlyph, cx } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, dayOf } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { BED_MAP_LABELS, type BedMap } from "@/components/ward-management/statistics/statistics-bed-map";
import {
  PhoneBody,
  PhoneList,
  PhonePinnedAction,
  phoneBodyStyles as phone,
} from "@/components/ward-management/statistics/statistics-phone-parts";
import { dateOf, isPastDate } from "@/components/ward-management/statistics/statistics-dates";
import { PeopleNotListed } from "@/components/ward-management/statistics/statistics-small-numbers";
import redesign from "./statistics-unit.module.css";
import { StayKey, bandIndexOf } from "./statistics-unit-bed-map";

export const ROSTER_FIRST_ROWS = 8;

export const ADMISSION_STATE_LABELS: Record<Admission["state"], string> = {
  waitlisted: "On waiting list",
  pulled: "Pulled",
  occupied: "In bed",
  departed: "Departed",
};

/** Whole days since arrival, or null when the person has not arrived (or the record says later). */
export function stayDaysOf(admission: Admission, now: number): number | null {
  if (admission.arrivedAt === null || admission.arrivedAt > now) return null;
  return Math.floor((now - admission.arrivedAt) / MINUTES_PER_DAY);
}

/** The bed strip's legend order and words on the phone (v10 phone). */
const PHONE_BED_LEGEND: { kinds: BedMap["cells"][number]["kind"][]; label: string }[] = [
  { kinds: ["occupied", "leave"], label: BED_MAP_LABELS.occupied },
  { kinds: ["pulled"], label: "Pulled" },
  { kinds: ["closed"], label: BED_MAP_LABELS.closed },
  { kinds: ["prep"], label: "Making ready" },
  { kinds: ["ready"], label: BED_MAP_LABELS.ready },
];

/**
 * One ward on a phone (v10 phone): the beds as a strip of boxes grouped by state (the model has no
 * bed numbers), then the roster, the discharges due in seven days and the blocked discharges as
 * one list behind a segmented control, and "Open the ward" pinned at the foot.
 */
export function WardPhone({
  unit,
  map,
  current,
  now,
  dayZero,
  leaveBeds,
}: {
  unit: Unit;
  map: BedMap;
  current: Admission[];
  now: number;
  dayZero: Date;
  leaveBeds: readonly { admissionId: string }[];
}) {
  const [tab, setTab] = useState<"roster" | "discharges" | "blockers">("roster");
  const { countsOnly } = useStatisticsCounts();
  const byStay = (a: Admission, b: Admission) => (stayDaysOf(b, now) ?? -1) - (stayDaysOf(a, now) ?? -1);
  const roster = [...current].sort(byStay);
  const discharges = current
    .filter(
      (admission) =>
        admission.state !== "pulled" &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt >= now &&
        dayOf(admission.expectedDischargeAt) < dayOf(now) + 7,
    )
    .sort((a, b) => (a.expectedDischargeAt ?? 0) - (b.expectedDischargeAt ?? 0));
  const blockers = current.filter((admission) => admission.blockReason !== null).sort(byStay);
  const shown = tab === "roster" ? roster : tab === "discharges" ? discharges : blockers;
  // Redesign (owner rule): a long list opens on its first rows, then "Show more".
  const [expanded, setExpanded] = useState(false);

  return (
    <PhoneBody testId="ward-statistics-ward-phone">
      <div className={phone.bedCard} data-testid="ward-statistics-ward-phone-beds">
        <ul className={phone.bedStrip} aria-label={`${unit.name}, ${unit.beds} beds by state`}>
          {/* Redesign: a bed someone is in is shaded by stay, the desktop map's four bands. A counts-only
              desk sees bed states alone, as on desktop. */}
          {map.cells.map((cell, index) => {
            const stay = countsOnly ? null : cell.stayDays;
            const label =
              stay === null
                ? BED_MAP_LABELS[cell.kind]
                : `${BED_MAP_LABELS[cell.kind]}, ${stay} ${stay === 1 ? "day" : "days"}`;
            return (
              <li
                key={index}
                className={cx(phone.bed, redesign.phoneBed)}
                data-kind={cell.kind}
                data-stay-band={stay === null ? undefined : bandIndexOf(stay)}
                title={label}
                aria-label={label}
              />
            );
          })}
        </ul>
        <ul className={phone.bedLegend} aria-label="Beds by state">
          {PHONE_BED_LEGEND.map((entry) => (
            <li key={entry.label}>
              {entry.label}
              <b>{entry.kinds.reduce((sum, kind) => sum + map.counts[kind], 0)}</b>
            </li>
          ))}
        </ul>
        {countsOnly ? null : <StayKey />}
      </div>
      {countsOnly ? (
        // The three lists are one row per admission, and their tab counts only count those rows.
        <PeopleNotListed testId="ward-statistics-ward-phone-not-listed" />
      ) : (
        <>
          <Segmented<"roster" | "discharges" | "blockers">
            className={cx(phone.seg, phone.stickySeg, redesign.phoneSeg)}
            size="md"
            label="Ward list"
            value={tab}
            onChange={setTab}
            items={[
              { id: "roster", label: "Roster", count: roster.length },
              { id: "discharges", label: "Discharges", count: discharges.length },
              { id: "blockers", label: "Blockers", count: blockers.length },
            ]}
          />
          {shown.length === 0 ? (
            <p className={phone.note}>
              {tab === "roster"
                ? "No current admissions recorded"
                : tab === "discharges"
                  ? "Nobody has a discharge date in the next 7 days"
                  : "No current admission carries a blocker"}
            </p>
          ) : (
            <PhoneList
              label={
                tab === "roster" ? "Admission roster" : tab === "discharges" ? "Due out, 7 days" : "Discharges held up"
              }
            >
              {(expanded ? shown : shown.slice(0, ROSTER_FIRST_ROWS)).map((admission) => {
                const days = stayDaysOf(admission, now);
                const onLeave = leaveBeds.some((bed) => bed.admissionId === admission.id);
                const status = onLeave ? "On leave" : ADMISSION_STATE_LABELS[admission.state];
                return (
                  <PhoneListRow
                    key={admission.id}
                    as="li"
                    name={<span className={phone.mono}>{admission.id}</span>}
                    meta={`${tab === "blockers" && admission.blockReason ? admission.blockReason : status}${
                      admission.expectedDischargeAt !== null && isPastDate(admission.expectedDischargeAt, now)
                        ? " · past date"
                        : ""
                    }`}
                    value={
                      days === null ? (
                        "none"
                      ) : (
                        <>
                          {days} <small className={phone.unit}>d</small>
                        </>
                      )
                    }
                    time={
                      admission.expectedDischargeAt === null ? (
                        "no date"
                      ) : isPastDate(admission.expectedDischargeAt, now) ? (
                        <span className={phone.flagged}>
                          <StatusGlyph tone="warning" size={9} />
                          {dateOf(admission.expectedDischargeAt, dayZero)}
                        </span>
                      ) : (
                        dateOf(admission.expectedDischargeAt, dayZero)
                      )
                    }
                  />
                );
              })}
            </PhoneList>
          )}
          {shown.length > ROSTER_FIRST_ROWS ? (
            <Button
              variant="ghost"
              className={redesign.phoneMore}
              icon={expanded ? ChevronUp : ChevronDown}
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? "Show fewer" : `Show ${shown.length - ROSTER_FIRST_ROWS} more`}
            </Button>
          ) : null}
        </>
      )}
      <PhonePinnedAction icon={Building2} href={unitHref(unit.id)} testId="ward-statistics-ward-phone-open">
        Open the ward
      </PhonePinnedAction>
    </PhoneBody>
  );
}
