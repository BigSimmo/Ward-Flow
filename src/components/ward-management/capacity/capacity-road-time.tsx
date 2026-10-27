"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { SpelledCodes, codeName } from "@/components/ward-management/ward-abbreviations";
import Link from "next/link";
import { useId, useState } from "react";

import { Card, CardHead, Icon, Select, cx, durMinutes } from "@/components/wf";
import {
  REFERENCE_DISTANCE_CAVEAT,
  referenceDistance,
} from "@/components/ward-management/reference/ward-reference-distances";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import type { NetworkWardRow } from "./capacity-derivations";
import styles from "./capacity-road-time.module.css";

/**
 * Ready beds ranked by road time from one emergency department. Moved here from the retired
 * Network screen (Josh, 19 Oct 2026), which was otherwise a copy of Home and Capacity: this list
 * was the one part no other screen had.
 *
 * "Ready" is Capacity's own figure (`NetworkWardRow.ready`), and the screen passes the same
 * service-scoped rows its ward table uses, so the list cannot disagree with the table beside it. A ward with no measured route is left out rather than given a guessed
 * time, and the caveat says the distances are indicative, not live traffic.
 */
export function ReadyByRoadTime({
  rows,
  defaultEdId,
  selectedUnitId,
  onSelectUnit,
  wardHref,
}: {
  rows: readonly NetworkWardRow[];
  /** The department to measure from until one is chosen: the one under most pressure. */
  defaultEdId: string | undefined;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string, opener: HTMLElement) => void;
  /**
   * When given, each row is a link to the ward instead of a select button. The phone uses this:
   * its Overview tab hides the rail where a selected ward's details would open.
   */
  wardHref?: (unitId: string) => string;
}) {
  const baseId = useId();
  const departments = allEmergencyDepartments();
  const [chosenEdId, setChosenEdId] = useState<string | undefined>(undefined);
  const ed = departments.find((d) => d.id === (chosenEdId ?? defaultEdId)) ?? departments[0];
  const ranked =
    ed === undefined
      ? []
      : rows
          .filter((row) => row.ready > 0)
          .flatMap((row) => {
            const route = referenceDistance(ed.referenceEdId, siteByCode(row.unit.siteCode)?.referenceSiteId);
            return route === null ? [] : [{ row, route }];
          })
          .sort((a, b) => a.route.min - b.route.min)
          .slice(0, 5);

  return (
    <Card as="section" className={styles.card} aria-labelledby={`${baseId}-heading`} data-testid="capacity-road-time">
      <CardHead icon={MapPin} id={`${baseId}-heading`} level={3} title="Ready beds by road time" />
      <div className={styles.from}>
        <label htmlFor={`${baseId}-from`}>From</label>
        {/* Phone: the real select stays at 16px, so iPhone Safari does not zoom when it is tapped,
            and sits invisible over a 13px copy of its value that matches the ward names below. */}
        <span className={styles.picker}>
          <Select
            id={`${baseId}-from`}
            boxClassName={styles.pickerBox}
            value={ed?.id ?? ""}
            onChange={(event) => setChosenEdId(event.currentTarget.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.siteCode} ED{codeName(d.siteCode) ? ` (${codeName(d.siteCode)})` : ""}
              </option>
            ))}
          </Select>
          <span className={styles.pickerValue} aria-hidden="true">
            {ed === undefined ? null : <SpelledCodes text={`${ed.siteCode} ED`} />}
            <Icon icon={ChevronDown} size={14} />
          </span>
        </span>
      </div>
      {/* Decision 6 (Audit 1, Josh 20 Oct): the order is road time alone, never a placement pick. */}
      <p className={styles.caveat} data-testid="capacity-road-time-caption">
        Distance only, not suitability.
      </p>
      {ranked.length === 0 ? (
        <p className={styles.empty}>No ward with a ready bed has a measured route from this department.</p>
      ) : (
        <ol className={styles.list}>
          {ranked.map(({ row, route }, index) => (
            <li key={row.unit.id}>
              <RowControl
                href={wardHref?.(row.unit.id)}
                className={cx(styles.row, row.unit.id === selectedUnitId && styles.rowSelected)}
                selected={row.unit.id === selectedUnitId}
                onSelect={(opener) => onSelectUnit(row.unit.id, opener)}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.text}>
                  <span className={styles.unitName}>
                    <SpelledCodes text={row.unit.name} />
                  </span>
                  <span className={styles.unitMeta}>
                    {row.ready} ready
                    {row.pendingPreparation ? `, ${row.pendingPreparation} still being made ready` : ""} · {route.km} km
                  </span>
                </span>
                <span className={styles.drive}>
                  {route.min === 0 ? (
                    <span className={styles.driveTime}>On site</span>
                  ) : (
                    <>
                      <span className={styles.driveTime}>{driveTime(route.min)}</span>
                      <span className={styles.unitMeta}>drive</span>
                    </>
                  )}
                </span>
              </RowControl>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.caveat}>{REFERENCE_DISTANCE_CAVEAT}</p>
    </Card>
  );
}

/** A road time is whole minutes; `durMinutes` adds seconds under ten minutes ("7m 00s"). */
function driveTime(minutes: number): string {
  return minutes < 10 ? `${Math.round(minutes)}m` : durMinutes(minutes);
}

function RowControl({
  href,
  className,
  selected,
  onSelect,
  children,
}: {
  href: string | undefined;
  className: string;
  selected: boolean;
  onSelect: (opener: HTMLElement) => void;
  children: React.ReactNode;
}) {
  if (href !== undefined) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      {children}
    </button>
  );
}
