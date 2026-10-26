"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button, DisabledReason, Field, Select, useOptionalToast } from "@/components/wf";

import { movementHref } from "../shell/ward-facade";
import { usePatientNameDisplay } from "../settings/discreet-names";
import { useWardCommandCompletion, wardCommandFailure } from "../ward/use-ward-command-completion";
import { legalStatusMismatchWarning } from "../ward-eligibility";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import type { LegalStatus } from "../ward-model";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  observationAt,
  observationLevelName,
  type Observation,
  type ObservationLevel,
} from "../ward-observation";
import { usePatientOf } from "../ward-patient-name";
import { acceptedAddressing } from "../ward-referrals";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import { allEmergencyDepartments } from "../ward-sites";
import { LEGAL_STATUSES, recordedPullDetails, type AcceptedAwaitingPull } from "./accepted-ward-referral";

import styles from "./pull-accepted-referral.module.css";

/** The form's own "No form" answer, kept apart from "not answered yet" (""). */
const NO_FORM = "none";

/**
 * PULL THE BED IN ONE STEP (WS-03, workflow speed audit, 26 Oct 2026). Pulling the bed after a ward
 * accepted took 11 taps over two or three screens and asked for the legal details again. This asks
 * once, filled in from what is already recorded (the person's wait on the ED board, else the
 * referral), and on Pull the bed starts the accepted journey and pulls the bed at the ward that
 * accepted. Nothing is chosen for the person: the ward is the one that accepted, the details are
 * the recorded ones, and anything not recorded is asked. A refusal (no Ready bed, observation
 * staffing, an override needed) is shown with a link to the journey, where the reasons live.
 */
