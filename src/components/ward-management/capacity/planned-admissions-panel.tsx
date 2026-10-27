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
  normalisePlannedAdmissionInitials,
  plannedAdmissionIsOverdue,
  type PlannedAdmission,
  type PlannedAdmissionCancelReason,
  type PlannedAdmissionReason,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import {
  MINUTES_PER_DAY,
  calendarDateOf,
  dayOf,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  perthCalendarDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import {
  COHORTS,
  HEALTH_SERVICES,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  type Cohort,
  type LegalStatus,
  type RecordedSex,
  type ReferralGender,
  type Movement,
} from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  patientCohort,
  patientDisplayName,
  type Patient,
  type PatientId,
} from "@/components/ward-management/ward-patients";
import { healthServiceAcronym, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { dispatchPermission } from "@/components/ward-management/ward-role-permissions";
import { plannedAdmissionAgenda } from "./planned-admissions";
import {
  applyDraftPatch,
  authorisationReasonNeeded,
  clockInputValue,
  draftTiming,
  plannedDayOffsets,
  type PlannedAdmissionDraft,
} from "./planned-admissions-draft";
import styles from "./planned-admissions.module.css";
import { plannedInitialsLabel } from "@/components/ward-management/ward-flow-demo-storage-constants";

type Draft = PlannedAdmissionDraft;

type FormState = { mode: "book" } | { mode: "change"; id: string } | { mode: "cancel"; id: string } | null;

const bookablePatientLists = new WeakMap<
  readonly Patient[],
  {
    admissions: readonly Admission[];
    movements: readonly Movement[] | undefined;
    plannedAdmissions: readonly PlannedAdmission[];
    available: Patient[];
  }
>();

/** Only called by Book and its chooser; unchanged immutable records share the same list. */
function bookablePatientsFor(
  patients: readonly Patient[],
  admissions: readonly Admission[],
  movements: readonly Movement[] | undefined,
  plannedAdmissions: readonly PlannedAdmission[],
): Patient[] {
  const cached = bookablePatientLists.get(patients);
  if (
    cached?.admissions === admissions &&
    cached.movements === movements &&
    cached.plannedAdmissions === plannedAdmissions
  )
    return cached.available;
  const busy = new Set<string>();
  for (const admission of admissions)
    if (admission.patientId && (admission.state === "pulled" || admission.state === "occupied"))
      busy.add(admission.patientId);
  for (const movement of movements ?? []) if (movement.patientId && isOpen(movement)) busy.add(movement.patientId);
  for (const planned of plannedAdmissions)
    if (planned.patientId && planned.state === "booked") busy.add(planned.patientId);
  const available = patients
    .filter((patient) => !busy.has(patient.id))
    .sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b)));
  bookablePatientLists.set(patients, { admissions, movements, plannedAdmissions, available });
  return available;
}

/** A linked patient's recorded sex, kept as recorded; anything unlisted reads as not recorded. */
function recordedSexOf(sex: string | undefined): RecordedSex {
  return RECORDED_SEXES.find((listed) => listed === sex) ?? "Not recorded";
}

