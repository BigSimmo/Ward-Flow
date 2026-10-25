"use client";

import { useId, useMemo, useState } from "react";

import { Button, DisabledReason, Field, Select, StatusGlyph } from "@/components/wf";

import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useOptionalWardFlowSelect, useWardFlowClock } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Referral, Unit } from "../ward-model";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import {
  REFERRAL_COMMITMENT_STEPS,
  REFERRAL_COMMITMENT_TIME_CHOICES,
  referralCommitmentStepLabel,
  type ReferralCommitmentStep,
} from "./referral-commitments";
import {
  awaitingWardAnswer,
  callbackDue,
  chaseCount,
  chaseCountLabel,
  commitmentEntriesFor,
  commitmentStatus,
  commitmentStepRank,
  promiseOverdue,
  type ReferralCommitmentStatus,
} from "./referral-commitments-model";
import { referralClosedForFollowUp } from "./referral-owner-and-calls-model";
import type { WardReferralInboxEntry } from "./referral-inbox";
import styles from "./referral-commitments.module.css";

/**
 * Closing-the-loop package A (24 Oct 2026), the screen half of response commitments: the state and
 * times beside a request, "Promise overdue" read from the recorded time, the "Asked N times"
 * marker, and the controls to record a step or a callback. Every choice is from a closed list.
 * Nothing here answers the referral. Screens load this file through `referral-commitments-lazy.tsx`.
 */

