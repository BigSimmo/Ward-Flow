"use client";

import { useUndoableStep } from "../use-undoable-step";
import { useId, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button, Field, Segmented, StatusGlyph, TextInput, type WfTone } from "@/components/wf";
import { formatInstant, formatInstantWithDay, type Instant } from "../ward-clock";
import { wardChromeRole } from "../ward-chrome-role";
import type { WardFlowRole } from "../ward-flow-events";
import { canDispatch } from "../ward-role-permissions";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import {
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_PARTY_LABELS,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
  admissionSupportNotificationSubject,
  clockTextOnDay,
  movementSupportNotificationSubject,
  supportNotificationChecklist,
  type SupportNotificationOutcome,
  type SupportNotificationParty,
  type SupportNotificationRecord,
} from "../ward-support-notifications";

import styles from "./support-notification-checklist.module.css";

const OUTCOME_ITEMS: { id: SupportNotificationOutcome; label: string }[] = [
  { id: "told", label: "Told" },
  { id: "not_applicable", label: "Not applicable" },
];

/** The day the person was told, so a contact before yesterday keeps its own date. */
type ToldDay = "0" | "1" | "2";
const DAY_ITEMS: { id: ToldDay; label: string }[] = [
  { id: "0", label: "Today" },
  { id: "1", label: "Yesterday" },
  { id: "2", label: "2 days ago" },
];

/**
 * Smart features idea 9 (19 Oct 2026): one tap for "told a little while ago". Each fills the time
 * and day, which stay editable; nothing is saved until Save. Minutes before the board clock.
 */
const TOLD_AGO_MINUTES = [15, 30, 60] as const;

export function toldAgo(now: Instant, minutes: number): { time: string; day: ToldDay } {
  const at = (now - minutes) as Instant;
  return { time: formatInstant(at), day: String(Math.floor(now / 1440) - Math.floor(at / 1440)) as ToldDay };
}

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
  role: roleOverride,
}: {
  /** An arrival (admission or transfer). */
  movementId?: string;
  /** A discharge. */
  admissionId?: string;
  /** The acting role. Defaults to the role this route gives (`ward-chrome-role.ts`), so history
   *  names who recorded it; a role the event does not allow sees the checklist read-only. */
  role?: WardFlowRole;
}) {
  const routeRole = wardChromeRole(usePathname() ?? "");
  const role = roleOverride ?? routeRole;
  const canRecord = canDispatch(role, "RECORD_SUPPORT_NOTIFICATION");
  const { movements, admissions, patients, referrals, supportNotifications, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const headingId = useId();
  const editingRevisionRef = useRef(0);
  const [editing, setEditing] = useState<SupportNotificationParty | null>(null);
  const [outcome, setOutcome] = useState<SupportNotificationOutcome>("told");
  const [who, setWho] = useState("");
  const [time, setTime] = useState("");
  const [day, setDay] = useState<ToldDay>("0");
  const [reason, setReason] = useState("");
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);
  const { runRecorded } = useUndoableStep({ dispatch, rejections, now, routeRole: role, onMessage: setOutcomeMessage });
  const [timeError, setTimeError] = useState<string | null>(null);
  const openParty = editing;

  const subject = useMemo(() => {
    if (movementId) {
      const movement = movements.find((candidate) => candidate.id === movementId);
      return movement ? movementSupportNotificationSubject(movement, referrals) : undefined;
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

  function startEditing(party: SupportNotificationParty) {
    editingRevisionRef.current += 1;
    setEditing(party);
    setOutcome("told");
    setWho("");
    setTime(formatInstant(now));
    setDay("0");
    setReason("");
    setOutcomeMessage(null);
    setTimeError(null);
  }

  function save(party: SupportNotificationParty) {
    if (!subject) return;
    const contactedAt = clockTextOnDay(time, Number(day), now);
    if (outcome === "told" && contactedAt === null) {
      setTimeError("Enter the time as HH:MM, for example 14:05 or 1405");
      return;
    }
    if (outcome === "told" && contactedAt !== null && contactedAt > now) {
      setTimeError("That time is later than now");
      return;
    }
    setTimeError(null);
    const submittedRevision = editingRevisionRef.current;
    const closeSubmittedDraft = () => {
      // An earlier save cannot dismiss a reopened form or edits made while it was pending.
      if (editingRevisionRef.current !== submittedRevision) return;
      editingRevisionRef.current += 1;
      setEditing(null);
    };
    const target =
      subject.occasion === "discharge" ? { admissionId: subject.subjectId } : { movementId: subject.subjectId };
    runRecorded(
      () => {
        const completion = dispatch({
          type: "RECORD_SUPPORT_NOTIFICATION",
          role,
          now,
          occasion: subject.occasion,
          ...target,
          party,
          outcome,
          ...(outcome === "told" ? { who, contactedAt: contactedAt ?? now } : { reason }),
        });
        if (completion && "then" in completion)
          void completion.then((result) => {
            if (result.status === "accepted") closeSubmittedDraft();
          });
        else if (completion?.status === "accepted") closeSubmittedDraft();
        return completion;
      },
      {
        success: `${SUPPORT_NOTIFICATION_PARTY_SHORT[party]} record saved`,
        undo: (at) => ({ type: "UNDO_SUPPORT_NOTIFICATION", role, now: at, ...target }),
        undone: "Tell record undone.",
      },
    );
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
      {outcomeMessage ? <p role="status">{outcomeMessage}</p> : null}
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
                {openParty === party || !canRecord ? null : (
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
                    onChange={(value) => {
                      editingRevisionRef.current += 1;
                      setOutcome(value);
                    }}
                  />
                  {outcome === "told" ? (
                    <div className={styles.fields}>
                      <Field label="Who was told">
                        <TextInput
                          value={who}
                          maxLength={SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS}
                          autoComplete="off"
                          onChange={(event) => {
                            editingRevisionRef.current += 1;
                            setWho(event.target.value);
                          }}
                        />
                      </Field>
                      <Segmented<ToldDay>
                        label="Day told"
                        items={DAY_ITEMS}
                        value={day}
                        onChange={(value) => {
                          editingRevisionRef.current += 1;
                          setDay(value);
                        }}
                      />
                      <Field label="Time told" hint="24h" error={timeError ?? undefined}>
                        <TextInput
                          value={time}
                          inputMode="numeric"
                          placeholder="HH:MM"
                          maxLength={5}
                          onChange={(event) => {
                            editingRevisionRef.current += 1;
                            setTime(event.target.value);
                          }}
                        />
                      </Field>
                      <div className={styles.agoChips} role="group" aria-label="Told a little while ago">
                        {TOLD_AGO_MINUTES.map((minutes) => (
                          <Button
                            key={minutes}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const told = toldAgo(now, minutes);
                              editingRevisionRef.current += 1;
                              setTime(told.time);
                              setDay(told.day);
                              setTimeError(null);
                            }}
                          >
                            {minutes === 60 ? "1 h ago" : `${minutes} min ago`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Field label="Reason">
                      <TextInput
                        value={reason}
                        maxLength={SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS}
                        autoComplete="off"
                        onChange={(event) => {
                          editingRevisionRef.current += 1;
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
                        editingRevisionRef.current += 1;
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
