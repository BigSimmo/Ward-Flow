"use client";

// Item 18, "Left the ward, waiting for transport": the ward board's compact list of people who have
// left the ward (their bed is already Ready) but are still on site waiting to be collected. Each
// stays here until "Collected", so nobody drops off every list while still in the building.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { LeavingDestination } from "@/components/ward-management/ward-admissions";
import { leftWardAllowedFor, type WaitingForTransportEntry } from "@/components/ward-management/ward-left-ward";
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
            {entries.length === 1 ? "1 person has" : `${entries.length} people have`} left the ward. Their bed was freed
            when they left.
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

/** Item 18: the confirm text when someone has left the ward and is still waiting for transport. */
export function TransportWaitConfirmText({ who, destination }: { who: string; destination?: string | null }) {
  return (
    <>
      Record that <strong>{who}</strong> has left the ward and is waiting for transport? This records their discharge
      and makes the bed ready now. They stay on the Waiting for transport list until collected.
      {destination ? (
        <span data-testid="ward-board-confirm-destination-text"> Where they are going: {destination}.</span>
      ) : null}
    </>
  );
}

/** The confirm dialog's title and button for a discharge, an ED transfer or item 18's left-the-ward step. */
function leavingConfirmWords(confirm: { kind: string; offerTransport?: boolean; awaitingTransport?: boolean }) {
  const leaving = confirm.kind === "leaving";
  return {
    title: confirm.offerTransport
      ? "Confirm left the ward"
      : leaving
        ? "Confirm discharge"
        : "Confirm emergency department transfer",
    action: confirm.awaitingTransport ? "Record left ward" : leaving ? "Record discharge" : "Record ED transfer",
  };
}

/**
 * Item 18: what the departure confirm asks about transport. It asks while the dialog's stay has
 * transport pending now, read from the live records (`pendingNow`), not only when it opened, so
 * transport another desk records as outstanding meanwhile is still asked about. Someone who did not
 * return is not on site, so it is never asked for them and no wait is recorded.
 */
export function transportConfirm(
  confirm: {
    kind: string;
    offerTransport?: boolean;
    awaitingTransport?: boolean;
    admissionId?: string;
    item?: { selectableKey?: string | null };
  } | null,
  destination: LeavingDestination | "",
  pendingNow: (admissionId?: string | null) => boolean,
) {
  const admissionId = confirm?.admissionId || confirm?.item?.selectableKey;
  const offers =
    confirm?.kind === "leaving" &&
    (destination === "" || leftWardAllowedFor(destination)) &&
    (confirm.offerTransport === true || pendingNow(admissionId));
  const awaiting = offers ? confirm?.awaitingTransport : undefined;
  return {
    offers,
    awaiting,
    unanswered: offers && awaiting === undefined,
    words: leavingConfirmWords({ kind: confirm?.kind ?? "", offerTransport: offers, awaitingTransport: awaiting }),
  };
}

/** Item 18: the Collected step's message and Undo, for the board's undoable departure runner. */
export function collectedStep(admissionId: string, actingUnitId: string, who: string) {
  return {
    success: `Collected: ${who} has gone.`,
    undo: (at: Instant) => ({
      type: "UNDO_DEPARTURE" as const,
      role: "ward" as const,
      now: at,
      admissionId,
      actingUnitId,
    }),
    undone: `Undone. ${who} is back on the Waiting for transport list.`,
  };
}
