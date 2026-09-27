"use client";

/**
 * 🔴 **THIS COMPONENT IS UNREACHABLE, AND ITS TESTS WERE RETIRED ON 2026-09-06 — NOT LOST.**
 *
 * /escalation redirects to /delays. Owner ruling 2026-09-06: the eleven replaced ward
 * screens are finished with. The tests that covered this file (`ward-escalation.dom.test.tsx, ward-device-claim-reason.dom.test.tsx`)
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

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  elapsedLabel,
  escalationBoard,
  stageCopy,
  type EscalationBoard,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { edById } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./escalation.module.css";

/**
 * Task 5 (spec item 4): the escalation board — one place showing every patient whose placement
 * has gone wrong. Unlike the shift handover (`handover-page.tsx`), this page is deliberately
 * NOT frozen at open: a coordinator working this board wants the live picture — a fresh
 * escalation recorded a minute ago, a ward's confirmed capacity that just changed the
 * `nowhereEligible` count — so `escalationBoard` is called fresh on every render against
 * `useWardFlow()`'s live `movements`/`units`/`now`, with no `useState` freeze. Nothing here
 * mutates anything; both sections are read-only.
 *
 * 🔴 WHAT WAS CALLED "THE HARDEST RULE IN THIS TASK" IS WITHDRAWN (owner ruling R-2026-09-04-G).
 *
 * Spec D4 said this board records and shows and SUGGESTS NOTHING — no least-bad options, no
 * ranking of wards the patient does not fit, no near-miss computation. It was never an owner
 * ruling; it was inferred and then enforced. The owner has ruled the opposite: the board is to
 * match patients to beds, with the software never deciding and the final acceptance coming from
 * the users.
 *
 * As it stands this component computes no suggestion of its own, and `escalationBoard` computes
 * none either. That is a description of today's code, not a constraint on tomorrow's — and the
 * matching work is a design that has not been done yet rather than a door that is closed.
 */
export function EscalationBoardPage() {
  const { movements, units, patients, referrals } = useWardFlow();
  const now = useWardFlowClock();
  const board = escalationBoard(movements, units, now);

  return (
    <div className={styles.screen} data-testid="ward-escalation-page">
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Escalation board</h1>
        </header>

        <EscalatedSection board={board} now={now} patients={patients} referrals={referrals} />
        <NowhereEligibleSection board={board} now={now} patients={patients} referrals={referrals} />
        <WardPrototypeFooter
          testId="ward-escalation-governance"
          note="This board is not a medical device · Coordinators decide placements, one at a time · Places nobody"
        />
      </main>
    </div>
  );
}

export function EscalatedSection({
  board,
  now,
  patients = [],
  referrals = [],
}: {
  board: EscalationBoard;
  now: Instant;
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
}) {
  return (
    <section className={styles.section} data-testid="ward-escalation-escalated">
      <h2 className={styles.sectionHeading}>Escalated</h2>
      {board.escalated.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-escalation-escalated-empty">
          None — no open movement carries a recorded escalation.
        </p>
      ) : (
        <WardTable className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">When</th>
              <th scope="col">Units tried</th>
              <th scope="col">Contact</th>
              <th scope="col">Wait</th>
            </tr>
          </thead>
          <tbody>
            {board.escalated.map((entry) => (
              <tr key={entry.movement.id}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <td>{resolveSubjectPatient(entry.movement, { patients, referrals }).formalName}</td>
                <td>
                  {entry.movement.escalation
                    ? formatInstantWithDay(entry.movement.escalation.at, now)
                    : "No time recorded"}
                </td>
                <td>{triedUnitsLabel(entry.triedUnits)}</td>
                <td>{entry.movement.escalation?.contact ?? "No contact recorded"}</td>
                <td>{elapsedLabel(entry.movement, now)}</td>
              </tr>
            ))}
          </tbody>
        </WardTable>
      )}
    </section>
  );
}

export function NowhereEligibleSection({
  board,
  now,
  patients = [],
  referrals = [],
}: {
  board: EscalationBoard;
  now: Instant;
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
}) {
  return (
    <section className={styles.section} data-testid="ward-escalation-nowhere-eligible">
      <h2 className={styles.sectionHeading}>Nowhere eligible</h2>
      {board.nowhereEligible.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-escalation-nowhere-eligible-empty">
          None — every open movement has at least one eligible ward right now.
        </p>
      ) : (
        <WardTable className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">Wait</th>
              <th scope="col">Stage</th>
              <th scope="col">Department</th>
            </tr>
          </thead>
          <tbody>
            {board.nowhereEligible.map((movement) => (
              <tr key={movement.id}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <td>{resolveSubjectPatient(movement, { patients, referrals }).formalName}</td>
                <td>{elapsedLabel(movement, now)}</td>
                <td>{stageCopy[movement.stage].label}</td>
                <td>{originDepartmentText(movement)}</td>
              </tr>
            ))}
          </tbody>
        </WardTable>
      )}
    </section>
  );
}

/** Every unit this movement's escalation record names as already tried — a record of what
 * happened, never a live candidate list. Mirrors `shortlist-panel.tsx`'s own decline-row
 * fallback: an id that does not resolve to a real `Unit` renders as an explicit absence, never a
 * substituted default. */
function triedUnitsLabel(triedUnits: { name: string }[]) {
  if (triedUnits.length === 0) return "No units recorded";
  return triedUnits.map((unit) => unit.name).join(", ");
}

/**
 * The origin department, with its site code when it resolves.
 *
 * ⚠️ **RENAMED FROM `departmentLabel`, 2026-09-12, and the rename is the point.** Three files
 * defined a local `departmentLabel` with opposite verdicts about the same absence — one blaming the
 * record, two blaming the network — with different signatures and every gate green. **Whoever
 * imported by habit got the wrong one.** The shared, ruled version keeps that name; the local
 * wrappers do not.
 *
 * **The unresolved sentence comes from `ward-absence-labels.ts` and is not written here**, so this
 * file cannot drift away from the ruling again.
 */
function originDepartmentText(movement: Movement) {
  const originEd = edById(movement.originEdId);
  return departmentLabel(movement.originEdId, originEd && `${originEd.name} (${originEd.siteCode})`);
}
