"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";

import { buildDueNowItems } from "./tools-due-now";
import styles from "./tools-workspace.module.css";

export function ToolsDuePanel({
  movements,
  units,
  admissions,
  bedReleases,
  leaveBeds,
  now,
  onNavigate,
}: {
  movements: Movement[];
  units: Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  now: Instant;
  onNavigate: () => void;
}) {
  const items = useMemo(
    () => buildDueNowItems({ movements, units, admissions, bedReleases, leaveBeds, now }),
    [movements, units, admissions, bedReleases, leaveBeds, now],
  );

  return (
    <div className={styles.stack}>
      <p className={styles.note}>Recorded due times, holds and the longest waits. Synthetic figures.</p>
      {items.length === 0 ? (
        <p className={styles.empty}>Nothing is due on these figures.</p>
      ) : (
        <ul className={styles.dueList} aria-label="Due now">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} data-tone={item.tone} onClick={onNavigate}>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
