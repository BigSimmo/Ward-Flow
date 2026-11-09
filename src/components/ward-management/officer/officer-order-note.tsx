import { useState } from "react";
import { Button, FilterChip, SrOnly } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { transportDelay } from "@/components/ward-management/transport/transport-delay";
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
function OfficerDelayedNote({ delayed, total, onShowAll }: { delayed: number; total: number; onShowAll: () => void }) {
  return (
    <p className={styles.delayedNote} role="status" data-testid="ward-officer-delayed-note">
      {/* One inline run, so the hidden marker leaves no gap before the full stop. */}
      <span>
        {delayed === 0 ? (
          "No job is delayed."
        ) : (
          <>
            Showing {delayed} delayed of {total} jobs<SrOnly> (synthetic rows)</SrOnly>.
          </>
        )}
      </span>
      <Button variant="ghost" size="sm" onClick={onShowAll}>
        Show all
      </Button>
    </p>
  );
}

/**
 * Feature 25: the Delayed filter, its chip, the phone's own chip row (the phone hides the toolbar,
 * polish 9 Nov 2026) and the note that says jobs are hidden. `jobs` is the list to draw.
 */
export function useOfficerDelayedFilter(all: readonly Movement[], now: Instant, isPhone: boolean) {
  const [only, setOnly] = useState(false);
  const delayedJobs = all.filter((movement) => transportDelay(movement, now) !== null);
  const chip = (
    <FilterChip pressed={only} onPressedChange={setOnly} count={delayedJobs.length}>
      Delayed
    </FilterChip>
  );
  return {
    jobs: only ? delayedJobs : all,
    chip,
    phoneRow: isPhone && (only || delayedJobs.length > 0) ? <div className={styles.phoneFilters}>{chip}</div> : null,
    note: only ? (
      <OfficerDelayedNote delayed={delayedJobs.length} total={all.length} onShowAll={() => setOnly(false)} />
    ) : null,
  };
}
