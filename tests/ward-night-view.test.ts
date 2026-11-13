/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  nightContacts,
  nightEdWaits,
  nightOnTheWay,
  nightReadyBeds,
} from "@/components/ward-management/night-view-figures";
import { KEY_LINE_IDS } from "@/components/ward-management/on-call/on-call-directory";
import { DEFAULT_DUE_SOON_THRESHOLDS, minuteOfDay } from "@/components/ward-management/ward-clock";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { screenForPath, ROLE_SCREENS } from "@/components/ward-management/ward-role-access";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { flowStageOf } from "@/components/ward-management/coordinator/priority-queue";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";

/**
 * Night view (feature plan item 29): every figure is the day screens' own figure for the same
 * records. Synthetic seed data only.
 */
const state = seedWardFlowState();
const now = NOW_ANCHOR;
const counts = wardNavCounts({
  movements: state.movements,
  units: state.units,
  referrals: state.referrals,
  bedReleases: state.bedReleases,
  leaveBeds: state.leaveBeds,
  admissions: state.admissions,
  now,
  sites: wardSites,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
});

describe("Night view figures match the day screens", () => {
  it("beds ready is Home's and the rail's figure, and the wards add up to it", () => {
    const beds = nightReadyBeds(state.units, state.admissions, state.bedReleases, state.movements, state.referrals);
    expect(beds.total).toBe(counts.capacity?.value);
    expect(beds.wards.reduce((sum, ward) => sum + ward.ready, 0)).toBe(beds.total);
    expect(beds.wards.length + beds.wardsWithNone).toBe(state.units.length);
    expect(beds.wards.every((ward) => ward.ready > 0)).toBe(true);
  });

  it("lists wards in the fixed order, health service then name (D-126)", () => {
    const beds = nightReadyBeds(state.units, state.admissions, state.bedReleases, state.movements, state.referrals);
    const keys = beds.wards.map((ward) => {
      const service = unitHealthService(ward.unit);
      return [service ? HEALTH_SERVICES.indexOf(service) : HEALTH_SERVICES.length, ward.unit.name] as const;
    });
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    expect(keys).toEqual(sorted);
  });

  it("ED waits by Step count Waiting's people, each at the ED board's Step", () => {
    const waits = nightEdWaits(state.movements, now);
    expect(waits.waiting).toBe(waitingInEds(state.movements, now).total);
    expect(waits.waiting).toBe(counts.delays?.value);
    expect(waits.steps.map((step) => step.step)).toEqual([1, 2, 3, 4]);
    // The ED board row's own clock (`ed-screen-board-row.tsx`).
    const board = new Map<number, number>();
    let under = 0;
    for (const movement of edOpenSummaries(state.movements, now).flatMap((summary) => summary.open)) {
      const minutes = Math.max(Math.min(now, recordedEdDeparture(movement) ?? now) - movement.openedAt, 0);
      const step = edWaitStep(minutes);
      if (step) board.set(step.step, (board.get(step.step) ?? 0) + 1);
      else under += 1;
    }
    for (const step of waits.steps) expect(step.count, step.label).toBe(board.get(step.step) ?? 0);
    expect(waits.underFirstStep).toBe(under);
    expect(waits.steps.reduce((sum, step) => sum + step.count, 0) + waits.underFirstStep).toBe(waits.waiting);
  });

  it("on the way is Home's Moving stage", () => {
    const moving = state.movements.map((movement, index) =>
      index < 2 && movement.closure === undefined ? { ...movement, stage: "moving" as const } : movement,
    );
    const home = queueOrder(moving, now).filter((movement) => flowStageOf(movement) === "moving");
    expect(home.length).toBeGreaterThan(0);
    expect(nightOnTheWay(moving, now).map((movement) => movement.id)).toEqual(home.map((movement) => movement.id));
    const seeded = queueOrder(state.movements, now).filter((movement) => flowStageOf(movement) === "moving");
    expect(nightOnTheWay(state.movements, now)).toHaveLength(seeded.length);
  });

  it("on call is the On-call page's key lines, in its order", () => {
    const contacts = nightContacts(wardSites, minuteOfDay(now));
    expect(contacts.map((contact) => contact.entry.id)).toEqual([...KEY_LINE_IDS]);
    // A15-14/A15-19: every number shown is an invented one in the fictional (08) 5550 range.
    for (const contact of contacts) expect(contact.number ?? "").not.toMatch(/^(?!08 5550)\d/);
  });
});

describe("Night view route", () => {
  it("is the coordinator's page only", () => {
    expect(screenForPath("/ward-flow/night")).toEqual({ screen: "night" });
    expect(ROLE_SCREENS.coordinator.night).toBe("all");
    for (const role of Object.keys(ROLE_SCREENS) as (keyof typeof ROLE_SCREENS)[]) {
      if (role !== "coordinator") expect(ROLE_SCREENS[role].night, role).toBeUndefined();
    }
  });
});