export function PullAcceptedReferral({ item, onDone }: { item: AcceptedAwaitingPull; onDone: () => void }) {
  const { referral, unitId, unitName } = item;
  const baseId = useId();
  const { movements } = useWardFlowSelect("movements");
  const raise = useWardRaise("coordinator");
  const gate = useRoleGate();
  const role = useRouteRole();
  const completeCommand = useWardCommandCompletion();
  const toast = useOptionalToast();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const who = patientOf(referral);
  const name = nameFor(who.formalName, who.umrn);

  const [recorded] = useState(() => recordedPullDetails(referral, movements));
  const [legalStatus, setLegalStatus] = useState<LegalStatus | "">(recorded.legalStatus ?? "");
  const [legalForm, setLegalForm] = useState(
    recorded.legalFormCode === undefined ? "" : (recorded.legalFormCode ?? NO_FORM),
  );
  const [level, setLevel] = useState<ObservationLevel | "">(recorded.observation?.level ?? "");
  const [intervalMinutes, setIntervalMinutes] = useState<number>(
    recorded.observation?.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0],
  );
  const [startedMovementId, setStartedMovementId] = useState<string | undefined>();
  // True once the start is accepted. The journey can reach the record before or after that answer
  // (local or shared), so the pull waits for both: this flag and the journey on the record.
  const [journeyStarted, setJourneyStarted] = useState(false);
  // The journey whose bed this sheet has asked to pull, so a re-render never asks twice.
  const pullAsked = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>();

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
  // This raises as the coordinator, so only the coordinator's desk may use it.
  const refusal =
    (journeyStarted
      ? message
        ? "The journey has started. Open it to pull the bed."
        : "Pulling the bed"
      : undefined) ??
    (role === "coordinator" ? undefined : "Coordinator only") ??
    gate("RAISE_REFERRAL").reason ??
    gate("PULL_PATIENT").reason ??
    (!destination || (referral.source === "ed_medical" && !ed)
      ? "This referral has no accepted ward place to pull from"
      : undefined) ??
    (referral.source === "community" && !referral.sendingTeamName
      ? "This community referral has no referring team recorded"
      : undefined) ??
    (referral.ageBand === undefined ? "This referral has no age band recorded" : undefined) ??
    (legalStatus === "" ? "Choose the legal status" : undefined) ??
    (legalForm === "" ? "Choose a legal form or no form" : undefined) ??
    (level === "" ? "Choose an observation level" : undefined);

  // The journey starts first; its bed is pulled once the journey is on the record.
  const journey = journeyStarted
    ? movements.find(
        (movement) =>
          movement.referralId === referral.id && !movement.closure && movement.stage === "accepted_awaiting_bed",
      )
    : undefined;
  const journeyId = journey?.id;
  useEffect(() => {
    if (journeyId === undefined || pullAsked.current === journeyId) return;
    pullAsked.current = journeyId;
    completeCommand(
      `pull:${journeyId}`,
      () => raise("PULL_PATIENT", { movementId: journeyId, unitId }),
      (outcome) => {
        const failure = wardCommandFailure(outcome);
        if (failure) {
          setStartedMovementId(journeyId);
          setMessage(`The journey has started, but the bed is not pulled. ${failure}`);
          return;
        }
        toast?.push({ tone: "success", title: `Bed pulled at ${unitName}` });
        onDone();
      },
    );
  }, [journeyId, unitId, unitName, raise, completeCommand, toast, onDone]);

  function pull(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      refusal ||
      journeyStarted ||
      !destination ||
      !referral.ageBand ||
      legalStatus === "" ||
      legalForm === "" ||
      level === ""
    )
      return;
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
    completeCommand(
      `pull-start:${referral.id}`,
      () =>
        raise("RAISE_REFERRAL", {
          ...(ed ? { edId: ed.id } : {}),
          referralId: referral.id,
          acceptedUnitId: unitId,
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
        if (failure) setMessage(failure);
        else setJourneyStarted(true);
      },
    );
  }

  const source = recorded.fromEdBoard ? "From the ED board" : undefined;
  return (
    <form
      className={styles.form}
      onSubmit={pull}
      data-testid={`ward-pull-accepted-${referral.id}`}
      aria-label={`Pull the bed for ${name}`}
    >
      <p className={styles.lead}>
        {unitName} has accepted {name}. Pulling the bed starts the journey and keeps the bed for this patient.
      </p>
      <Field label="Legal status" hint={recorded.legalStatus ? (source ?? "From the referral") : undefined}>
        <Select
          value={legalStatus}
          onChange={(event) => setLegalStatus(event.target.value as LegalStatus | "")}
          data-testid="ward-pull-accepted-legal-status"
        >
          <option value="">Choose a legal status</option>
          {LEGAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </Field>
      {mismatch ? (
        <p role="alert" className={styles.warning} data-testid="ward-pull-accepted-legal-mismatch">
          {mismatch} You can still pull the bed.
        </p>
      ) : null}
      <Field label="Legal form" hint={recorded.legalFormCode !== undefined ? source : undefined}>
        <Select
          value={legalForm}
          onChange={(event) => setLegalForm(event.target.value)}
          data-testid="ward-pull-accepted-legal-form"
        >
          <option value="">Choose a legal form or no form</option>
          <option value={NO_FORM}>No form</option>
          {SELECTABLE_LEGAL_FORMS.map((form) => (
            <option key={form.code} value={form.code}>
              {legalFormName(form)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Observation level" hint={recorded.observation ? source : undefined}>
        <Select
          value={level}
          onChange={(event) => setLevel(event.target.value as ObservationLevel | "")}
          data-testid="ward-pull-accepted-observation"
        >
          <option value="">Choose an observation level</option>
          {OBSERVATION_LEVELS.map((choice) => (
            <option key={choice} value={choice}>
              {observationLevelName(choice)}
            </option>
          ))}
        </Select>
      </Field>
      {level === "intermittent" ? (
        <Field label="Check every">
          <Select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))}>
            {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="pri"
          aria-disabled={refusal !== undefined ? "true" : undefined}
          aria-describedby={refusal ? `${baseId}-why` : undefined}
          data-testid="ward-pull-accepted-confirm"
        >
          Pull the bed
        </Button>
        {refusal ? <DisabledReason id={`${baseId}-why`}>{refusal}</DisabledReason> : null}
      </div>
      <p role="status" className={styles.status} data-testid="ward-pull-accepted-status">
        {message}
        {message && startedMovementId ? (
          <>
            {" "}
            <Link href={movementHref(startedMovementId)}>Open the journey</Link>
          </>
        ) : null}
      </p>
    </form>
  );
}
