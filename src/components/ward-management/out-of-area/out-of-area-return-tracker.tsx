"use client";

/**
 * OA1 (3 Nov 2026): Out of area is a return tracker. The plan opens with where this person's return
 * has got to, four steps, and the one thing that happens next, so the panel reads as progress
 * towards home rather than a ledger entry.
 */
import { Check } from "lucide-react";

import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

import type { RepatDraft } from "./out-of-area-model";
import own from "./out-of-area-return-tracker.module.css";

const STEPS = ["Receiving bed", "Ward agreed", "Transport booked", "Placed home"] as const;

/**
 * How many of the four steps are done, read only from what has been recorded or drafted. The steps
 * run in order, so the count stops at the first step not yet done. Codex review on #1371: recording
 * the return creates a movement still waiting for its bed, so Transport booked reads the movement's
 * transport booking and Placed home waits for the movement to close as arrived.
 */
export function returnStepsDone(
  draft: RepatDraft,
  record: RepatriationRecord | undefined,
  returnMovement: Pick<Movement, "transport" | "closure"> | undefined,
): number {
  const steps = [
    record !== undefined || Boolean(draft.homeHospital),
    record ? Boolean(record.receivingWardAgreed) : draft.receivingWardAgreed === true && Boolean(draft.homeHospital),
    returnMovement?.transport !== undefined,
    returnMovement?.closure?.outcome === "arrived",
  ];
  const firstOpen = steps.indexOf(false);
  return firstOpen === -1 ? steps.length : firstOpen;
}

export function ReturnTracker({
  done,
  who,
  what,
  testId,
}: {
  done: number;
  who: string;
  what: string;
  testId: string;
}) {
  return (
    <div className={own.tracker} data-testid={testId}>
      <ol className={own.steps} aria-label={`Return to home region, ${done} of ${STEPS.length} steps done`}>
        {STEPS.map((label, index) => {
          const state = index < done ? "done" : index === done ? "now" : undefined;
          return (
            <li key={label} className={own.step} data-state={state}>
              <span className={own.dot} aria-hidden="true">
                {state === "done" ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              <span className={own.label}>
                {label}
                {state === "done" ? <span className="sr-only">, done</span> : null}
                {state === "now" ? <span className="sr-only">, next</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={own.next}>
        <b>Next</b>
        <span>
          {who} {what}
        </span>
      </p>
    </div>
  );
}
