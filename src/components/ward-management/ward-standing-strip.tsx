"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { elapsedLabel, isOpen } from "@/components/ward-management/ward-derivations";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  openBedsNow,
} from "@/components/ward-management/ward-bed-availability";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { wardSites } from "@/components/ward-management/ward-sites";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { Movement } from "@/components/ward-management/ward-model";
import { DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import styles from "./ward-standing-strip.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

/**
 * **THE CORE FIGURES, BEHIND A TOGGLE IN THE HEADER — owner's change, 2026-09-07.**
 *
 * It began as a permanent band. The owner asked for a drop-down instead, and the reason is sound:
 * measured, `/capacity` is **6043px tall in a 900px viewport**, and a band that never collapses
 * spends 74px of every screen on figures a coordinator has usually already read.
 *
 * 🔴 **BUT AN ALARM MUST NEVER BE ONE CLICK AWAY, SO THE TOGGLE CARRIES IT.** Hiding a breached
 * statutory deadline behind a control somebody has to think to open is exactly the failure this
 * project keeps finding in other shapes. **When any figure is flagged, the button states it in
 * words on its own face** — "1 deadline passed" — and only the rest of the detail is collapsed.
 * A closed panel therefore never means "nothing is wrong"; it means "nothing more to add".
 *
 * ⚠️ **THE FIGURES CHANGE WITH THE ROLE, AND THE ROLE IS THE ROUTE.** Ward Flow has no signed-in
 * identity — see `ward-chrome-role.ts`. A coordinator gets network totals; a ward gets its own
 * ward's beds; an emergency department gets its own department's waits, with statewide supply as
 * context rather than as something it can act on.
 *
 * ⚠️ **EVERY FIGURE NAMES ITS DERIVATION AND NONE IS AUTHORED HERE.** Where a derivation already
 * sums across the network that sum is used rather than re-added — `serviceRollup` computes each
 * unit's breakdown exactly once, so a caller cannot double-count a unit by also totalling sites.
 *
 * 🔴 **THE FIGURES ARE DIRECT CHILDREN OF `WardFigureStrip`, WHICH THROWS ABOVE TWO FLAGGED.**
 * Wrapping them in cluster elements would hide them from `Children.toArray` and silently disarm the
 * only place that rule can be enforced. Grouping is done in CSS against
 * `[data-ward-primitive="figure"]`. **A bespoke strip built to escape the throw is the one refactor
 * this file forbids.**
 */

export type StandingFigure = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  flagged?: boolean;
};

type FigureInput = {
  movements: Movement[];
  units: ReturnType<typeof useWardFlow>["units"];
  admissions: ReturnType<typeof useWardFlow>["admissions"];
  bedReleases: ReturnType<typeof useWardFlow>["bedReleases"];
  leaveBeds: ReturnType<typeof useWardFlow>["leaveBeds"];
  now: Instant;
  chromeRole: WardChromeRole;
  /** The unit or department id in the path, when the route carries one. */
  placeId?: string;
};

function legalCounts(movements: Movement[], now: Instant) {
  let passed = 0;
  let withinHour = 0;
  for (const movement of movements) {
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) continue;
    const state = clockState(dueAt, now);
    if (state === "breached") passed += 1;
    else if (state === "critical") withinHour += 1;
  }
  return { passed, withinHour };
}

function longestOpen(open: Movement[], now: Instant): StandingFigure {
  const worst = open.reduce<Movement | undefined>(
    (found, movement) => (found === undefined || movement.openedAt < found.openedAt ? movement : found),
    undefined,
  );
  return {
    key: "longest",
    label: "Longest wait",
    value: worst === undefined ? "—" : elapsedLabel(worst, now),
    sub: worst?.id,
  };
}

