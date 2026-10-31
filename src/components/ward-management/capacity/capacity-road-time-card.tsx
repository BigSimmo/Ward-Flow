"use client";

// Capacity's nearest ready beds (polish, Josh 31 Oct 2026; the phone keeps `capacity-road-time.tsx`): "Nearest ready beds", with the From picker as a compact menu in the title row, each
// ward one row with its drive time on the right, and the two caveats together in one quiet foot.
// The ranking, the five-row limit and both caveat sentences are unchanged.

import { ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";

import { Card, CardHead, Menu, cx, durMinutes } from "@/components/wf";
import { SpelledCodes, codeName } from "@/components/ward-management/ward-abbreviations";
import type { NetworkWardRow } from "./capacity-derivations";
import {
  REFERENCE_DISTANCE_CAVEAT,
  referenceDistance,
} from "@/components/ward-management/reference/ward-reference-distances";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import { HowWorkedOut } from "./capacity-how-worked-out";
import styles from "./capacity-page.module.css";

export function RoadTimeCard({
  rows,
  defaultEdId,
  selectedUnitId,
  onSelectUnit,
}: {
  rows: readonly NetworkWardRow[];
  /** The department to measure from until one is chosen: the one under most pressure. */
  defaultEdId: string | undefined;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
}) {
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
  const edName = (siteCode: string) => codeName(siteCode) ?? siteCode;

  return (
    <Card as="section" aria-labelledby="capacity-road-title" data-testid="capacity-road-time">
      <CardHead
        icon={MapPin}
        id="capacity-road-title"
        title="Nearest ready beds"
        action={
          <Menu
            label="Measure from"
            align="end"
            items={departments.map((d) => ({
              id: d.id,
              label: edName(d.siteCode),
              meta: `${d.siteCode} ED`,
              checked: d.id === ed?.id,
              checkable: "radio" as const,
              onSelect: () => setChosenEdId(d.id),
            }))}
            trigger={(props) => (
              <button type="button" {...props} className={styles.rtPicker}>
                <span className={styles.rtPickerFrom}>From</span>
                {ed === undefined ? "Choose ED" : <SpelledCodes text={`${ed.siteCode} ED`} />}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            )}
          />
        }
      />
      {ranked.length === 0 ? (
        <p className={styles.rtEmpty}>No ward with a ready bed has a measured route from this department.</p>
      ) : (
        // Decision 6 (Audit 1, Josh 20 Oct): the order is road time alone, never a placement pick.
        <ol className={styles.rtList} aria-label={`Ready beds by road time from ${ed?.siteCode ?? ""} ED`}>
          {ranked.map(({ row, route }) => (
            <li key={row.unit.id}>
              <button
                type="button"
                className={cx(styles.rtRow, row.unit.id === selectedUnitId && styles.rtRowSelected)}
                aria-pressed={row.unit.id === selectedUnitId}
                onClick={() => onSelectUnit(row.unit.id)}
              >
                <span className={styles.rtText}>
                  <span className={styles.rtName}>
                    <SpelledCodes text={row.unit.name} />
                  </span>
                  <span className={styles.rtMeta}>
                    {row.ready} ready
                    {row.pendingPreparation ? ` · ${row.pendingPreparation} being made ready` : ""} · {route.km} km
                  </span>
                </span>
                <span className={styles.rtTime}>
                  {route.min === 0 ? "On site" : driveTime(route.min)}
                  {route.min === 0 ? null : <span className={styles.srOnly}> drive</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {/* Polish (Josh, 31 Oct 2026): one short line; the map-data caveat opens from it. */}
      <div className={styles.rtFoot}>
        <HowWorkedOut label="Distance only, not suitability">
          <p>{REFERENCE_DISTANCE_CAVEAT}</p>
        </HowWorkedOut>
      </div>
    </Card>
  );
}

/** A road time is whole minutes; `durMinutes` adds seconds under ten minutes ("7m 00s"). */
function driveTime(minutes: number): string {
  return minutes < 10 ? `${Math.round(minutes)}m` : durMinutes(minutes);
}
