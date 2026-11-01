"use client";

import { StatusGlyph } from "@/components/wf";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Unit } from "@/components/ward-management/ward-model";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import styles from "./handover-refined.module.css";

/**
 * Role branches of the one Handover page (approved redesign, Josh, 31 Oct 2026). A ward desk with
 * one ward (the nurse in charge) sees that ward's sheet with no scope picker; an ED desk (the ED
 * clinician) sees its own department, holds no ward and never signs off. Everyone else sees the
 * coordinator's sheet.
 */
export type HandoverDesk = {
  /** The desk's one ward, when the desk is a ward desk with exactly one. */
  ownWard: Unit | undefined;
  /** An ED desk: no Beds tab, no bed counts and no sign-off. */
  edDesk: boolean;
  /** The ED desk's own department ("Peel ED"), named in place of "All records you can access". */
  edName: string | undefined;
};

export function handoverDeskOf(access: WardAccess, units: readonly Unit[]): HandoverDesk {
  const ids = access.role === "ward" && access.scope.kind === "ward" ? access.scope.unitIds : [];
  const ownWard = ids.length === 1 ? units.find((unit) => unit.id === ids[0]) : undefined;
  const edDesk = access.role === "ed";
  const edName = edDesk && access.scope.kind === "ed" ? edShortName(edById(access.scope.edId)) || undefined : undefined;
  return { ownWard, edDesk, edName };
}

/** The hero chips a ward desk gets: Finding a ward is the coordinator's work, not the ward's. */
export const WARD_DESK_PILLS = ["act", "urg", "due", "mov"] as const;
export const COORDINATOR_PILLS = ["act", "urg", "due", "bed", "mov"] as const;

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

/** The ward desk's title count with its noun ("1 person to hand over"), on desktop and phone alike. */
export function peopleToHandOver(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"} to hand over`;
}

/**
 * Highlight chips on a ward desk: Declined and Escalated are the coordinator's bed search, and a
 * ward does not learn another ward's refusal (FD-23), so they are left out here.
 */
export function deskChips<T extends { id: string }>(chips: readonly T[], wardDesk: boolean): readonly T[] {
  return wardDesk ? chips.filter((chip) => chip.id !== "dec" && chip.id !== "esc") : chips;
}
