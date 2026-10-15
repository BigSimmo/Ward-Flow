"use client";

import { Badge } from "@/components/wf";
import { admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

import edStyles from "./ed.module.css";
import styles from "./ed-admission-checklist.module.css";

/**
 * Admission arrival checklist (Top 25 item 14, flag `top25-admission-checklist`). Read only: each
 * tick comes from a recorded fact (`admissionChecklist`), and the two checks with no record in this
 * prototype say so. Shown on the ED person card once a ward has accepted the patient.
 */
export function EdAdmissionChecklist({ movement, referrals }: { movement: Movement; referrals: readonly Referral[] }) {
  const items = admissionChecklist(movement, referrals);
  const done = items.filter((item) => item.state === "done").length;
  const counted = items.filter((item) => item.state !== "not_wired").length;
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
        {items.map((item) => (
          <li key={item.key} className={styles.row} data-state={item.state}>
            <span className={styles.label}>{item.label}</span>
            <Badge
              size="sm"
              tone={item.state === "done" ? "success" : item.state === "outstanding" ? "warning" : "neutral"}
            >
              {item.state === "done" ? "Done" : item.state === "outstanding" ? "Outstanding" : "Not wired"}
            </Badge>
            <span className={styles.detail}>{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
