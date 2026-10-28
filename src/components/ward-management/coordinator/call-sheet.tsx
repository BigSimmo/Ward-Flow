"use client";

import { useId, useState } from "react";
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

import styles from "./call-sheet.module.css";

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
  const [recorded, setRecorded] = useState<string | undefined>();
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
            now={now}
            testId={`ward-call-sheet-promise-${group.unitId}`}
          />
          <CommitmentTimeSelect
            label="Next callback"
            value={callback}
            onChange={setCallback}
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
            onClick={() => {
              if (refusal || outcome === "") return;
              // One call, recorded against each linked referral, in the sheet's own order.
              for (const item of group.items) {
                raise("LOG_REFERRAL_CONTACT", {
                  referralId: item.referral.id,
                  contact: { kind: "psychiatric_ward", unitId: group.unitId },
                  outcome,
                });
                if (promise !== "" || callback !== "") {
                  raise("RECORD_REFERRAL_COMMITMENT", {
                    referralId: item.referral.id,
                    unitId: group.unitId,
                    ...(promise !== "" ? { step: "promised" as const, promisedFor: now + Number(promise) } : {}),
                    ...(callback !== "" ? { nextCallbackAt: now + Number(callback) } : {}),
                  });
                }
              }
              setRecorded(`Recorded against ${group.items.length} referral${group.items.length === 1 ? "" : "s"}.`);
              setOutcome("");
              setPromise("");
              setCallback("");
            }}
            data-testid={`ward-call-sheet-record-${group.unitId}`}
          >
            Record call outcome
          </Button>
          {refusal ? <DisabledReason id={`${baseId}-why`}>{refusal}</DisabledReason> : null}
          <span role="status" className={styles.note}>
            {recorded}
          </span>
        </div>
      </fieldset>
    </section>
  );
}
