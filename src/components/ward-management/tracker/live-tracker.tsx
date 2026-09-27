"use client";

/**
 * 🔴 **THIS COMPONENT IS UNREACHABLE, AND ITS TESTS WERE RETIRED ON 2026-09-06 — NOT LOST.**
 *
 * /transport redirects to /movements. Owner ruling 2026-09-06: the eleven replaced ward
 * screens are finished with. The tests that covered this file (`ward-tracker-leg-badge.dom.test.tsx`)
 * are `describe.skip`, and what each case asserted is written out in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md`.
 *
 * ⚠️ **THE MARKER EXISTS BECAUSE A COMPONENT WITH NO TESTS AND NO EXPLANATION READS AS AN
 * OVERSIGHT, AND THE NEXT PERSON WRITES NEW ONES.** They would pass, and they would cover
 * nothing a coordinator can open.
 *
 * **The component was deliberately NOT deleted.** Removing an exported symbol on a "nothing
 * imports it" basis is forbidden here (`docs/agents/dead-code-deletion.md`), and three defects
 * found that day were held in place BY unreachability — **an unreachable wrong screen is a fix,
 * not a delete.** If a route ever points here again, `tests/ward-component-reachability.test.ts`
 * goes red and names the declaration to remove; restore the cover from the record then.
 */

import Link from "next/link";

import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";

import { stampAgeText, trackerRowState, type TrackerLeg } from "./tracker-derivations";
import styles from "./live-tracker.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * Which visual treatment each leg's badge carries. A `Record` over the full `TrackerLeg` union,
 * not a chain of ternaries, so adding a leg is a compile error here rather than a badge that
 * silently inherits the default.
 *
 * Only one distinction is drawn — "Collected", the patient physically in the vehicle — and the
 * reasoning for drawing that one and no others is in `live-tracker.module.css` next to the class
 * itself. `Cancelled` keeps the danger treatment it already had. `Arrived` maps to the same
 * neutral badge as the pre-collection legs: an arrived movement is closed and `isOpen` keeps it
 * off this screen entirely, so there is no arrival state here to give a treatment to.
 */
const LEG_BADGE_CLASS: Record<TrackerLeg, string> = {
  Requested: styles.legBadge,
  Accepted: styles.legBadge,
  "En route": styles.legBadge,
  Collected: styles.legBadgeInVehicle,
  Arrived: styles.legBadge,
  Cancelled: styles.legBadgeCancelled,
};

/**
 * Task 10: the coordinator's live tracker (`/mockups/ward-flow/transport`, rewritten — spec §7:
 * "the existing route... the coordinator's view of every vehicle: which patient, which leg, how
 * long since the last stamp").
 *
 * **Scope decision — which movements are "a vehicle".** `TransportJob` is the model's only
 * concept of a vehicle; a movement without one has never had a job created for it at all (the
 * reducer's `BOOK_TRANSPORT` case is the only thing that creates one). 33 of the 48 seed
 * movements have no transport job (re-measured against the branch this task landed on — see the
 * task report, not the earlier preflight numbers, which predate a fixture fix). Listing all 33 as
 * tracker rows with a fabricated "no leg" placeholder would dilute a screen whose entire job is
 * naming a leg and an age; it would also contradict the prior `/transport` route and the officer
 * screen (Task 9), both of which already filter to movements that carry a transport job. This
 * screen keeps that precedent — every row is a real vehicle — and states the exclusion on screen
 * instead of silently dropping those movements, the same honesty discipline the officer screen
 * uses for "no officer identity exists in this model" (Task 9). `isOpen` (not a raw stage check)
 * additionally keeps a movement whose journey already closed off the tracker: a "live" tracker of
 * vehicles in transit has nothing left to say about a record the patient has already left.
 *
 * **Leg and age.** `transportLeg` (via `trackerRowState`) decides the leg exactly the way every
 * other screen in this phase does; `stampAgeText` reads the one stamp that corresponds to that
 * leg and reports it as "<duration> ago", falling back to an explicit "no timestamp" sentence for
 * the `"Requested"` leg, which the model never stamps at all (see `tracker-derivations.ts`). No
 * row can therefore claim a leg it has not reached: the leg text and the age text both come from
 * the same single source of truth, never independently guessed.
 */
