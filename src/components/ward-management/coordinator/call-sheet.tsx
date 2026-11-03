"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import { Button, DisabledReason, Field, Select } from "@/components/wf";

import { referralBoardHref } from "../ed/ed-bed-search-step";
import { CommitmentStatusLine, CommitmentTimeSelect } from "../referrals/referral-commitments-panel";
import { callSheetGroups, type CallSheetGroup } from "../referrals/referral-commitments-model";
import {
  REFERRAL_CONTACT_OUTCOMES,
  referralContactOutcomeLabel,
  type ReferralContactOutcome,
} from "../referrals/referral-owner-and-calls";
import { minutesAgoLabel } from "../referrals/referral-owner-and-calls-model";
import { usePatientNameDisplay } from "../settings/discreet-names";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { useRoleGate } from "../ward-role-gate";

import { useHoldOpenForm } from "../use-hold-open-form";
import { useWardShellPublic } from "../shell/ward-shell-public-context";
import type { WardCommandOutcome } from "../ward-shared-client";
import { SAVE_NOT_CONFIRMED } from "../ward-save-failure";
import styles from "./call-sheet.module.css";

type CallStep = {
  referralId: string;
  kind: "contact" | "commitment";
  record: () => ReturnType<ReturnType<typeof useWardRaise>>;
  status: "ready" | "accepted" | "failed" | "uncertain" | "stale";
  message?: string;
};
type CallBatch = { scope: object; referralIds: string[]; steps: CallStep[] };

/**
 * COORDINATED CALL SHEET (closing-the-loop package A, 24 Oct 2026). Every referral still waiting
 * on a ward, grouped by ward: the last call logged, what is still unanswered, promised times and
 * the next callback. One "Record call outcome" per ward logs the same outcome against each linked
 * referral in one go. Screen and print only: nothing is emailed or shared from here, and no link
 * carries patient details. Wards follow the network's own order and referrals keep their recorded
 * order inside each ward. Nothing is ranked or proposed.
 */
export function CallSheet() {
  const { referrals, units } = useWardFlowSelect("referrals", "units");
  const now = useWardFlowClock();
  const groups = callSheetGroups(referrals, units);
  return (
    <div className={styles.sheet} data-print-output data-testid="ward-call-sheet">
      <div className={styles.head}>
        <p className={styles.note}>Prepared {formatInstantWithDay(now, now)}. Synthetic data.</p>
        <Button size="sm" variant="sec" icon={Printer} onClick={() => window.print()} data-print-hide>
          Print
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className={styles.note}>No referral is waiting on a ward.</p>
      ) : (
        groups.map((group) => <WardGroup key={group.unitId} group={group} units={units} now={now} />)
      )}
    </div>
  );
}

