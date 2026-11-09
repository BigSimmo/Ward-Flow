import type { ReactNode } from "react";

import { Badge, SrOnly } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { TRANSPORT_DELAY_LABEL, type TransportDelay } from "@/components/ward-management/transport/transport-delay";
import { OFFICER_LEG_STEPS, type OfficerLeg } from "./officer-screen-helpers";
import styles from "./officer.module.css";

/**
 * The Jobs table's Stage cell: the four-step tracker and stage name, the time in this stage with
 * when it was booked (feature 25), and a Delayed tag with why for screen readers. Split from
 * `officer-screen.tsx` (its line cap). A booking with no recorded time shows only the stage time.
 */
export function OfficerStageCell({
  movementId,
  leg,
  stepStatusText,
  stageTime,
  bookedAt,
  now,
  delay,
  children,
}: {
  movementId: string;
  leg: OfficerLeg;
  stepStatusText: string;
  /** Time in this stage, already worded ("16m"); undefined when not recorded. */
  stageTime: string | undefined;
  bookedAt: Instant | undefined;
  now: Instant;
  delay: TransportDelay | null;
  /** Anything that folds in under the stage, such as the Forms note while the job panel is open. */
  children?: ReactNode;
}) {
  const legIndex = OFFICER_LEG_STEPS.indexOf(leg);
  return (
    <span className={styles.stageCell}>
      <span
        className={styles.stepper}
        role="img"
        aria-label={`Transport stage: ${leg}, ${stepStatusText}`}
        data-testid={`ward-officer-stepper-${movementId}`}
      >
        {OFFICER_LEG_STEPS.map((stepName, index) => (
          <span
            key={stepName}
            className={styles.stageDot}
            data-s={index < legIndex ? "done" : index === legIndex ? "now" : "todo"}
          />
        ))}
      </span>
      <p className={styles.stageLine}>
        <strong>{leg}</strong>
        <SrOnly>, {stepStatusText}</SrOnly>
      </p>
      {stageTime !== undefined || bookedAt !== undefined ? (
        <span className={styles.stageFor} data-testid={`ward-officer-booked-${movementId}`}>
          {stageTime}
          {bookedAt !== undefined ? (
            <span className={styles.stageBookedAt}>
              <span className={styles.stageBooked}>Booked </span>
              {formatInstantWithDay(bookedAt, now)}
            </span>
          ) : null}
        </span>
      ) : null}
      {delay ? (
        <span className={styles.stageDelayed} data-testid={`ward-officer-delayed-${movementId}`}>
          <Badge tone="warning" size="sm" title={TRANSPORT_DELAY_LABEL[delay]}>
            Delayed
          </Badge>
          <SrOnly>: {TRANSPORT_DELAY_LABEL[delay]}</SrOnly>
        </span>
      ) : null}
      {children}
    </span>
  );
}