export function LiveTracker() {
  const { movements, units, patients } = useWardFlow();
  const now = useWardFlowClock();

  const openMovements = movements.filter(isOpen);
  const vehicles = openMovements.filter((movement) => movement.transport !== undefined);
  const withoutTransport = openMovements.length - vehicles.length;

  return (
    <div className={styles.screen} data-testid="ward-mode-transport">
      <main id="main-content" className={styles.main} data-testid="ward-live-tracker">
        {/*
          The page's ACCESSIBLE NAME, and `HD-Q1` settled what it is: Transport. This said "Live
          tracker" while the route said /transport and the tab said something else again —
          three user-facing names for one page.

          ⚠️ This heading is the one that mattered most and was the easiest to leave behind,
          because it is `sr-only`: nobody reviewing the screen visually ever sees it. For a
          screen-reader user it is not one name among three, it is the ONLY one they get, so
          they had nothing to reconcile "Live tracker" against.

          The component is still `LiveTracker` in `live-tracker.tsx`, deliberately: that name
          is internal, no user meets it, and renaming it moves every import for no reader.
        */}
        <h1 className="sr-only">Transport</h1>

        {vehicles.length === 0 ? (
          <p className={styles.placeholder} data-testid="ward-tracker-empty">
            No transport job is currently open &mdash; nothing to track right now.
          </p>
        ) : (
          <ul className={styles.vehicleList} data-testid="ward-tracker-list">
            {vehicles.map((movement) => {
              const transport = movement.transport;
              // Unreachable given the `vehicles` filter above (it only keeps movements with a
              // transport job), but this is TypeScript narrowing without a non-null assertion,
              // not a fallback that hides real data.
              if (!transport) return null;

              const { leg, stampAt } = trackerRowState(transport);
              // Same unreachable-but-real-narrowing shape: `trackerRowState` only returns an
              // undefined leg when its transport argument is undefined, which cannot happen here.
              if (!leg) return null;

              const originEd = edById(movement.originEdId);
              const destinationUnit = movement.acceptedUnitId
                ? units.find((unit) => unit.id === movement.acceptedUnitId)
                : undefined;
              const destinationLabel = movement.acceptedUnitId
                ? (destinationUnit?.name ?? `No synthetic unit matches "${movement.acceptedUnitId}"`)
                : "No accepted destination recorded";

              return (
                <li key={movement.id} data-testid={`ward-tracker-row-${movement.id}`} className={styles.vehicleRow}>
                  <div className={styles.vehicleHeader}>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <strong>{resolveSubjectPatient(movement, { patients, movements }).formalName}</strong>
                    <span className={LEG_BADGE_CLASS[leg]}>{leg}</span>
                  </div>
                  <dl className={styles.vehicleDetails}>
                    <div className={styles.vehicleDetailRow}>
                      <dt>Provider</dt>
                      <dd>{transport.provider}</dd>
                    </div>
                    <div className={styles.vehicleDetailRow}>
                      <dt>Origin department</dt>
                      <dd>
                        {originEd
                          ? `${originEd.name} (${originEd.siteCode})`
                          : `No synthetic department matches "${movement.originEdId}"`}
                      </dd>
                    </div>
                    <div className={styles.vehicleDetailRow}>
                      <dt>Destination unit</dt>
                      <dd>{destinationLabel}</dd>
                    </div>
                    <div className={styles.vehicleDetailRow}>
                      <dt>Last stamp</dt>
                      <dd>{stampAgeText(stampAt, now)}</dd>
                    </div>
                  </dl>
                  <Link className={styles.reviewLink} href={`/mockups/ward-flow/movements/${movement.id}`}>
                    Review patient
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <WardPrototypeFooter testId="ward-tracker-governance" note="Transport · Not a medical device" />
      </main>
    </div>
  );
}
