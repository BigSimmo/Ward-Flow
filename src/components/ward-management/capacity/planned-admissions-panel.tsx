"use client";

// src/components/ward-management/capacity/planned-admissions-panel.tsx
//
// Planned admissions on the Capacity screen (stream D, 9 October 2026): the next fourteen days as
// a count per day per health service, the bookings still waiting, and the forms that book,
// change, cancel and record the arrival of one. Every write is a reducer event; this component
// holds only the open form's draft, never in browser storage.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus } from "lucide-react";

import { Button, Field, Select, Sheet, StatusGlyph, TextInput } from "@/components/wf";
import {
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_CANCEL_REASON_LABELS,
  PLANNED_ADMISSION_LEGAL_STATUSES,
  PLANNED_ADMISSION_MAX_STAY_DAYS,
  PLANNED_ADMISSION_REASONS,
  PLANNED_ADMISSION_REASON_LABELS,
  PLANNED_ADMISSION_WINDOW_DAYS,
  normalisePlannedAdmissionInitials,
  plannedAdmissionIsOverdue,
  type PlannedAdmission,
  type PlannedAdmissionCancelReason,
  type PlannedAdmissionReason,
} from "@/components/ward-management/ward-admissions";
import {
  MINUTES_PER_DAY,
  calendarDateOf,
  dayOf,
  demoDayZero,
  formatInstantWithDay,
  formatRemaining,
  minuteOfDay,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  HEALTH_SERVICES,
  RECORDED_SEXES,
  type LegalStatus,
  type RecordedSex,
} from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientDisplayName, type PatientId } from "@/components/ward-management/ward-patients";
import { healthServiceAcronym, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { plannedAdmissionAgenda, plannedAdmissionDays } from "./planned-admissions";
import styles from "./planned-admissions.module.css";

type Draft = {
  who: "patient" | "initials";
  patientId: string;
  initials: string;
  sex: RecordedSex;
  reason: PlannedAdmissionReason;
  unitId: string;
  dayOffset: number;
  time: string;
  stayDays: string;
  legalStatus: LegalStatus;
  /** Preserved when editing an overdue booking so an unrelated save does not move its day. */
  originalArrivalAt: Instant | null;
};

type FormState = { mode: "book" } | { mode: "change"; id: string } | { mode: "cancel"; id: string } | null;

/** The "hh:mm" value a time input needs. Never displayed as text: rows use formatInstantWithDay. */
function clockInputValue(instant: Instant): string {
  const minute = minuteOfDay(instant);
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function PlannedAdmissionsPanel({ now }: { now: Instant }) {
  const { units, patients, admissions, dayZero, dispatch, rejections, plannedAdmissions = [] } = useWardFlow();
  // Capacity DOM tests mock `useWardFlow` from seed state and omit `dayZero`; the live provider
  // always supplies it. Fall back the same way `record-preview` does so label rendering never throws.
  const activeDayZero = dayZero ?? demoDayZero(new Date());
  const patientOf = usePatientOf();
  const [form, setForm] = useState<FormState>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cancelReason, setCancelReason] = useState<PlannedAdmissionCancelReason>(PLANNED_ADMISSION_CANCEL_REASONS[0]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const pending = useRef<{ rejections: number } | null>(null);
  const bookButton = useRef<HTMLButtonElement>(null);

  const days = plannedAdmissionDays(plannedAdmissions, units, now);
  const agenda = plannedAdmissionAgenda(plannedAdmissions);
  const servicesInWindow = HEALTH_SERVICES.filter((service) =>
    days.some((day) => day.byService.some((entry) => entry.service === service)),
  );
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";

  // Patients free to book: no live stay and no booking already waiting.
  const bookablePatients = useMemo(() => {
    const busy = new Set<string>();
    for (const admission of admissions)
      if (admission.patientId && (admission.state === "pulled" || admission.state === "occupied"))
        busy.add(admission.patientId);
    for (const planned of plannedAdmissions)
      if (planned.patientId && planned.state === "booked") busy.add(planned.patientId);
    return patients
      .filter((patient) => !busy.has(patient.id))
      .sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b)));
  }, [admissions, patients, plannedAdmissions]);

  // A dispatch either adds a rejection (refused: say why) or not (accepted: close the form).
  useEffect(() => {
    if (!pending.current) return;
    const before = pending.current.rejections;
    pending.current = null;
    if (rejections.length > before) {
      setRefusal(rejections[rejections.length - 1]?.reason ?? "Not recorded");
    } else {
      setForm(null);
      setDraft(null);
      setRefusal(null);
    }
  }, [rejections, plannedAdmissions, admissions]);

  function dayLabel(dayOffset: number): string {
    if (dayOffset === 0) return "Today";
    if (dayOffset === 1) return "Tomorrow";
    return calendarDateOf((dayOf(now) + dayOffset) * MINUTES_PER_DAY, activeDayZero).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function shortDayLabel(dayOffset: number): string {
    return calendarDateOf((dayOf(now) + dayOffset) * MINUTES_PER_DAY, activeDayZero).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
    });
  }

  function whoText(planned: PlannedAdmission): string {
    if (planned.patientId) return patientOf({ patientId: planned.patientId }).displayName;
    return `Initials ${planned.initials ?? "not recorded"}`;
  }

  function openBook() {
    setRefusal(null);
    setDraft({
      who: bookablePatients.length > 0 ? "patient" : "initials",
      patientId: bookablePatients[0]?.id ?? "",
      initials: "",
      sex: "Not recorded",
      reason: PLANNED_ADMISSION_REASONS[0],
      unitId: units[0]?.id ?? "",
      dayOffset: 1,
      time: "10:00",
      stayDays: "7",
      legalStatus: PLANNED_ADMISSION_LEGAL_STATUSES[0]!,
      originalArrivalAt: null,
    });
    setForm({ mode: "book" });
  }

  function openChange(planned: PlannedAdmission) {
    setRefusal(null);
    setDraft({
      who: planned.patientId ? "patient" : "initials",
      patientId: planned.patientId ?? "",
      initials: planned.initials ?? "",
      sex: planned.sex,
      reason: planned.reason,
      unitId: planned.unitId,
      // Keep a past day visible so an overdue booking does not silently become "Today".
      dayOffset: dayOf(planned.expectedArrivalAt) - dayOf(now),
      time: clockInputValue(planned.expectedArrivalAt),
      stayDays: String(planned.expectedStayDays),
      legalStatus: planned.legalStatus,
      originalArrivalAt: planned.expectedArrivalAt,
    });
    setForm({ mode: "change", id: planned.id });
  }

  function openCancel(planned: PlannedAdmission) {
    setRefusal(null);
    setCancelReason(PLANNED_ADMISSION_CANCEL_REASONS[0]);
    setForm({ mode: "cancel", id: planned.id });
  }

  function closeForm() {
    setForm(null);
    setDraft(null);
    setRefusal(null);
  }

  function submitDraft() {
    if (!draft || !form || form.mode === "cancel") return;
    const minute = parseTime(draft.time);
    if (minute === null) {
      setRefusal("Enter the arrival time as hh:mm.");
      return;
    }
    const stay = Number(draft.stayDays);
    const selectedArrivalAt = (dayOf(now) + draft.dayOffset) * MINUTES_PER_DAY + minute;
    // Unrelated edits on an overdue booking must keep the recorded instant when day/time are unchanged.
    const expectedArrivalAt =
      form.mode === "change" &&
      draft.originalArrivalAt !== null &&
      selectedArrivalAt === draft.originalArrivalAt
        ? draft.originalArrivalAt
        : selectedArrivalAt;
    pending.current = { rejections: rejections.length };
    if (form.mode === "book") {
      let sex = draft.sex;
      let initials: string | null = null;
      if (draft.who === "initials") {
        initials = normalisePlannedAdmissionInitials(draft.initials);
        if (initials === null) {
          pending.current = null;
          setRefusal("Initials are one to three letters.");
          return;
        }
      } else {
        const patient = patients.find((candidate) => candidate.id === draft.patientId);
        // Preserve every recorded sex, including "Another term"; only invent "Not recorded" when absent.
        const recorded = patient?.sex;
        sex =
          recorded && (RECORDED_SEXES as readonly RecordedSex[]).includes(recorded as RecordedSex)
            ? (recorded as RecordedSex)
            : "Not recorded";
      }
      dispatch({
        type: "BOOK_PLANNED_ADMISSION",
        role: "coordinator",
        now,
        ...(draft.who === "patient" ? { patientId: draft.patientId as PatientId } : { initials }),
        sex,
        reason: draft.reason,
        unitId: draft.unitId,
        expectedArrivalAt,
        expectedStayDays: stay,
        legalStatus: draft.legalStatus,
      });
    } else {
      dispatch({
        type: "CHANGE_PLANNED_ADMISSION",
        role: "coordinator",
        now,
        plannedAdmissionId: form.id,
        reason: draft.reason,
        unitId: draft.unitId,
        expectedArrivalAt,
        expectedStayDays: stay,
        legalStatus: draft.legalStatus,
      });
    }
  }

  function submitCancel() {
    if (!form || form.mode !== "cancel") return;
    pending.current = { rejections: rejections.length };
    dispatch({
      type: "CANCEL_PLANNED_ADMISSION",
      role: "coordinator",
      now,
      plannedAdmissionId: form.id,
      reason: cancelReason,
    });
  }

  function recordArrival(planned: PlannedAdmission) {
    pending.current = { rejections: rejections.length };
    dispatch({ type: "CONVERT_PLANNED_ADMISSION", role: "coordinator", now, plannedAdmissionId: planned.id });
  }

  const booked = agenda.length;
  const cancelling = form?.mode === "cancel" ? plannedAdmissions.find((planned) => planned.id === form.id) : undefined;
  const update = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <WardPanel
      title="Planned admissions"
      count={`${booked} booked, next ${PLANNED_ADMISSION_WINDOW_DAYS} days`}
      testId="ward-capacity-planned-admissions"
      headerAction={
        <Button ref={bookButton} variant="pri" size="sm" onClick={openBook} data-testid="ward-planned-book">
          <CalendarPlus size={16} aria-hidden="true" />
          Book
        </Button>
      }
    >
      <div className={styles.body}>
        <div className={styles.stripScroll} role="region" aria-label="Planned admissions per day" tabIndex={0}>
          <table className={styles.strip} data-testid="ward-planned-strip">
            <thead>
              <tr>
                <th scope="col" className={styles.rowHead}>
                  Service
                </th>
                {days.map((day) => (
                  <th key={day.day} scope="col" className={styles.dayHead}>
                    {day.dayOffset === 0 ? "Today" : shortDayLabel(day.dayOffset)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servicesInWindow.map((service) => (
                <tr key={service}>
                  <th scope="row" className={styles.rowHead} title={service}>
                    {healthServiceAcronym(service)}
                  </th>
                  {days.map((day) => {
                    const count = day.byService.find((entry) => entry.service === service)?.count ?? 0;
                    return (
                      <td key={day.day} className={count > 0 ? styles.count : styles.none}>
                        {count > 0 ? count : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <th scope="row" className={styles.rowHead}>
                  Total
                </th>
                {days.map((day) => (
                  <td
                    key={day.day}
                    className={day.total > 0 ? styles.count : styles.none}
                    data-testid={`ward-planned-day-${day.dayOffset}`}
                  >
                    {day.total > 0 ? day.total : "·"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {agenda.length === 0 ? (
          <p className={styles.empty}>No planned admissions booked.</p>
        ) : (
          <ul className={styles.agenda} aria-label="Booked planned admissions">
            {agenda.map((planned) => {
              const overdue = plannedAdmissionIsOverdue(planned, now);
              const unit = units.find((candidate) => candidate.id === planned.unitId);
              const service = unit ? unitHealthService(unit) : undefined;
              return (
                <li key={planned.id} className={styles.item} data-testid={`ward-planned-${planned.id}`}>
                  <span className={styles.when}>
                    {overdue ? <StatusGlyph tone="warning" size={8} /> : null}
                    <span className={styles.time}>{formatInstantWithDay(planned.expectedArrivalAt, now)}</span>
                  </span>
                  <span className={styles.who}>{whoText(planned)}</span>
                  <span className={styles.facts}>
                    {PLANNED_ADMISSION_REASON_LABELS[planned.reason]} · {unitName(planned.unitId)}
                    {service ? ` (${healthServiceAcronym(service)})` : ""} · {planned.expectedStayDays}d ·{" "}
                    {planned.legalStatus}
                    {overdue ? (
                      <span className={styles.overdue}>
                        {" "}
                        · arrival not recorded, {formatRemaining(minutesUntil(planned.expectedArrivalAt, now))}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.actions}>
                    <Button size="sm" variant="sec" onClick={() => recordArrival(planned)}>
                      Arrived
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openChange(planned)}>
                      Change
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openCancel(planned)}>
                      Cancel
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {refusal && !form ? (
          <p className={styles.refusal} role="status" data-testid="ward-planned-refusal">
            {refusal}
          </p>
        ) : null}
      </div>

      <Sheet
        open={form !== null && form.mode !== "cancel" && draft !== null}
        onClose={closeForm}
        title={form?.mode === "change" ? "Change planned admission" : "Book planned admission"}
        portal={false}
        testId="ward-planned-form"
        returnFocusRef={bookButton}
        footer={
          <div className={styles.sheetFoot}>
            <Button onClick={closeForm}>Close</Button>
            <Button variant="pri" onClick={submitDraft} data-testid="ward-planned-submit">
              {form?.mode === "change" ? "Save" : "Book"}
            </Button>
          </div>
        }
      >
        {draft ? (
          <div className={styles.form}>
            {form?.mode === "book" ? (
              <>
                <Field label="Patient">
                  <Select
                    value={draft.who}
                    onChange={(event) => update({ who: event.target.value as Draft["who"] })}
                    data-testid="ward-planned-who"
                  >
                    <option value="patient" disabled={bookablePatients.length === 0}>
                      Existing patient
                    </option>
                    <option value="initials">Initials only</option>
                  </Select>
                </Field>
                {draft.who === "patient" ? (
                  <Field label="Existing patient">
                    <Select
                      value={draft.patientId}
                      onChange={(event) => update({ patientId: event.target.value })}
                      data-testid="ward-planned-patient"
                    >
                      {bookablePatients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patientDisplayName(patient)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <>
                    <Field label="Initials" hint="1 to 3 letters">
                      <TextInput
                        value={draft.initials}
                        maxLength={5}
                        autoComplete="off"
                        onChange={(event) => update({ initials: event.target.value })}
                        data-testid="ward-planned-initials"
                      />
                    </Field>
                    <Field label="Recorded sex">
                      <Select
                        value={draft.sex}
                        onChange={(event) => update({ sex: event.target.value as RecordedSex })}
                        data-testid="ward-planned-sex"
                      >
                        {RECORDED_SEXES.map((sex) => (
                          <option key={sex} value={sex}>
                            {sex}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}
              </>
            ) : (
              <p className={styles.formWho}>
                {whoText(plannedAdmissions.find((planned) => form?.mode === "change" && planned.id === form.id)!)}
              </p>
            )}
            <Field label="Reason">
              <Select
                value={draft.reason}
                onChange={(event) => update({ reason: event.target.value as PlannedAdmissionReason })}
                data-testid="ward-planned-reason"
              >
                {PLANNED_ADMISSION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {PLANNED_ADMISSION_REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ward">
              <Select
                value={draft.unitId}
                onChange={(event) => update({ unitId: event.target.value })}
                data-testid="ward-planned-unit"
              >
                {HEALTH_SERVICES.map((service) => {
                  const inService = units.filter((unit) => unitHealthService(unit) === service);
                  return inService.length === 0 ? null : (
                    <optgroup key={service} label={service}>
                      {inService.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </Field>
            <div className={styles.pair}>
              <Field label="Day">
                <Select
                  value={String(draft.dayOffset)}
                  onChange={(event) => update({ dayOffset: Number(event.target.value) })}
                  data-testid="ward-planned-day"
                >
                  {Array.from({ length: PLANNED_ADMISSION_WINDOW_DAYS }, (_, index) => index)
                    .concat(draft.dayOffset < 0 ? [draft.dayOffset] : [])
                    .sort((a, b) => a - b)
                    .map((offset) => (
                      <option key={offset} value={offset}>
                        {dayLabel(offset)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Arrival time">
                <TextInput
                  type="time"
                  value={draft.time}
                  onChange={(event) => update({ time: event.target.value })}
                  data-testid="ward-planned-time"
                />
              </Field>
            </div>
            <div className={styles.pair}>
              <Field label="Expected stay" hint="days">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={PLANNED_ADMISSION_MAX_STAY_DAYS}
                  value={draft.stayDays}
                  onChange={(event) => update({ stayDays: event.target.value })}
                  data-testid="ward-planned-stay"
                />
              </Field>
              <Field label="Legal status">
                <Select
                  value={draft.legalStatus}
                  onChange={(event) => update({ legalStatus: event.target.value as LegalStatus })}
                  data-testid="ward-planned-legal"
                >
                  {PLANNED_ADMISSION_LEGAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {refusal ? (
              <p className={styles.refusal} role="alert" data-testid="ward-planned-form-refusal">
                {refusal}
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={form?.mode === "cancel" && cancelling !== undefined}
        onClose={closeForm}
        title="Cancel planned admission"
        portal={false}
        testId="ward-planned-cancel"
        footer={
          <div className={styles.sheetFoot}>
            <Button onClick={closeForm}>Keep booking</Button>
            <Button variant="danger" onClick={submitCancel} data-testid="ward-planned-cancel-confirm">
              Cancel booking
            </Button>
          </div>
        }
      >
        {cancelling ? (
          <div className={styles.form}>
            <p className={styles.formWho}>
              {whoText(cancelling)} · {unitName(cancelling.unitId)} ·{" "}
              {formatInstantWithDay(cancelling.expectedArrivalAt, now)}
            </p>
            <Field label="Reason">
              <Select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value as PlannedAdmissionCancelReason)}
                data-testid="ward-planned-cancel-reason"
              >
                {PLANNED_ADMISSION_CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {PLANNED_ADMISSION_CANCEL_REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
            </Field>
            {refusal ? (
              <p className={styles.refusal} role="alert">
                {refusal}
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </WardPanel>
  );
}
