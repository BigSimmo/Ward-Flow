import type { Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * DOWNTIME PACK UP TO DATE (Batch 4 item 24, Josh's approved plan, 10 Nov 2026,
 * D-135). The shared record keeps only WHEN a ward's downtime pack was printed or saved
 * as a PDF (`RECORD_DOWNTIME_PACK_PRINTED`), so the coordinator can see a ward whose paper is old.
 *
 * 🔒 **NO PACK CONTENT, ANYWHERE.** A print record is a ward id, a time and a role. The pack itself
 * stays in the tab's memory and leaves only as paper or a file the person saves (D-18, D-72 item 2);
 * nothing here writes to the device. `tests/ward-downtime-pack-device-storage.dom.test.tsx` scans
 * this file with the rest of the pack's code.
 *
 * Print and Save as PDF open the same browser print window, so the record cannot tell them apart and
 * does not try to.
 */

/** A ward's pack older than this is listed as old (signed by Josh, 10 Nov 2026, D-135). */
export const PACK_OLD_AFTER_MINUTES = CLINICAL_VALUES.downtimePackOld.value;

/** The newest print times kept per ward. Older ones say nothing the newest does not. */
const PRINTS_KEPT_PER_WARD = 12;

export type DowntimePackPrintRecord = {
  unitId: string;
  at: Instant;
  by: WardFlowRole;
};

export type DowntimePackPrintEvent = {
  type: "RECORD_DOWNTIME_PACK_PRINTED";
  role: WardFlowRole;
  /** The board clock when the print was started; sent only after the person says it printed (fix 3.3). Typed `number`, as other event types beside their records. */
  now: number;
  /** The wards on the pack that was printed. Ids only. */
  unitIds: string[];
};

type PrintState = {
  units: readonly { id: string }[];
  downtimePackPrints?: DowntimePackPrintRecord[];
};

/**
 * The reducer half: one time per ward named. Refuses an empty or repeated list and a ward not in
 * this workspace. A second print of the same wards in the same minute records nothing new.
 */
export function reduceDowntimePackPrint<S extends PrintState>(
  state: S,
  event: DowntimePackPrintEvent,
  reject: (state: S, reason: string) => S,
  accept: () => void,
): S {
  const unitIds: unknown = event.unitIds;
  if (!Array.isArray(unitIds) || unitIds.length === 0 || new Set(unitIds).size !== unitIds.length)
    return reject(state, `${event.type} names each ward on the pack once`);
  for (const id of unitIds)
    if (typeof id !== "string" || !state.units.some((unit) => unit.id === id))
      return reject(state, `no unit found for id ${String(id)}`);
  accept();
  const records = state.downtimePackPrints ?? [];
  const fresh = (unitIds as string[]).filter(
    (unitId) => !records.some((record) => record.unitId === unitId && record.at === event.now),
  );
  if (fresh.length === 0) return state;
  const added = [...records, ...fresh.map((unitId) => ({ unitId, at: event.now, by: event.role }))];
  return { ...state, downtimePackPrints: keepNewest(added) };
}

function keepNewest(records: DowntimePackPrintRecord[]): DowntimePackPrintRecord[] {
  const byWard = new Map<string, DowntimePackPrintRecord[]>();
  for (const record of records) byWard.set(record.unitId, [...(byWard.get(record.unitId) ?? []), record]);
  const kept = new Set<DowntimePackPrintRecord>();
  for (const rows of byWard.values())
    for (const row of [...rows].sort((a, b) => b.at - a.at).slice(0, PRINTS_KEPT_PER_WARD)) kept.add(row);
  return records.filter((record) => kept.has(record));
}

/**
 * When this ward's pack was last printed or saved, or `null` if never. With `atOrBefore`, the last
 * print at or before that time (for example, the paper a ward had in hand when an outage ended).
 */
export function lastPackPrintedAt(
  records: readonly DowntimePackPrintRecord[] | undefined,
  unitId: string,
  atOrBefore?: Instant,
): Instant | null {
  let latest: Instant | null = null;
  for (const record of records ?? []) {
    if (record.unitId !== unitId) continue;
    if (atOrBefore !== undefined && record.at > atOrBefore) continue;
    if (latest === null || record.at > latest) latest = record.at;
  }
  return latest;
}

export type WardPackPrint = { unitId: string; lastPrintedAt: Instant | null };

/** The last print time of each ward, in the order given. */
export function lastPackPrintPerWard(
  records: readonly DowntimePackPrintRecord[] | undefined,
  unitIds: readonly string[],
): WardPackPrint[] {
  return unitIds.map((unitId) => ({ unitId, lastPrintedAt: lastPackPrintedAt(records, unitId) }));
}

/**
 * Wards whose printed pack is older than `PACK_OLD_AFTER_MINUTES`, or that have never printed one
 * (`lastPrintedAt: null`), oldest first and never printed first of all. A print time later than now
 * (a clock moved back) is not counted as old.
 */
export function wardsWithOldPack(
  records: readonly DowntimePackPrintRecord[] | undefined,
  unitIds: readonly string[],
  now: Instant,
): WardPackPrint[] {
  return lastPackPrintPerWard(records, unitIds)
    .filter((ward) => ward.lastPrintedAt === null || now - ward.lastPrintedAt > PACK_OLD_AFTER_MINUTES)
    .sort((a, b) => (a.lastPrintedAt ?? -Infinity) - (b.lastPrintedAt ?? -Infinity));
}

/**
 * The two kinds of ward `wardsWithOldPack` lists, counted apart (root-cause fix 3.3, Josh 13 Nov
 * 2026). A ward that has never printed a pack is not "over 24h old", so Home and the Downtime band
 * word each count on its own. Whether "never printed" should alarm on a first day is Josh's call;
 * both keep the warning tone they had.
 */
export function oldPackCounts(wards: readonly WardPackPrint[]): { neverPrinted: number; overAge: number } {
  const neverPrinted = wards.filter((ward) => ward.lastPrintedAt === null).length;
  return { neverPrinted, overAge: wards.length - neverPrinted };
}

/** "22 outage packs never printed, 1 over 24h old": each count only when it is above zero. */
export function oldPackWords({ neverPrinted, overAge }: { neverPrinted: number; overAge: number }): string {
  const hours = Math.round(PACK_OLD_AFTER_MINUTES / 60);
  const packs = (count: number) => `${count} outage ${count === 1 ? "pack" : "packs"}`;
  const never = neverPrinted > 0 ? `${packs(neverPrinted)} never printed` : "";
  if (overAge === 0) return never;
  return never ? `${never}, ${overAge} over ${hours}h old` : `${packs(overAge)} over ${hours}h old`;
}
