"use client";

import { useMemo, useState } from "react";

import { Badge, Button, Field, TextInput } from "@/components/wf";
import { admissionChecklist, type AdmissionChecklistItem } from "@/components/ward-management/ward-admission-checklist";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  ARRIVAL_CHECKS,
  type ArrivalCheck,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS } from "@/components/ward-management/ward-support-notifications";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";

import edStyles from "./ed.module.css";
import styles from "./ed-admission-checklist.module.css";

/**
 * Admission arrival checklist (Top 25 item 14).
 * Reads recorded facts. The contraband search and the medication chart are recorded here with
 * `RECORD_ARRIVAL_CHECK` (D-72), and show "Done" only once the reducer has accepted the record.
 *
 * Feature item 15 (D-134): "Interpreter booked" and "Aboriginal liaison offered" show only when the
 * patient record says they apply and are recorded the same way. "Mental Health Advocacy Service
 * told" shows for a detained patient and records `RECORD_SUPPORT_NOTIFICATION` (party `mhas`), the
 * one record the ward's support checklist and the Notifications alert also read. None is ever
 * pre-ticked. PROVISIONAL wording, pending the cultural safety review (audit M122).
 */
export function EdAdmissionChecklist({ movement, referrals }: { movement: Movement; referrals: readonly Referral[] }) {
  const raise = useWardRaise("ed");
  const records = useOptionalWardFlowSelect(
    "patients",
    "movements",
    "plannedAdmissions",
    "supportNotifications",
  );
  const now = useWardFlowClock(0);
  const patient = useMemo(
    () => (records ? createPatientResolver({ ...records, referrals })(movement).patient : undefined),
    [records, referrals, movement],
  );
  const items = admissionChecklist(movement, referrals, undefined, {
    patient,
    supportNotifications: records?.supportNotifications,
    now,
  });
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
            <li key={item.key} className={styles.row} data-state={item.state} data-item={item.key}>
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
                    isDone ? `Take back ${item.label.toLowerCase()}` : `Record done: ${item.label.toLowerCase()}`
                  }
                  onClick={() => void raise("RECORD_ARRIVAL_CHECK", { movementId: movement.id, check, done: !isDone })}
                >
                  {isDone ? "Take back" : "Record done"}
                </Button>
              ) : null}
              {item.key === "mhas_told" && !isDone && recordable && item.supportNotification ? (
                <AdvocacyToldForm movementId={movement.id} target={item.supportNotification} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Records who at the Mental Health Advocacy Service was told, now. A correction or a "not
 * applicable" is made in the ward's support checklist after arrival, on the same record.
 */
function AdvocacyToldForm({
  movementId,
  target,
}: {
  movementId: string;
  target: NonNullable<AdmissionChecklistItem["supportNotification"]>;
}) {
  const raise = useWardRaise("ed");
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  // Audit CS3-01: an open form is checked against the board it opened on.
  useHoldOpenForm(open);
  if (!open)
    return (
      <Button
        className={styles.action}
        variant="sec"
        size="sm"
        aria-label="Record told: Mental Health Advocacy Service"
        onClick={() => {
          setWho("");
          setOpen(true);
        }}
      >
        Record told
      </Button>
    );
  return (
    <form
      className={styles.form}
      aria-label="Record Mental Health Advocacy Service told"
      onSubmit={(event) => {
        event.preventDefault();
        if (who.trim() === "") return;
        void raise("RECORD_SUPPORT_NOTIFICATION", {
          occasion: target.occasion,
          movementId,
          party: "mhas",
          outcome: "told",
          who,
        });
        setOpen(false);
      }}
    >
      <Field label="Who was told">
        <TextInput
          value={who}
          maxLength={SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS}
          autoComplete="off"
          onChange={(event) => setWho(event.target.value)}
        />
      </Field>
      <div className={styles.formActions}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="pri"
          size="sm"
          type="submit"
          disabledReason={who.trim() === "" ? "Enter who was told" : undefined}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
