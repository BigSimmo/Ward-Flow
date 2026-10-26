import { describe, expect, it } from "vitest";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { boardRows, isOver24hInEd, isOver8hInEd } from "@/components/ward-management/delays/delays-board-model";
import { heroHighlights } from "@/components/ward-management/movements/movements-screen-helpers";
import { bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { DEFAULT_BED_FINDER_FILTERS, findBeds } from "@/components/ward-management/tools/ward-bed-finder";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { dayOf, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { inEdOver } from "@/components/ward-management/ward-shared-figures";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

/**
 * H-0213 (audit 24 Oct 2026, SRC-2): the figure probe turned into a test, so the disagreements the 24
 * and 26 Oct "do the numbers agree" audits found cannot come back unseen. It replays the engine's own
 * fuzz and, after every accepted action, reads each pair of screens that print the same figure.
 *
 * - Beds ready (NA3-01, NA3-05): Referrals "Beds ready statewide", Tools "Copy bed summary" and Find
 *   a bed read `readyBedsNow`, as Home, Capacity and the rail do.
 * - Over 8h and Over 24h (NA3-03, NA2-10): Movements' pills count the same people as Waiting's tiles.
 * - Confirmed (NA3-06, decision 16): Capacity's confirmed less its "also held up" is the bed meeting's
 *   confirmed, and both screens give the same held-up releases.
 * - Discharged today (NA3-04): the printed bed meeting counts the Perth calendar day.
 *
 * Each check also asserts the run reaches a state where the old formula would have split from the
 * shared one, so a pass is not a fixture that never exercises the case.
 */
describe("figures that more than one screen prints agree after random actions", () => {
  it("beds ready, over 8h, over 24h, confirmed and discharged today", () => {
    let checked = 0;
    let oldReadySplit = 0;
    let oldOver8hSplit = 0;
    let confirmedOverlap = 0;
    for (let seed = 0; seed < WARD_SCENARIOS.length * 2; seed += 1) {
      const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length]!;
      const network = scenarioWardNetwork(scenario);
      const random = seededRandom(9100 + seed);
      let state: WardFlowState = seedWardFlowState(scenario);
      for (let step = 0; step < 120; step += 1) {
        const next = wardFlowReducer(state, nextEvent(state, random, step));
        const refused = next.rejections.length > state.rejections.length;
        state = next;
        if (refused) continue;
        const now = nowFor(state, step);
        const at = `${scenario} seed ${seed} step ${step}`;
        const thresholds = dueSoonThresholdsOf(state.configuration);

        // Beds ready.
        const ready = totalReadyBedsNow(state.units, state.admissions, state.bedReleases);
        expect(bedsReadySummary(state.units, state.admissions, state.bedReleases, now).total, at).toBe(ready);
        const summary = bedSummaryText({
          units: state.units,
          admissions: state.admissions,
          movements: state.movements,
          bedReleases: state.bedReleases,
          leaveBeds: state.leaveBeds,
          now,
          thresholds,
          network,
        });
        expect(summary, at).toContain(`Ready beds: ${ready} of `);
        for (const row of findBeds(state.units, state.admissions, state.bedReleases, {
          ...DEFAULT_BED_FINDER_FILTERS,
          legalStatus: "voluntary",
        })) {
          expect(row.free, at).toBe(readyBedsNow(row.unit, state.admissions, state.bedReleases));
        }
        const old = state.units.reduce(
          (sum, unit) => sum + capacityBreakdown(unit, state.bedReleases, state.leaveBeds, now).availableNow,
          0,
        );
        if (old !== ready) oldReadySplit += 1;

        // Over 8h and over 24h: Waiting's tiles against Movements' pills.
        const rows = boardRows(delayGroups(state.movements, state.units, now, thresholds), now);
        const pills = heroHighlights(now, LONG_WAIT_MINUTES);
        const count = (id: string) => state.movements.filter(pills.find((pill) => pill.id === id)!.test).length;
        expect(count("over"), at).toBe(rows.filter(isOver8hInEd).length);
        expect(count("past"), at).toBe(rows.filter(isOver24hInEd).length);
        expect(count("over"), at).toBe(
          state.movements.filter((m) => inEdOver(m, now, ED_SEVERE_PRESSURE_WAIT_MINUTES)).length,
        );
        const everyOpenOver8h = state.movements.filter(
          (m) => isOpen(m) && now - m.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES,
        ).length;
        if (everyOpenOver8h !== count("over")) oldOver8hSplit += 1;

        // Confirmed, held up and discharged today: Capacity against the printed bed meeting.
        const sheet = bedMeetingSheet({
          units: state.units,
          movements: state.movements,
          bedReleases: state.bedReleases,
          admissions: state.admissions,
          leaveBeds: state.leaveBeds,
          now,
          thresholds,
          service: null,
          nameOf: (movement) => movement.id,
        });
        const capacity = state.units.map((unit) => capacityBreakdown(unit, state.bedReleases, state.leaveBeds, now));
        const sum = (pick: (value: (typeof capacity)[number]) => number) =>
          capacity.reduce((total, value) => total + pick(value), 0);
        expect(sheet.discharges.heldUp, at).toBe(sum((value) => value.blockedToday));
        expect(sheet.discharges.confirmed, at).toBe(
          sum((value) => value.confirmedToday) - sum((value) => value.confirmedHeldUpToday),
        );
        if (sum((value) => value.confirmedHeldUpToday) > 0) confirmedOverlap += 1;
        expect(sheet.discharges.dischargedToday, at).toBe(
          state.admissions.filter((admission) => admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now))
            .length,
        );
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(400);
    expect(oldReadySplit, "the run reaches a state the old ready formula counted differently").toBeGreaterThan(0);
    expect(oldOver8hSplit, "the run reaches a journey over 8 hours that is not in an ED").toBeGreaterThan(0);
    expect(confirmedOverlap, "the run reaches a confirmed release that is also held up").toBeGreaterThan(0);
  });
});
