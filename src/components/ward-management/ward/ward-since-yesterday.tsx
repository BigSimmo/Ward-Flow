"use client";

// Fold the Bed board into Ward (Josh's approved version, item 13; design plan 26 Nov 2026): the
// board's "Since yesterday" counts, in the Updates chip's sheet under the since-you-last-looked
// review. Same call as the board (`sinceYesterday`), given this ward's stays with departures kept in.

import { sinceYesterday } from "@/components/ward-management/ward-board-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { FactGrid, GroupHead } from "@/components/wf";
import styles from "./ward-home-tab.module.css";

export function WardSinceYesterday({ unitId }: { unitId: string }) {
  const { admissions } = useWardFlowSelect("admissions");
  const now = useWardFlowClock();
  const movement = sinceYesterday(
    admissions.filter((admission) => admission.unitId === unitId),
    now,
  );
  return (
    <section
      className={styles.sinceYesterday}
      aria-labelledby="ward-since-yesterday"
      data-testid="ward-since-yesterday"
    >
      <h3 id="ward-since-yesterday" className="sr-only">
        Since yesterday
      </h3>
      <GroupHead title="Since yesterday" meta="the last 24 hours" />
      <FactGrid
        className={styles.sinceFacts}
        facts={[
          { id: "left", label: "Left this ward", value: movement.discharged },
          { id: "given", label: `Bed${movement.pulled === 1 ? "" : "s"} given away`, value: movement.pulled },
          {
            id: "dates",
            label: `Expected date${movement.datesMoved === 1 ? "" : "s"} moved`,
            value: movement.datesMoved,
          },
        ]}
      />
      {/* `discharged` counts every destination; it is never a count of beds returned to the network. */}
      <p className={styles.sinceNote}>Includes transfers to other psychiatric wards.</p>
    </section>
  );
}