function WardGroup({ group, units, now }: { group: CallSheetGroup; units: readonly Unit[]; now: Instant }) {
  const baseId = useId();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const raise = useWardRaise("coordinator");
  const gate = useRoleGate();
  const [outcome, setOutcome] = useState<ReferralContactOutcome | "">("");
  const [promise, setPromise] = useState("");
  const [callback, setCallback] = useState("");
  const lifetime = useWardShellPublic()?.accessLifetime;
  const scope = useMemo(() => ({ unitId: group.unitId, lifetime }), [group.unitId, lifetime]);
  const currentScope = useRef<object | null>(scope);
  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => {
      currentScope.current = null;
    };
  }, [scope]);
  const batch = useRef<CallBatch | null>(null);
  const [batchView, setBatchView] = useState<CallBatch | null>(null);
  const inFlight = useRef<object | null>(null);
  const [working, setWorking] = useState<object | null>(null);
  const [recorded, setRecorded] = useState<{ scope: object; message: string }>();
  const pending = working === scope;
  useHoldOpenForm(pending);
  const currentBatch = batchView?.scope === scope ? batchView : null;
  const retaining = currentBatch !== null;
  const stale = currentBatch?.steps.some((step) => step.status === "stale") === true;
  const awaiting = currentBatch?.steps.some((step) => step.status === "uncertain") === true;
  function describe(attempt: CallBatch) {
    if (currentScope.current !== attempt.scope) return;
    setBatchView({ ...attempt, steps: attempt.steps.map((step) => ({ ...step })) });
    const completed = attempt.referralIds.filter((id) =>
      attempt.steps.filter((step) => step.referralId === id).every((step) => step.status === "accepted"),
    ).length;
    const partly = attempt.referralIds.filter((id) => {
      const steps = attempt.steps.filter((step) => step.referralId === id);
      return steps.some((step) => step.status === "accepted") && !steps.every((step) => step.status === "accepted");
    }).length;
    const message =
      completed === attempt.referralIds.length
        ? `Recorded against ${completed} referral${completed === 1 ? "" : "s"}.`
        : `${completed} of ${attempt.referralIds.length} referrals fully recorded. ${partly} partly recorded. ${attempt.steps.some((step) => step.status === "uncertain") ? "Waiting for confirmation; do not record it again." : (attempt.steps.find((step) => step.message)?.message ?? "Review and retry the unrecorded steps.")}`;
    setRecorded({ scope: attempt.scope, message });
  }
  async function settle(step: CallStep, attempt: CallBatch) {
    let answer: WardCommandOutcome | void;
    try {
      answer = await step.record();
      while (answer?.status === "failed" && answer.confirmation) {
        step.status = "uncertain";
        step.message = answer.message ?? SAVE_NOT_CONFIRMED;
        describe(attempt);
        const commandId = answer.commandId;
        const confirmed: WardCommandOutcome = await answer.confirmation;
        if (confirmed.commandId !== commandId) return;
        answer = confirmed;
      }
    } catch {
      step.status = "failed";
      step.message = SAVE_NOT_CONFIRMED;
      return;
    }
    if (currentScope.current !== attempt.scope || answer?.isCurrent?.() === false) {
      step.status = "stale";
      step.message = "The workspace changed. Review the current call sheet.";
    } else if (answer?.status === "accepted") {
      step.status = "accepted";
      step.message = undefined;
    } else {
      step.status = "failed";
      step.message = answer?.message ?? SAVE_NOT_CONFIRMED;
    }
  }
  async function recordOutcome() {
    if (inFlight.current === scope || refusal || outcome === "" || stale) return;
    const attempt = (batch.current?.scope === scope ? batch.current : null) ?? {
      scope,
      referralIds: group.items.map((item) => item.referral.id),
      steps: group.items.flatMap((item): CallStep[] => [
        {
          referralId: item.referral.id,
          kind: "contact",
          status: "ready",
          record: () =>
            raise("LOG_REFERRAL_CONTACT", {
              referralId: item.referral.id,
              contact: { kind: "psychiatric_ward", unitId: group.unitId },
              outcome,
            }),
        },
        ...(promise !== "" || callback !== ""
          ? [
              {
                referralId: item.referral.id,
                kind: "commitment" as const,
                status: "ready" as const,
                record: () =>
                  raise("RECORD_REFERRAL_COMMITMENT", {
                    referralId: item.referral.id,
                    unitId: group.unitId,
                    ...(promise !== "" ? { step: "promised" as const, promisedFor: now + Number(promise) } : {}),
                    ...(callback !== "" ? { nextCallbackAt: now + Number(callback) } : {}),
                  }),
              },
            ]
          : []),
      ]),
    };
    batch.current = attempt;
    inFlight.current = scope;
    setWorking(scope);
    setRecorded({ scope, message: "Recording call outcome. Waiting for confirmation." });
    try {
      for (const step of attempt.steps) {
        if (currentScope.current !== scope || attempt.steps.some((candidate) => candidate.status === "stale")) break;
        if (step.status === "accepted" || step.status === "uncertain") continue;
        if (
          step.kind === "commitment" &&
          !attempt.steps.some(
            (candidate) =>
              candidate.referralId === step.referralId &&
              candidate.kind === "contact" &&
              candidate.status === "accepted",
          )
        )
          continue;
        await settle(step, attempt);
        describe(attempt);
      }
      if (currentScope.current === scope && attempt.steps.every((step) => step.status === "accepted")) {
        batch.current = null;
        setBatchView(null);
        setOutcome("");
        setPromise("");
        setCallback("");
      }
    } finally {
      if (inFlight.current === scope) inFlight.current = null;
      if (currentScope.current === scope) setWorking(null);
    }
  }
  const ward = units.find((unit) => unit.id === group.unitId)?.name ?? "Ward not recorded";
  const callGate = gate("LOG_REFERRAL_CONTACT");
  const commitGate = gate("RECORD_REFERRAL_COMMITMENT");
  const refusal =
    callGate.reason ??
    (promise !== "" || callback !== "" ? commitGate.reason : undefined) ??
    (outcome === "" ? "Choose what the ward said" : undefined);
  const headingId = `${baseId}-ward`;

  return (
    <section className={styles.group} aria-labelledby={headingId} data-testid={`ward-call-sheet-${group.unitId}`}>
      <h3 id={headingId} className={styles.ward}>
        {ward}
      </h3>
      <dl className={styles.facts}>
        <div>
          <dt>Last contact</dt>
          <dd>
            {group.lastCall
              ? `${formatInstantWithDay(group.lastCall.at, now)}, ${referralContactOutcomeLabel(group.lastCall.outcome)} (${minutesAgoLabel(group.lastCall.at, now)})`
              : "No call logged"}
          </dd>
        </div>
        <div>
          <dt>Unanswered</dt>
          <dd>
            {group.items.length} referral{group.items.length === 1 ? "" : "s"}
            {group.openNeeds > 0
              ? `, ${group.openNeeds} item${group.openNeeds === 1 ? "" : "s"} asked of the referrer`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Next callback</dt>
          <dd>{group.nextCallbackAt !== undefined ? formatInstantWithDay(group.nextCallbackAt, now) : "Not set"}</dd>
        </div>
      </dl>
      <ol className={styles.items}>
        {group.items.map((item) => {
          const who = patientOf(item.referral);
          return (
            <li key={item.referral.id}>
              <Link href={referralBoardHref(item.referral.id)} className={styles.link}>
                {nameFor(who.formalName, who.umrn)}
              </Link>{" "}
              <span className={styles.note}>
                Tier {item.referral.urgency}, raised {formatInstantWithDay(item.referral.raisedAt, now)}
              </span>
              <CommitmentStatusLine
                status={item.status}
                now={now}
                chases={item.chases}
                testId={`ward-call-sheet-item-${group.unitId}-${item.referral.id}`}
              />
            </li>
          );
        })}
      </ol>
      <fieldset className={styles.form} data-print-hide>
        <legend className={styles.legend}>Record call outcome</legend>
        <div className={styles.row}>
          <Field label="What the ward said" className={styles.field}>
            <Select
              value={outcome}
              disabled={pending || retaining}
              onChange={(event) => setOutcome(event.target.value as ReferralContactOutcome | "")}
              data-testid={`ward-call-sheet-outcome-${group.unitId}`}
            >
              <option value="">Choose</option>
              {REFERRAL_CONTACT_OUTCOMES.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </Select>
          </Field>
          <CommitmentTimeSelect
            label="Answer promised by"
            value={promise}
            onChange={setPromise}
            disabled={pending || retaining}
            now={now}
            testId={`ward-call-sheet-promise-${group.unitId}`}
          />
          <CommitmentTimeSelect
            label="Next callback"
            value={callback}
            onChange={setCallback}
            disabled={pending || retaining}
            now={now}
            testId={`ward-call-sheet-callback-${group.unitId}`}
          />
        </div>
        <div className={styles.row}>
          <Button
            size="sm"
            variant="sec"
            aria-disabled={refusal !== undefined ? "true" : undefined}
            aria-describedby={refusal ? `${baseId}-why` : undefined}
            disabledReason={
              pending
                ? "Saving"
                : awaiting
                  ? "Waiting for the original confirmation"
                  : stale
                    ? "Review the current call sheet"
                    : undefined
            }
            onClick={() => {
              void recordOutcome();
            }}
            data-testid={`ward-call-sheet-record-${group.unitId}`}
          >
            {retaining ? "Retry unrecorded steps" : "Record call outcome"}
          </Button>
          {retaining && !pending && !awaiting && !stale ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                batch.current = null;
                setBatchView(null);
                setRecorded({ scope, message: "Previously recorded steps are kept. Choose answers for another call." });
              }}
            >
              {currentBatch.steps.some((step) => step.status === "accepted") ? "Start another call" : "Change answers"}
            </Button>
          ) : null}
          {refusal ? <DisabledReason id={`${baseId}-why`}>{refusal}</DisabledReason> : null}
          <span role="status" className={styles.note}>
            {recorded?.scope === scope ? recorded.message : undefined}
          </span>
        </div>
      </fieldset>
    </section>
  );
}