/** A time picker offering fixed choices from now. "" means not set. */
export function CommitmentTimeSelect({
  label,
  value,
  onChange,
  now,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  now: Instant;
  testId?: string;
}) {
  return (
    <Field label={label} className={styles.field}>
      <Select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        <option value="">Not set</option>
        {REFERRAL_COMMITMENT_TIME_CHOICES.map((choice) => (
          <option key={choice.minutes} value={String(choice.minutes)}>
            By {formatInstantWithDay(now + choice.minutes, now)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** "Promised by 14:30 · Promise overdue · Next callback 15:00". Words, never colour alone. */
export function CommitmentStatusLine({
  status,
  now,
  chases,
  testId,
}: {
  status: ReferralCommitmentStatus;
  now: Instant;
  chases?: number;
  testId?: string;
}) {
  const overdue = promiseOverdue(status, now);
  const callback = status.nextCallbackAt;
  return (
    <p className={styles.line} data-testid={testId}>
      <StatusGlyph tone={overdue ? "warning" : "neutral"} size={8} />{" "}
      <b>{status.step ? referralCommitmentStepLabel(status.step.step) : "No commitment recorded"}</b>
      {status.step ? (
        <span className={styles.when}>
          {" "}
          · {status.step.by}, {formatInstantWithDay(status.step.at, now)}
        </span>
      ) : null}
      {status.promisedFor !== undefined ? <> · Promised by {formatInstantWithDay(status.promisedFor, now)}</> : null}
      {overdue ? <span className={styles.overdue}> · Promise overdue</span> : null}
      {callback ? (
        <>
          {" "}
          · Next callback {formatInstantWithDay(callback.at, now)}
          {callbackDue(status, now) ? <span className={styles.overdue}> (time reached)</span> : null}
        </>
      ) : null}
      {chases !== undefined && chases > 0 ? (
        <span className={styles.chase} data-testid={testId ? `${testId}-chases` : undefined}>
          {" "}
          {chaseCountLabel(chases)}
        </span>
      ) : null}
    </p>
  );
}

/** Wards this referral's copies can be recorded against: a named copy's ward, or every ward for an open copy. */
function wardChoices(referral: Referral, units: readonly Unit[]): Unit[] {
  const open = referral.destinations.filter(
    (arm) => arm.destination.kind === "psychiatric_ward" && awaitingWardAnswer(arm),
  );
  const named = new Set(
    open.flatMap((arm) =>
      arm.destination.kind === "psychiatric_ward" && arm.destination.unitId ? [arm.destination.unitId] : [],
    ),
  );
  const anyWard = open.some(
    (arm) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId === undefined,
  );
  // Name order only: the list never ranks or proposes a ward (D-71).
  return units.filter((unit) => anyWard || named.has(unit.id)).sort((a, b) => a.name.localeCompare(b.name));
}

/** The coordinator's panel on the referral board. Shows nothing outside a provider. */
export function ReferralCommitments({
  referral,
  now,
  readOnly = false,
}: {
  referral: Referral;
  now: Instant;
  readOnly?: boolean;
}) {
  const flow = useOptionalWardFlowSelect("units");
  if (!flow) return null;
  return <CommitmentsBody referral={referral} now={now} units={flow.units} readOnly={readOnly} />;
}

function CommitmentsBody({
  referral,
  now,
  units,
  readOnly,
}: {
  referral: Referral;
  now: Instant;
  units: readonly Unit[];
  readOnly: boolean;
}) {
  const role = useRouteRole();
  const raise = useWardRaise(role);
  const gate = useRoleGate();
  const baseId = useId();
  const choices = useMemo(() => wardChoices(referral, units), [referral, units]);
  const [unitChoice, setUnitChoice] = useState("");
  const [stepChoice, setStepChoice] = useState<ReferralCommitmentStep | "">("");
  const [promiseChoice, setPromiseChoice] = useState("");
  const [callbackChoice, setCallbackChoice] = useState("");

  // One line per ward with something recorded, in the order the copies were addressed.
  const rows = referral.destinations.flatMap((arm) => {
    if (arm.destination.kind !== "psychiatric_ward") return [];
    const unitIds = [
      ...new Set([
        ...(arm.destination.unitId ? [arm.destination.unitId] : []),
        ...(arm.commitments ?? []).map((entry) => entry.unitId),
      ]),
    ];
    return unitIds.map((unitId) => ({
      unitId,
      status: commitmentStatus(commitmentEntriesFor(arm, unitId)),
      chases: chaseCount(referral, unitId),
    }));
  });
  const wardName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";

  const unitId = choices.length === 1 ? choices[0]!.id : unitChoice;
  const current = rows.find((row) => row.unitId === unitId)?.status;
  const closed = referralClosedForFollowUp(referral);
  const recordGate = gate("RECORD_REFERRAL_COMMITMENT");
  const backwards =
    stepChoice !== "" &&
    current !== undefined &&
    (commitmentStepRank(stepChoice) < commitmentStepRank(current.step?.step) ||
      (stepChoice === current.step?.step && stepChoice !== "response_requested" && stepChoice !== "promised"));
  const refusal =
    closed ??
    recordGate.reason ??
    (choices.length === 0
      ? "No ward copy is waiting on an answer"
      : unitId === ""
        ? "Choose a ward"
        : current?.step?.step === "resolved"
          ? "Already resolved"
          : stepChoice === "" && callbackChoice === ""
            ? "Choose a step or a callback time"
            : stepChoice === "promised" && promiseChoice === ""
              ? "Choose when the answer is promised by"
              : backwards
                ? "Steps only move forward"
                : undefined);

  return (
    <div className={styles.panel} data-testid={`ward-referral-commitments-${referral.id}`}>
      {rows.length > 0 ? (
        <ul className={styles.list} aria-label="Response commitments">
          {rows.map((row) => (
            <li key={row.unitId}>
              <span className={styles.ward}>{wardName(row.unitId)}</span>
              <CommitmentStatusLine
                status={row.status}
                now={now}
                chases={row.chases}
                testId={`ward-referral-commitment-${referral.id}-${row.unitId}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.when}>No commitment recorded.</p>
      )}

      {readOnly || closed ? null : (
        <fieldset className={styles.form}>
          <legend className={styles.heading}>Record a commitment</legend>
          <div className={styles.row}>
            {choices.length > 1 ? (
              <Field label="Ward" className={styles.field}>
                <Select
                  value={unitChoice}
                  onChange={(event) => setUnitChoice(event.target.value)}
                  data-testid={`ward-referral-commitment-ward-${referral.id}`}
                >
                  <option value="">Choose a ward</option>
                  {choices.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Step" className={styles.field}>
              <Select
                value={stepChoice}
                onChange={(event) => setStepChoice(event.target.value as ReferralCommitmentStep | "")}
                data-testid={`ward-referral-commitment-step-${referral.id}`}
              >
                <option value="">No change</option>
                {REFERRAL_COMMITMENT_STEPS.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.label}
                  </option>
                ))}
              </Select>
            </Field>
            {stepChoice === "promised" ? (
              <CommitmentTimeSelect
                label="Promised by"
                value={promiseChoice}
                onChange={setPromiseChoice}
                now={now}
                testId={`ward-referral-commitment-promise-${referral.id}`}
              />
            ) : null}
            <CommitmentTimeSelect
              label="Next callback"
              value={callbackChoice}
              onChange={setCallbackChoice}
              now={now}
              testId={`ward-referral-commitment-callback-${referral.id}`}
            />
          </div>
          <div className={styles.row}>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={refusal !== undefined ? "true" : undefined}
              aria-describedby={refusal ? `${baseId}-why` : undefined}
              onClick={() => {
                if (refusal) return;
                raise("RECORD_REFERRAL_COMMITMENT", {
                  referralId: referral.id,
                  unitId,
                  ...(stepChoice !== "" ? { step: stepChoice } : {}),
                  ...(stepChoice === "promised" ? { promisedFor: now + Number(promiseChoice) } : {}),
                  ...(callbackChoice !== "" ? { nextCallbackAt: now + Number(callbackChoice) } : {}),
                });
                setStepChoice("");
                setPromiseChoice("");
                setCallbackChoice("");
              }}
              data-testid={`ward-referral-commitment-record-${referral.id}`}
            >
              Record
            </Button>
            {refusal ? <DisabledReason id={`${baseId}-why`}>{refusal}</DisabledReason> : null}
          </div>
          <p className={styles.when}>
            Acknowledged means the ward has seen it and agreed to respond. A commitment does not answer the referral.
          </p>
        </fieldset>
      )}
    </div>
  );
}

/**
 * The ward's own controls in its referral inbox: acknowledge, and promise an answer by a time. The
 * ward sees only its own commitment line, never another ward's.
 */
export function WardCommitmentControls({
  entry,
  unitId,
  actingUnitId,
  refusal,
}: {
  entry: WardReferralInboxEntry;
  unitId: string;
  actingUnitId: string | undefined;
  refusal: string | undefined;
}) {
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const baseId = useId();
  const [promiseChoice, setPromiseChoice] = useState("");
  const status = commitmentStatus(commitmentEntriesFor(entry, unitId));
  if (status.step?.step === "resolved") return <CommitmentStatusLine status={status} now={now} />;
  const rank = commitmentStepRank(status.step?.step);
  const ackRefusal = refusal ?? (rank >= commitmentStepRank("acknowledged") ? "Already acknowledged" : undefined);
  const promiseRefusal = refusal ?? (promiseChoice === "" ? "Choose a time" : undefined);
  const base = { referralId: entry.id, unitId, ...(actingUnitId ? { actingUnitId } : {}) };
  return (
    <div className={styles.panel} data-testid={`ward-referral-commitment-ward-${entry.id}`}>
      {status.entries > 0 ? <CommitmentStatusLine status={status} now={now} /> : null}
      <div className={styles.row}>
        <Button
          size="sm"
          variant="sec"
          aria-disabled={ackRefusal !== undefined ? "true" : undefined}
          aria-describedby={ackRefusal ? `${baseId}-ack` : undefined}
          onClick={() => {
            if (ackRefusal) return;
            raise("RECORD_REFERRAL_COMMITMENT", { ...base, step: "acknowledged" });
          }}
          data-testid={`ward-referral-acknowledge-${entry.id}`}
        >
          Acknowledge, will respond
        </Button>
        {ackRefusal ? <DisabledReason id={`${baseId}-ack`}>{ackRefusal}</DisabledReason> : null}
      </div>
      <div className={styles.row}>
        <CommitmentTimeSelect
          label="Answer promised by"
          value={promiseChoice}
          onChange={setPromiseChoice}
          now={now}
          testId={`ward-referral-promise-choice-${entry.id}`}
        />
        <Button
          size="sm"
          variant="sec"
          aria-disabled={promiseRefusal !== undefined ? "true" : undefined}
          aria-describedby={promiseRefusal ? `${baseId}-promise` : undefined}
          onClick={() => {
            if (promiseRefusal) return;
            raise("RECORD_REFERRAL_COMMITMENT", {
              ...base,
              step: "promised",
              promisedFor: now + Number(promiseChoice),
            });
            setPromiseChoice("");
          }}
          data-testid={`ward-referral-promise-${entry.id}`}
        >
          Record promise
        </Button>
        {promiseRefusal ? <DisabledReason id={`${baseId}-promise`}>{promiseRefusal}</DisabledReason> : null}
      </div>
    </div>
  );
}
