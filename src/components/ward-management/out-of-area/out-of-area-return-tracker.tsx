"use client";

/**
 * OA1 (3 Nov 2026): Out of area is a return tracker. The plan opens with where this person's return
 * has got to, four steps, and the one thing that happens next, so the panel reads as progress
 * towards home rather than a ledger entry.
 */
import { Check } from "lucide-react";

import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";

import type { RepatDraft } from "./out-of-area-model";
import own from "./out-of-area-return-tracker.module.css";

const STEPS = ["Receiving bed", "Ward agreed", "Transport booked", "Placed home"] as const;

/** How many of the four steps are done, read only from what has been recorded or drafted. */
export function returnStepsDone(
  draft: RepatDraft,
  record: RepatriationRecord | undefined,
  returnMovementId: string | undefined,
): number {
  if (returnMovementId !== undefined && record?.receivingWardAgreed) return 4;
  if (record) return record.receivingWardAgreed ? 3 : 1;
  if (draft.receivingWardAgreed === true && draft.homeHospital) return 2;
  return draft.homeHospital ? 1 : 0;
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
