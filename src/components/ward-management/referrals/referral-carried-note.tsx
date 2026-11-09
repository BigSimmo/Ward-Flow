import styles from "./referral-carried-note.module.css";

/**
 * Feature 39 (9 Nov 2026): "From last referral 3 Nov. Check it." beside a value the form carried
 * over from the person's current stay or last referral. Drawn only while the field still holds
 * that value; editing the field removes it.
 */
export function CarriedNote({ note, field }: { note: string | null | undefined; field: string }) {
  if (!note) return null;
  return (
    <p className={styles.note} data-testid={`ward-referral-carried-${field}`}>
      {note}. Check it.
    </p>
  );
}
