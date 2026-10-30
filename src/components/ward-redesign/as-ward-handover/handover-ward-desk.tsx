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
  const empty = groups.filter((group) => group.rows.length === 0);
  if (empty.length === 0) return null;
  return (
    <div className={styles.tableFoot} data-testid="ward-handover-empty-groups">
      <StatusGlyph tone="success" size={8} />
      <span>Nothing in {empty.map((group) => group.title).join(", ")}</span>
    </div>
  );
}

/** This ward's ready beds, without the statewide match against people finding a ward. */
export function WardDeskReadyBeds({ ready, ward }: { ready: number; ward: string }) {
  return (
    <span className={styles.gap}>
      <span>
        <b>{ready}</b> {ready === 1 ? "bed" : "beds"} ready on {ward}
      </span>
    </span>
  );
}
