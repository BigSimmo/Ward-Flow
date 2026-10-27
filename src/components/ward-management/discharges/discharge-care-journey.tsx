"use client";

import { downloadBlob } from "@/components/ward-management/ward-download";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { COMMUNITY_TEAM_PAGES, communityTeamById } from "../community/community-derivations";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  CARE_CONTACTS,
  CARE_PLAN_ITEMS,
  CARE_DOCUMENTS,
  CARE_STATUSES,
  APPOINTMENT_MODES,
  CONTACT_OUTCOMES,
  TRANSPORT_MODES,
  RECEIVING_CLASSES,
  SEPARATION_CODES,
  EPISODE_TYPES,
  validCareChange,
  currentCareContact,
  separationHandoff,
  careRecordedByLabel,
} from "../ward-care-journey";
import type { DischargeRecord, WardRecordActor } from "../ward-discharge-records";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { formatInstantWithDay, perthDateTimeLocal } from "../ward-clock";
import { useWardFormSave } from "../use-ward-form-save";
import styles from "./discharges-third-edition.module.css";
const words = (value: string) => value.replaceAll("_", " ");
/** Fresh audit W-4: stored values read as plain labels, never as raw codes. */
const CHOICE_LABELS: Readonly<Record<string, string>> = {
  none: "No transport order",
  metro: "Metropolitan",
  rfds: "RFDS",
  accepted: "Accepted",
  handover: "Handed over",
  arrived: "Arrived",
  revocation: "Revocation",
};
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** H-0842: a form code reads with its register title ("Form 4A (Transport order)" style, from the register), never the bare code. */
const FORM_CODES = new Set(["4A", "5A", "5B", "7D"]);
const choiceLabel = (value: string) =>
  FORM_CODES.has(value) ? legalFormName({ code: value }) : sentence(CHOICE_LABELS[value] ?? words(value));
