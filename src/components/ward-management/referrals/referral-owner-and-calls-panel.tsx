"use client";

import { useId, useMemo, useState } from "react";

import { Button, DisabledReason, Field, Select } from "@/components/wf";

import { COMMUNITY_TEAM_PAGES, communityTeamById } from "../community/community-derivations";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { WardCommandOutcome } from "../ward-shared-client";
import { wardCommandFailure } from "../ward/use-ward-command-completion";
import type { Referral, Unit } from "../ward-model";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import {
  REFERRAL_CONTACT_OUTCOMES,
  REFERRAL_OWNER_DESKS,
  referralContactOutcomeLabel,
  type ReferralContactOutcome,
  type ReferralContactTarget,
  type ReferralOwnerDesk,
} from "./referral-owner-and-calls";
import {
  currentReferralOwner,
  minutesAgoLabel,
  referralClosedForFollowUp,
  referralContactTargetLabel,
  referralOwnerLabel,
} from "./referral-owner-and-calls-model";
import styles from "./referral-owner-and-calls.module.css";

/**
 * Fix plan item 4 (Josh, 21 Oct 2026), the screen half: the referral's owner desk with Assign, and
 * "Log a call" in place of the old unwired Call button. Every choice is from a closed list. Logging
 * a call never answers the referral; the ward's answer is still recorded on its own copy.
 */

const TEAM_PREFIX = "team:";
const WARD_PREFIX = "ward:";
const REFERRER = "referrer";

function targetFromChoice(choice: string): ReferralContactTarget | undefined {
  if (choice === REFERRER) return { kind: "referrer" };
  if (choice.startsWith(WARD_PREFIX)) return { kind: "psychiatric_ward", unitId: choice.slice(WARD_PREFIX.length) };
  if (choice.startsWith(TEAM_PREFIX)) return { kind: "community_team", teamId: choice.slice(TEAM_PREFIX.length) };
  return undefined;
}

const teamName = (teamId: string) => communityTeamById(teamId)?.name;

/** Shows nothing outside a provider, where there is nothing to record into. */
export function ReferralOwnerAndCalls({
  referral,
  now,
  readOnly = false,
}: {
  referral: Referral;
  now: Instant;
  /** D-80: the owner and the call log only, with no Assign or Log a call (a read-only board). */
  readOnly?: boolean;
}) {
  const flow = useOptionalWardFlowSelect("units");
  if (!flow) return null;
  return <OwnerAndCalls referral={referral} now={now} units={flow.units} readOnly={readOnly} />;
}

