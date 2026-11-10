"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import type { Movement } from "@/components/ward-management/ward-model";

import { escalationCallText, lastEscalationCall } from "./escalation-calls";
import styles from "./escalation-call.module.css";

// The sheet loads on its own: the on-call directory it reads is not otherwise on the ED page, and
// the phone size limit for that page has no room for it in the first load.
const EscalationCallSheet = dynamic(() => import("./escalation-call-sheet").then((m) => m.EscalationCallSheet));

/** Escalation calls (item 3, D-133): the last recorded outcome beside an ED wait step, "No answer 14:32". */
export function EscalationLastOutcome({
  movement,
  step,
  now,
}: {
  movement: Pick<Movement, "id" | "escalationCalls">;
  step: EdWaitStep["step"];
  now: Instant;
}) {
  const last = lastEscalationCall(movement, step);
  if (!last) return null;
  return (
    <span className={styles.lastOutcome} data-testid={`ward-escalation-last-${movement.id}`}>
      {` · ${escalationCallText(last, now)}`}
    </span>
  );
}

/**
 * Escalation calls (item 3, D-133): a quiet "Who to call" link under an ED wait step that opens the
 * step's on-call contact, its number to copy, and the four outcomes.
 */
export function EscalationStepCall({
  movement,
  step,
  minutesInDepartment,
  patientName,
  now,
}: {
  movement: Pick<Movement, "id" | "originEdId" | "escalationCalls">;
  step: EdWaitStep["step"];
  minutesInDepartment: number;
  patientName: string;
  now: Instant;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={opener}
        type="button"
        className={styles.trigger}
        aria-label={`Who to call for ${patientName}, Step ${step}`}
        data-testid={`ward-escalation-who-${movement.id}`}
        onClick={() => setOpen(true)}
      >
        Who to call
      </button>
      {open ? (
        <EscalationCallSheet
          open
          onClose={() => setOpen(false)}
          movement={movement}
          minutesInDepartment={minutesInDepartment}
          patientName={patientName}
          now={now}
          returnFocusRef={opener}
        />
      ) : null}
    </>
  );
}
