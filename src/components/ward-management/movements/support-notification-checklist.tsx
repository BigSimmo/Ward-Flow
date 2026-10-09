"use client";

import { useId, useMemo, useState } from "react";
import { BellRing } from "lucide-react";

import { Button, Field, Segmented, StatusGlyph, TextInput, type WfTone } from "@/components/wf";
import { formatInstant, formatInstantWithDay } from "../ward-clock";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import {
  SUPPORT_NOTIFICATION_CONTACT_DAYS,
  SUPPORT_NOTIFICATION_CONTACT_DAY_LABELS,
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_PARTY_LABELS,
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
  admissionSupportNotificationSubject,
  contactClockTextToInstant,
  movementSupportNotificationSubject,
  supportNotificationChecklist,
  type SupportNotificationContactDay,
  type SupportNotificationOutcome,
  type SupportNotificationParty,
  type SupportNotificationRecord,
} from "../ward-support-notifications";

import styles from "./support-notification-checklist.module.css";

const OUTCOME_ITEMS: { id: SupportNotificationOutcome; label: string }[] = [
  { id: "told", label: "Told" },
  { id: "not_applicable", label: "Not applicable" },
];

const CONTACT_DAY_ITEMS: { id: SupportNotificationContactDay; label: string }[] = SUPPORT_NOTIFICATION_CONTACT_DAYS.map(
  (day) => ({ id: day, label: SUPPORT_NOTIFICATION_CONTACT_DAY_LABELS[day] }),
);

function recordTone(record: SupportNotificationRecord | undefined): WfTone {
  if (!record) return "warning";
  return record.outcome === "told" ? "success" : "neutral";
}

function recordText(record: SupportNotificationRecord | undefined, now: number): string {
  if (!record) return "Not recorded";
  if (record.outcome === "told")
    return `Told ${record.who ?? ""} · ${formatInstantWithDay(record.contactedAt ?? record.at, now)}`;
  return `Not applicable · ${record.reason ?? ""}`;
}

/**
 * Advisory carer, personal support person and MHAS checklist for one completed move of an
 * involuntary patient. Renders nothing for any other move. Each answer is a
 * `RECORD_SUPPORT_NOTIFICATION`; the reducer is the gate, and its refusal is shown here.
 */
