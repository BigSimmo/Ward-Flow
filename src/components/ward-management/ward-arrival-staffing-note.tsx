import { Info } from "lucide-react";
import type { Movement } from "@/components/ward-management/ward-model";
import { arrivalStaffingPrompt, type CardReferral } from "./patients/patient-referral-safety";
import styles from "./patients/card-safety-tags.module.css";

/**
 * Feature 7, "Plan staff for an arrival" (D-117 item 3): one calm line on the receiving ward's
 * incoming card when the referral records aggression or absconding, so the nurse in charge can
 * arrange staff before the person arrives. Read through `arrivalStaffingPrompt` (H10), from the
 * movement's referral only; nothing is written to the patient record (R-2026-09-04-A). Neutral
 * words and glyph, like the safety tags beside it: a planning note, not an alarm.
 */
export function ArrivalStaffingNote({
  movement,
  referrals,
  testId,
}: {
  movement: Movement;
  referrals: readonly CardReferral[];
  /** Defaults to `ward-answer-arrival-staffing-<movement id>`. */
  testId?: string;
}) {
  const prompt = arrivalStaffingPrompt(movement, referrals);
  if (!prompt) return null;
  return (
    <p className={styles.arrivalNote} data-testid={testId ?? `ward-answer-arrival-staffing-${movement.id}`}>
      <Info size={14} strokeWidth={1.75} aria-hidden="true" className={styles.arrivalGlyph} />
      <span>
        <strong>Plan staffing for this arrival</strong>
        {" · "}
        Referral records {prompt.reasons.join(" and ")}
      </span>
    </p>
  );
}
