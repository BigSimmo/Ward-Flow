"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";

import { Badge, Button, DisabledReason, Field, Radio, Select, useOptionalToast } from "@/components/wf";

import { minutesText } from "../alerts/alerts-model";
import { movementHref } from "../shell/ward-facade";
import { usePatientNameDisplay } from "../settings/discreet-names";
import { useWardCommandCompletion, wardCommandFailure } from "../ward/use-ward-command-completion";
import { legalStatusMismatchWarning } from "../ward-eligibility";
import { legalFormStatusWarning } from "../ward-legal-form-fit";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import { ORIGIN_NOT_RECORDED, type LegalStatus } from "../ward-model";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  OBSERVATION_NOT_RECORDED,
  observationAt,
  observationLevelName,
  type Observation,
  type RecordedObservationLevel,
} from "../ward-observation";
import { usePatientOf } from "../ward-patient-name";
import { acceptedAddressing } from "../ward-referrals";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import { allEmergencyDepartments } from "../ward-sites";
import { LEGAL_STATUSES, recordedPullDetails, type AcceptedAwaitingPull } from "./accepted-ward-referral";
import {
  acceptedDecisionAt,
  chooseFactsLine,
  clockText,
  isPullDesk,
  pullDeskName,
  pullFactSource,
  pullFactSourceText,
  pullFormChanges,
  type PullFact,
  type PullFactSource,
  type PulledBed,
} from "./pull-bed-facts";
import { withSendingTeam } from "./referral-sending-team";

import styles from "./pull-accepted-referral.module.css";

/** The form's own "No form" answer, kept apart from "not answered yet" (""). */
const NO_FORM = "none";

/** A fact's source on its label line: the record's name, "Not recorded", or who changed it. */
function SourceLine({ id, source }: { id: string; source: PullFactSource }) {
  return (
    <span id={id} className={styles.src} data-source={source.kind}>
      {pullFactSourceText(source)}
    </span>
  );
}

