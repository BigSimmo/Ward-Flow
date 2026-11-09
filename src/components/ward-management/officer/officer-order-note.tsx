import { Button, SrOnly } from "@/components/wf";
import styles from "./officer.module.css";

/**
 * Audit 24-1 decision 5 (Josh, 25 Oct 2026): the job list keeps its "Next action" order, since it
 * lists transport jobs, not the ED queue, and says so while that sort is chosen.
 */
export function OfficerOrderNote({ shown }: { shown: boolean }) {
  return shown ? (
    <p className={styles.panelNote} data-testid="ward-officer-order-note">
      Late jobs first, then forms to upload, then furthest along.
    </p>
  ) : null;
}

/**
 * Feature 25 (Josh, 9 Nov 2026): the Delayed filter hides jobs, so the list says so and clears in
 * one press. With none delayed it says that instead of drawing an empty table. The announced count
 * carries its marker in its own run ("synthetic rows"), read by screen readers only.
 */
export function OfficerDelayedNote({
  delayed,
  total,
  onShowAll,
}: {
  delayed: number;
  total: number;
  onShowAll: () => void;
}) {
  return (
    <p className={styles.highlightNote} role="status" data-testid="ward-officer-delayed-note">
      {delayed === 0 ? (
        "No job is delayed."
      ) : (
        <>
          Showing {delayed} delayed of {total} jobs<SrOnly> (synthetic rows)</SrOnly>.
        </>
      )}{" "}
      <Button variant="ghost" size="sm" onClick={onShowAll}>
        Show all
      </Button>
    </p>
  );
}
