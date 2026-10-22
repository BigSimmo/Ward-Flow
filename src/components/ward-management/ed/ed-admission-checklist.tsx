"use client";

import { Badge, Button } from "@/components/wf";
import { admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import {
  ARRIVAL_CHECKS,
  type ArrivalCheck,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";

import edStyles from "./ed.module.css";
import styles from "./ed-admission-checklist.module.css";

/**
 * Admission arrival checklist (Top 25 item 14).
 * Reads recorded facts. The contraband search and the medication chart are recorded here with
 * `RECORD_ARRIVAL_CHECK` (D-72), and show "Done" only once the reducer has accepted the record.
 */
export function EdAdmissionChecklist({ movement, referrals }: { movement: Movement; referrals: readonly Referral[] }) {
  const raise = useWardRaise("ed");
  const items = admissionChecklist(movement, referrals);
  const done = items.filter((item) => item.state === "done").length;
  const recordable = movement.closure === undefined;
  return (
    <section
      className={edStyles.expandedCard}
      aria-label="Arrival checklist for the receiving ward"
      data-testid="ward-ed-admission-checklist"
    >
      <h3 className={edStyles.expandedHeading}>
        Arrival checklist, {done} of {items.length} recorded
      </h3>
      <ul className={styles.list}>
        {items.map((item) => {
          const check = ARRIVAL_CHECKS.find((key): key is ArrivalCheck => key === item.key);
          const isDone = item.state === "done";
          return (
            <li key={item.key} className={styles.row} data-state={item.state}>
              <span className={styles.label}>{item.label}</span>
              <Badge size="sm" tone={isDone ? "success" : "warning"} className={styles.badge}>
                {isDone ? "Done" : "Outstanding"}
              </Badge>
              <span className={styles.detail}>{item.detail}</span>
              {check !== undefined && recordable ? (
                <Button
                  className={styles.action}
                  variant={isDone ? "ghost" : "sec"}
                  size="sm"
                  aria-label={
                    isDone ? `Take back ${item.label.toLowerCase()}` : `Record ${item.label.toLowerCase()} done`
                  }
                  onClick={() => void raise("RECORD_ARRIVAL_CHECK", { movementId: movement.id, check, done: !isDone })}
                >
                  {isDone ? "Take back" : "Record done"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
