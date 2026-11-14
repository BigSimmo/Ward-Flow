"use client";

/**
 * D-226 (Josh, 14 Nov 2026): the refusal line for a continuation-type form after a Form 3E, and,
 * for the coordinator only, the listed reason that records it anyway. Shared by the Forms page and
 * the movement's continuation action. Synthetic data only.
 */
import { useId } from "react";

import { Radio } from "@/components/wf";
import {
  AFTER_3E_REASONS,
  AFTER_3E_REFUSAL,
  isAfter3EReason,
  type After3EReason,
} from "@/components/ward-management/ward-legal-after-3e";

export function After3EReasonField({
  coordinator,
  value,
  onChange,
  testId,
}: {
  /** Only the coordinator may pick a reason; every other desk sees the refusal and is told who can. */
  coordinator: boolean;
  value: After3EReason | "";
  onChange: (reason: After3EReason | "") => void;
  testId: string;
}) {
  const name = useId();
  return (
    <div data-testid={testId}>
      <p role="status">
        {AFTER_3E_REFUSAL}
        {coordinator ? null : " The coordinator can record it with a reason."}
      </p>
      {coordinator ? (
        <fieldset>
          <legend>Reason to record anyway</legend>
          {Object.entries(AFTER_3E_REASONS).map(([key, words]) => (
            <Radio
              key={key}
              name={name}
              value={key}
              label={words}
              checked={value === key}
              onChange={() => onChange(isAfter3EReason(key) ? key : "")}
            />
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
