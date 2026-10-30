"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/wf";

import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./ward-desk-alerts.module.css";

/**
 * Role view (nurse in charge): the ward's own name, or undefined on any other desk. Kept beside the
 * fork so the merged component can read it as one more branch on the desk's role.
 */
export function ownWardName(access: WardAccess, units: readonly Unit[]): string | undefined {
  if (access.role !== "ward" || access.scope.kind !== "ward") return undefined;
  const ids = access.scope.unitIds;
  return units.find((unit) => ids.includes(unit.id))?.name;
}

/**
 * Role view (nurse in charge): with no alert for the ward, the side panel opens on what was checked
 * for it rather than "Pick an alert", so a quiet shift still shows what the screen is watching.
 */
export function DeskSidePanel({
  wardName,
  quiet,
  checks,
}: {
  wardName: string | undefined;
  quiet: boolean;
  checks: ReactNode;
}) {
  if (wardName === undefined || !quiet) return <EmptyState icon={Bell} title="Pick an alert to see it here" />;
  return (
    <section className={styles.clear} aria-label={`Checked for ${wardName}`}>
      <p className={styles.head}>
        <CheckCircle2 size={16} aria-hidden="true" />
        {`Nothing for ${wardName} needs you`}
      </p>
      {checks}
    </section>
  );
}