export function SupportNotificationChecklist({
  movementId,
  admissionId,
  role,
}: {
  /** An arrival (admission or transfer). */
  movementId?: string;
  /** A discharge. */
  admissionId?: string;
  role: "ward" | "coordinator";
}) {
  const { movements, admissions, patients, referrals, supportNotifications, dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const headingId = useId();
  const [editing, setEditing] = useState<SupportNotificationParty | null>(null);
  const [outcome, setOutcome] = useState<SupportNotificationOutcome>("told");
  const [who, setWho] = useState("");
  const [day, setDay] = useState<SupportNotificationContactDay>("today");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const recordCount = supportNotifications?.length ?? 0;
  // The form closes once the reducer has accepted (a new record exists); a refusal keeps it open.
  const openParty = editing !== null && !(savedFrom !== null && recordCount > savedFrom) ? editing : null;

  const subject = useMemo(() => {
    if (movementId) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      return movement ? movementSupportNotificationSubject(movement, { referrals }) : undefined;
    }
    if (admissionId) {
      const admission = admissions.find((candidate) => candidate.id === admissionId);
      return admission
        ? admissionSupportNotificationSubject(admission, { movements, admissions, patients, referrals })
        : undefined;
    }
    return undefined;
  }, [movementId, admissionId, movements, admissions, patients, referrals]);

  if (!subject) return null;
  const checklist = supportNotificationChecklist(supportNotifications, subject.occasion, subject.subjectId);
  const done = SUPPORT_NOTIFICATION_PARTIES.filter((party) => checklist[party] !== undefined).length;
  const refusal =
    submittedAt !== null &&
    rejections.length > submittedAt &&
    rejections.at(-1)?.attempted === "RECORD_SUPPORT_NOTIFICATION"
      ? rejections.at(-1)?.reason
      : undefined;

  function startEditing(party: SupportNotificationParty) {
    setEditing(party);
    setOutcome("told");
    setWho("");
    setDay("today");
    setTime(formatInstant(now));
    setReason("");
    setSubmittedAt(null);
    setSavedFrom(null);
    setTimeError(null);
  }

  function save(party: SupportNotificationParty) {
    if (!subject) return;
    const contactedAt = contactClockTextToInstant(time, day, now);
    if (outcome === "told" && contactedAt === null) {
      setTimeError(
        /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())
          ? "That day and time is still in the future"
          : "Enter the time as HH:MM, for example 14:05",
      );
      return;
    }
    setTimeError(null);
    setSubmittedAt(rejections.length);
    setSavedFrom(recordCount);
    const target =
      subject.occasion === "discharge" ? { admissionId: subject.subjectId } : { movementId: subject.subjectId };
    dispatch({
      type: "RECORD_SUPPORT_NOTIFICATION",
      role,
      now,
      occasion: subject.occasion,
      ...target,
      party,
      outcome,
      ...(outcome === "told" ? { who, contactedAt: contactedAt ?? now } : { reason }),
    });
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="ward-support-notifications">
      <div className={styles.head}>
        <BellRing aria-hidden="true" className={styles.icon} />
        <h4 id={headingId} className={styles.title}>
          Carer, PSP and MHAS
        </h4>
        <span className={styles.meta}>
          {SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion]} · Advisory · {done} of 3
        </span>
      </div>
      {refusal ? (
        <p className={styles.error} role="alert">
          <StatusGlyph tone="danger" size={9} />
          Not recorded: {refusal}
        </p>
      ) : null}
      <ul className={styles.rows}>
        {SUPPORT_NOTIFICATION_PARTIES.map((party) => {
          const record = checklist[party];
          return (
            <li key={party} className={styles.row} data-party={party} data-state={record?.outcome ?? "outstanding"}>
              <div className={styles.line}>
                <span className={styles.party}>
                  <StatusGlyph tone={recordTone(record)} size={9} />
                  {SUPPORT_NOTIFICATION_PARTY_LABELS[party]}
                </span>
                <span className={styles.value} data-testid={`ward-support-notification-${party}`}>
                  {recordText(record, now)}
                </span>
                {openParty === party ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${record ? "Change" : "Record"} ${SUPPORT_NOTIFICATION_PARTY_LABELS[party]}`}
                    onClick={() => {
                      startEditing(party);
                    }}
                  >
                    {record ? "Change" : "Record"}
                  </Button>
                )}
              </div>
              {openParty === party ? (
                <form
                  className={styles.form}
                  aria-label={`Record ${SUPPORT_NOTIFICATION_PARTY_LABELS[party]}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    save(party);
                  }}
                >
                  <Segmented<SupportNotificationOutcome>
                    label="Outcome"
                    items={OUTCOME_ITEMS}
                    value={outcome}
                    onChange={setOutcome}
                  />
                  {outcome === "told" ? (
                    <>
                      <Field label="Who was told">
                        <TextInput
                          value={who}
                          maxLength={SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS}
                          autoComplete="off"
                          onChange={(event) => {
                            setWho(event.target.value);
                          }}
                        />
                      </Field>
                      <div className={styles.when}>
                        <Segmented<SupportNotificationContactDay>
                          label="Day told"
                          items={CONTACT_DAY_ITEMS}
                          value={day}
                          onChange={setDay}
                        />
                        <Field label="Time told" hint="24h" error={timeError ?? undefined}>
                          <TextInput
                            value={time}
                            inputMode="numeric"
                            placeholder="HH:MM"
                            maxLength={5}
                            onChange={(event) => {
                              setTime(event.target.value);
                            }}
                          />
                        </Field>
                      </div>
                    </>
                  ) : (
                    <Field label="Reason">
                      <TextInput
                        value={reason}
                        maxLength={SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS}
                        autoComplete="off"
                        onChange={(event) => {
                          setReason(event.target.value);
                        }}
                      />
                    </Field>
                  )}
                  <div className={styles.actions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="pri"
                      size="sm"
                      type="submit"
                      disabled={outcome === "told" ? who.trim() === "" : reason.trim() === ""}
                    >
                      Save
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
