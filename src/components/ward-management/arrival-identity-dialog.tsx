"use client";

import { Dialog } from "@/components/wf";

/**
 * Walk-through WT-11 (26 Oct 2026): Confirm arrival took one tap with no second identifier, unlike
 * a departure, which checks the name and UMRN first (DA-08). The ward now confirms who is in front
 * of them, and where, before the arrival is recorded. Cancel leaves everything as it was.
 */
export function ArrivalIdentityDialog({
  open,
  who,
  identity,
  wardName,
  onConfirm,
  onClose,
  testId = "ward-arrival-identity",
}: {
  open: boolean;
  /** The person's name, for the title. */
  who: string;
  /** Name and UMRN, as `patientIdentityLine` gives them. */
  identity: string;
  wardName: string;
  onConfirm: () => void;
  onClose: () => void;
  testId?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={`Confirm arrival for ${who}?`}
      description={`Check the person in front of you before recording their arrival at ${wardName}.`}
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{ label: "Confirm arrival", onAction: onConfirm }}
      data-testid={testId}
    >
      <p data-testid={`${testId}-check`}>Check: {identity}</p>
    </Dialog>
  );
}
