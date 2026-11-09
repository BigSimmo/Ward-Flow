"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  DateField,
  Field,
  isoDateAsTyped,
  Segmented,
  TextInput,
  TimeField,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardFlowEvent, WardFlowRole } from "../ward-flow-events";
import type { Patient } from "../ward-patients";
import { uploadedFileLabel, uploadedFileTypeOf } from "../ward-uploaded-file";
import {
  CARE_PLAN_AGREED_BY_MAX,
  CARE_PLAN_CONTACT_NAME_MAX,
  CARE_PLAN_CONTACT_PHONE_MAX,
  CARE_PLAN_HELPS,
  CARE_PLAN_HELPS_EXTRA_MAX,
  CARE_PLAN_TYPES,
  CULTURAL_SUPPORT_REQUESTS,
  TRIBUNAL_OUTCOMES,
  carerToldMoments,
  currentCarePlan,
  frequentPresenterTag,
  tribunalHearingPassedWithoutOutcome,
  validateCarePlanInput,
  type CarePlanHelp,
  type CarePlanType,
  type CarerToldMoment,
  type CulturalSupportRequest,
  type TribunalOutcome,
} from "../ward-patient-care-plans";
import type { UploadedFileType } from "../ward-model-vocabulary";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { Admission } from "../ward-admissions";
import type { Movement } from "../ward-model";
import { createPatientResolver } from "../ward-patient-resolver";
import { supportNotificationSubjects } from "../ward-support-notifications";
import styles from "./patient-care-plans-card.module.css";

type Gate = (eventType: WardFlowEvent["type"]) => { allowed: boolean; reason?: string };

const OCCASION_LABEL: Record<CarerToldMoment["occasion"], string> = {
  admission: "Admission",
  transfer: "Transfer",
  discharge: "Discharge",
};

/** "04/11/2026", as typed. Dates are never turned into a countdown (D-93). */
function typedDay(iso: string | undefined): string {
  return iso ? isoDateAsTyped(iso) || iso : "Not recorded";
}

type Draft = {
  type: CarePlanType | "";
  agreedBy: string;
  agreedOn: string;
  reviewOn: string;
  contactName: string;
  contactPhone: string;
  helps: CarePlanHelp[];
  helpsExtra: string;
  attachment?: { fileType: UploadedFileType; sizeBytes: number };
};
/** Forms open blank: nothing clinical is pre-selected. */
const BLANK: Draft = {
  type: "",
  agreedBy: "",
  agreedOn: "",
  reviewOn: "",
  contactName: "",
  contactPhone: "",
  helps: [],
  helpsExtra: "",
};

/**
 * Care plan, tribunal hearing date, carer told and cultural support on the patient's Now tab (Josh,
 * 9 Nov 2026, care plans and safety flags thread: defaults approved). Presentation and form only;
 * every change is an engine event and the reducer is the gate.
 */