/** Kit choice rows for one fact (legal status, observation level): nothing is chosen unless recorded. */
function ChoiceRows<T extends string>({
  label,
  name,
  value,
  options,
  source,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  name: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  source: PullFactSource;
  disabled: boolean;
  testId: string;
  onChange: (value: T) => void;
}) {
  const srcId = useId();
  return (
    <fieldset className={styles.q} aria-describedby={srcId} data-testid={testId}>
      <legend className={styles.qHead}>
        <span className={styles.qLabel}>{label}</span>
        <SourceLine id={srcId} source={source} />
      </legend>
      <div className={styles.opts}>
        {options.map((option) => (
          <Radio
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            className={styles.opt}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * PULL THE BED IN ONE STEP (WS-03, workflow speed audit, 26 Oct 2026; wave 4 D-188, Josh 13 Nov 2026).
 * Legal status, legal form and observation level are filled in from the record (the person's wait
 * on the ED board, else the referral), each naming its source. The desk pulling can change any of
 * them; a changed value then reads "Changed by <desk role>". A fact the record does not hold reads
 * "Not recorded" with nothing selected. A change stays on this pull and never updates the person's
 * record (D-188 point b). The ward-desk clinician and the bed coordinator may both pull, and the
 * movement's stage change records which desk did (D-188 point a).
 *
 * WT-08 (Josh, 26 Oct 2026): one tap starts the accepted journey and keeps the bed at the ward that
 * accepted, in one event, so a refused pull starts nothing. Only after a refusal is the journey
 * offered on its own, where the reasons live. Each engine event follows a tap, never an effect.
 */
export function PullAcceptedReferral({
  item,
  onDone,
  onPulled,
  onCancel,
  actingUnitId,
}: {
  item: AcceptedAwaitingPull;
  /** Closes the step. */
  onDone: () => void;
  /**
   * Told once the bed is pulled, before `onDone`. A host that keeps the row with its Undo
   * (`usePullBedStep`) takes the toast over; without it the form says the pull in its own toast.
   */
  onPulled?: (pulled: PulledBed) => void;
  /** Shows a Cancel beside Pull the bed. */
  onCancel?: () => void;
  /** The ward desk's own unit, which a ward desk must pass (the coordinator acts for any ward). */
  actingUnitId?: string;
}) {
  const { referral, unitId, unitName } = item;
  const baseId = useId();
  const { movements } = useWardFlowSelect("movements");
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const desk = isPullDesk(routeRole) ? routeRole : undefined;
  const raise = useWardRaise(desk ?? "coordinator");
  const gate = useRoleGate();
  const completeCommand = useWardCommandCompletion();
  const toast = useOptionalToast();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const who = patientOf(referral);
  const name = nameFor(who.formalName, who.umrn);

  const [recorded] = useState(() => recordedPullDetails(referral, movements));
  const recordedForm = recorded.legalFormCode === undefined ? "" : (recorded.legalFormCode ?? NO_FORM);
  // D-188 (tightened 13 Nov): an observation level the ED board records as "not recorded"
  // is not a level. It opens with nothing chosen, and the bed cannot be pulled until one is chosen.
  const recordedLevel: RecordedObservationLevel | "" =
    recorded.observation === undefined || recorded.observation.level === OBSERVATION_NOT_RECORDED
      ? ""
      : recorded.observation.level;
  const [legalStatus, setLegalStatus] = useState<LegalStatus | "">(recorded.legalStatus ?? "");
  const [legalForm, setLegalForm] = useState(recordedForm);
  const [level, setLevel] = useState<RecordedObservationLevel | "">(recordedLevel);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(
    recorded.observation?.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0],
  );
  // The refusal of the one-tap pull, which offers the journey on its own.
  const [pullRefused, setPullRefused] = useState(false);
  // True once the journey alone was started after a refusal; its link then opens it.
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const journeyId = journeyStarted
    ? movements.find((movement) => movement.referralId === referral.id && !movement.closure)?.id
    : undefined;
  const accepted = acceptedAddressing(referral);
  const destination = accepted?.destination.kind === "psychiatric_ward" ? accepted.destination : undefined;
  const ed =
    referral.source === "ed_medical"
      ? allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode)
      : undefined;
  const mismatch =
    destination && legalStatus !== ""
      ? legalStatusMismatchWarning(destination.involuntaryBedNeeded, legalStatus)
      : null;
  // Finding 78: a form that does not fit the status warns and never blocks.
  const formMismatch = legalFormStatusWarning(
    legalStatus,
    legalForm === "" ? undefined : legalForm === NO_FORM ? null : legalForm,
  );

  // D-188: the source each fact names. "Not recorded" also covers an ED board that records the
  // observation level as not recorded, which must then be chosen (D-188 (tightened 13 Nov)).
  // `fromEdBoard` is only ever true when the referral's own ED site code found the board.
  const recordedFrom = recorded.fromEdBoard ? `From the ${referral.originSiteCode} ED board` : "From the referral";
  const changed: Record<PullFact, boolean> = {
    legalStatus: legalStatus !== "" && legalStatus !== (recorded.legalStatus ?? ""),
    legalForm: legalForm !== "" && legalForm !== recordedForm,
    observation:
      level !== "" &&
      (level !== recordedLevel ||
        (level === "intermittent" && recorded.observation?.intervalMinutes !== intervalMinutes)),
  };
  const sourceOf = (fact: PullFact, held: boolean) =>
    pullFactSource(held, changed[fact], recordedFrom, desk ?? "coordinator");
  const statusSource = sourceOf("legalStatus", recorded.legalStatus !== undefined);
  const formSource = sourceOf("legalForm", recorded.legalFormCode !== undefined);
  const levelSource = sourceOf("observation", recordedLevel !== "");
  // PR C (pull-step-api.md): the changed facts, ready for the pull's own record once its event holds them.
  const changedFacts = pullFormChanges(changed);

  const missing: PullFact[] = [
    ...(legalStatus === "" ? (["legalStatus"] as const) : []),
    ...(legalForm === "" ? (["legalForm"] as const) : []),
    ...(level === "" ? (["observation"] as const) : []),
  ];
  // D-188 point a: the ward-desk clinician (for its own ward) and the bed coordinator may pull.
  const refusal =
    (journeyStarted ? "The movement has started. Open it to pull the bed." : undefined) ??
    (desk === undefined ? `${pullDeskName("coordinator")} or ward desk only` : undefined) ??
    (desk === "ward" && actingUnitId !== unitId ? `Only the ${unitName} desk can pull this bed` : undefined) ??
    gate("RAISE_REFERRAL").reason ??
    gate("PULL_PATIENT").reason ??
    (!destination || (referral.source === "ed_medical" && !ed)
      ? "This referral has no accepted ward place to pull from"
      : undefined) ??
    (referral.source === "community" && !referral.sendingTeamName
      ? "This community referral has no referring team recorded"
      : undefined) ??
    (referral.ageBand === undefined ? "This referral has no age band recorded" : undefined) ??
    chooseFactsLine(missing);

  function pull(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (refusal) return;
    start(true);
  }

  /** Starts the accepted journey, with its bed pulled unless the pull was refused and declined. */
  function start(pullBed: boolean) {
    if (!desk || !destination || !referral.ageBand || legalStatus === "" || legalForm === "" || level === "") return;
    setMessage(undefined);
    // The recorded level is carried whole, with any review time a person typed; a changed level is new.
    const observation: Observation =
      recorded.observation?.level === level &&
      (level !== "intermittent" || recorded.observation.intervalMinutes === intervalMinutes)
        ? { ...recorded.observation }
        : level === "intermittent"
          ? { ...observationAt(level), intervalMinutes }
          : observationAt(level);
    const keepsDueAt = recorded.legalFormDueAt !== undefined && legalForm === recorded.legalFormCode;
    const pulledAt = now;
    completeCommand(
      `pull-start:${referral.id}`,
      () =>
        raise("RAISE_REFERRAL", {
          ...(ed ? { edId: ed.id } : {}),
          referralId: referral.id,
          acceptedUnitId: unitId,
          ...(desk === "ward" ? { actingUnitId: unitId } : {}),
          ...(pullBed ? { pullBed: true } : {}),
          draft: {
            cohort: referral.ageBand,
            security: destination.secureBedNeeded ? "Secure" : "Open",
            sex: destination.sex,
            gender: destination.gender,
            highAcuity: destination.highAcuityNursingNeeded === true,
            observation,
            legalStatus,
            legalFormCode: legalForm === NO_FORM ? null : legalForm,
            ...(keepsDueAt ? { legalFormDueAt: recorded.legalFormDueAt } : {}),
            urgency: referral.urgency,
            atsCategory: referral.atsCategory,
          },
        }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) {
          setMessage(pullBed ? `The bed is not pulled and nothing has started. ${failure}` : failure);
          if (pullBed) setPullRefused(true);
        } else if (pullBed) {
          const pulled: PulledBed = {
            entry: item,
            name,
            desk,
            ...(desk === "ward" ? { actingUnitId: unitId } : {}),
            at: pulledAt,
          };
          if (onPulled) onPulled(pulled);
          // Pop-ups build (toast, round 2, 1 Nov 2026): a save confirmation names who it was for,
          // surname first through the name display (D-83), so discreet names still apply.
          else toast?.push({ tone: "success", title: `Bed pulled at ${unitName} for ${name}` });
          onDone();
        } else {
          setMessage("The movement has started without the bed. Open it to pull the bed.");
          setJourneyStarted(true);
        }
      },
    );
  }

  const decidedAt = acceptedDecisionAt(item);
  const fromPlace = ed ? `${referral.originSiteCode} ED` : (referral.originSiteCode ?? ORIGIN_NOT_RECORDED);
  const formId = `${baseId}-form`;
  return (
    <form
      className={styles.form}
      onSubmit={pull}
      data-testid={`ward-pull-accepted-${referral.id}`}
      data-changed-facts={changedFacts.join(" ") || undefined}
      aria-label={`Pull the bed for ${name}`}
    >
      <div className={styles.person}>
        <p className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.umrn}>{who.umrn}</span>
          <Badge size="sm" className={styles.tag}>
            Accepted, bed not pulled
          </Badge>
        </p>
        <p className={styles.ctx}>Pulling the bed starts the movement and keeps the bed for this patient.</p>
      </div>
      <section className={styles.group} aria-labelledby={`${baseId}-placement`}>
        <h3 id={`${baseId}-placement`}>Placement</h3>
        <dl className={styles.kv}>
          <dt>Ward</dt>
          <dd>{unitName}</dd>
          <dt>Accepted</dt>
          {decidedAt === undefined ? (
            <dd className={styles.nr}>Not recorded</dd>
          ) : (
            <dd>
              <span className={styles.mono}>{clockText(decidedAt)}</span>
              {` · ${minutesText(Math.max(0, now - decidedAt))} ago`}
            </dd>
          )}
          <dt>From</dt>
          <dd>{withSendingTeam(fromPlace, referral)}</dd>
          <dt>Bed</dt>
          <dd className={styles.nr}>Not recorded</dd>
        </dl>
      </section>
      <section className={styles.group} aria-labelledby={`${baseId}-carried`}>
        <h3 id={`${baseId}-carried`}>Carried with the movement</h3>
        <ChoiceRows
          label="Legal status"
          name={`${formId}-status`}
          value={legalStatus}
          options={LEGAL_STATUSES.map((status) => ({ value: status, label: status }))}
          source={statusSource}
          disabled={journeyStarted}
          testId="ward-pull-accepted-legal-status"
          onChange={setLegalStatus}
        />
        {mismatch ? (
          <p role="alert" className={styles.warning} data-testid="ward-pull-accepted-legal-mismatch">
            {mismatch} You can still pull the bed.
          </p>
        ) : null}
        <div className={styles.q}>
          {/* PR E swap: the kit list picker (spec item 15) replaces this select once it is built. */}
          <Field label="Legal form" hint={<SourceLine id={`${baseId}-form-src`} source={formSource} />}>
            <Select
              value={legalForm}
              onChange={(event) => setLegalForm(event.target.value)}
              data-testid="ward-pull-accepted-legal-form"
              disabled={journeyStarted}
            >
              <option value="">Choose a form, or No form</option>
              <option value={NO_FORM}>No form</option>
              {SELECTABLE_LEGAL_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {legalFormName(form)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {formMismatch ? (
          <p role="alert" className={styles.warning} data-testid="ward-pull-accepted-form-mismatch">
            {formMismatch} You can still pull the bed.
          </p>
        ) : null}
        <ChoiceRows
          label="Observation level"
          name={`${formId}-observation`}
          value={level}
          options={OBSERVATION_LEVELS.map((choice) => ({ value: choice, label: observationLevelName(choice) }))}
          source={levelSource}
          disabled={journeyStarted}
          testId="ward-pull-accepted-observation"
          onChange={setLevel}
        />
        {level === "intermittent" ? (
          <Field label="Check every">
            <Select
              value={intervalMinutes}
              disabled={journeyStarted}
              onChange={(event) => setIntervalMinutes(Number(event.target.value))}
              data-testid="ward-pull-accepted-interval"
            >
              {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </section>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="pri"
          data-placement-action
          aria-disabled={refusal !== undefined ? "true" : undefined}
          aria-describedby={refusal ? `${baseId}-why` : undefined}
          data-testid="ward-pull-accepted-confirm"
        >
          Pull the bed
        </Button>
        {pullRefused && !journeyStarted ? (
          <Button type="button" variant="sec" onClick={() => start(false)} data-testid="ward-pull-accepted-start-only">
            Start the movement without the bed
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} data-testid="ward-pull-accepted-cancel">
            Cancel
          </Button>
        ) : null}
        {refusal ? <DisabledReason id={`${baseId}-why`}>{refusal}</DisabledReason> : null}
      </div>
      <p role="status" className={styles.status} data-testid="ward-pull-accepted-status">
        {message}
        {message && journeyId ? (
          <>
            {" "}
            <Link href={movementHref(journeyId)}>Open the movement</Link>
          </>
        ) : null}
      </p>
    </form>
  );
}
