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
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  COHORTS,
  HEALTH_SERVICES,
  RECORDED_SEXES,
  type Cohort,
  type LegalStatus,
  type RecordedSex,
} from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientCohort, patientDisplayName, type PatientId } from "@/components/ward-management/ward-patients";
import { healthServiceAcronym, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { plannedAdmissionAgenda, plannedAdmissionDays } from "./planned-admissions";
import {
  applyDraftPatch,
  clockInputValue,
  draftTiming,
  plannedDayOffsets,
  type PlannedAdmissionDraft,
} from "./planned-admissions-draft";
import styles from "./planned-admissions.module.css";

type Draft = PlannedAdmissionDraft;

type FormState = { mode: "book" } | { mode: "change"; id: string } | { mode: "cancel"; id: string } | null;

/** A linked patient's recorded sex, kept as recorded; anything unlisted reads as not recorded. */
function recordedSexOf(sex: string | undefined): RecordedSex {
  return RECORDED_SEXES.find((listed) => listed === sex) ?? "Not recorded";
}

export function PlannedAdmissionsPanel({ now }: { now: Instant }) {
  const {
    units,
    patients,
    admissions,
    movements,
    dayZero,
    dispatch,
    rejections,
    plannedAdmissions: plannedFromContext,
  } = useWardFlow();
  const plannedAdmissions = useMemo(() => plannedFromContext ?? [], [plannedFromContext]);
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

  // Patients free to book: no live stay, no open movement and no booking already waiting. The
  // reducer refuses the same people, so this list only spares a coordinator a refusal.
  const bookablePatients = useMemo(() => {
    const busy = new Set<string>();
    for (const admission of admissions)
      if (admission.patientId && (admission.state === "pulled" || admission.state === "occupied"))
        busy.add(admission.patientId);
    for (const movement of movements ?? []) if (movement.patientId && isOpen(movement)) busy.add(movement.patientId);
    for (const planned of plannedAdmissions)
      if (planned.patientId && planned.state === "booked") busy.add(planned.patientId);
    return patients
      .filter((patient) => !busy.has(patient.id))
      .sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b)));
  }, [admissions, movements, patients, plannedAdmissions]);

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

  // A calendar date needs the provider's day zero; a screen given none still labels each day by
  // its distance from today rather than failing to render.
  function calendarDay(dayOffset: number, options: Intl.DateTimeFormatOptions): string {
    if (!(dayZero instanceof Date)) return dayOffset < 0 ? `${-dayOffset}d ago` : `+${dayOffset}d`;
    return calendarDateOf((dayOf(now) + dayOffset) * MINUTES_PER_DAY, dayZero).toLocaleDateString("en-AU", options);
  }

  function dayLabel(dayOffset: number): string {
    if (dayOffset === 0) return "Today";
    if (dayOffset === 1) return "Tomorrow";
    return calendarDay(dayOffset, { weekday: "short", day: "numeric", month: "short" });
  }

  function shortDayLabel(dayOffset: number): string {
    return calendarDay(dayOffset, { weekday: "short", day: "numeric" });
  }

  function whoText(planned: PlannedAdmission): string {
    if (planned.patientId) return patientOf({ patientId: planned.patientId }).displayName;
    return `Initials ${planned.initials ?? "not recorded"}`;
  }

  const cancelling = form?.mode === "cancel" ? plannedAdmissions.find((planned) => planned.id === form.id) : undefined;
  const changing = form?.mode === "change" ? plannedAdmissions.find((planned) => planned.id === form.id) : undefined;

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
      ageBand: "Adult",
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
      // An overdue booking keeps its own past day, so saving another edit never moves it to today.
      dayOffset: dayOf(planned.expectedArrivalAt) - dayOf(now),
      time: clockInputValue(planned.expectedArrivalAt),
      stayDays: String(planned.expectedStayDays),
      legalStatus: planned.legalStatus,
      ageBand: planned.ageBand,
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
    const timing = draftTiming(draft, now);
    if (!timing.ok) {
      setRefusal(timing.refusal);
      return;
    }
    const { expectedArrivalAt, expectedStayDays } = timing;
    pending.current = { rejections: rejections.length };
    if (form.mode === "book") {
      let sex = draft.sex;
      let ageBand: Cohort = draft.ageBand;
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
        sex = recordedSexOf(patient?.sex);
        // The age group comes from the record's date of birth on today's calendar date.
        if (patient && dayZero instanceof Date) ageBand = patientCohort(patient.dateOfBirth, calendarDateOf(now, dayZero));
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
        expectedStayDays,
        legalStatus: draft.legalStatus,
        ageBand,
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
        expectedStayDays,
        legalStatus: draft.legalStatus,
      });
    }
  }

  function submitCancel() {
    if (!form || form.mode !== "cancel" || !cancelling) return;
    pending.current = { rejections: rejections.length };
    dispatch({
      type: "CANCEL_PLANNED_ADMISSION",
      role: "coordinator",
      now,
      plannedAdmissionId: cancelling.id,
      unitId: cancelling.unitId,
      reason: cancelReason,
    });
  }

  function recordArrival(planned: PlannedAdmission) {
    pending.current = { rejections: rejections.length };
    dispatch({
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now,
      plannedAdmissionId: planned.id,
      unitId: planned.unitId,
    });
  }

  const booked = agenda.length;
  const update = (patch: Partial<Draft>) => {
    setDraft((current) => applyDraftPatch(current, patch));
  };

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
                    <Button
                      size="sm"
                      variant="sec"
                      onClick={() => {
                        recordArrival(planned);
                      }}
                    >
                      Arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        openChange(planned);
                      }}
                    >
                      Change
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        openCancel(planned);
                      }}
                    >
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
                    onChange={(event) => {
                      update({ who: event.target.value as Draft["who"] });
                    }}
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
                      onChange={(event) => {
                        update({ patientId: event.target.value });
                      }}
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
                        onChange={(event) => {
                          update({ initials: event.target.value });
                        }}
                        data-testid="ward-planned-initials"
                      />
                    </Field>
                    <Field label="Age group">
                      <Select
                        value={draft.ageBand}
                        onChange={(event) => {
                          update({ ageBand: event.target.value as Cohort });
                        }}
                        data-testid="ward-planned-age"
                      >
                        {COHORTS.map((cohort) => (
                          <option key={cohort} value={cohort}>
                            {cohort}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Recorded sex">
                      <Select
                        value={draft.sex}
                        onChange={(event) => {
                          update({ sex: event.target.value as RecordedSex });
                        }}
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
                {changing ? whoText(changing) : "This booking is no longer listed."}
              </p>
            )}
            <Field label="Reason">
              <Select
                value={draft.reason}
                onChange={(event) => {
                  update({ reason: event.target.value as PlannedAdmissionReason });
                }}
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
                onChange={(event) => {
                  update({ unitId: event.target.value });
                }}
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
                  onChange={(event) => {
                    update({ dayOffset: Number(event.target.value) });
                  }}
                  data-testid="ward-planned-day"
                >
                  {plannedDayOffsets(draft.dayOffset).map((offset) => (
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
                  onChange={(event) => {
                    update({ time: event.target.value });
                  }}
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
                  onChange={(event) => {
                    update({ stayDays: event.target.value });
                  }}
                  data-testid="ward-planned-stay"
                />
              </Field>
              <Field label="Legal status">
                <Select
                  value={draft.legalStatus}
                  onChange={(event) => {
                    update({ legalStatus: event.target.value as LegalStatus });
                  }}
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
                onChange={(event) => {
                  setCancelReason(event.target.value as PlannedAdmissionCancelReason);
                }}
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
