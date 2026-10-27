"use client";

/*
 * CAD to follow (Josh, 27 Oct 2026). A dispatched job booked before the provider gave its CAD
 * number shows a "CAD to follow" warning wherever the CAD is shown, and this is where the number
 * is added once it comes, read off the call. Same placeholder rule as the booking (HAZ-03). The
 * typed number is kept until the save is accepted.
 */
import { useState } from "react";
import { Button, Field, StatusGlyph, TextInput } from "@/components/wf";
import { CAD_TO_FOLLOW, cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-events";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { cadNumberSentence } from "@/components/ward-management/ward-transport-checks";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import styles from "./transport-booking-form.module.css";

export function TransportCadToFollow({
  movementId,
  role,
  actingUnitId,
  unavailable,
  testId,
}: {
  movementId: string;
  /** The desk adding the number, as it would book. */
  role: WardFlowRole;
  /** A ward names itself as the sending ward, as it does when booking. */
  actingUnitId?: string;
  /** Why this desk cannot add the number here, shown in place of the box. */
  unavailable?: string;
  testId: string;
}) {
  const raise = useWardRaise(role);
  const save = useWardFormSave(`${movementId}:cad-to-follow`);
  const [cad, setCad] = useState("");
  const problem = cad.trim() ? cadNumberProblem(cad) : undefined;
  const blocked = save.pending
    ? "Saving"
    : cad.trim().length === 0
      ? "Type the CAD number from the provider first"
      : problem
        ? cadNumberSentence(problem)
        : undefined;
  return (
    <div className={styles.form} data-testid={testId}>
      <p className={styles.warn} data-testid={`${testId}-warning`}>
        <StatusGlyph tone="warning" size={9} />
        {CAD_TO_FOLLOW}. Add it when the provider gives it.
      </p>
      {unavailable ? (
        <p className={styles.note}>{unavailable}</p>
      ) : (
        <>
          <Field label="CAD transport number" error={problem ? cadNumberSentence(problem) : undefined}>
            <TextInput
              data-testid={`${testId}-input`}
              className={styles.mono}
              autoComplete="off"
              placeholder="CAD number"
              disabled={save.pending}
              value={cad}
              onChange={(event) => setCad(event.target.value)}
            />
          </Field>
          <Button
            size="sm"
            variant="sec"
            data-testid={`${testId}-save`}
            disabledReason={blocked}
            onClick={() =>
              save.submit(
                () =>
                  raise("RECORD_TRANSPORT_CAD", {
                    movementId,
                    cadNumber: cad.trim(),
                    ...(actingUnitId ? { actingUnitId } : {}),
                  }),
                () => setCad(""),
              )
            }
          >
            Add CAD number
          </Button>
          {save.error ? (
            <p className={styles.warn} role="alert">
              {save.error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
