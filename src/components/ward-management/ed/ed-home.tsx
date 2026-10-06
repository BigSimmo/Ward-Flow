/**
 * 🔴 **THIS COMPONENT IS UNREACHABLE, AND ITS TESTS WERE RETIRED ON 2026-09-06 — NOT LOST.**
 *
 * /ed/[edId] renders EdScreen instead. Owner ruling 2026-09-06: the eleven replaced ward
 * screens are finished with. The tests that covered this file (`ward-ed-home.dom.test.tsx`)
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
// src/components/ward-management/ed/ed-home.tsx
"use client";

import Link from "next/link";

import { splitDuration } from "@/components/ward-management/ward-clock";
import { WardChip } from "@/components/ward-management/ward-chip";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import {
  type EdSummary,
  ED_HOME_POPULATION_NOTE,
  edHomeSummaries,
  edHomeTotals,
  groupByHealthService,
  ofPopulation,
  worstEdSummary,
} from "./ed-home-derivations";
import { EdServiceBands } from "./ed-service-bands";
import styles from "./ed-home.module.css";

/**
 * A generated sentence, never a template with a number dropped in — every clause is conditional
 * on whether the fact it names is actually true of `worst`, so a department with nobody detained
 * or nobody past the access target does not get a sentence claiming otherwise.
 *
 * ⚠️ Carries no claim about referral state (nobody "looking" or "not looking" for a bed) —
 * corrected ruling, 2026-09-04: see `ed-home-derivations.ts`'s own note on why this screen counts
 * nothing from `referredUnitIds`/`declines`.
 */
function heroLede(worst: EdSummary, isHighestWaiting: boolean, accessTargetMinutes: number): string {
  const peopleClause =
    worst.waiting === 1
      ? "One person is waiting here for a psychiatric bed"
      : `${worst.waiting} people are waiting here for a psychiatric bed`;
  const sentences: string[] = [
    `${peopleClause}${isHighestWaiting ? " — more than anywhere else in the network" : ""}.`,
  ];

  if (worst.pastAccessTarget > 0) {
    sentences.push(
      `${worst.pastAccessTarget} ${worst.pastAccessTarget === 1 ? "has" : "have"} now passed the department's own ${splitDuration(accessTargetMinutes)} access target.`,
    );
  }

  if (worst.detained > 0) {
    sentences.push(
      `${worst.detained} of the ${worst.waiting} ${worst.waiting === 1 ? "patient" : "patients"} waiting here ${worst.detained === 1 ? "is" : "are"} recorded as detained, which narrows which wards can take ${worst.detained === 1 ? "them" : "them"}.`,
    );
  }

  return sentences.join(" ");
}

/**
 * The coordinator's all-departments home. Approved design:
 * docs/ward-flow/design/prototypes/mockup-ed-home.html.
 *
 * ⚠️ Every figure below is derived from `useWardFlow()` state via `ed-home-derivations.ts` —
 * nothing here is a literal. See that module's own note on why the population counted is
 * MOVEMENTS, never referrals, and why that choice is reported rather than assumed to be settled.
 *
 * Renders its own `<h1>` and `<main>` because the navigation shell (`WardGround`/
 * `WardShellHeader`) renders neither — see the navigation-shell plan's stated interface.
 */
