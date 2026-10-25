import styles from "./officer.module.css";

/**
 * Audit 24-1 decision 5 (Josh, 25 Oct 2026): the job list keeps its "Next action" order, since it
 * lists transport jobs, not the ED queue, and says so while that sort is chosen.
 */
export function OfficerOrderNote({ shown }: { shown: boolean }) {
  return shown ? (
    <p className={styles.panelNote} data-testid="ward-officer-order-note">
      Next action order: late jobs first, then forms still to upload, then the jobs furthest along.
    </p>
  ) : null;
}
