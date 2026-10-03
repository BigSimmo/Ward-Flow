"use client";
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
  separationHandoff,
  type CareChange,
} from "../ward-care-journey";
import type { DischargeRecord, WardRecordActor } from "../ward-discharge-records";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { formatInstantWithDay } from "../ward-clock";
import styles from "./discharges-third-edition.module.css";
const words = (value: string) => value.replaceAll("_", " ");
function Choice({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <label className={styles.filterField}>
      {label}
      <select name={label} required defaultValue="">
        <option value="">Choose {label.toLowerCase()}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {words(v)}
          </option>
        ))}
      </select>
    </label>
  );
}
export function DischargeCareJourney({ record, actor }: { record: DischargeRecord; actor: WardRecordActor }) {
  const { dispatch, rejections, dayZero, units } = useWardFlow();
  const now = useWardFlowClock();
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cohort, setCohort] = useState("adult");
  const care = record.careJourney;
  const editable =
    record.identity.kind === "linked" &&
    ["occupied", "departed"].includes(record.admissionState) &&
    ["ward", "coordinator", "community"].includes(actor.role);
  const dead = record.leavingDestination === "died-on-the-ward";
  const clinical = actor.role !== "community";
  const instant = (value: FormDataEntryValue | null) => {
    if (typeof value !== "string" || !value) return NaN;
    const date = new Date(value);
    return (date.getTime() - dayZero.getTime()) / 60_000;
  };
  function save(value: unknown) {
    if (!validCareChange(value) || record.identity.kind !== "linked") {
      setLocalError("Complete the required choices and date before recording.");
      return;
    }
    setLocalError(null);
    setSubmitted(rejections.length);
    dispatch({
      type: "RECORD_ADMISSION_CARE",
      role: actor.role,
      now,
      ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
      ...(actor.role === "community" ? { actingTeamId: actor.actingTeamId } : {}),
      admissionId: record.admissionId,
      patientId: record.identity.patient.id,
      expectedGeneration: record.generation,
      expectedRevision: record.revision,
      change: value,
    });
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
  const fact = (at: number, by: string) => `${by} · ${formatInstantWithDay(at, now)}`;
  return (
    <section className={styles.drawerSection} aria-label="Care journey">
      <h4>Care journey</h4>
      <p>
        Chosen workflow facts are attributed to the recording role. Clinical documents remain in the clinical record.
      </p>
      {localError && <p role="alert">{localError}</p>}
      {submitted !== null && rejections.length > submitted && (
        <p role="alert">
          {rejections.at(-1)?.reason ?? "Care action was not recorded."} Reopen the current record before retrying.
        </p>
      )}
      <dl>
        <dt>Responsible clinician and appointment</dt>
        <dd>
          {care?.followUp
            ? `${CARE_CONTACTS.find((c) => c.id === care.followUp?.contactId)?.label} · ${communityTeamById(care.followUp.serviceId)?.name} · ${words(care.followUp.mode)} · ${formatInstantWithDay(care.followUp.appointmentAt, now)} · ${fact(care.followUp.recordedAt, care.followUp.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Follow-up contact</dt>
        <dd>
          {care?.contacts.length
            ? care.contacts.map((c, i) => (
                <p key={i}>
                  {words(c.outcome)} · contact {formatInstantWithDay(c.contactedAt, now)} · recorded{" "}
                  {fact(c.recordedAt, c.recordedBy)}
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
            ? `${words(care.coding.receivingClass)} · code ${care.coding.separationCode} · ${fact(care.coding.recordedAt, care.coding.recordedBy)}`
            : "Not recorded; legacy residential care needs an explicit classification."}
        </dd>
        <dt>Statistical episode changes</dt>
        <dd>
          {care?.episodes.length
            ? care.episodes.map((e, i) => (
                <p key={i}>
                  {words(e.episodeType)} · code 50 · {fact(e.recordedAt, e.recordedBy)}
                </p>
              ))
            : "Not recorded"}
        </dd>
        <dt>Transport arrangement</dt>
        <dd>
          {care?.transport
            ? `${words(care.transport.mode)} · ${care.transport.region} · risk document ${care.transport.riskDocument ? "recorded" : "not recorded"} · authority ${care.transport.authority} · ${fact(care.transport.recordedAt, care.transport.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Receiving ward transfer</dt>
        <dd>
          {care?.transfer
            ? `${units.find((u) => u.id === care.transfer?.receivingUnitId)?.name} · ${care.transfer.step} · ${fact(care.transfer.recordedAt, care.transfer.recordedBy)}`
            : "Not recorded"}
        </dd>
        <dt>Paper authority for community transition</dt>
        <dd>
          {care?.legal
            ? `${care.legal.authority} · written ${formatInstantWithDay(care.legal.writtenAt, now)} · checked ${fact(care.legal.recordedAt, care.legal.recordedBy)}`
            : "Not recorded"}
        </dd>
      </dl>
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
                <Choice label="Planning item" values={CARE_PLAN_ITEMS} />
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
                    values={
                      actor.role === "coordinator" ? ["accepted", "handover", "arrived"] : ["accepted", "handover"]
                    }
                  />
                  <p>
                    Acceptance and handover precede arrival. The coordinator records arrival, checking suitability and
                    moving both wards’ occupancy in one transaction.
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
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "separation-review.json";
            a.click();
            URL.revokeObjectURL(url);
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
