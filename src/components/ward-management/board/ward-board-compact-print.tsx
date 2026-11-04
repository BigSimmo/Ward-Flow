"use client";

import { useEffect, useRef } from "react";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { currentPerthPrintMoment, formatSheetMoment } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import type { Occupant, Tile } from "./ward-board-model";
import styles from "./ward-board-compact-print.module.css";

/** The board summary is separate from its detailed on-screen shift brief. Nothing is truncated. */
export function WardBoardCompactPrint({
  unit,
  tiles,
  occupants,
  admissions,
  nameFor,
  dayZero,
}: {
  unit: Unit;
  tiles: readonly Tile[];
  occupants: readonly Occupant[];
  admissions: readonly Admission[];
  nameFor: (admissionId: string | undefined) => string;
  dayZero: Date;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Read once per print, then use the same actual moment on every page. beforeprint also runs
    // for the browser's own Print command; the simulation's day zero is never the print stamp.
    const stamp = () => {
      const text = currentPerthPrintMoment();
      root.current?.querySelectorAll<HTMLElement>("[data-ward-board-print-time]").forEach((node) => {
        node.textContent = text;
      });
    };
    stamp();
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  const people = new Map(occupants.map((occupant) => [occupant.key, occupant]));
  const records = new Map(admissions.map((admission) => [admission.id, admission]));
  const pages = Array.from({ length: Math.max(1, Math.ceil(tiles.length / 30)) }, (_, index) =>
    tiles.slice(index * 30, (index + 1) * 30),
  );
  return (
    <div className={styles.output} data-ward-board-print ref={root}>
      {pages.map((page, index) => (
        <section
          className={styles.page}
          key={index}
          data-testid="ward-board-print-page"
          aria-label={`${unit.name} bed board print, page ${index + 1}`}
        >
          <div className={styles.head}>
            <h2>{unit.name} · Bed board</h2>
            <p>
              Printed{" "}
              <span data-ward-board-print-time data-testid="ward-board-print-time">
                when prepared
              </span>
            </p>
            <p>
              {tiles.length} recorded beds · Page {index + 1} of {pages.length}. Check the live board before acting.
              Synthetic data.
            </p>
          </div>
          <ul className={styles.beds} aria-label="All recorded beds">
            {page.map((tile) => {
              const occupant = people.get(tile.key);
              const admission = records.get(tile.key);
              const hasPerson = tile.kind === "occupied" || tile.kind === "waiting";
              const expected = admission?.expectedDischargeAt;
              return (
                <li className={styles.bed} key={tile.key} data-testid="ward-board-print-bed">
                  {hasPerson && (
                    <p className={styles.name}>
                      {admission?.bedNumber !== undefined ? `Bed ${admission.bedNumber} · ` : ""}
                      {nameFor(tile.key)}
                    </p>
                  )}
                  <p>
                    {tile.kind === "occupied"
                      ? `${tile.days} ${tile.days === 1 ? "day" : "days"} in bed`
                      : tile.kind === "waiting"
                        ? "Pulled; not arrived"
                        : tile.kind === "blocked"
                          ? "Out of service"
                          : tile.kind === "closed"
                            ? "Closed"
                            : "Ready"}
                  </p>
                  {hasPerson && (
                    <>
                      <p>
                        {typeof expected === "number" && Number.isFinite(expected)
                          ? `Expected ${formatSheetMoment(expected, dayZero, { includeYearAndZone: true })}`
                          : "No expected date set"}
                        {occupant?.confirmed ? " · Confirmed" : ""}
                      </p>
                      {occupant?.pastDate && <p>Past expected date</p>}
                      {occupant?.awayAtEdHours != null && <p>At an ED; bed still theirs</p>}
                      {occupant?.blockReason && <p>Held up: {occupant.blockReason}</p>}
                      {occupant?.dischargeBarrier && <p>Discharge barrier: {occupant.dischargeBarrier}</p>}
                      {occupant?.stepDownCandidate && <p>Flagged for step-down</p>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>Bed board summary. Detailed plans and the shift brief remain on the live board.</p>
        </section>
      ))}
    </div>
  );
}