function OwnerAndCalls({
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
  const [ownerChoice, setOwnerChoice] = useState<ReferralOwnerDesk | "">("");
  const [contactChoice, setContactChoice] = useState("");
  const [outcomeChoice, setOutcomeChoice] = useState<ReferralContactOutcome | "">("");
  const [callSaving, setCallSaving] = useState(false);
  const [callFailure, setCallFailure] = useState<string | undefined>(undefined);
  // Wards and teams in name order only: the list never ranks or suggests a ward (D-71).
  const wards = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);
  const teams = useMemo(() => [...COMMUNITY_TEAM_PAGES].sort((a, b) => a.name.localeCompare(b.name)), []);

  const owner = currentReferralOwner(referral);
  const closed = referralClosedForFollowUp(referral);
  const calls = [...(referral.contactLog ?? [])].reverse();
  const places = { units, teamName };

  const assignGate = gate("ASSIGN_REFERRAL");
  const callGate = gate("LOG_REFERRAL_CONTACT");
  // The coordinator assigns to any listed desk; an ED or community desk takes the referral itself.
  const coordinator = role === "coordinator";
  const ownDesk = (REFERRAL_OWNER_DESKS as readonly string[]).includes(role) ? (role as ReferralOwnerDesk) : undefined;
  const assignRefusal =
    closed ??
    assignGate.reason ??
    (coordinator
      ? ownerChoice === ""
        ? "Choose a desk"
        : ownerChoice === owner?.owner
          ? "Already assigned to that desk"
          : undefined
      : ownDesk === undefined || ownDesk === owner?.owner
        ? "Already assigned to your desk"
        : undefined);
  const target = targetFromChoice(contactChoice);
  const callRefusal =
    closed ??
    callGate.reason ??
    (target === undefined ? "Choose who was rung" : outcomeChoice === "" ? "Choose what they said" : undefined);

  return (
    <div className={styles.panel} data-testid={`ward-referral-owner-calls-${referral.id}`}>
      <p className={styles.owner} data-testid={`ward-referral-owner-${referral.id}`}>
        <b>Owner</b>{" "}
        {owner ? (
          <>
            {referralOwnerLabel(owner.owner)}
            <span className={styles.when}>
              {" "}
              · assigned {formatInstantWithDay(owner.at, now)} by {owner.by}
            </span>
          </>
        ) : (
          "Not assigned"
        )}
      </p>

      {readOnly ? null : (
        <>
          <div className={styles.row}>
            {coordinator ? (
              <Field label="Assign to" className={styles.field}>
                <Select
                  value={ownerChoice}
                  onChange={(event) => setOwnerChoice(event.target.value as ReferralOwnerDesk | "")}
                  data-testid={`ward-referral-assign-choice-${referral.id}`}
                >
                  <option value="">Choose a desk</option>
                  {REFERRAL_OWNER_DESKS.map((desk) => (
                    <option key={desk} value={desk}>
                      {referralOwnerLabel(desk)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Button
              size="sm"
              variant="sec"
              aria-disabled={assignRefusal !== undefined ? "true" : undefined}
              aria-describedby={assignRefusal ? `${baseId}-assign-why` : undefined}
              onClick={() => {
                if (assignRefusal) return;
                const next = coordinator ? ownerChoice : ownDesk;
                if (!next) return;
                raise("ASSIGN_REFERRAL", { referralId: referral.id, owner: next });
                setOwnerChoice("");
              }}
              data-testid={`ward-referral-assign-${referral.id}`}
            >
              {coordinator ? "Assign" : "Take this referral"}
            </Button>
            {assignRefusal ? <DisabledReason id={`${baseId}-assign-why`}>{assignRefusal}</DisabledReason> : null}
          </div>

          <fieldset className={styles.call}>
            <legend className={styles.heading}>Log a call</legend>
            <div className={styles.row}>
              <Field label="Who was rung" className={styles.field}>
                <Select
                  value={contactChoice}
                  onChange={(event) => setContactChoice(event.target.value)}
                  data-testid={`ward-referral-call-who-${referral.id}`}
                >
                  <option value="">Choose</option>
                  <option value={REFERRER}>The referrer</option>
                  <optgroup label="Wards">
                    {wards.map((unit) => (
                      <option key={unit.id} value={`${WARD_PREFIX}${unit.id}`}>
                        {unit.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Community teams">
                    {teams.map((team) => (
                      <option key={team.id} value={`${TEAM_PREFIX}${team.id}`}>
                        {team.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
              <Field label="What they said" className={styles.field}>
                <Select
                  value={outcomeChoice}
                  onChange={(event) => setOutcomeChoice(event.target.value as ReferralContactOutcome | "")}
                  data-testid={`ward-referral-call-outcome-${referral.id}`}
                >
                  <option value="">Choose</option>
                  {REFERRAL_CONTACT_OUTCOMES.map((outcome) => (
                    <option key={outcome.id} value={outcome.id}>
                      {outcome.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className={styles.row}>
              <Button
                size="sm"
                variant="sec"
                aria-disabled={callRefusal !== undefined || callSaving ? "true" : undefined}
                aria-describedby={callRefusal ? `${baseId}-call-why` : undefined}
                onClick={() => {
                  if (callRefusal || callSaving || !target || outcomeChoice === "") return;
                  setCallFailure(undefined);
                  // Production audit URE-05: the choices clear only once the call is recorded; a
                  // shared answer of failed or cancelled keeps them, with the reason beside the button.
                  // A choice changed while the save was pending is kept.
                  const sentContact = contactChoice;
                  const sentOutcome = outcomeChoice;
                  const finish = (outcome?: WardCommandOutcome | void) => {
                    setCallSaving(false);
                    const message = wardCommandFailure(outcome ?? undefined);
                    if (message) setCallFailure(message);
                    else {
                      setContactChoice((current) => (current === sentContact ? "" : current));
                      setOutcomeChoice((current) => (current === sentOutcome ? "" : current));
                    }
                  };
                  const result = raise("LOG_REFERRAL_CONTACT", {
                    referralId: referral.id,
                    contact: target,
                    outcome: outcomeChoice,
                  });
                  if (result instanceof Promise) {
                    setCallSaving(true);
                    result.then(finish, () => finish({ commandId: "", status: "failed" }));
                  } else finish(result);
                }}
                data-testid={`ward-referral-call-log-${referral.id}`}
              >
                Log a call
              </Button>
              {callRefusal ? <DisabledReason id={`${baseId}-call-why`}>{callRefusal}</DisabledReason> : null}
              {callFailure ? (
                <p className={styles.note} role="alert" data-testid={`ward-referral-call-failure-${referral.id}`}>
                  {callFailure}
                </p>
              ) : null}
            </div>
            <p className={styles.note}>
              A call does not answer the referral. Record the ward&apos;s answer on its copy. The decision time keeps
              running.
            </p>
          </fieldset>
        </>
      )}

      {calls.length > 0 ? (
        <ul className={styles.list} aria-label="Calls logged" data-testid={`ward-referral-calls-${referral.id}`}>
          {calls.map((call, index) => (
            // Append-only, shown newest first: the position from the oldest is a stable key.
            <li key={calls.length - index}>
              <span className={styles.mono}>{formatInstantWithDay(call.at, now)}</span>{" "}
              {referralContactTargetLabel(call.contact, places)}: {referralContactOutcomeLabel(call.outcome)}
              <span className={styles.when}>
                {" "}
                · {call.by}, {minutesAgoLabel(call.at, now)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.when}>No calls logged.</p>
      )}
    </div>
  );
}