/**
 * Device audit option A (Josh, 11 Oct 2026): the bookings as a short list, without the 14-day
 * grid, and Book as a secondary button so the page keeps one primary.
 */
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
    shared,
  } = useWardFlowSelect(
    "units",
    "patients",
    "admissions",
    "movements",
    "dayZero",
    "dispatch",
    "rejections",
    "plannedAdmissions",
    "shared",
  );
  const plannedAdmissions = useMemo(() => plannedFromContext ?? [], [plannedFromContext]);
  // Josh, 27 Oct 2026: a desk sees the bookings for its own wards, and offers only the steps its role
  // may take. The executive reads them as counts, with nobody named.
  const role = useRouteRole();
  const canBook = dispatchPermission(role, "BOOK_PLANNED_ADMISSION").allowed;
  const canChange = dispatchPermission(role, "CHANGE_PLANNED_ADMISSION").allowed;
  const canCancel = dispatchPermission(role, "CANCEL_PLANNED_ADMISSION").allowed;
  const canConvert = dispatchPermission(role, "CONVERT_PLANNED_ADMISSION").allowed;
  const patientOf = usePatientOf();
  const [form, setForm] = useState<FormState>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Audit 1 (WP-12, Josh 20 Oct): no reason is chosen for the coordinator; one must be picked.
  const [cancelReason, setCancelReason] = useState<PlannedAdmissionCancelReason | "">("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const pending = useRef<{ rejections: number } | null>(null);
  // Whether the open form has sent a change, so a shared-save error from earlier work is not shown on a
  // form that has not asked for anything yet.
  const [submittedInForm, setSubmittedInForm] = useState(false);

  useDirtyStateGuard(form !== null);

  const agenda = useMemo(() => plannedAdmissionAgenda(plannedAdmissions), [plannedAdmissions]);
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";

  // Patients free to book: no live stay, no open movement and no booking already waiting. The
  // reducer refuses the same people, so this list only spares a coordinator a refusal.
  const getBookablePatients = () => bookablePatientsFor(patients, admissions, movements, plannedAdmissions);

  const sharedEnabled = shared?.enabled === true;
  const sharedStatus = shared?.status;
  const sharedError = shared?.error ?? null;

  // A dispatch either adds a rejection (refused: say why) or not (accepted: close the form). In the shared
  // workspace it settles only once saving ends, and a failed save keeps the form open with its error. The
  // status and error are dependencies, so a save that fails without changing the board still settles.
  useEffect(() => {
    if (!pending.current) return;
    if (sharedEnabled && sharedStatus === "saving") return;
    const before = pending.current.rejections;
    pending.current = null;
    if (rejections.length > before) {
      setRefusal(rejections[rejections.length - 1]?.reason ?? "Not recorded");
    } else if (!sharedEnabled || !sharedError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- A dispatch's outcome is only visible once the provider has answered.
      setForm(null);
      setDraft(null);
      setRefusal(null);
      setSubmittedInForm(false);
    }
  }, [rejections, plannedAdmissions, admissions, sharedEnabled, sharedStatus, sharedError]);

  const displayedRefusal =
    refusal ?? (form !== null && submittedInForm && sharedEnabled && sharedError ? sharedError : null);

  // A calendar date needs the provider's day zero; a screen given none still labels each day by
  // its distance from today rather than failing to render.
  function calendarDay(dayOffset: number, options: Intl.DateTimeFormatOptions): string {
    if (!(dayZero instanceof Date)) return dayOffset < 0 ? `${-dayOffset}d ago` : `+${dayOffset}d`;
    return calendarDateOf((dayOf(now) + dayOffset) * MINUTES_PER_DAY, dayZero).toLocaleDateString("en-AU", {
      ...options,
      timeZone: "Australia/Perth",
    });
  }

  function dayLabel(dayOffset: number): string {
    if (dayOffset === 0) return "Today";
    if (dayOffset === 1) return "Tomorrow";
    return calendarDay(dayOffset, { weekday: "short", day: "numeric", month: "short" });
  }

  function whoText(planned: PlannedAdmission): string {
    if (role === "executive") return "Name not shown to this desk";
    if (planned.patientId) return patientOf({ patientId: planned.patientId }).displayName;
    return planned.initials === null ? "Initials not recorded" : plannedInitialsLabel(planned.initials);
  }

  const cancelling = form?.mode === "cancel" ? plannedAdmissions.find((planned) => planned.id === form.id) : undefined;
  const changing = form?.mode === "change" ? plannedAdmissions.find((planned) => planned.id === form.id) : undefined;

  function openBook() {
    const bookablePatients = getBookablePatients();
    setRefusal(null);
    setSubmittedInForm(false);
    setDraft({
      // WT-13: the patient, reason, ward and legal status open blank and are chosen; the day, time
      // and stay keep their usual defaults.
      who: bookablePatients.length > 0 ? "patient" : "initials",
      patientId: "",
      initials: "",
      sex: "Not recorded",
      gender: undefined,
      reason: "",
      unitId: "",
      dayOffset: 1,
      time: "10:00",
      stayDays: "7",
      legalStatus: "",
      ageBand: "Adult",
      overrideReason: undefined,
    });
    setForm({ mode: "book" });
  }

  function openChange(planned: PlannedAdmission) {
    setRefusal(null);
    setSubmittedInForm(false);
    setDraft({
      who: planned.patientId ? "patient" : "initials",
      patientId: planned.patientId ?? "",
      initials: planned.initials ?? "",
      sex: planned.sex,
      gender: planned.gender,
      reason: planned.reason,
      unitId: planned.unitId,
      // An overdue booking keeps its own past day, so saving another edit never moves it to today.
      dayOffset: dayOf(planned.expectedArrivalAt) - dayOf(now),
      time: clockInputValue(planned.expectedArrivalAt),
      stayDays: String(planned.expectedStayDays),
      legalStatus: planned.legalStatus,
      ageBand: planned.ageBand,
      overrideReason: planned.authorisationOverride?.reason,
    });
    setForm({ mode: "change", id: planned.id });
  }

  function openCancel(planned: PlannedAdmission) {
    setRefusal(null);
    setSubmittedInForm(false);
    setCancelReason("");
    setForm({ mode: "cancel", id: planned.id });
  }

  function closeForm() {
    setForm(null);
    setDraft(null);
    setRefusal(null);
    setSubmittedInForm(false);
  }

  function submitDraft() {
    if (!draft || !form || form.mode === "cancel") return;
    if (draftMissing || overrideReasonMissing) return;
    const { reason, legalStatus } = draft;
    if (reason === "" || legalStatus === "") return;
    const timing = draftTiming(draft, now);
    if (!timing.ok) {
      setRefusal(timing.refusal);
      return;
    }
    const { expectedArrivalAt, expectedStayDays } = timing;
    // Today's demo calendar date, which the reducer counts on from to the arrival's date when it
    // checks a linked patient's age group.
    const calendarDate =
      dayZero instanceof Date
        ? (() => {
            const today = perthCalendarDay(calendarDateOf(now, dayZero));
            return [
              String(today.year),
              String(today.monthIndex + 1).padStart(2, "0"),
              String(today.day).padStart(2, "0"),
            ].join("-");
          })()
        : undefined;
    pending.current = { rejections: rejections.length };
    setSubmittedInForm(true);
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
        // The age group comes from the record's date of birth on the expected arrival's calendar
        // date; the reducer checks it against the same date.
        if (patient && dayZero instanceof Date)
          ageBand = patientCohort(patient.dateOfBirth, calendarDateOf(expectedArrivalAt, dayZero));
      }
      dispatch({
        type: "BOOK_PLANNED_ADMISSION",
        role: "coordinator",
        now,
        ...(draft.who === "patient"
          ? { patientId: draft.patientId as PatientId }
          : { initials, ...(draft.gender === undefined ? {} : { gender: draft.gender }) }),
        sex,
        reason,
        unitId: draft.unitId,
        expectedArrivalAt,
        expectedStayDays,
        legalStatus,
        ageBand,
        ...(calendarDate !== undefined ? { calendarDate } : {}),
        overrideReason: overrideReasonShown ? draft.overrideReason : undefined,
      });
    } else {
      dispatch({
        type: "CHANGE_PLANNED_ADMISSION",
        role: "coordinator",
        now,
        plannedAdmissionId: form.id,
        ...(draft.who === "initials" && draft.gender !== undefined ? { gender: draft.gender } : {}),
        reason,
        unitId: draft.unitId,
        expectedArrivalAt,
        expectedStayDays,
        legalStatus,
        ...(calendarDate !== undefined ? { calendarDate } : {}),
        overrideReason: overrideReasonShown ? draft.overrideReason : undefined,
      });
    }
  }

  function submitCancel() {
    if (!form || form.mode !== "cancel" || !cancelling || cancelReason === "") return;
    pending.current = { rejections: rejections.length };
    setSubmittedInForm(true);
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

  // Audit 24-1 CS2-19: the chosen ward is not authorised for the chosen legal status, so the booking
  // needs an override reason chosen from the list a pull past the same gate uses. A booking already
  // standing at this ward on that footing (saved before the rule) may be edited without one, as the
  // reducer allows.
  const draftUnit = draft ? units.find((unit) => unit.id === draft.unitId) : undefined;
  const overrideReasonShown = draft !== null && authorisationReasonNeeded(draft.legalStatus, draftUnit);
  const alreadyStanding =
    changing !== undefined &&
    draft !== null &&
    changing.unitId === draft.unitId &&
    authorisationReasonNeeded(changing.legalStatus, draftUnit);
  const overrideReasonMissing = overrideReasonShown && !alreadyStanding && draft?.overrideReason === undefined;
  const draftMissing = !draft
    ? undefined
    : form?.mode === "book" && draft.who === "patient" && draft.patientId === ""
      ? "Choose the patient first"
      : draft.reason === ""
        ? "Choose a reason first"
        : draft.unitId === ""
          ? "Choose a ward first"
          : draft.legalStatus === ""
            ? "Choose a legal status first"
            : undefined;

  const booked = agenda.length;
  const update = (patch: Partial<Draft>) => {
    setDraft((current) => applyDraftPatch(current, patch));
  };

  /** A linked patient's gender is the record's: shown, never picked. */
  function recordGenderText(patientId: string): string {
    const gender = patients.find((patient) => patient.id === patientId)?.gender;
    return gender ? `Gender (from the patient record): ${gender}` : "Gender: not recorded on the patient record";
  }

  /**
   * Gender for an initials-only booking, read by a single-sex ward when the person arrives. Once a
   * booking has one, a change can correct it but not clear it (`lockRecorded`).
   */
  function genderField(lockRecorded: boolean) {
    if (!draft) return null;
    return (
      <Field label="Gender">
        <Select
          value={draft.gender ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            update({ gender: value === "" ? undefined : (value as ReferralGender) });
          }}
          data-testid="ward-planned-gender"
        >
          <option value="" disabled={lockRecorded}>
            Not recorded
          </option>
          {REFERRAL_GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  return (
    <WardPanel
      title="Planned admissions"
      count={`${booked} booked`}
      testId="ward-capacity-planned-admissions"
      headerAction={
        canBook ? (
          <Button variant="sec" size="sm" onClick={openBook} data-testid="ward-planned-book">
            <CalendarPlus size={16} aria-hidden="true" />
            Book
          </Button>
        ) : undefined
      }
    >
      <div className={styles.body}>
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
                  {canConvert || canChange || canCancel ? (
                    <span className={styles.actions}>
                      {canConvert ? (
                        <Button
                          size="sm"
                          variant="sec"
                          onClick={() => {
                            recordArrival(planned);
                          }}
                        >
                          Arrived
                        </Button>
                      ) : null}
                      {canChange ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            openChange(planned);
                          }}
                        >
                          Change
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            openCancel(planned);
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
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
        footer={
          <div className={styles.sheetFoot}>
            <Button onClick={closeForm}>Close</Button>
            <Button
              variant="pri"
              onClick={submitDraft}
              disabledReason={draftMissing ?? (overrideReasonMissing ? "Choose an override reason first" : undefined)}
              data-testid="ward-planned-submit"
            >
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
                    <option value="patient" disabled={getBookablePatients().length === 0}>
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
                      <option value="" disabled>
                        Choose the patient
                      </option>
                      {getBookablePatients().map((patient) => (
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
                    {genderField(false)}
                  </>
                )}
                {draft.who === "patient" && draft.patientId !== "" ? (
                  <p className={styles.formWho} data-testid="ward-planned-record-gender">
                    {recordGenderText(draft.patientId)}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className={styles.formWho}>{changing ? whoText(changing) : "This booking is no longer listed."}</p>
                {changing && changing.patientId === null ? genderField(changing.gender !== undefined) : null}
                {changing?.patientId ? (
                  <p className={styles.formWho} data-testid="ward-planned-record-gender">
                    {recordGenderText(changing.patientId)}
                  </p>
                ) : null}
              </>
            )}
            <Field label="Reason">
              <Select
                value={draft.reason}
                onChange={(event) => {
                  update({ reason: event.target.value as PlannedAdmissionReason });
                }}
                data-testid="ward-planned-reason"
              >
                <option value="" disabled>
                  Choose a reason
                </option>
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
                <option value="" disabled>
                  Choose a ward
                </option>
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
                  <option value="" disabled>
                    Choose a legal status
                  </option>
                  {PLANNED_ADMISSION_LEGAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {overrideReasonShown ? (
              <Field
                label="Override reason"
                hint={`${draftUnit?.name ?? "This ward"} is not set up for involuntary admissions. Record why this is going ahead anyway.`}
              >
                <Select
                  value={draft.overrideReason ?? ""}
                  onChange={(event) => {
                    const chosen = event.target.value;
                    update({
                      overrideReason: OVERRIDE_REASONS.includes(chosen as OverrideReason)
                        ? (chosen as OverrideReason)
                        : undefined,
                    });
                  }}
                  data-testid="ward-planned-override-reason"
                >
                  <option value="">Choose reason</option>
                  {OVERRIDE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {displayedRefusal ? (
              <p className={styles.refusal} role="alert" data-testid="ward-planned-form-refusal">
                {displayedRefusal}
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
            <Button
              variant="danger"
              onClick={submitCancel}
              disabledReason={cancelReason === "" ? "Choose a reason first." : undefined}
              data-testid="ward-planned-cancel-confirm"
            >
              {/* Audit 24-7 (CT-19): the final button names who the booking is for. */}
              {cancelling ? `Cancel booking for ${whoText(cancelling)}` : "Cancel booking"}
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
                  setCancelReason(event.target.value as PlannedAdmissionCancelReason | "");
                }}
                data-testid="ward-planned-cancel-reason"
              >
                <option value="">Choose a reason</option>
                {PLANNED_ADMISSION_CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {PLANNED_ADMISSION_CANCEL_REASON_LABELS[reason]}
                  </option>
                ))}
              </Select>
            </Field>
            {displayedRefusal ? (
              <p className={styles.refusal} role="alert">
                {displayedRefusal}
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </WardPanel>
  );
}
