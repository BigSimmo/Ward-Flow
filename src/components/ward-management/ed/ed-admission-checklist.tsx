"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/wf";
import {
  admissionChecklist,
  type AdmissionChecklistOverrides,
} from "@/components/ward-management/ward-admission-checklist";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

import edStyles from "./ed.module.css";
import styles from "./ed-admission-checklist.module.css";

/**
 * Admission arrival checklist (Top 25 item 14, flag `top25-admission-checklist`).
 * Reads recorded medical clearance, legal form receipt and transport from the movement, and lets
 * the ED clinician mark the contraband search and medication chart ready before departure.
 */
export function EdAdmissionChecklist({ movement, referrals }: { movement: Movement; referrals: readonly Referral[] }) {
  const [overrides, setOverrides] = useState<AdmissionChecklistOverrides>({});
  const items = admissionChecklist(movement, referrals, overrides);
  const done = items.filter((item) => item.state === "done").length;
  const counted = items.length;
  const toggleOverride = (key: keyof AdmissionChecklistOverrides, currentDone: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: !currentDone }));
  };
  return (
    <section
      className={edStyles.expandedCard}
      aria-label="Arrival checklist for the receiving ward"
      data-testid="ward-ed-admission-checklist"
    >
      <h3 className={edStyles.expandedHeading}>
        Arrival checklist, {done} of {counted} recorded
      </h3>
      <ul className={styles.list}>
        {items.map((item) => {
          const isToggleable = item.key === "contraband_search" || item.key === "medication_chart";
          return (
            <li key={item.key} className={styles.row} data-state={item.state}>
              <span className={styles.label}>{item.label}</span>
              <Badge size="sm" tone={item.state === "done" ? "success" : "warning"}>
                {item.state === "done" ? "Done" : "Outstanding"}
              </Badge>
              <span className={styles.detail}>{item.detail}</span>
              {isToggleable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={item.state === "done"}
                  onClick={() => toggleOverride(item.key as keyof AdmissionChecklistOverrides, item.state === "done")}
                >
                  {item.state === "done" ? "Clear" : "Mark done"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