export function EdHome() {
  const { movements, configuration, patients } = useWardFlow();
  const now = useWardFlowClock();
  const accessTarget = configuration.edAccessTargetMinutes;
  const summaries = edHomeSummaries(movements, now, accessTarget);
  const totals = edHomeTotals(summaries, now);
  const worst = worstEdSummary(summaries);
  const bands = groupByHealthService(summaries);

  const allEds = allEmergencyDepartments();
  const serviceCount = new Set(summaries.map((summary) => summary.service)).size;
  const isHighestWaiting = worst !== undefined && worst.waiting === Math.max(...summaries.map((s) => s.waiting));

  const departmentsPastTargetNames = totals.departmentsPastAccessTarget.map((summary) => summary.siteName);

  return (
    <main className={styles.screen}>
      <div className={styles.masthead}>
        <div>
          <span className={styles.eyebrow}>Coordinator</span>
          <h1 className={styles.title}>Emergency departments</h1>
          <p className={styles.covers}>
            <b>
              {allEds.length} emergency department{allEds.length === 1 ? "" : "s"}
            </b>{" "}
            across {serviceCount} health service{serviceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <p className={styles.modelLimit} data-testid="ed-home-model-limit">
        <b>The emergency department record itself holds almost nothing.</b> The model&rsquo;s{" "}
        <code>EmergencyDepartment</code> type carries only an id, a site code and a name — no bed count, no waiting
        count, no capacity figure. {ED_HOME_POPULATION_NOTE}
      </p>

      <div data-testid="ed-home-totals">
        <WardFigureStrip>
          <WardFigure
            label="Waiting for a psychiatric bed, all sites"
            value={String(totals.waiting)}
            sub="Patients physically present in an emergency department, network-wide"
          />
          <WardFigure
            label="Longest single wait"
            value={totals.longestWait ? splitDuration(totals.longestWait.waitMinutes) : "0m"}
            flagged
            sub={
              // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
              totals.longestWait
                ? `${resolveSubjectPatient(totals.longestWait.movement, { patients, movements }).formalName} · ${totals.longestWait.summary.siteName}`
                : "Nobody is currently waiting"
            }
          />
          <WardFigure
            label="Recorded as detained, waiting"
            value={String(totals.detained)}
            unit={ofPopulation(totals.waiting, "patient")}
            sub="Narrows which wards can take them"
          />
          <WardFigure
            label="Detained, and past the access target"
            value={String(totals.detainedAndPastAccessTarget)}
            unit={ofPopulation(totals.waiting, "patient")}
            flagged
            sub="Both at once: an authorised bed, and urgently"
          />
          <WardFigure
            label="Departments past their access target"
            value={String(totals.departmentsPastAccessTarget.length)}
            unit={ofPopulation(allEds.length, "department")}
            sub={departmentsPastTargetNames.length > 0 ? departmentsPastTargetNames.join(", ") : "None currently"}
          />
        </WardFigureStrip>
      </div>
      <p className={styles.populationNote}>
        Every figure above counts patients physically present in an emergency department, waiting for a bed — never a
        referral raised for them. A department&rsquo;s own hub may show a different figure for the same day if it counts
        referrals instead.
      </p>

      {worst ? (
        <WardPanel
          title={worst.ed.name}
          count={`${worst.waiting} waiting`}
          blurb="Counts patients physically present in this department, waiting for a bed — not referrals raised for them."
        >
          <div className={styles.heroBody}>
            <WardChip level="urgent">Worst department right now</WardChip>
            <p className={styles.heroLede}>{heroLede(worst, isHighestWaiting, accessTarget)}</p>
          </div>
          <div className={styles.heroFiguresGrid} data-testid="ed-home-hero-figures">
            <WardFigure
              label="Waiting for a bed"
              value={String(worst.waiting)}
              sub={isHighestWaiting ? "Highest of any department" : "Patients physically present here"}
            />
            <WardFigure
              label="Longest wait"
              value={splitDuration(worst.longestWaitMinutes)}
              sub={
                worst.pastAccessTarget > 0
                  ? `Past the ${splitDuration(accessTarget)} access target`
                  : "Not yet past the access target"
              }
            />
            <WardFigure
              label="Detained under the Act"
              value={String(worst.detained)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub={worst.detained > 0 ? "Only an authorised bed can take them" : "None currently detained here"}
            />
            <WardFigure
              label={`Detained, and past ${splitDuration(accessTarget)}`}
              value={String(worst.detainedAndPastAccessTarget)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub="Both at once: an authorised bed, and urgently"
            />
            <WardFigure
              label={`Past ${splitDuration(accessTarget)}`}
              value={String(worst.pastAccessTarget)}
              unit={ofPopulation(worst.waiting, "patient")}
              sub="The department's own access measure, not a legal deadline"
            />
          </div>
          <Link className={styles.heroOpen} href={`/mockups/ward-flow/ed/${worst.ed.id}`}>
            Open {worst.ed.name} hub →
          </Link>
        </WardPanel>
      ) : null}

      <EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={accessTarget} />
    </main>
  );
}
