"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { useMemo, useState, type RefObject } from "react";

import { Badge, Button, Sheet, StatusGlyph } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import type { Instant } from "@/components/ward-management/ward-clock";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useOptionalWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { edWaitStep, type EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import type { Movement } from "@/components/ward-management/ward-model";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";

import {
  ESCALATION_CALL_OUTCOMES,
  ESCALATION_CALL_OUTCOME_LABELS,
  ESCALATION_CONTACT_ROLE_LABELS,
  ESCALATION_STEP_ROLE,
  escalationCallText,
  lastEscalationCall,
  type EscalationCallOutcome,
} from "./escalation-calls";
import { escalationContact } from "./escalation-contact";
import contact from "../staffing/staffing.module.css";
import styles from "./escalation-call.module.css";

/**
 * Escalation calls (item 3, D-133): who to call at this wait step, the number to copy and when the
 * entry was last checked, then four outcome buttons. Every number is a synthetic mock from the
 * on-call directory; Copy puts it on the clipboard and nothing dials. No outcome is pre-selected and
 * none is filled: each records the call as it happened, nothing more.
 */
export function EscalationCallSheet({
  open,
  onClose,
  movement,
  minutesInDepartment,
  patientName,
  now,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  movement: Pick<Movement, "id" | "originEdId" | "escalationCalls">;
  minutesInDepartment: number;
  patientName: string;
  now: Instant;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const step = edWaitStep(minutesInDepartment);
  const network = useWardNetwork();
  const checks = useOptionalWardFlowSelect("directoryChecks")?.directoryChecks;
  const entries = useMemo(() => buildOnCallDirectory(network.sites), [network.sites]);
  const siteCode = edById(movement.originEdId)?.siteCode;
  const service = siteByCode(siteCode)?.service;
  const who = step ? escalationContact(step.step, { siteCode, service }, entries, checks, now) : undefined;
  const [said, setSaid] = useState("");
  const copy = async (number: string) => {
    try {
      await copyTextToClipboard(number);
      setSaid("Number copied");
    } catch {
      setSaid("Copy is unavailable in this browser. Select the number instead.");
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step ? `Who to call: Step ${step.step}` : "Who to call"}
      placement="responsive-right"
      mobilePlacement="bottom"
      returnFocusRef={returnFocusRef}
      testId="ward-escalation-call-sheet"
    >
      {step ? (
        <>
          <p className={contact.contactHead}>
            {patientName} · {step.label}. Suggested next step: {step.nextStep}. Synthetic numbers, nothing dials.
          </p>
          {who ? (
            <div className={contact.contactRow} data-testid="ward-escalation-contact">
              <span className={contact.contactWho}>
                <span className={contact.contactLabel}>{ESCALATION_CONTACT_ROLE_LABELS[who.role]}</span>
                <span className={contact.contactSub}>
                  {who.entry.name} · {who.entry.place}
                </span>
                {who.hours ? (
                  <span className={contact.contactSub}>
                    <StatusGlyph tone={who.hours.startsWith("Opens") ? "neutral" : "success"} size={9} />
                    <span className={contact.mono}>{who.hours}</span>
                  </span>
                ) : null}
              </span>
              {who.number ? (
                <span className={contact.actions}>
                  <span className={contact.contactNumber} data-testid="ward-escalation-number">
                    {who.number}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Copy}
                    iconOnly
                    aria-label={`Copy ${ESCALATION_CONTACT_ROLE_LABELS[who.role].toLowerCase()} number`}
                    data-testid="ward-escalation-copy"
                    onClick={() => void copy(who.number!)}
                  />
                </span>
              ) : (
                <span className={contact.missing}>Not recorded</span>
              )}
              <span className={styles.checked} data-testid="ward-escalation-checked">
                Synthetic · {who.checked} · Kept up to date by {WARD_FLOW_ROLE_LABELS[who.entry.ownerRole]}
                <Badge size="sm" variant="plain">
                  Not verified
                </Badge>
              </span>
              {who.notChecked ? <span className={styles.note}>{who.notChecked}</span> : null}
            </div>
          ) : (
            <p className={contact.missing}>The on-call directory holds no entry for this step. Not recorded.</p>
          )}
          <EscalationOutcomes movement={movement} step={step.step} now={now} />
        </>
      ) : (
        <p className={contact.contactHead}>This wait has not reached a step.</p>
      )}
      <div className={contact.contactFoot}>
        <span className={contact.status} role="status">
          {said}
        </span>
        <Link className={contact.link} href="/ward-flow/on-call" data-testid="ward-escalation-all-contacts">
          All contacts
        </Link>
      </div>
    </Sheet>
  );
}

/** The four outcomes. Only desks the event permits (the ED and the coordinator) see them. */
function EscalationOutcomes({
  movement,
  step,
  now,
}: {
  movement: Pick<Movement, "id" | "escalationCalls">;
  step: EdWaitStep["step"];
  now: Instant;
}) {
  const access = useEffectiveWardAccess();
  const role = (EVENT_ROLE.RECORD_ESCALATION_CALL as readonly string[]).includes(access.role)
    ? (access.role as WardFlowRole)
    : null;
  const canRecord = useOptionalWardFlowSelect("dispatch") !== null && role !== null;
  const last = lastEscalationCall(movement, step);
  return (
    <section className={styles.outcomes} aria-labelledby="ward-escalation-outcome-head">
      <h3 id="ward-escalation-outcome-head" className={styles.head}>
        After the call
      </h3>
      <p className={styles.last} data-testid="ward-escalation-last">
        {last
          ? `Last recorded: ${escalationCallText(last, now)} by ${WARD_FLOW_ROLE_LABELS[last.by]}`
          : "No call recorded for this step."}
      </p>
      {canRecord && role !== null ? <OutcomeButtons movementId={movement.id} step={step} role={role} /> : null}
    </section>
  );
}

function OutcomeButtons({
  movementId,
  step,
  role,
}: {
  movementId: string;
  step: EdWaitStep["step"];
  role: WardFlowRole;
}) {
  const raise = useWardRaise(role);
  const save = useWardFormSave(`escalation-call:${movementId}:${step}`);
  const [done, setDone] = useState<EscalationCallOutcome>();
  return (
    <>
      <div className={styles.buttons} role="group" aria-label="What happened">
        {ESCALATION_CALL_OUTCOMES.map((outcome) => (
          <Button
            key={outcome}
            size="sm"
            variant="sec"
            data-testid={`ward-escalation-outcome-${outcome}`}
            disabledReason={save.pending ? "Saving" : undefined}
            onClick={() => {
              setDone(undefined);
              save.submit(
                () =>
                  raise("RECORD_ESCALATION_CALL", {
                    movementId,
                    step,
                    roleCalled: ESCALATION_STEP_ROLE[step],
                    outcome,
                  }),
                () => setDone(outcome),
              );
            }}
          >
            {ESCALATION_CALL_OUTCOME_LABELS[outcome]}
          </Button>
        ))}
      </div>
      {save.error ? (
        <span className={contact.status} role="alert">
          {save.error}
        </span>
      ) : null}
      {done ? (
        <span className={contact.status} role="status">
          Recorded: {ESCALATION_CALL_OUTCOME_LABELS[done]}.
        </span>
      ) : null}
    </>
  );
}
