"use client";

import { useId, useState } from "react";
import { Button } from "@/components/wf";
import { ON_BEHALF_REASONS, type OnBehalfReasonId } from "./ward-on-behalf-reason";
import styles from "./on-behalf-reason-form.module.css";

/**
 * D-80 item 17: before a bed coordinator opens a ward's clinical record (a stay's discharge and care
 * record), it says why it is opening it on the ward's behalf. One choice from a closed list, nothing
 * typed; the opening and its reason go into the record access log that Governance reviews.
 */
export function OnBehalfReasonForm({
  onOpen,
  testId = "ward-on-behalf-reason",
}: {
  onOpen: (reason: OnBehalfReasonId) => void;
  testId?: string;
}) {
  const [reason, setReason] = useState<OnBehalfReasonId | null>(null);
  const name = useId();
  return (
    <section className={styles.form} data-testid={testId} aria-label="Reason for opening this record">
      <p>This is the ward&apos;s clinical record. Opening it is logged with your reason for Governance to review.</p>
      <fieldset>
        <legend>Why are you opening it on the ward&apos;s behalf?</legend>
        {ON_BEHALF_REASONS.map((option) => (
          <label key={option.id} className={styles.reason}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={reason === option.id}
              onChange={() => setReason(option.id)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div>
        <Button
          variant="pri"
          size="sm"
          disabled={reason === null}
          data-testid={`${testId}-open`}
          onClick={() => reason && onOpen(reason)}
        >
          Open record
        </Button>
      </div>
    </section>
  );
}
