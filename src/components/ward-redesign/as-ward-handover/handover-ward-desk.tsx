"use client";

import { StatusGlyph } from "@/components/wf";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Unit } from "@/components/ward-management/ward-model";
import styles from "@/components/ward-management/handover/handover-refined.module.css";

/**
 * Nurse in charge (ward desk with one ward): the two small parts the Handover fork draws for it,
 * kept here so the fork stays within the line limit. Real change: inline in the handover screen.
 */

/** The hero chips a ward desk gets: Finding a ward is the coordinator's work, not the ward's. */
export const WARD_DESK_PILLS = ["act", "urg", "due", "mov"] as const;

/** The desk's one ward when the desk is a ward desk with exactly one; otherwise none. */
export function ownWardOf(access: WardAccess, units: readonly Unit[]): Unit | undefined {
  const ids = access.role === "ward" && access.scope.kind === "ward" ? access.scope.unitIds : [];
  return ids.length === 1 ? units.find((unit) => unit.id === ids[0]) : undefined;
}

/** The groups with nobody in them, named on one line instead of one empty row each. */
export function WardDeskEmptyGroups({ groups }: { groups: readonly { title: string; rows: readonly unknown[] }[] }) {
  // Finding a ward is the coordinator's group (WARD_DESK_PILLS drops it), so the ward's line leaves it out.
  const empty = groups.filter((group) => group.rows.length === 0 && group.title !== "Finding a ward");
  if (empty.length === 0) return null;
  return (
    <div className={styles.tableFoot} data-testid="ward-handover-empty-groups">
      <StatusGlyph tone="success" size={8} />
      <span>Nothing in {empty.map((group) => group.title).join(", ")}</span>
    </div>
  );
}

/** The page title's count with its noun ("1 person to hand over"), on desktop and phone alike. */
export function peopleToHandOver(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"} to hand over`;
}

/** The Act now chip shows two words; its spoken label keeps the breakdown the chip used to print. */
export function actNowChipLabel(people: number, alerts: number): string {
  return `${people} act now: ${people} ${people === 1 ? "person" : "people"}, ${alerts} ${alerts === 1 ? "alert" : "alerts"}`;
}

/**
 * Highlight chips on a ward desk: Declined and Escalated are the coordinator's bed search, and a
 * ward does not learn another ward's refusal (FD-23), so they are left out here.
 */
export function deskChips<T extends { id: string }>(chips: readonly T[], wardDesk: boolean): readonly T[] {
  return wardDesk ? chips.filter((chip) => chip.id !== "dec" && chip.id !== "esc") : chips;
}
