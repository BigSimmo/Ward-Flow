"use client";

import { MapPin } from "lucide-react";
import { useId, useState } from "react";

import { Card, CardHead, Select, cx, durMinutes } from "@/components/wf";
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
 * "Ready" is Capacity's own figure (`NetworkWardRow.ready`), so the list cannot disagree with the
 * ward table beside it. A ward with no measured route is left out rather than given a guessed
 * time, and the caveat says the distances are indicative, not live traffic.
 */
export function ReadyByRoadTime({
  rows,
  defaultEdId,
  selectedUnitId,
  onSelectUnit,
}: {
  rows: readonly NetworkWardRow[];
  /** The department to measure from until one is chosen: the one under most pressure. */
  defaultEdId: string | undefined;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string, opener: HTMLElement) => void;
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
        <Select
          id={`${baseId}-from`}
          value={ed?.id ?? ""}
          onChange={(event) => setChosenEdId(event.currentTarget.value)}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.siteCode} ED
            </option>
          ))}
        </Select>
      </div>
      {ranked.length === 0 ? (
        <p className={styles.empty}>No ward with a ready bed has a measured route from this department.</p>
      ) : (
        <ol className={styles.list}>
          {ranked.map(({ row, route }, index) => (
            <li key={row.unit.id}>
              <button
                type="button"
                className={cx(styles.row, row.unit.id === selectedUnitId && styles.rowSelected)}
                aria-pressed={row.unit.id === selectedUnitId}
                onClick={(event) => onSelectUnit(row.unit.id, event.currentTarget)}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.text}>
                  <span className={styles.unitName}>{row.unit.name}</span>
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
                      <span className={styles.driveTime}>{durMinutes(route.min)}</span>
                      <span className={styles.unitMeta}>drive</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.caveat}>{REFERENCE_DISTANCE_CAVEAT}</p>
    </Card>
  );
}