/** A stored list value (status, outcome, mode, class) in sentence case, as the select offers it. */
const plain = (value: string) => sentence(words(value));
/** Fresh audit W-4: the appointment's internal version number reads as how often it was booked. */
function bookingText(version: number): string {
  if (version <= 1) return "first booking";
  const times = version - 1;
  return `rebooked ${times === 1 ? "once" : times === 2 ? "twice" : `${times} times`}`;
}
function Choice({
  label,
  values,
  labelOf = choiceLabel,
}: {
  label: string;
  values: readonly string[];
  labelOf?: (value: string) => string;
}) {
  return (
    <label className={styles.filterField}>
      {label}
      <select name={label} required defaultValue="">
        <option value="">Choose {label.toLowerCase()}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {labelOf(v)}
          </option>
        ))}
      </select>
    </label>
  );
}
export function DischargeCareJourney({ record, actor }: { record: DischargeRecord; actor: WardRecordActor }) {
  const { dispatch, rejections, dayZero, units } = useWardFlowSelect("dispatch", "rejections", "dayZero", "units");
  const now = useWardFlowClock();
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cohort, setCohort] = useState("adult");
  // Audit 24-3 SV-5: a shared refusal reaches only the outcome, so it is said here too.
  const careSave = useWardFormSave(record.admissionId);
  const care = record.careJourney;
  const editable =
    record.identity.kind === "linked" &&
    ["occupied", "departed"].includes(record.admissionState) &&
    ["ward", "coordinator", "community"].includes(actor.role);
  const dead = record.leavingDestination === "died-on-the-ward";
  const clinical = actor.role !== "community";
  const instant = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || !value) return NaN;
    const date = perthDateTimeLocal(value);
    return date ? (date.getTime() - dayZero.getTime()) / 60_000 : NaN;
  };
  function save(value: unknown) {
    if (!validCareChange(value) || record.identity.kind !== "linked") {
      setLocalError("Complete the required choices and date before recording.");
      return;
    }
    setLocalError(null);
    setSubmitted(rejections.length);
    const patientId = record.identity.patient.id;
    careSave.submit(
      () =>
        dispatch({
          type: "RECORD_ADMISSION_CARE",
          role: actor.role,
          now,
          ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
          ...(actor.role === "community" ? { actingTeamId: actor.actingTeamId } : {}),
          admissionId: record.admissionId,
          patientId,
          expectedGeneration: record.generation,
          expectedRevision: record.revision,
          change: value,
        }),
      () => {},
    );
  }
  const section = (title: string, children: ReactNode, change: (data: FormData) => unknown) => (
    <details>
      <summary>{title}</summary>
      <form
        className={styles.filters}
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          change(new FormData(e.currentTarget));
        }}
      >
        {children}
        <button className={styles.quietButton} type="submit">
          Record {title.toLowerCase()}
        </button>
      </form>
    </details>
  );
  const fact = (at: number, by: string) => `${careRecordedByLabel(by)} · ${formatInstantWithDay(at, now)}`;
  return (
    <section className={`${styles.drawerSection} ${styles.careJourney}`} aria-label="Care journey">
      <h4>Care journey</h4>
      <p>
        Chosen workflow facts are attributed to the recording role. Clinical documents remain in the clinical record.
      </p>
      {localError && <p role="alert">{localError}</p>}
      {submitted !== null &&
      rejections.length > submitted &&
      rejections.at(-1)?.attempted === "RECORD_ADMISSION_CARE" ? (
        <p role="alert">
          {rejections.at(-1)?.reason ?? "Care action was not recorded."} Reopen the current record before retrying.
        </p>
      ) : careSave.error ? (
        <p role="alert">{careSave.error}</p>
      ) : null}
      <dl>
        <dt>Responsible clinician and appointment</dt>
        <dd>
          {care?.followUp
            ? `${CARE_CONTACTS.find((c) => c.id === care.followUp?.contactId)?.label ?? "Clinician not recorded"} · ${communityTeamById(care.followUp.serviceId)?.name ?? "Team not recorded"} · ${plain(care.followUp.mode)} · ${formatInstantWithDay(care.followUp.appointmentAt, now)} · ${fact(care.followUp.recordedAt, care.followUp.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Current appointment contact</dt>
        <dd>
          {care?.followUp
            ? record.followUp?.state !== "arranged"
              ? "Appointment is not marked arranged; earlier details remain in history"
              : currentCareContact(care)
                ? `${plain(currentCareContact(care)!.outcome)} · ${bookingText(care.followUp.appointmentVersion)}`
                : "No contact recorded for the current appointment"
            : "No appointment recorded"}
        </dd>
        <dt>Follow-up contact history</dt>
        <dd>
          {care?.contacts.length
            ? care.contacts.map((c, i) => (
                <p key={i}>
                  {plain(c.outcome)} · {bookingText(c.appointmentVersion)}
                  {c.appointmentVersion === care.followUp?.appointmentVersion ? " (current)" : " (previous)"} · contact{" "}
                  {formatInstantWithDay(c.contactedAt, now)} · recorded {fact(c.recordedAt, c.recordedBy)}
                </p>
              ))
            : "Not recorded"}
        </dd>
        <dt>Discharge planning</dt>
        <dd>
          {CARE_PLAN_ITEMS.map((item) => (
            <p key={item}>
              {words(item)}:{" "}
              {care?.plan[item]?.status
                ? `${words(care.plan[item]!.status)} · ${fact(care.plan[item]!.recordedAt, care.plan[item]!.recordedBy)}`
                : "Not recorded"}
            </p>
          ))}
        </dd>
        <dt>Clinical documentation</dt>
        <dd>
          {CARE_DOCUMENTS.map((item) => (
            <p key={item}>
              {words(item)}:{" "}
              {care?.documents[item]
                ? `${care.documents[item]!.cohort.toUpperCase()} · ${words(care.documents[item]!.status)} · ${fact(care.documents[item]!.recordedAt, care.documents[item]!.recordedBy)}`
                : "Not recorded"}
            </p>
          ))}
        </dd>
        <dt>Receiving establishment and coding review</dt>
        <dd>
          {care?.coding
            ? `${plain(care.coding.receivingClass)} · code ${care.coding.separationCode} · ${fact(care.coding.recordedAt, care.coding.recordedBy)}`
            : "Not recorded; legacy residential care needs an explicit classification."}
        </dd>
        <dt>Statistical episode changes</dt>
        <dd>
          {care?.episodes.length
            ? care.episodes.map((e, i) => (
                <p key={i}>
                  {plain(e.episodeType)} · code 50 · {fact(e.recordedAt, e.recordedBy)}
                </p>
              ))
            : "Not recorded"}
        </dd>
        <dt>Transport arrangement</dt>
        <dd>
          {care?.transport
            ? `${choiceLabel(care.transport.mode)} · ${choiceLabel(care.transport.region)} · risk document ${care.transport.riskDocument ? "recorded" : "not recorded"} · ${care.transport.authority === "none" ? "no transport order" : `authority ${choiceLabel(care.transport.authority)}`} · ${fact(care.transport.recordedAt, care.transport.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Receiving ward transfer</dt>
        <dd>
          {care?.transfer
            ? `${units.find((u) => u.id === care.transfer?.receivingUnitId)?.name ?? "Ward not recorded"} · ${choiceLabel(care.transfer.step)} · ${fact(care.transfer.recordedAt, care.transfer.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Paper authority for community transition</dt>
        <dd>
          {care?.legal
            ? `${choiceLabel(care.legal.authority)} · written ${formatInstantWithDay(care.legal.writtenAt, now)} · checked ${fact(care.legal.recordedAt, care.legal.recordedBy)}`
            : "Not recorded"}
        </dd>
      </dl>
      {record.identity.kind !== "linked" && ["occupied", "departed"].includes(record.admissionState) && (
        <p data-testid="care-journey-link-first">
          Link the patient to their record first. A revocation or any other care step can only be recorded for a linked
          patient.
        </p>
      )}
      {editable && (
        <>
          {!dead &&
            section(
              "Appointment",
              <>
                <label className={styles.filterField}>
                  Responsible clinician
                  <select name="clinician" required defaultValue="">
                    <option value="">Choose clinician</option>
                    {CARE_CONTACTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  The local demonstration directory contains synthetic clinicians. A real directory connection is
                  required for clinical use.
                </p>
                <label className={styles.filterField}>
                  Responsible community service
                  <select name="service" required defaultValue={actor.role === "community" ? actor.actingTeamId : ""}>
                    <option value="">Choose service</option>
                    {COMMUNITY_TEAM_PAGES.filter((t) => actor.role !== "community" || t.id === actor.actingTeamId).map(
                      (t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className={styles.filterField}>
                  Appointment date and time
                  <input name="at" type="datetime-local" required />
                </label>
                <Choice label="Appointment mode" values={APPOINTMENT_MODES} />
                <p>
                  Contact through the recorded community service. The appointment location must be confirmed in its
                  clinical record.
                </p>
              </>,
              (d) =>
                save({
                  kind: "follow_up",
                  contactId: d.get("clinician"),
                  serviceId: d.get("service"),
                  appointmentAt: instant(d.get("at")),
                  mode: d.get("Appointment mode"),
                }),
            )}
          {!dead &&
            section(
              "Contact outcome",
              <>
                <Choice label="Contact outcome" values={CONTACT_OUTCOMES} />
                <label className={styles.filterField}>
                  Contact date and time
                  <input name="contactAt" type="datetime-local" required />
                </label>
              </>,
              (d) =>
                save({ kind: "contact", outcome: d.get("Contact outcome"), contactedAt: instant(d.get("contactAt")) }),
            )}
          {!dead &&
            section(
              "Planning item",
              <>
                <Choice label="Planning item" values={CARE_PLAN_ITEMS} labelOf={plain} />
                <Choice label="Planning status" values={CARE_STATUSES} />
              </>,
              (d) => save({ kind: "plan", item: d.get("Planning item"), status: d.get("Planning status") }),
            )}
          {!dead &&
            section(
              "Clinical document",
              <>
                <label className={styles.filterField}>
                  Document cohort
                  <select name="cohort" value={cohort} onChange={(e) => setCohort(e.target.value)}>
                    <option value="adult">Adult</option>
                    <option value="camhs">CAMHS</option>
                  </select>
                </label>
                <Choice
                  key={cohort}
                  label="Document"
                  values={CARE_DOCUMENTS.filter((d) => cohort !== "camhs" || !["physical", "appearance"].includes(d))}
                />
                <Choice label="Document status" values={CARE_STATUSES} />
                <p>
                  Adult SMHMR and CAMHS forms are tracked separately. A completed status records the user’s assertion;
                  it does not inspect the document.
                </p>
              </>,
              (d) =>
                save({
                  kind: "document",
                  cohort: d.get("cohort"),
                  document: d.get("Document"),
                  status: d.get("Document status"),
                }),
            )}
          {clinical &&
            record.admissionState === "departed" &&
            section(
              "Separation coding",
              <>
                <Choice label="Receiving establishment class" values={RECEIVING_CLASSES} />
                <Choice label="Separation code" values={SEPARATION_CODES.filter((c) => c !== "50")} />
                <label>
                  <input type="checkbox" name="fromLeave" />
                  Clinical ending from leave confirmed
                </label>
                <p>
                  Code 70 records discharge from leave after the stay has ended. Code 50 uses the statistical episode
                  control and keeps the bed occupied.
                </p>
              </>,
              (d) =>
                save({
                  kind: "coding",
                  receivingClass: d.get("Receiving establishment class"),
                  separationCode: d.get("Separation code"),
                  dischargedFromLeave: d.has("fromLeave"),
                }),
            )}
          {clinical && record.admissionState === "occupied" && !dead && (
            <>
              {section(
                "Statistical episode change",
                <>
                  <Choice label="Episode type" values={EPISODE_TYPES} />
                  <p>This records an administrative change with code 50. It preserves the occupied bed.</p>
                </>,
                (d) => save({ kind: "episode", episodeType: d.get("Episode type") }),
              )}
              {section(
                "Transport arrangement",
                <>
                  <Choice label="Transport mode" values={TRANSPORT_MODES} />
                  <Choice label="Transport region" values={["metro", "country"]} />
                  <Choice label="Checked transport authority" values={["none", "4A", "7D"]} />
                  {[
                    "Risk document recorded",
                    "Escort suitability checked",
                    "Least restrictive option reviewed",
                    "Regional service arrangement confirmed",
                  ].map((label) => (
                    <label key={label}>
                      <input name={label} type="checkbox" />
                      {label}
                    </label>
                  ))}
                  <p>
                    Confirm current metropolitan or WACHS arrangements directly. This records an external arrangement;
                    it does not send a booking or infer service hours.
                  </p>
                </>,
                (d) =>
                  save({
                    kind: "transport",
                    mode: d.get("Transport mode"),
                    region: d.get("Transport region"),
                    authority: d.get("Checked transport authority"),
                    riskDocument: d.has("Risk document recorded"),
                    escortSuitable: d.has("Escort suitability checked"),
                    leastRestrictiveReviewed: d.has("Least restrictive option reviewed"),
                    regionalServiceConfirmed: d.has("Regional service arrangement confirmed"),
                  }),
              )}
              {section(
                "Ward transfer",
                <>
                  <label className={styles.filterField}>
                    Receiving ward
                    <select name="ward" required defaultValue={care?.transfer?.receivingUnitId ?? ""}>
                      <option value="">Choose receiving ward</option>
                      {units
                        .filter((u) => u.id !== record.unitId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Choice
                    label="Transfer step"
                    values={actor.role === "coordinator" ? ["accepted", "handover", "arrived"] : ["handover"]}
                  />
                  <p>
                    Acceptance and handover precede arrival. Only the central bed coordinator accepts a transfer and
                    records arrival, checking suitability and moving both wards’ occupancy in one transaction.
                  </p>
                </>,
                (d) => save({ kind: "transfer", receivingUnitId: d.get("ward"), step: d.get("Transfer step") }),
              )}
              {section(
                "Community legal transition",
                <>
                  <Choice label="Paper authority" values={["revocation", "5A", "5B"]} />
                  <label className={styles.filterField}>
                    Authority written date and time
                    <input name="written" type="datetime-local" required />
                  </label>
                  <label>
                    <input name="checked" type="checkbox" required />
                    Paper authority checked for this admission
                  </label>
                  <p>
                    Record an actual clinician-authorised order. No legal expiry or authority is calculated. A CTO
                    requires a recorded community clinician and appointment.
                  </p>
                </>,
                (d) =>
                  save({
                    kind: "legal",
                    authority: d.get("Paper authority"),
                    writtenAt: instant(d.get("written")),
                    paperChecked: d.has("checked"),
                  }),
              )}
            </>
          )}
        </>
      )}
      {clinical && care?.coding && (
        <button
          className={styles.quietButton}
          type="button"
          onClick={() => {
            const handoff = separationHandoff({
              id: record.admissionId,
              state: record.admissionState,
              leftAt: record.leftAt,
              leavingDestination: record.leavingDestination,
              careJourney: care,
            });
            if (!handoff) {
              setLocalError("Coding must match the current departure before export.");
              return;
            }
            const blob = new Blob([JSON.stringify(handoff, null, 2)], { type: "application/json" });
            // H-0356: the file name says synthetic, like every other Ward Flow download; the file's
            // own `synthetic: true` and notice come from separationHandoff.
            downloadBlob(blob, "ward-flow-synthetic-separation-review.json");
          }}
        >
          Download coding review handoff
        </button>
      )}
      <p>
        PAS/HMDC connection: not connected. A downloaded review handoff has not been submitted or accepted externally.
      </p>
    </section>
  );
}