export function PatientCarePlansCard({
  patient,
  now,
  todayIso,
  nowClock,
  hasCarer,
  episodes,
  gate,
  role,
  run,
}: {
  patient: Patient;
  /** The route's role, which every event is recorded under. */
  role: WardFlowRole;
  now: Instant;
  todayIso: string;
  nowClock: string;
  /** False when the record holds no carer or support person. */
  hasCarer: boolean;
  /** Earlier episodes of care, for the frequent presenter tag. */
  episodes?: readonly { kind: string; start: string }[];
  gate: Gate;
  run: (event: WardFlowEvent, success: string, onRefused: (reason: string) => void) => void;
}) {
  const { movements, admissions, patients, referrals, supportNotifications } = useWardFlowSelect(
    "movements",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
  );
  // The advisory checklist's completed moves for this person, newest first (`RECORD_SUPPORT_NOTIFICATION`).
  const carerTold = useMemo(() => {
    // D-14: the person behind each move is read through the allow-listed resolver, never here.
    const resolve = createPatientResolver({ patients, referrals, movements });
    const mine = (subject: Movement | Admission | undefined) =>
      subject !== undefined && resolve(subject).patient?.id === patient.id;
    const subjects = supportNotificationSubjects({ movements, admissions, patients, referrals }).filter(
      (subject) =>
        mine(movements.find((movement) => movement.id === subject.movementId)) ||
        mine(admissions.find((admission) => admission.id === subject.admissionId)),
    );
    return carerToldMoments(subjects, supportNotifications);
  }, [movements, admissions, patients, referrals, supportNotifications, patient.id]);
  const [form, setForm] = useState<"none" | "plan" | "hearing">("none");
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [hearingDate, setHearingDate] = useState("");
  const [hearingTime, setHearingTime] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const plan = currentCarePlan(patient.carePlans);
  const superseded = (patient.carePlans ?? []).filter((item) => item.status === "Superseded").length;
  const hearing = patient.tribunalHearing;
  const hearingPassed = tribunalHearingPassedWithoutOutcome(hearing, todayIso, nowClock);
  const presenter = frequentPresenterTag(episodes, patient.carePlans, todayIso);
  const planGate = gate("RECORD_CARE_PLAN");
  const hearingGate = gate("RECORD_TRIBUNAL_HEARING");
  const outcomeGate = gate("RECORD_TRIBUNAL_OUTCOME");
  const culturalGate = gate("SET_CULTURAL_SUPPORT_REQUEST");

  function open(next: "plan" | "hearing") {
    setProblem(null);
    setDraft(BLANK);
    setHearingDate("");
    setHearingTime("");
    setForm(next);
  }

  function savePlan() {
    if (draft.type === "") return setProblem("Choose the plan type.");
    const input = {
      type: draft.type,
      agreedBy: draft.agreedBy,
      agreedOn: draft.agreedOn,
      ...(draft.reviewOn ? { reviewOn: draft.reviewOn } : {}),
      contactName: draft.contactName,
      contactPhone: draft.contactPhone,
      helps: draft.helps,
      helpsExtra: draft.helpsExtra,
    };
    const checked = validateCarePlanInput(input);
    if (typeof checked === "string") return setProblem(checked);
    setProblem(null);
    setForm("none");
    run(
      {
        type: "RECORD_CARE_PLAN",
        role,
        now,
        patientId: patient.id,
        plan: { ...checked.plan, ...(draft.attachment ? { attachment: draft.attachment } : {}) },
      },
      plan ? "Care plan recorded. The earlier plan is marked superseded." : "Care plan recorded",
      setProblem,
    );
  }

  function saveHearing() {
    if (!hearingDate) return setProblem("Enter the hearing date.");
    setProblem(null);
    setForm("none");
    run(
      {
        type: "RECORD_TRIBUNAL_HEARING",
        role,
        now,
        patientId: patient.id,
        date: hearingDate,
        ...(hearingTime ? { time: hearingTime } : {}),
      },
      "Tribunal hearing date recorded",
      setProblem,
    );
  }

  function saveOutcome(outcome: TribunalOutcome) {
    run(
      { type: "RECORD_TRIBUNAL_OUTCOME", role, now, patientId: patient.id, outcome },
      `Hearing outcome recorded: ${outcome}`,
      setProblem,
    );
  }

  function setCultural(value: string) {
    const request = (CULTURAL_SUPPORT_REQUESTS as readonly string[]).includes(value)
      ? (value as CulturalSupportRequest)
      : null;
    run(
      { type: "SET_CULTURAL_SUPPORT_REQUEST", role, now, patientId: patient.id, request },
      request ? "Cultural support request recorded" : "Cultural support request taken off",
      setProblem,
    );
  }

  return (
    <Card data-testid="ward-patient-care-plan-card">
      <CardHead
        icon={ClipboardList}
        title="Care and safety"
        level={3}
        action={
          form === "plan" ? null : (
            <Button
              size="sm"
              variant="sec"
              onClick={() => open("plan")}
              disabledReason={planGate.allowed ? undefined : planGate.reason}
              data-testid="ward-patient-add-care-plan"
            >
              Add care plan
            </Button>
          )
        }
      />
      <CardBody>
        {presenter || patient.culturalSupportRequested ? (
          <p className={styles.tags} data-testid="ward-patient-care-flags">
            {presenter ? <Badge size="sm">{presenter}</Badge> : null}
            {patient.culturalSupportRequested ? (
              <Badge size="sm">{`${patient.culturalSupportRequested} requested`}</Badge>
            ) : null}
          </p>
        ) : null}
        {problem ? (
          <p className={styles.problem} role="alert">
            {problem}
          </p>
        ) : null}

        {form === "plan" ? (
          <form
            className={styles.form}
            aria-label="Add care plan"
            onSubmit={(event) => {
              event.preventDefault();
              savePlan();
            }}
          >
            {/* Q36: a kit choice, never the browser's drop-down. Nothing starts chosen. */}
            <div className={styles.choice}>
              <span className={styles.choiceLabel}>Plan type</span>
              <Segmented<CarePlanType | "">
                label="Plan type"
                items={CARE_PLAN_TYPES.map((type) => ({ id: type, label: type }))}
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type })}
                className={styles.seg}
              />
            </div>
            <Field label="Agreed by" hint="Role or team">
              <TextInput
                value={draft.agreedBy}
                maxLength={CARE_PLAN_AGREED_BY_MAX}
                onChange={(event) => setDraft({ ...draft, agreedBy: event.target.value })}
              />
            </Field>
            <div className={styles.pair}>
              <Field label="Date agreed" hint="DD/MM/YYYY">
                <DateField value={draft.agreedOn} onValueChange={(agreedOn) => setDraft({ ...draft, agreedOn })} />
              </Field>
              <Field label="Review date" hint="DD/MM/YYYY">
                <DateField value={draft.reviewOn} onValueChange={(reviewOn) => setDraft({ ...draft, reviewOn })} />
              </Field>
            </div>
            <div className={styles.pair}>
              <Field label="Key contact">
                <TextInput
                  value={draft.contactName}
                  maxLength={CARE_PLAN_CONTACT_NAME_MAX}
                  onChange={(event) => setDraft({ ...draft, contactName: event.target.value })}
                />
              </Field>
              <Field label="Contact phone">
                <TextInput
                  value={draft.contactPhone}
                  inputMode="tel"
                  maxLength={CARE_PLAN_CONTACT_PHONE_MAX}
                  onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })}
                />
              </Field>
            </div>
            <fieldset className={styles.helps}>
              <legend>What helps</legend>
              {CARE_PLAN_HELPS.map((help) => (
                <Checkbox
                  key={help}
                  label={help}
                  checked={draft.helps.includes(help)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      helps: event.target.checked
                        ? [...draft.helps, help]
                        : draft.helps.filter((item) => item !== help),
                    })
                  }
                />
              ))}
            </fieldset>
            <Field label="One short note" hint="Optional">
              <TextInput
                value={draft.helpsExtra}
                maxLength={CARE_PLAN_HELPS_EXTRA_MAX}
                onChange={(event) => setDraft({ ...draft, helpsExtra: event.target.value })}
              />
            </Field>
            <Field label="Attach the plan" help="Only the file's type and size are kept in this prototype.">
              <input
                type="file"
                className={styles.file}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // The name is read for its type and dropped (H-0049); the file itself is not kept.
                  setDraft({
                    ...draft,
                    attachment:
                      file && file.size > 0
                        ? { fileType: uploadedFileTypeOf(file.name, file.type), sizeBytes: file.size }
                        : undefined,
                  });
                }}
              />
            </Field>
            <div className={styles.actions}>
              <Button type="submit" size="sm" variant="pri">
                Save care plan
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm("none")}>
                Cancel
              </Button>
            </div>
          </form>
        ) : plan ? (
          <dl className={styles.facts} data-testid="ward-patient-care-plan-current">
            <div>
              <dt>Plan</dt>
              <dd>
                {plan.type} <Badge size="sm">Current</Badge>
              </dd>
            </div>
            <div>
              <dt>Agreed</dt>
              <dd>
                {`${plan.agreedBy} · `}
                <span className={styles.mono}>{typedDay(plan.agreedOn)}</span>
              </dd>
            </div>
            <div>
              <dt>Review</dt>
              <dd className={styles.mono}>{typedDay(plan.reviewOn)}</dd>
            </div>
            <div>
              <dt>Key contact</dt>
              <dd>
                {plan.contactName ?? "Not recorded"}
                {plan.contactPhone ? <span className={styles.mono}> · {plan.contactPhone}</span> : null}
              </dd>
            </div>
            <div>
              <dt>What helps</dt>
              <dd>
                {plan.helps.length ? plan.helps.join(", ") : "Not recorded"}
                {plan.helpsExtra ? <span className={styles.note}>{plan.helpsExtra}</span> : null}
              </dd>
            </div>
            <div>
              <dt>Attachment</dt>
              <dd>
                {plan.attachment ? <span className={styles.mono}>{uploadedFileLabel(plan.attachment)}</span> : "None"}
              </dd>
            </div>
            {superseded ? (
              <p className={styles.quiet}>
                {superseded === 1 ? "1 earlier plan" : `${superseded} earlier plans`} kept as superseded.
              </p>
            ) : null}
          </dl>
        ) : (
          <p className={styles.quiet}>No care plan recorded.</p>
        )}

        <dl className={styles.facts}>
          <div data-testid="ward-patient-tribunal-hearing">
            <dt>Tribunal hearing</dt>
            <dd>
              {hearing ? (
                <>
                  <span className={styles.mono}>
                    {typedDay(hearing.date)}
                    {hearing.time ? ` ${hearing.time}` : ""}
                  </span>{" "}
                  as typed
                  {hearing.outcome ? (
                    <>
                      {" · "}
                      {hearing.outcome.value}, recorded{" "}
                      <span className={styles.mono}>{formatInstantWithDay(hearing.outcome.recordedAt, now)}</span>
                    </>
                  ) : null}
                  {hearingPassed ? (
                    <Badge size="sm" tone="warning">
                      Hearing date passed, outcome not recorded
                    </Badge>
                  ) : null}
                </>
              ) : (
                "Not recorded"
              )}
              {form === "hearing" ? (
                <span className={styles.inline}>
                  <Field label="Hearing date" hint="DD/MM/YYYY">
                    <DateField value={hearingDate} onValueChange={setHearingDate} />
                  </Field>
                  <Field label="Time" hint="HH:MM, optional">
                    <TimeField value={hearingTime} onValueChange={setHearingTime} />
                  </Field>
                  <Button size="sm" variant="pri" onClick={saveHearing}>
                    Save date
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setForm("none")}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <span className={styles.inline}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => open("hearing")}
                    disabledReason={hearingGate.allowed ? undefined : hearingGate.reason}
                  >
                    {hearing ? "New hearing date" : "Record hearing date"}
                  </Button>
                  {hearing && !hearing.outcome ? <span className={styles.quietInline}>Outcome:</span> : null}
                  {hearing && !hearing.outcome
                    ? TRIBUNAL_OUTCOMES.map((outcome) => (
                        <Button
                          key={outcome}
                          size="sm"
                          variant="ghost"
                          onClick={() => saveOutcome(outcome)}
                          disabledReason={outcomeGate.allowed ? undefined : outcomeGate.reason}
                        >
                          {outcome}
                        </Button>
                      ))
                    : null}
                </span>
              )}
            </dd>
          </div>

          <div data-testid="ward-patient-carer-told">
            <dt>Carer told</dt>
            <dd>
              {hasCarer ? (
                <span className={styles.moments}>
                  {carerTold.map((moment) => (
                    <span key={moment.occasion}>
                      {OCCASION_LABEL[moment.occasion]}:{" "}
                      {moment.status === "told" ? (
                        <>
                          Told{moment.who ? ` ${moment.who}` : ""} ·{" "}
                          <span className={styles.mono}>
                            {moment.contactedAt === undefined ? "" : formatInstantWithDay(moment.contactedAt, now)}
                          </span>
                        </>
                      ) : moment.status === "not-yet" ? (
                        <Badge size="sm" tone="warning">
                          Not yet
                        </Badge>
                      ) : moment.status === "not-applicable" ? (
                        "Not applicable"
                      ) : (
                        <span className={styles.quietInline}>None on record</span>
                      )}
                    </span>
                  ))}
                </span>
              ) : (
                "No carer recorded"
              )}
            </dd>
          </div>

          <div data-testid="ward-patient-cultural-support">
            <dt>Cultural support</dt>
            <dd>
              <Segmented<CulturalSupportRequest | "none">
                label="Cultural support asked for by the person or family"
                items={[
                  { id: "none", label: "Not requested" },
                  ...CULTURAL_SUPPORT_REQUESTS.map((request) => ({ id: request, label: `${request} requested` })),
                ]}
                value={patient.culturalSupportRequested ?? "none"}
                onChange={(next) => {
                  if (next !== (patient.culturalSupportRequested ?? "none")) setCultural(next);
                }}
                disabledReason={culturalGate.allowed ? undefined : culturalGate.reason}
                className={styles.seg}
              />
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