export function standingFigures(input: FigureInput): StandingFigure[] {
  const { movements, units, admissions, bedReleases, leaveBeds, now, chromeRole, placeId } = input;
  const open = movements.filter(isOpen);
  const legal = legalCounts(open, now);

  /*
   * 🔴 **A "READY" FIGURE MUST SAY HOW MANY OF THOSE BEDS ARE PENDING — owner ruling 2026-09-05, and
   * this strip shipped without it.** The number itself is right and does not move: `availableNow`
   * deliberately subtracts nothing for a preparation note, because the owner ruled on 2026-09-01
   * that a ward's figure must not lurch as preparation starts and stops. **The defect is a correct
   * number with the sentence missing.** `PULL_PATIENT` refuses on exactly those beds, so a
   * coordinator reading a bare "2 ready" can commit a patient, tell the ward, and be refused at the
   * moment of action.
   *
   * 🔴 **"PENDING" IS THE STATE'S NAME AND THE OWNER HAS NOW DEFINED IT, 2026-09-07:** *"anything that
   * holds a bed up when a patient has left but the bed is not yet ready."* **The patient having LEFT is
   * part of the definition**, and `bedsPendingPreparation` already enforces exactly that — verified,
   * not assumed: it filters `release.state === "discharged" && release.preparing`, and `discharged`
   * is the arm of `BED_RELEASE_STATES` where the bed is free. So the figure and the definition agree
   * by construction rather than by convention.
   *
   * ⚠️ **NEVER "being made ready" OR "being cleaned" — owner correction 2026-09-07.**
   * Cleaning is one of two `BED_PREPARATION_NOTES` entries; the other is maintenance or repair, and
   * a bed may carry the flag with no reason recorded at all. Both of the longer phrases assert a
   * reason the model does not hold. **This file said "being made ready" for a few hours on
   * 2026-09-07 and it was wrong in exactly the way "being cleaned" was.**
   *
   * ⚠️ **AND THE ACTIONABLE CLAUSE IS OMITTED FOR AN EMERGENCY DEPARTMENT, DELIBERATELY.** The
   * coordinator and ward tiles say "N can be pulled into · M pending", which is the wording the
   * other four surfaces use. An ED cannot pull a patient into anything — its tile already carries
   * "not all eligible" for that reason — so telling it how many beds *could be pulled into* names
   * an action it does not have. It gets the pending count and not the clause.
   *
   * ⚠️ **SAID ONLY WHEN THERE IS SOMETHING TO SAY.** "0 pending" is a claim nobody made, and a
   * caveat printed on every screen every day stops being read — the failure this strip's flagging
   * rules are written against.
   */
  const pendingAt = (unitId: string) => bedsPendingPreparation(unitId, [...bedReleases]);
  const pendingEverywhere = units.reduce((total, unit) => total + pendingAt(unit.id), 0);
  const openEverywhere = units.reduce((total, unit) => total + openBedsNow(unit, [...bedReleases]), 0);
  /** `actionable` omitted where the reader cannot pull — see the ED note above. */
  const preparationNote = (pending: number, actionable?: number): string | undefined => {
    if (pending === 0) return undefined;
    return actionable === undefined ? `${pending} pending` : `${actionable} can be pulled into · ${pending} pending`;
  };
  const withSub = (base: string | undefined, note: string | undefined): string | undefined => {
    if (note === undefined) return base;
    return base === undefined ? note : `${base} · ${note}`;
  };

  /*
   * 🔴 **ONLY THE TWO LEGAL FIGURES MAY FLAG, IN EVERY ROLE.** Longest-wait is never flagged
   * because flagging it needs a THRESHOLD this prototype has no figure for — inventing one would be
   * a clinical claim — and because it is never zero, so the flag would be permanent and would
   * therefore mean nothing. The legal figures carry thresholds the model itself defines
   * (`clockState`) and are **zero on a good day**, which is what makes an amber tile informative.
   */
  const legalFigures: StandingFigure[] = [
    { key: "passed", label: "Deadline passed", value: String(legal.passed), flagged: legal.passed > 0 },
    {
      key: "within-hour",
      label: `Due within ${DUE_SOON_URGENT_MINUTES / 60}h (your default)`,
      value: String(legal.withinHour),
      flagged: legal.withinHour > 0,
    },
  ];

  if (chromeRole === "ed") {
    const departments = edPressure(now, movements);
    const mine = placeId === undefined ? undefined : departments.find((entry) => entry.ed.id === placeId);
    const rollup = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now);
    return [
      /*
       * ⚠️ **AN ED CANNOT PLACE A PATIENT, so statewide supply is CONTEXT and the caveat lives
       * INSIDE the figure.** "27 ready" alone reads as 27 beds available to this department; the
       * sub-line says what the number actually is, because a figure a reader must remember a
       * caveat about is a figure that will eventually be read without it.
       */
      {
        key: "waiting-here",
        label: "Waiting here",
        value: String(mine?.waiting ?? open.length),
        sub: mine === undefined ? "all departments" : mine.ed.name,
      },
      {
        key: "longest-here",
        label: "Longest here",
        value: mine === undefined ? longestOpen(open, now).value : `${Math.floor(mine.longestWaitMinutes / 60)}h`,
      },
      {
        key: "ready-statewide",
        label: "Ready statewide",
        value: String(rollup.service.availableNow),
        sub: withSub("not all eligible", preparationNote(pendingEverywhere)),
      },
      ...legalFigures,
    ];
  }

  if (chromeRole === "ward") {
    /*
     * 🔴 **THE LIVE `units`, NEVER `unitById`.** `unitById` reads the frozen `ward-sites.ts`
     * fixture — the establishment as authored, not as the reducer has since changed it. This
     * shipped reading the fixture, so a ward whose beds had moved during the session was shown its
     * opening figures with nothing to say they were stale. `ward-place.ts:55-58` states the same
     * rule for the same reason; the two must not diverge again.
     */
    const unit = placeId === undefined ? undefined : units.find((candidate) => candidate.id === placeId);
    if (unit !== undefined) {
      const breakdown = capacityBreakdown(unit, [...bedReleases], [...leaveBeds], now);
      const oneToOne = remainingSpeciallingCapacity(unit, admissions);
      return [
        {
          key: "ready-here",
          label: "Ready here",
          value: String(breakdown.availableNow),
          sub: withSub(unit.name, preparationNote(pendingAt(unit.id), openBedsNow(unit, [...bedReleases]))),
        },
        { key: "out-today", label: "Out today", value: String(breakdown.expectedToday) },
        /*
         * ⚠️ **"FREE OF STAFFED", never "staffed" alone.** A bare "2" beside a bed figure reads as
         * headroom; `remainingSpeciallingCapacity` is the only derivation that can answer it, and it
         * needs the admissions list — which is why the eligibility panel one file away deliberately
         * refuses to make this claim at all. Stated as a fraction so it cannot be read as a pool.
         */
        {
          key: "one-to-one",
          label: "One-to-one free",
          value: `${oneToOne} of ${unit.speciallingCapacity}`,
          sub: "staffed establishment",
        },
        ...legalFigures,
      ];
    }
  }

  const rollup = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now);
  const inEd = edPressure(now, movements).reduce((total, entry) => total + entry.waiting, 0);
  return [
    /*
     * 🔴 **THE `sub` IS NOT DECORATION — WITHOUT IT THIS TILE IS THE LEAST HONEST FIGURE ON THE
     * SCREEN, AND IT IS ON EVERY SCREEN.**
     *
     * `availableNow` counts beds that are free INCLUDING ones still being made ready, and
     * `PULL_PATIENT` refuses on exactly those. So "Ready now: N", alone, on chrome a coordinator
     * reads while deciding where a patient can go, states a number they cannot act on and offers
     * nothing to say so. **The three statistics screens carried this same defect and it was fixed
     * there hours ago; the strip was built in between and inherited it.**
     *
     * ⚠️ **THE NUMBER MUST NOT CHANGE, BY OWNER RULING.** `availableNow` deliberately subtracts
     * nothing for a preparation note, so a ward's figure does not lurch as cleaning starts and
     * stops. **What was missing is the sentence beside it, never the count** — the same ruling, in
     * the same words, that `ward-ready-figure-preparation-qualifier` enforces on the other four
     * surfaces.
     *
     * ⚠️ **AND THE `sub` SAYS "PENDING", NOT "BEING CLEANED".** The owner corrected that vocabulary
     * on 2026-09-07: cleaning is one of two `BED_PREPARATION_NOTES` entries, the other is
     * maintenance or repair, and a bed may carry the flag with no reason recorded at all. The
     * state is Pending and it covers more than the model can currently express.
     *
     * Rendered only when there is something to say. A `sub` reading "0 pending" would be a claim
     * nobody made, and the tile is honest without it.
     */
    {
      key: "ready",
      label: "Ready now",
      value: String(rollup.service.availableNow),
      sub: withSub(undefined, preparationNote(pendingEverywhere, openEverywhere)),
    },
    { key: "out-today", label: "Out today", value: String(rollup.service.expectedToday) },
    { key: "waiting", label: "Waiting", value: String(open.length) },
    /*
     * "From ED", not "In ED": `edPressure` buckets on `originEdId`, which is where a patient came
     * FROM. Somebody admitted through an emergency department and since pulled to a ward still
     * counts here. The two figures are equal on today's seed because every open movement originated
     * in an ED — **two figures agreeing looks like confirmation and is a coincidence of the data.**
     */
    { key: "from-ed", label: "From ED", value: String(inEd) },
    longestOpen(open, now),
    ...legalFigures,
  ];
}

