"use client";

// Item 18, "Left the ward, waiting for transport": the ward board's compact list of people who have
// left the ward (their bed is already Ready) but are still on site waiting to be collected. Each
// stays here until "Collected", so nobody drops off every list while still in the building.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { WaitingForTransportEntry } from "@/components/ward-management/ward-left-ward";
import styles from "./board.module.css";

export function WardBoardTransportWait({
  entries,
  nameFor,
  now,
  onCollected,
}: {
  entries: readonly WaitingForTransportEntry[];
  nameFor: (admissionId: string) => string;
  now: Instant;
  onCollected: (entry: WaitingForTransportEntry, who: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section
      className={`${styles.workBand} ${styles.workZone}`}
      aria-labelledby="ward-board-transport-wait-heading"
      data-testid="ward-board-transport-wait"
    >
      <div className={styles.workBandFold}>
        <div className={styles.transportWaitHead}>
          <h2 id="ward-board-transport-wait-heading" className={styles.workBandTitle}>
            Waiting for transport
          </h2>
          <span className={styles.workBandDigest}>
            {entries.length === 1 ? "1 person has" : `${entries.length} people have`} left the ward. Their bed is ready.
          </span>
        </div>
        <div className={styles.shiftGrid} data-expanded="true">
          {entries.map((entry) => {
            const who = nameFor(entry.admissionId);
            return (
              <div
                key={entry.admissionId}
                className={styles.shiftTile}
                data-testid={`ward-board-transport-wait-${entry.admissionId}`}
              >
                <div className={styles.shiftTop}>
                  <span className={styles.shiftBedLink}>{who}</span>
                  <span className={styles.shiftTag}>Left the ward</span>
                </div>
                <span className={styles.shiftSub}>Waiting since {formatInstantWithDay(entry.since, now)}.</span>
                <div className={styles.shiftRowActs}>
                  <button
                    type="button"
                    className={styles.shiftCtl}
                    aria-label={`Collected: ${who}`}
                    onClick={() => onCollected(entry, who)}
                  >
                    Collected
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
