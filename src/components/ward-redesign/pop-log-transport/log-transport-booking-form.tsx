"use client";

/*
 * One transport booking form (A34, simplification audit item 2, Josh approved 26 Oct 2026).
 *
 * The ED popup, the community team popup, the patient page's Transport sheet and the transit deck
 * each built their own booking form, with different controls for the same answers. Each screen
 * keeps its own container (popup, sheet or panel, D-74: the screens are not merged); this is the
 * form inside it. It records exactly the fields `BOOK_TRANSPORT` always took.
 *
 * Rules carried over from the forms it replaces:
 * - Provider, escort, CAD number and time are read off the phone call and never filled in
 *   (owner's third ruling, 17 Sep 2026). Escort is never derived from legal status or the last booking.
 * - Legal status is filled in from Legal now when the record holds one (`LEGAL_STATUS_FROM_LEGAL_NOW`).
 *   An answer that differs from Legal now asks for a reason, recorded as the booking's exception.
 * - The answers still missing are named, and one button moves to the first (blocker mock-up, 26 Oct).
 *   Pressing Save early also moves to the first missing answer, rather than doing nothing.
 * - A ward escort or a family member has no dispatch service, so no CAD number is asked for
 *   (form friction audit, 27 Oct 2026). Questions follow the call: who, CAD, when, then escort and
 *   legal status.
 * - CAD to follow (Josh, 27 Oct 2026): a dispatched service books with the CAD box blank. The form
 *   warns, and the job shows "CAD to follow" until the number is added. A placeholder is refused.
 * - A quoted time after the bed hold ends is warned, never blocked (audit A4-2).
 * - Deliberately not a `<form>`: Enter inside a field must not submit a half-answered booking.
 * - The host keeps the answers until its save is accepted, and passes `pending` and `error` back.
 */
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Button, Field, Select, StatusGlyph, TextInput } from "@/components/wf";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  TRANSPORT_EXCEPTION_REASON_LABELS,
  cadNumberSentence,
  holdEndsBeforeEta,
  instantFromEstimatedTimeInputs,
  legalNowText,
  legalNowTransportStatus,
  transportAnswersBlockedReason,
  transportAnswersMissing,
  transportCadToFollow,
  transportStatusClashes,
  type TransportAnswer,
  type TransportBookingAnswers,
} from "@/components/ward-management/ward-transport-checks";
import {
  TRANSPORT_EXCEPTION_REASONS,
  BOOKABLE_TRANSPORT_PROVIDERS,
  TRANSPORT_LEGAL_STATUSES,
  type Movement,
  type TransportExceptionReason,
  type TransportLegalStatus,
  type TravelMode,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import styles from "./log-transport-booking-form.module.css";

/**
 * Whether the legal status answer starts from Legal now. One switch for every screen, so Josh's
 * answer to the A34 question changes one line. `false` leaves both answers unticked.
 */
const LEGAL_STATUS_FROM_LEGAL_NOW = true;

/** Answers before anything is chosen. Re-applied on every open, so one patient's answers never reach the next. */
export const BLANK_TRANSPORT_BOOKING: TransportBookingAnswers = {
  provider: undefined,
  escortRequired: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

/** The fields `BOOK_TRANSPORT` takes from the form. */
export type TransportBookingSubmission = {
  provider: TransportProvider;
  escortRequired: boolean;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus;
  estimatedAt: Instant;
  exception?: { gaps: ["legal_status_differs"]; reason: TransportExceptionReason };
};

/** The parts of the form a test or another control can find. */
export type TransportBookingPart =
  | "provider"
  | "escort"
  | "cad"
  | "cad-problem"
  | "cad-to-follow"
  | "legal"
  | "legal-reason"
  | "time"
  | "day"
  | "presets"
  | "hold"
  | "left"
  | "confirm"
  | "cancel"
  | "failure";

/** Test ids as `<prefix>-<name>[-<option>][-<suffix>]`. Screens keep the ids their tests already use. */
export type TransportBookingTestIds = {
  prefix: string;
  suffix?: string;
  names?: Partial<Record<TransportBookingPart, string>>;
};

const DEFAULT_PART_NAMES: Record<TransportBookingPart, string> = {
  provider: "transport-provider",
  escort: "transport-escort",
  cad: "transport-cad",
  "cad-problem": "transport-cad-problem",
  "cad-to-follow": "transport-cad-to-follow",
  legal: "transport-legal",
  "legal-reason": "transport-legal-reason",
  time: "transport-estimated-time",
  day: "transport-estimated-day",
  presets: "transport-eta-presets",
  hold: "transport-eta-hold",
  left: "book-transport-left",
  confirm: "book-transport-confirm",
  cancel: "book-transport-cancel",
  failure: "book-transport-failure",
};

export function transportBookingTestId(ids: TransportBookingTestIds, part: TransportBookingPart, option?: string) {
  const name = ids.names?.[part] ?? DEFAULT_PART_NAMES[part];
  return [ids.prefix, name, option, ids.suffix].filter(Boolean).join("-");
}

/** Each unanswered question's short name and the part that asks it. */
const ANSWER_PARTS: Record<TransportAnswer, [name: string, part: TransportBookingPart]> = {
  provider: ["provider", "provider"],
  escort: ["escort answer", "escort"],
  legalStatus: ["legal status", "legal"],
  time: ["estimated time", "time"],
};

/**
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, AND NOTHING ANYWHERE SUPPLIES AN ANSWER FOR IT** (owner,
 * relayed 2026-08-30). Not from `legalStatus`, not from the last booking, not as a "usually".
 *
 * **His reason is that a pre-filled clinical judgement is answered by clicking past it**, and the
 * record then asserts that a clinician decided when nobody did — worse than the honest derivation
 * it replaces, because it launders an automatic value through a human's name.
 *
 * ⚠️ **THE DEFECT THIS NAMED IS NOW FIXED, AND THIS CLAUSE SAID OTHERWISE UNTIL 2026-09-01.** It
 * read "`HANDOVER_READY` still computes `movement.legalStatus !== "Voluntary"` today". It does not:
 * that fabrication was deleted when `BOOK_TRANSPORT` landed on 2026-08-31, and the reducer's
 * `HANDOVER_READY` case now only refuses a movement with no booked transport and sets the stage.
 * The reason for keeping this control blank is unchanged — re-creating the derivation as a default
 * here would restore the defect rather than move it — but a comment claiming a live defect that has
 * been fixed sends a reader hunting for code that is not there.
 *
 * **If this control ever feels unhelpful for being blank, the help is the question being legible,
 * never the answer being supplied.**
 *
 * The reducer refuses a missing answer independently (`case "BOOK_TRANSPORT"`), so this is not the
 * only thing holding the rule — and it must never contradict it either: every state this function
 * calls blocked is a state the reducer would reject.
 */
const ESCORT_ANSWERS = [
  { value: true, label: "Escort required" },
  { value: false, label: "No escort required" },
] as const;

const LEGAL_LABELS: Record<TransportLegalStatus, string> = { voluntary: "Voluntary", involuntary: "Involuntary" };

const ETA_PRESETS = [
  { label: "Now", offset: 0 },
  { label: "+15m", offset: 15 },
  { label: "+30m", offset: 30 },
  { label: "+1h", offset: 60 },
] as const;

function clockText(instant: Instant): string {
  const minutes = minuteOfDay(instant);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** A preset's time and day. "Today" or "tomorrow" is read from the same day count the field uses. */
export function etaPresetAnswers(
  now: Instant,
  offset: number,
): Pick<TransportBookingAnswers, "estimatedTime" | "estimatedDay"> {
  const target = now + offset;
  return { estimatedTime: clockText(target), estimatedDay: dayOf(target) > dayOf(now) ? "tomorrow" : "today" };
}

/** Legal now as the form uses it: the status in force, and the record it is read from. */
type LegalNowRecord = Pick<Movement, "legalStatus" | "legalForm"> & Partial<Pick<Movement, "pullExpiresAt">>;

/**
 * The complete booking, or `undefined` while any answer is missing or refused. The one rule every
 * screen submits through, so no screen can dispatch a booking the form says is not ready.
 */
export function transportBookingSubmission(
  answers: TransportBookingAnswers,
  legalReason: TransportExceptionReason | "",
  record: LegalNowRecord | undefined,
  now: Instant,
): TransportBookingSubmission | undefined {
  const { provider, escortRequired, cadNumber, transportLegalStatus, estimatedTime, estimatedDay } = answers;
  const estimatedAt = instantFromEstimatedTimeInputs(estimatedTime, estimatedDay, now);
  if (
    provider === undefined ||
    escortRequired === undefined ||
    (cadNumber.trim().length > 0 && cadNumberProblem(cadNumber) !== undefined) ||
    transportLegalStatus === undefined ||
    estimatedAt === undefined
  )
    return undefined;
  const clash = record !== undefined && transportStatusClashes(record, transportLegalStatus);
  if (clash && legalReason === "") return undefined;
  return {
    provider,
    escortRequired,
    cadNumber: cadNumber.trim(),
    transportLegalStatus,
    estimatedAt,
    ...(clash && legalReason !== "" ? { exception: { gaps: ["legal_status_differs"], reason: legalReason } } : {}),
  };
}

export type TransportBookingFormProps = {
  answers: TransportBookingAnswers;
  onAnswers: Dispatch<SetStateAction<TransportBookingAnswers>>;
  legalReason: TransportExceptionReason | "";
  onLegalReason: (reason: TransportExceptionReason | "") => void;
  /** The movement being booked: Legal now and the bed hold's end. */
  record: LegalNowRecord | undefined;
  /** The patient's name, as the screen shows it. */
  patientName: string;
  now: Instant;
  testIds: TransportBookingTestIds;
  /** Why this screen cannot book at all (role, stage), on top of the form's own answers. */
  blockedReason?: string;
  /** A save is out: every control is locked and the answers stay. */
  pending?: boolean;
  /** Why the last save was not recorded, as a sentence. */
  error?: string;
  /** The screen's role note under the buttons, if any. */
  note?: ReactNode;
  onSubmit: (booking: TransportBookingSubmission) => void;
  onCancel?: () => void;
};

export function LogTransportBookingForm({
  answers,
  onAnswers,
  legalReason,
  onLegalReason,
  record,
  patientName,
  now,
  testIds,
  blockedReason,
  pending = false,
  error,
  note,
  onSubmit,
  onCancel,
}: TransportBookingFormProps) {
  const tid = (part: TransportBookingPart, option?: string) => transportBookingTestId(testIds, part, option);
  // DOM ids follow the test ids, which are unique per movement on every screen.
  const did = (part: TransportBookingPart) => `${tid(part)}-field`;
  const legalNow = record ? legalNowTransportStatus(record) : undefined;

  // Filled in once, when the form opens, and only when the person has not answered yet.
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || !LEGAL_STATUS_FROM_LEGAL_NOW || legalNow === undefined) return;
    filled.current = true;
    onAnswers((current) =>
      current.transportLegalStatus === undefined ? { ...current, transportLegalStatus: legalNow } : current,
    );
  }, [legalNow, onAnswers]);

  const set = (patch: Partial<TransportBookingAnswers>) => onAnswers((current) => ({ ...current, ...patch }));
  const cadProblem = answers.cadNumber.trim() ? cadNumberProblem(answers.cadNumber) : undefined;
  const missing = transportAnswersMissing(answers, now);
  const missingNames = missing.map((answer) => ANSWER_PARTS[answer][0]);
  const clash = record !== undefined && transportStatusClashes(record, answers.transportLegalStatus);
  const reasonMissing = clash && legalReason === "";
  const estimatedAt = instantFromEstimatedTimeInputs(answers.estimatedTime, answers.estimatedDay, now);
  const holdEnd =
    record?.pullExpiresAt === undefined
      ? undefined
      : holdEndsBeforeEta(record as Pick<Movement, "pullExpiresAt">, estimatedAt);
  const blocked =
    blockedReason ??
    transportAnswersBlockedReason(answers, now) ??
    (reasonMissing ? "Before booking, choose why the transport status differs from Legal now." : undefined);
  const submission = transportBookingSubmission(answers, legalReason, record, now);
  const unavailable = blocked !== undefined || submission === undefined || pending;

  const goToPart = (part: TransportBookingPart) => {
    const field = document.querySelector<HTMLElement>(`[data-testid="${tid(part)}"]`);
    (field?.matches("fieldset") ? field.querySelector<HTMLElement>("input") : field)?.focus();
  };
  const goToAnswer = (answer: TransportAnswer) => goToPart(ANSWER_PARTS[answer][1]);
  // The answers still to give, with the reason it differs last: one list, beside Save.
  const leftNames = reasonMissing ? [...missingNames, "reason it differs"] : missingNames;
  const goToFirstLeft = () => (missing.length > 0 ? goToAnswer(missing[0]!) : goToPart("legal-reason"));

  return (
    <div className={styles.form} aria-busy={pending || undefined}>
      {/* Redesign (review note): what is still to answer sits first, with a link to the first one.
          Once everything is answered it says so, and Save is the next step. */}
      {leftNames.length > 0 ? (
        <p className={styles.left} data-testid={tid("left")} role="status">
          <span>
            <strong>
              {leftNames.length} {leftNames.length === 1 ? "answer" : "answers"} left
            </strong>
            : {leftNames.join(", ")}
          </span>
          <button type="button" className={styles.leftFix} onClick={goToFirstLeft}>
            Add {leftNames[0]}
          </button>
        </p>
      ) : (
        <p className={styles.allAnswered} data-testid={tid("left")} role="status">
          <StatusGlyph tone="success" size={9} />
          Every answer given. Check them, then save.
        </p>
      )}

      <Field label={`Who is collecting ${patientName}`} id={did("provider")}>
        <Select
          data-testid={tid("provider")}
          disabled={pending}
          value={answers.provider ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            set({
              provider: BOOKABLE_TRANSPORT_PROVIDERS.includes(next as TravelMode) ? (next as TravelMode) : undefined,
            });
          }}
        >
          {/* Nobody chosen, first and selected: never a provider standing in for a choice not made. */}
          <option value="">Not chosen</option>
          {BOOKABLE_TRANSPORT_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
      </Field>

      {/* The box never blocks Save: a ward escort or family has no dispatch call, and a dispatched
          service may give its number later (CAD to follow, Josh, 27 Oct 2026). */}
      <Field
        label="CAD transport number"
        id={did("cad")}
        error={cadProblem ? <span data-testid={tid("cad-problem")}>{cadNumberSentence(cadProblem)}</span> : undefined}
        help="Read it off the call with the provider."
      >
        <TextInput
          data-testid={tid("cad")}
          className={styles.mono}
          autoComplete="off"
          placeholder="CAD number"
          disabled={pending}
          value={answers.cadNumber}
          onChange={(event) => set({ cadNumber: event.target.value })}
        />
      </Field>
      {transportCadToFollow(answers) ? (
        <p className={styles.warn} data-testid={tid("cad-to-follow")}>
          <StatusGlyph tone="warning" size={9} />
          No CAD number yet. The job will show CAD to follow until it is added.
        </p>
      ) : null}

      <div className={styles.timeRow}>
        <div className={styles.timeCol}>
          <Field label="Estimated time" id={did("time")}>
            <TextInput
              data-testid={tid("time")}
              className={styles.mono}
              inputMode="numeric"
              placeholder="HH:MM"
              autoComplete="off"
              disabled={pending}
              value={answers.estimatedTime}
              onChange={(event) => set({ estimatedTime: event.target.value })}
            />
          </Field>
          <div role="group" aria-label="Quick times" className={styles.presets} data-testid={tid("presets")}>
            {ETA_PRESETS.map((preset) => {
              const value = etaPresetAnswers(now, preset.offset);
              const active =
                answers.estimatedTime.trim() === value.estimatedTime && answers.estimatedDay === value.estimatedDay;
              return (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={active ? "pri" : "sec"}
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => set(value)}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>
        <fieldset className={styles.question} data-testid={tid("day")} disabled={pending}>
          <legend className={styles.legend}>Today or tomorrow?</legend>
          <span className={styles.choice}>
            {(["today", "tomorrow"] as const).map((day) => (
              <label key={day} className={styles.choiceItem}>
                <input
                  type="radio"
                  name={did("day")}
                  data-testid={tid("day", day)}
                  value={day}
                  checked={answers.estimatedDay === day}
                  onChange={() => set({ estimatedDay: day })}
                />
                <span>{day === "today" ? "Today" : "Tomorrow"}</span>
              </label>
            ))}
          </span>
        </fieldset>
      </div>
      {holdEnd !== undefined ? (
        <p className={styles.warn} data-testid={tid("hold")}>
          <StatusGlyph tone="warning" size={9} />
          Arrives after the pull time limit ends at {clockText(holdEnd)}. Extend the pull or rebook.
        </p>
      ) : null}

      <fieldset className={styles.question} data-testid={tid("escort")} disabled={pending}>
        <legend className={styles.legend}>Does {patientName} need an escort?</legend>
        <span className={styles.choice}>
          {ESCORT_ANSWERS.map((answer) => (
            <label key={answer.label} className={styles.choiceItem}>
              <input
                type="radio"
                name={`${did("escort")}`}
                data-testid={tid("escort", answer.value ? "yes" : "no")}
                value={answer.value ? "yes" : "no"}
                // `=== answer.value`, never truthiness: an unanswered draft must check neither box.
                checked={answers.escortRequired === answer.value}
                onChange={() => set({ escortRequired: answer.value })}
              />
              <span>{answer.label}</span>
            </label>
          ))}
        </span>
      </fieldset>

      <fieldset className={styles.question} data-testid={tid("legal")} disabled={pending}>
        <legend className={styles.legend}>Is the transport voluntary or involuntary?</legend>
        <span className={styles.choice}>
          {TRANSPORT_LEGAL_STATUSES.map((status) => (
            <label key={status} className={styles.choiceItem}>
              <input
                type="radio"
                name={did("legal")}
                data-testid={tid("legal", status)}
                value={status}
                checked={answers.transportLegalStatus === status}
                onChange={() => set({ transportLegalStatus: status })}
              />
              <span>{LEGAL_LABELS[status]}</span>
            </label>
          ))}
        </span>
        {record ? (
          <p className={styles.note}>
            Legal now: {legalNowText(record)}.
            {LEGAL_STATUS_FROM_LEGAL_NOW && legalNow !== undefined && answers.transportLegalStatus === legalNow
              ? " Filled in from Legal now. Change it if the call said otherwise."
              : null}
          </p>
        ) : null}
      </fieldset>

      {clash ? (
        <Field
          label="Why does it differ from Legal now?"
          id={did("legal-reason")}
          help={
            <span className={styles.warn}>
              <StatusGlyph tone="warning" size={9} />
              Differs from Legal now ({legalNowText(record!)}). Record why.
            </span>
          }
        >
          <Select
            data-testid={tid("legal-reason")}
            disabled={pending}
            value={legalReason}
            onChange={(event) => {
              const next = event.target.value;
              onLegalReason(
                TRANSPORT_EXCEPTION_REASONS.includes(next as TransportExceptionReason)
                  ? (next as TransportExceptionReason)
                  : "",
              );
            }}
          >
            <option value="">Choose a reason</option>
            {TRANSPORT_EXCEPTION_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {TRANSPORT_EXCEPTION_REASON_LABELS[reason]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className={styles.actions}>
        <Button
          variant="pri"
          data-testid={tid("confirm")}
          aria-disabled={unavailable ? "true" : undefined}
          aria-describedby={blocked ? `${did("confirm")}-blocked` : undefined}
          title={blocked}
          onClick={() => {
            if (pending) return;
            // Pressed early, Save moves to the first answer still to give instead of doing nothing.
            if (unavailable || submission === undefined) {
              if (blockedReason === undefined && leftNames.length > 0) goToFirstLeft();
              return;
            }
            onSubmit(submission);
          }}
        >
          Save transport booking
        </Button>
        {onCancel ? (
          <Button data-testid={tid("cancel")} disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {blocked ? (
          <span id={`${did("confirm")}-blocked`} className="sr-only">
            {blocked}
          </span>
        ) : null}
      </div>
      {note}
      {pending && !error ? (
        <p className={styles.note} role="status">
          Saving transport booking…
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert" data-testid={tid("failure")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
