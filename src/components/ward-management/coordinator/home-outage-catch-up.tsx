"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardHead, ShowMoreRow, buttonClass, foldHidden, foldLimit } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { wardCatchUp, type WardCatchUp } from "@/components/ward-management/ward-outage-catch-up";

import styles from "./home-outage-catch-up.module.css";

/** Where the coordinator records an outage, and changes its times. */
export const DOWNTIME_PACK_HREF = "/ward-flow/reports/downtime";

/** Wards listed before "Show more". */
const WARDS_FIRST = 5;

/**
 * CATCH-UP AFTER THE OUTAGE (Batch 4 item 25, Josh approved the drawing 11 Nov 2026, D-142): the
 * coordinator's card first in Home's work column. "Down 06:40 to 09:05 · 6 of 21 wards caught up",
 * then each ward still to confirm with its last pack time before the outage ended. A ward counts as
 * caught up only on its own Beds still correct. Nothing renders until an outage is recorded, and it
 * goes once every ward has caught up. Read only: it changes no bed figure.
 */
export function HomeOutageCatchUp({ now }: { now: Instant }) {
  const role = useRouteRole();
  const read = useOptionalWardFlowSelect("units", "outageWindows", "downtimePackPrints");
  const [open, setOpen] = useState(false);
  if (role !== "coordinator" || read === null) return null;
  const all = read.units
    .map((unit) => ({ unit, catchUp: wardCatchUp(unit, read, now) }))
    .filter((row): row is { unit: (typeof read.units)[number]; catchUp: WardCatchUp } => row.catchUp !== null);
  const waiting = all.filter((row) => !row.catchUp.caughtUp);
  if (all.length === 0 || waiting.length === 0) return null;
  const { outage } = all[0]!.catchUp;
  const caughtUp = all.length - waiting.length;
  const shown = open ? waiting.length : foldLimit(waiting.length, WARDS_FIRST);
  const hidden = foldHidden(waiting.length, WARDS_FIRST);
  return (
    <Card aria-labelledby="home-catch-up-title" className={styles.card} data-testid="home-outage-catch-up">
      <CardHead
        id="home-catch-up-title"
        title="Catch-up after the outage"
        meta={
          <span data-testid="home-catch-up-summary">
            Down {formatInstantWithDay(outage.from, now)} to {formatInstantWithDay(outage.to, now)} ·{" "}
            <b>
              {caughtUp} of {all.length}
            </b>{" "}
            wards caught up
          </span>
        }
        action={
          <Link href={DOWNTIME_PACK_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
            Change times
          </Link>
        }
      />
      <ul className={styles.rows} aria-label="Wards still to confirm">
        {waiting.slice(0, shown).map(({ unit, catchUp }) => (
          <li key={unit.id} className={styles.row} data-testid={`home-catch-up-ward-${unit.id}`}>
            <span className={styles.main}>
              <span className={styles.name}>{unit.name}</span>
              <span className={styles.detail}>Beds not confirmed since the outage</span>
            </span>
            <span className={styles.pack}>
              {catchUp.lastPackPrintedAt === null
                ? "No pack printed"
                : `Pack ${formatInstantWithDay(catchUp.lastPackPrintedAt, now)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.foot}>A ward is caught up once it taps Beds still correct.</p>
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setOpen((was) => !was)} expanded={open}>
          {open ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
    </Card>
  );
}
