import { describe, expect, it } from "vitest";

import { toHandoverWard } from "@/components/ward-management/handover/handover-model";
import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { bedStates, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

/**
 * Audit 24-4 (numbers agree), NA2-03 and NA2-08. Replays the engine's own fuzz over every scenario
 * and, after each accepted action, checks two screens against the shared bed-state selector:
 *
 * - Handover's "Held" / "Pulled for incoming" is `bedStates().pulled`, the Capacity and Home box. It
 *   used to be `unitCapacity().held`, which counted closed beds (19 against 17 at the seed's 10:42).
 * - The header bed alerts' total is `readyBedsNow`, the one ready figure. It used to be the pull gate
 *   `openBedsNow`, which also drops beds being made ready (25 "unoccupied" against 26 ready).
 *
 * Each old formula must split from the shared one at least once, so the run is known to reach the case.
 * The Tools half of NA2-06 is pinned on screen in tests/ward-audit-24-4-counts.dom.test.tsx.
 */
describe("audit 24-4: Handover held and header bed alerts read the shared bed states", () => {
  it("agree with bedStates and readyBedsNow after every accepted action", () => {
    let checked = 0;
    let oldHeldSplit = 0;
    let oldAlertsSplit = 0;
    let preparingSeen = 0;
    for (let seed = 0; seed < WARD_SCENARIOS.length * 2; seed += 1) {
      const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length]!;
      const sites = scenarioWardNetwork(scenario).sites;
      const siteCodes = new Set(sites.map((site) => site.code));
      const random = seededRandom(24400 + seed);
      let state: WardFlowState = seedWardFlowState(scenario);
      for (let step = 0; step < 150; step += 1) {
        const next = wardFlowReducer(state, nextEvent(state, random, step));
        const refused = next.rejections.length > state.rejections.length;
        state = next;
        if (refused) continue;
        const now = nowFor(state, step);
        const label = `${scenario} seed ${seed} step ${step}`;

        const pulled = state.units.reduce(
          (sum, unit) => sum + bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds).pulled,
          0,
        );
        const handoverHeld = state.units.reduce(
          (sum, unit) => sum + toHandoverWard(unit, state.admissions, now, state.bedReleases).held,
          0,
        );
        expect(handoverHeld, label).toBe(pulled);
        const oldHeld = state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).held, 0);
        if (oldHeld !== pulled) oldHeldSplit += 1;

        const siteUnits = state.units.filter((unit) => siteCodes.has(unit.siteCode));
        const ready = totalReadyBedsNow(siteUnits, state.admissions, state.bedReleases);
        const alerts = deriveServiceBedAlerts(
          state.units,
          state.bedReleases,
          sites,
          state.movements,
          now,
          undefined,
          state.admissions,
        );
        expect(alerts.totalFreeBeds, label).toBe(ready);
        const preparing = siteUnits.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, state.bedReleases), 0);
        expect(alerts.totalBeingMadeReady, label).toBe(preparing);
        if (preparing > 0) preparingSeen += 1;
        const oldAlerts = siteUnits.reduce((sum, unit) => sum + openBedsNow(unit, state.bedReleases), 0);
        if (oldAlerts !== ready) oldAlertsSplit += 1;
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(oldHeldSplit, "the run reaches a closed bed the old Held formula counted").toBeGreaterThan(0);
    expect(oldAlertsSplit, "the run reaches a state the old bed alerts formula got wrong").toBeGreaterThan(0);
    expect(preparingSeen, "the run reaches a bed being made ready").toBeGreaterThan(0);
  });

  it("Handover held at the standard seed is the Pulled box, not the closed beds", () => {
    const state = seedWardFlowState("standard");
    for (const unit of state.units) {
      const ward = toHandoverWard(unit, state.admissions, nowFor(state, 0), state.bedReleases);
      expect(ward.held, unit.name).toBe(bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds).pulled);
    }
  });
});
