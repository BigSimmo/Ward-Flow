"use client";

// Wave 4 (D-191, notes 6, F-56 part, A9-18 c): the ward's decline reasons as kit choice rows, not
// 13 px browser radios. 36 px rows in two columns on a desktop, 40 px with a 48 px tap cover in one
// column on a phone. Nothing is chosen when the form opens. Until a reason is chosen, Confirm decline
// is "not yet": it stays, dashed, with the lock line "Choose a reason first". The reason list and its
// wording are unchanged (D-78).

import type { FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button, Radio } from "@/components/wf";
import { MOVEMENT_DECLINE_REASONS, type DeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { canSubmitDecline, DECLINE_SUBMIT_UNAVAILABLE_REASON } from "./ward-home-tab-model";
import styles from "./ward-decline-reasons.module.css";

/** The lock line under a "not yet" Confirm decline (shared parts spec 6). */
export const DECLINE_LOCK_LINE = "Choose a reason first";

export function WardDeclineReasons({
  movementId,
  declineReason,
  onReason,
  onSubmit,
  className,
}: {
  movementId: string;
  declineReason: DeclineReason | "" | undefined;
  onReason: (reason: DeclineReason) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  const ready = canSubmitDecline(declineReason);
  return (
    <form onSubmit={onSubmit} data-testid={`ward-decline-form-${movementId}`} className={className}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Decline reason for this patient</legend>
        <div className={styles.choices}>
          {MOVEMENT_DECLINE_REASONS.map((reason) => (
            <Radio
              key={reason}
              className={styles.choice}
              name={`decline-reason-${movementId}`}
              value={reason}
              checked={declineReason === reason}
              onChange={() => {
                onReason(reason);
              }}
              label={DECLINE_REASON_LABELS[reason]}
            />
          ))}
        </div>
      </fieldset>
      <div className={styles.foot}>
        <span className={ready ? undefined : styles.notYet}>
          <Button
            variant="sec"
            size="md"
            data-placement-action
            disabledReason={ready ? undefined : DECLINE_SUBMIT_UNAVAILABLE_REASON}
            // "page": the lock line below already draws the reason, so no second touch copy (check B4).
            reasonDisplay="page"
            type="submit"
            onClick={(event) => {
              if (!ready) event.preventDefault();
            }}
          >
            Confirm decline
          </Button>
          {ready ? null : (
            <span className={styles.lock} aria-hidden="true">
              <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
              {DECLINE_LOCK_LINE}
            </span>
          )}
        </span>
        {ready ? null : (
          <span id={`ward-decline-submit-reason-${movementId}`} className="sr-only">
            {DECLINE_SUBMIT_UNAVAILABLE_REASON}
          </span>
        )}
      </div>
    </form>
  );
}
