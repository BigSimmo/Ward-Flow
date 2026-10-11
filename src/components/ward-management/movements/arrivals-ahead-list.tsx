"use client";

import { useState } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { MovementHorizonEvent, MovementHorizonLane } from "./movements-derivations";
import styles from "./arrivals-ahead-list.module.css";

/** The windows the timeline already offers, read as "the next N hours" (v10 phone). */
const WINDOWS = [12, 24, 48] as const;
type Window = (typeof WINDOWS)[number];

/** "Pallowmere, Orla" or "Orla Pallowmere" both read as "Pallowmere". */
function surname(name: string): string {
  if (name.includes(",")) return name.split(",")[0].trim();
  return name.trim().split(/\s+/).pop() ?? name;
}

/** Timed arrivals first, by their recorded planned time; untimed ones after, in lane order. */
function byPlannedTime(a: MovementHorizonEvent, b: MovementHorizonEvent): number {
  if (a.plannedAt === undefined) return b.plannedAt === undefined ? 0 : 1;
  if (b.plannedAt === undefined) return -1;
  return a.plannedAt - b.plannedAt;
}

/**
 * v10 phone: Arrivals ahead as a list — each receiving ward, who is due in and when, soonest first
 * — read from the same lanes the timeline draws. Only a recorded planned move time is shown as a
 * time: an accepted move with no plan, or one already on the road, sits at the timeline's start
 * because nothing places it, so it reads "time not recorded" and is never ranked as soonest.
 */
export function ArrivalsAheadList({ lanes, now }: { lanes: MovementHorizonLane[]; now: Instant }) {
  const [hours, setHours] = useState<Window>(24);
  const rows = lanes
    .map((lane) => ({
      lane,
      events: lane.events.filter((event) => event.startH <= hours).sort(byPlannedTime),
    }))
    .filter((row) => row.events.length > 0)
    .sort((a, b) => byPlannedTime(a.events[0], b.events[0]));

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
                        `${surname(event.patientName ?? event.title)} ${
                          event.plannedAt !== undefined
                            ? formatInstantWithDay(event.plannedAt, now)
                            : "time not recorded"
                        }`,
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
