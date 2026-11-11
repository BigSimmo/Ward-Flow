import { Badge } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { perthDayLabel } from "@/components/ward-management/ward-clock";
import { referralCardFlags, type CardReferral } from "./patient-referral-safety";
import { interpreterLanguageRequired } from "./patient-interpreter";
import styles from "./card-safety-tags.module.css";

/**
 * Small worded tags on the ED board and a ward's bed request (Josh, 9 Nov 2026, care plans and safety
 * flags thread: defaults approved): the referral's risk flags with the referral's date, read only
 * through `referralCardFlags` (H10), and "<Language> interpreter" from the patient record. Neutral
 * tags: none of these is an act-now signal. Renders nothing when there is nothing to show.
 */
export function CardSafetyTags({
  movement,
  referrals,
  patient,
  dayZero,
  testId,
}: {
  movement: Movement;
  /** The desk's scoped referrals: full records, or a ward's own inbox entries (FD-23). */
  referrals: readonly CardReferral[];
  patient: Pick<Patient, "interpreterLanguage"> | undefined;
  /** Without a day zero the referral date cannot be shown, so neither are its flags (H10). */
  dayZero: Date | undefined;
  testId?: string;
}) {
  const flags = dayZero ? referralCardFlags(movement, referrals) : undefined;
  const language = interpreterLanguageRequired(patient);
  if (!flags && !language) return null;
  return (
    <span className={styles.tags} data-testid={testId}>
      {flags && dayZero ? (
        // One wrapped line, not a stack of chips: the row stays short on a busy board (9 Nov 2026 review).
        <span className={styles.flags}>
          <span className={styles.when}>
            Referral {perthDayLabel(flags.raisedAt, dayZero).replace(/^[A-Za-z]{3} /u, "")}
          </span>
          {" · "}
          {flags.labels.join(", ")}
        </span>
      ) : null}
      {language ? <Badge size="sm">{language} interpreter</Badge> : null}
    </span>
  );
}
