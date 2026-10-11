"use client";

import { useState } from "react";

import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { MovementHorizonLane } from "./movements-derivations";
import styles from "./arrivals-ahead-list.module.css";

/** The windows the timeline already offers, read as "the next N hours" (v10 phone). */
const WINDOWS = [12, 24, 48] as const;
type Window = (typeof WINDOWS)[number];

/** "Pallowmere, Orla" or "Orla Pallowmere" both read as "Pallowmere". */
function surname(name: string): string {
  if (name.includes(",")) return name.split(",")[0].trim();
  return name.trim().split(/\s+/).pop() ?? name;
}

/**
 * v10 phone: Arrivals ahead as a list — each receiving ward, who is due in and when, soonest first
 * — read from the same lanes the timeline draws. Nothing here is computed beyond filtering those
 * lanes to the chosen window.
 */
export function ArrivalsAheadList({ lanes, now }: { lanes: MovementHorizonLane[]; now: Instant }) {
  const [hours, setHours] = useState<Window>(24);
  const rows = lanes
    .map((lane) => ({
      lane,
      events: lane.events.filter((event) => event.startH <= hours).sort((a, b) => a.startH - b.startH),
    }))
    .filter((row) => row.events.length > 0)
    .sort((a, b) => a.events[0].startH - b.events[0].startH);

  return (
    <div className={styles.arrivals} data-testid="movements-arrivals-list">
      <div className={styles.arrivalsSeg} role="group" aria-label="Arrivals window">
        {WINDOWS.map((window) => (
          <button key={window} type="button" aria-pressed={hours === window} onClick={() => setHours(window)}>
            Next {window}
            {"h"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={styles.arrivalsNone}>Nobody is due into a ward in this window.</p>
      ) : (
        <ul className={styles.arrivalsList}>
          {rows.map(({ lane, events }) => (
            <li key={lane.id} className={styles.arrivalsRow}>
              <span className={styles.arrivalsText}>
                <span className={styles.arrivalsWard}>{lane.name}</span>
                <span className={styles.arrivalsWho}>
                  {events
                    .map(
                      (event) =>
                        `${surname(event.patientName ?? event.title)} ${formatInstant(
                          (now + Math.round(event.startH * 60)) as Instant,
                        )}`,
                    )
                    .join(" · ")}
                </span>
              </span>
              <span className={styles.arrivalsCount}>{events.length}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