/** The id a ward or ED route carries, so a figure can be scoped to the place being looked at. */
function placeIdFrom(pathname: string): string | undefined {
  const match = /\/(?:ward|board|ed)\/([^/]+)/u.exec(pathname);
  return match?.[1];
}

/**
 * ⚠️ **THE TOGGLE AND THE PANEL ARE SEPARATE EXPORTS BECAUSE THEY SIT IN DIFFERENT PLACES.**
 *
 * The owner asked for the toggle in the header row (2026-09-07) and the panel necessarily drops
 * BELOW that row, so no one component can own both and still be laid out as a single line.
 * `WardChromeHeader` owns the open state and places each half; `WardStandingStrip` below composes
 * them for anything that wants the pair on its own.
 */
export function WardStatsToggle({
  figures,
  open,
  onToggle,
}: {
  figures: StandingFigure[];
  open: boolean;
  onToggle: () => void;
}) {
  const flagged = figures.filter((figure) => figure.flagged);
  const alarm = flagged.map((figure) => `${figure.value} ${figure.label.toLowerCase()}`).join(", ");

  return (
    <button
      type="button"
      className={flagged.length > 0 ? `${styles.toggle} ${styles.toggleAlarm}` : styles.toggle}
      aria-expanded={open}
      onClick={onToggle}
      data-testid="ward-stats-toggle"
      data-ward-dynamic-island="true"
      title={flagged.length > 0 ? `Clinical telemetry: ${alarm}` : "Clinical telemetry: Nominal"}
    >
      <span className={flagged.length > 0 ? styles.hudPipAlarm : styles.hudPipNominal} aria-hidden="true" />
      <span className={styles.toggleLabel}>{open ? "Hide figures" : "Figures"}</span>
      <span className={styles.hudDivider} aria-hidden="true" />
      {/*
       * 🔴 **THE ALARM IS ON THE BUTTON, NOT ONLY INSIDE THE PANEL.** A collapsed panel must never
       * be able to mean "nothing is wrong" — so whatever is flagged is stated here in WORDS, not
       * as a bare badge count, and not by colour alone. With nothing flagged the button says so
       * rather than going silent, because an empty control and an unread one look identical.
       */}
      <span className={styles.toggleState}>{flagged.length > 0 ? alarm : "nothing flagged"}</span>
      <span aria-hidden="true" className={styles.chev}>
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}

export function WardStatsPanel({ figures, open }: { figures: StandingFigure[]; open: boolean }) {
  return (
    <div className={styles.wrap} data-testid="ward-standing-strip">
      {/*
       * 🔴 **ALWAYS RENDERED, HIDDEN WITH `hidden` — NEVER `{open ? … : null}`, AND THE REASON IS
       * PAPER.**
       *
       * `globals.css` hides every `button` under `@media print`, so the toggle correctly disappears
       * on a printed sheet. **If the panel were conditionally rendered, a coordinator printing a
       * handover with the panel closed would get no figures at all** — and the page would look
       * complete, because a strip that was never in the DOM leaves no gap. That is the exact defect
       * measured on the referral board earlier today, where four of thirteen referrals vanished from
       * paper while nine printed normally.
       *
       * Keeping it in the DOM and hiding it with the `hidden` attribute lets the print rule restore
       * it, so **what prints does not depend on which way somebody happened to leave a toggle.**
       */}
      <div className={styles.panel} hidden={!open} data-testid="ward-stats-panel">
        <WardFigureStrip>
          {figures.map((figure) => (
            <WardFigure
              key={figure.key}
              label={figure.label}
              value={figure.value}
              sub={figure.sub}
              flagged={figure.flagged}
            />
          ))}
        </WardFigureStrip>
        <LegalLimitsNotChecked variant="tag" />
      </div>
    </div>
  );
}

/**
 * The toggle and its panel as one unit, for anything that wants the pair without the rest of the
 * chrome around it. `WardChromeHeader` deliberately does NOT use this — it places the toggle in the
 * header row and the panel beneath, which is the whole reason the two are separate exports.
 */
export function WardStandingStrip() {
  const pathname = usePathname() ?? "";
  const { movements, units, admissions, bedReleases, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const [open, setOpen] = useState(false);
  const chromeRole = wardChromeRole(pathname);
  const figures = standingFigures({
    movements,
    units,
    admissions,
    bedReleases,
    leaveBeds,
    now,
    chromeRole,
    placeId: placeIdFrom(pathname),
  });
  return (
    <div data-chrome-role={chromeRole} className={styles.hudAnchor}>
      <WardStatsToggle figures={figures} open={open} onToggle={() => setOpen(!open)} />
      <WardStatsPanel figures={figures} open={open} />
    </div>
  );
}
