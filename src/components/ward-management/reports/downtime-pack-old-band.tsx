"use client";

import { useState } from "react";

import { HeroBand, foldHidden, foldLimit, useIsPhone, type HeroBandCell } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import styles from "./downtime-pack-outage.module.css";
import {
  PACK_OLD_AFTER_MINUTES,
  oldPackCounts,
  oldPackWords,
  wardsWithOldPack,
  type DowntimePackPrintRecord,
} from "../ward-downtime-pack-prints";

/** Old packs the band shows before "Show more". */
const OLD_PACKS_FIRST = 6;

/** The words for a ward that has never printed or saved a pack (approved, D-142). */
export const NEVER_PRINTED = "Never printed";

/**
 * When a print by `role` last covered any of these wards, or `null`: the "Last printed" line under
 * the pack's Print button (Batch 4 item 24, D-142). Ids and times only.
 */
export function lastPrintedByRole(
  records: readonly DowntimePackPrintRecord[] | undefined,
  unitIds: readonly string[],
  role: string,
): Instant | null {
  let latest: Instant | null = null;
  for (const record of records ?? [])
    if (record.by === role && unitIds.includes(record.unitId) && (latest === null || record.at > latest))
      latest = record.at;
  return latest;
}

/**
 * OUTAGE PACKS OLDER THAN 24 HOURS (Batch 4 item 24, Josh approved the drawing 11 Nov 2026, D-142).
 * The coordinator's band on the downtime pack screen: each ward whose last printed or saved pack is
 * older than `PACK_OLD_AFTER_MINUTES`, with that time, or "Never printed". The list lives here only;
 * Home's Checking line points to it. Nothing is drawn when no pack is old.
 *
 * Root-cause fix 3.3 (Josh, 13 Nov 2026): the title and counts word "never printed" and "over 24h
 * old" apart, with the same words as Home, and say the band covers every ward in the network (Home
 * counts the chosen service's wards when one is chosen, and says so).
 */
export function DowntimeOldPacksBand({ now }: { now: Instant }) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const read = useOptionalWardFlowSelect("units", "downtimePackPrints");
  const units = read?.units ?? [];
  const old = wardsWithOldPack(
    read?.downtimePackPrints,
    units.map((unit) => unit.id),
    now,
  );
  if (old.length === 0) return null;
  const shown = open ? old.length : foldLimit(old.length, OLD_PACKS_FIRST);
  const hidden = foldHidden(old.length, OLD_PACKS_FIRST);
  const cells: HeroBandCell[] = old.slice(0, shown).map((ward) => ({
    id: ward.unitId,
    label: units.find((unit) => unit.id === ward.unitId)?.name ?? ward.unitId,
    value:
      ward.lastPrintedAt === null ? (
        <span className={styles.never}>{NEVER_PRINTED}</span>
      ) : (
        formatInstantWithDay(ward.lastPrintedAt, now)
      ),
    tone: "warning",
    testId: `ward-downtime-old-pack-${ward.unitId}`,
  }));
  if (hidden > 0)
    cells.push({
      id: "more",
      label: open ? "Show fewer" : `Show ${hidden} more`,
      value: "",
      quiet: true,
      onClick: () => setOpen((was) => !was),
      testId: "ward-downtime-old-packs-more",
    });
  const counts = oldPackCounts(old);
  const hours = Math.round(PACK_OLD_AFTER_MINUTES / 60);
  const title =
    counts.overAge === 0
      ? "Outage packs never printed"
      : counts.neverPrinted === 0
        ? `Outage packs over ${hours}h old`
        : `Outage packs never printed or over ${hours}h old`;
  const wardsWord = `${oldPackWords(counts)} · all ${units.length} ${units.length === 1 ? "ward" : "wards"}`;
  // Screen only: the printed pack is the board, not this list.
  return (
    <div data-print-hide>
      <HeroBand
        title={title}
        aside={isPhone ? wardsWord : `${wardsWord} · each ward's last print or save`}
        variant="wrap"
        cells={cells}
        testId="ward-downtime-old-packs"
      />
    </div>
  );
}
