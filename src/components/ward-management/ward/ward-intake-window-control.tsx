"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { intakeWindowLine, tonightIntakeWindow } from "../capacity/ward-intake-window";
import type { Instant } from "../ward-clock";
import { useRouteRole } from "../ward-role-gate";
import type { Unit } from "../ward-model";
import styles from "./ward-intake-window-control.module.css";

// The editor arrives as its own chunk when first opened (script budget, 11 Nov 2026).
const WardIntakeWindowDialog = dynamic(
  () => import("./ward-intake-window-dialog").then((m) => m.WardIntakeWindowDialog),
  { ssr: false },
);

/**
 * Feature item 13 (10 Nov 2026): "Tonight: admit 21:00 to 02:00" on the ward hero, with an Edit that
 * opens two typed times. Information only: it never blocks a referral or orders wards. Nothing is
 * pre-filled, and the line reads "Tonight: not set" again after the 07:00 day start.
 *
 * The route's desk acts: the ward for itself, or the coordinator. Any other desk reads the line only.
 */
export function WardIntakeWindowControl({ unit, now }: { unit: Unit; now: Instant }) {
  const role = useRouteRole();
  const tonight = tonightIntakeWindow(unit, now);
  const mayEdit = role === "ward" || role === "coordinator";
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  return (
    <span className={styles.row} data-testid="ward-intake-window">
      <span data-testid="ward-intake-window-line">{intakeWindowLine(tonight)}</span>
      {mayEdit ? (
        <>
          {" · "}
          <button
            type="button"
            className={styles.trigger}
            aria-label={`Edit tonight's intake hours for ${unit.name}`}
            onClick={() => {
              setRefused(null);
              setOpen(true);
            }}
            data-testid="ward-intake-window-edit"
          >
            Edit
          </button>
        </>
      ) : null}
      {refused ? (
        <span className={styles.refused} role="alert">
          Not saved. {refused}
        </span>
      ) : null}
      {open && mayEdit ? (
        <WardIntakeWindowDialog
          unit={unit}
          hasTonight={tonight !== null}
          role={role}
          onClose={() => setOpen(false)}
          onRefused={setRefused}
        />
      ) : null}
    </span>
  );
}
