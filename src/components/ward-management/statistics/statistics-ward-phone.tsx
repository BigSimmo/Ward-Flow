"use client";
// One ward on a phone, split out of statistics-ward-screen.tsx to keep that file under the line cap.

import { useState, type CSSProperties } from "react";
import { Building2 } from "lucide-react";

import { PhoneListRow, Segmented, ShowMoreRow, StatusGlyph, cx } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, dayOf } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { BED_MAP_LABELS, type BedMap } from "./statistics-bed-map";
import { PhoneBody, PhoneList, PhonePinnedAction, phoneBodyStyles as phone } from "./statistics-phone-parts";
import { dateOf, isPastDate } from "./statistics-dates";
import { PeopleNotListed } from "./statistics-small-numbers";
import { BED_LEGEND, StayKey, bandIndexOf, bedColumns } from "./statistics-ward-compact-bed-map";
import compact from "./statistics-ward-compact.module.css";
import beds from "./statistics-ward-phone-beds.module.css";

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
  const access = useEffectiveWardAccess();
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
      {access.role === "ward" ? (
        <WardDeskBedGrid unit={unit} map={map} countsOnly={countsOnly} />
      ) : (
        <BedStrip unit={unit} map={map} countsOnly={countsOnly} />
      )}
      {countsOnly ? (
        // The three lists are one row per admission, and their tab counts only count those rows.
        <PeopleNotListed testId="ward-statistics-ward-phone-not-listed" />
      ) : (
        <>
          <Segmented<"roster" | "discharges" | "blockers">
            className={cx(phone.seg, phone.stickySeg)}
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
            <ShowMoreRow expanded={expanded} onClick={() => setExpanded((open) => !open)}>
              {expanded ? "Show fewer" : `Show ${shown.length - ROSTER_FIRST_ROWS} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
      <PhonePinnedAction icon={Building2} href={unitHref(unit.id)} testId="ward-statistics-ward-phone-open">
        Open the ward
      </PhonePinnedAction>
    </PhoneBody>
  );
}

/**
 * The bed strip: a bed someone is in is shaded by stay, the desktop map's four bands. A counts-only
 * desk sees bed states alone, as on desktop.
 */
function BedStrip({ unit, map, countsOnly }: { unit: Unit; map: BedMap; countsOnly: boolean }) {
  return (
    <div className={phone.bedCard} data-testid="ward-statistics-ward-phone-beds">
      <ul className={phone.bedStrip} aria-label={`${unit.name}, ${unit.beds} beds by state`}>
        {map.cells.map((cell, index) => {
          const stay = countsOnly ? null : cell.stayDays;
          const label =
            stay === null
              ? BED_MAP_LABELS[cell.kind]
              : `${BED_MAP_LABELS[cell.kind]}, ${stay} ${stay === 1 ? "day" : "days"}`;
          return (
            <li
              key={index}
              className={cx(phone.bed, compact.phoneBed)}
              data-kind={cell.kind}
              data-stay-band={stay === null ? undefined : bandIndexOf(stay)}
              title={label}
              aria-label={label}
            />
          );
        })}
      </ul>
      <ul className={phone.bedLegend} aria-label="Beds by state">
        {BED_LEGEND.map((entry) => (
          <li key={entry.label}>
            {entry.label}
            <b>{entry.kinds.reduce((sum, kind) => sum + map.counts[kind], 0)}</b>
          </li>
        ))}
      </ul>
      {countsOnly ? null : <StayKey />}
    </div>
  );
}

/**
 * Role view (nurse in charge), coordinator review 31 Oct 2026: an even grid, each state its own fill
 * in the Capacity map's colours, and a legend with the same swatches. The grid drops the stay shading:
 * five state fills are what a small grid can carry, and the roster gives each stay in days.
 */
function WardDeskBedGrid({ unit, map, countsOnly }: { unit: Unit; map: BedMap; countsOnly: boolean }) {
  return (
    <div className={phone.bedCard} data-testid="ward-statistics-ward-phone-beds">
      <ul
        className={beds.grid}
        style={{ "--bed-cols": bedColumns(map.cells.length) } as CSSProperties}
        aria-label={`${unit.name}, ${unit.beds} beds by state`}
      >
        {map.cells.map((cell, index) => {
          const stay = countsOnly ? null : cell.stayDays;
          const label =
            stay === null
              ? BED_MAP_LABELS[cell.kind]
              : `${BED_MAP_LABELS[cell.kind]}, ${stay} ${stay === 1 ? "day" : "days"}`;
          return <li key={index} className={beds.bed} data-kind={cell.kind} title={label} aria-label={label} />;
        })}
      </ul>
      <ul className={beds.legend} aria-label="Beds by state">
        {BED_LEGEND.map((entry) => (
          <li key={entry.label}>
            <i className={beds.swatch} data-kind={entry.kinds[0]} aria-hidden="true" />
            {entry.label}
            <b>{entry.kinds.reduce((sum, kind) => sum + map.counts[kind], 0)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
