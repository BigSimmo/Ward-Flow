import { BedDouble, ShieldCheck, Truck } from "lucide-react";
import type { Movement } from "../ward-model";
import { clock, dur, STAGES } from "./patient-now-records";
import styles from "./patient-tracker-facts.module.css";

/** Compact operational context for the persistent patient tracker. No workflow state is copied. */
export function PatientTrackerFacts({
  movement,
  now,
  bedState,
  destination,
  onCoordinate,
}: {
  movement: Movement;
  now: number;
  bedState?: string;
  destination?: string;
  onCoordinate: () => void;
}) {
  const activeJob = movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
  const remaining = movement.pullExpiresAt === undefined ? undefined : movement.pullExpiresAt - now;
  const index = STAGES.findIndex((s) => s.id === movement.stage);
  const recent = movement.stageChanges.at(-1);
  return (
    <div className={styles.facts} data-patient-tracker-facts>
      <div className={styles.progress} role="img" aria-label={`Current stage ${index + 1} of 7`}>
        {STAGES.map((s) => (
          <span
            key={s.id}
            data-state={
              s.id === movement.stage
                ? "current"
                : movement.stageChanges.some((c) => c.to === s.id)
                  ? "recorded"
                  : "pending"
            }
          />
        ))}
      </div>
      <div className={styles.destination}>
        <span>DESTINATION</span>
        <strong>{destination ?? "Under review"}</strong>
      </div>
      <div className={styles.tile} data-attention={bedState === "pulled" && remaining !== undefined && remaining <= 0}>
        <BedDouble size={16} aria-hidden="true" />
        <div>
          <span>Bed reservation</span>
          <strong>{bedState === "pulled" ? "Bed held" : bedState === "occupied" ? "Occupied" : "No bed held"}</strong>
          <small>
            {bedState === "pulled" && remaining !== undefined
              ? remaining <= 0
                ? `Expired ${dur(-remaining)} ago`
                : `${dur(remaining)} remaining`
              : "No active reservation countdown"}
          </small>
        </div>
      </div>
      <div className={styles.tile}>
        <Truck size={16} aria-hidden="true" />
        <div>
          <span>Transport</span>
          <strong>
            {activeJob
              ? activeJob.collectedAt !== undefined
                ? "Patient collected"
                : "Booking recorded"
              : movement.transportNeed?.needed === false
                ? "Not required"
                : "No active booking"}
          </strong>
          <small>
            {activeJob
              ? `${activeJob.cadNumber ?? "CAD not recorded"}${activeJob.estimatedAt !== undefined ? ` · ETA ${clock(activeJob.estimatedAt)}` : ""}`
              : "Check dispatch in Now"}
          </small>
        </div>
      </div>
      <div className={styles.tile}>
        <ShieldCheck size={16} aria-hidden="true" />
        <div>
          <span>Medical clearance</span>
          <strong>
            {movement.medicalClearance
              ? movement.medicalClearance.cleared
                ? "Clearance recorded"
                : "Not cleared"
              : "Not assessed"}
          </strong>
          <small>
            {movement.medicalClearance
              ? `Recorded ${clock(movement.medicalClearance.at)} AWST`
              : "No sign-off recorded"}
          </small>
        </div>
      </div>
      <button type="button" onClick={onCoordinate}>
        Placement ↗
      </button>
      <p>{recent ? `Last stage update ${clock(recent.at)} · ${recent.by}` : "No stage transition recorded"}</p>
    </div>
  );
}
