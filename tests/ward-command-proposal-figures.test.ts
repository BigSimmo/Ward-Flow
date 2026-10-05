/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { commandFigures } from "@/components/ward-management/coordinator/proposal/command-proposal-figures";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Command redesign proposal: every figure on the page must equal the sidebar's own figure and its
 * rows must add up to it. One source per bed figure.
 */
describe("Command proposal figures", () => {
  const state = seedWardFlowState();
  const input = {
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    now: NOW_ANCHOR,
  };
  const figures = commandFigures(input);
  const nav = wardNavCounts(input);

  it("uses the sidebar's ready-bed, referral and delay figures", () => {
    expect(figures.readyBeds).toBe(nav.capacity?.value);
    expect(figures.referralsAwaiting).toBe(nav.referrals?.value);
    expect(figures.severeDelays).toBe(nav.delays?.value);
    expect(figures.blockedToday).toBe(nav.discharges?.value);
  });

  it("adds the per-service bed rows up to the totals", () => {
    const sum = (key: "ready" | "confirmedToday" | "expectedToday" | "blockedToday") =>
      figures.services.reduce((total, row) => total + row[key], 0);
    expect(sum("ready")).toBe(figures.readyBeds);
    expect(sum("confirmedToday")).toBe(figures.confirmedToday);
    expect(sum("expectedToday")).toBe(figures.expectedToday);
    expect(sum("blockedToday")).toBe(figures.blockedToday);
    expect(figures.services.reduce((total, row) => total + row.wards, 0)).toBe(state.units.length);
  });

  it("counts every open movement in exactly one emergency department", () => {
    expect(figures.openMovements).toBe(state.movements.filter(isOpen).length);
    expect(figures.waitingInEd).toBe(figures.openMovements);
    expect(figures.departmentsWithWaiting).toBe(figures.eds.filter((row) => row.waiting > 0).length);
  });

  it("names the department with the longest wait", () => {
    const longest = Math.max(...figures.eds.map((row) => row.longestWaitMinutes));
    expect(figures.longest?.minutes).toBe(longest);
  });

  it("lists serious items before warnings", () => {
    const tones = figures.attention.map((item) => item.tone);
    expect(tones).toEqual([...tones].sort((a, b) => (a === b ? 0 : a === "danger" ? -1 : 1)));
  });
});

describe("Command proposal answer sentence", () => {
  it("reads correctly for an empty network and for single values", async () => {
    const { answerSentence } =
      await import("@/components/ward-management/coordinator/proposal/command-proposal-figures");
    expect(answerSentence({ waitingInEd: 0, departmentsWithWaiting: 0, readyBeds: 0 })).toBe(
      "Nobody is waiting in an emergency department; 0 beds ready now.",
    );
    expect(answerSentence({ waitingInEd: 1, departmentsWithWaiting: 1, readyBeds: 1 })).toBe(
      "1 person waiting in 1 emergency department, 1 bed ready now.",
    );
    expect(answerSentence({ waitingInEd: 70, departmentsWithWaiting: 8, readyBeds: 26 })).toBe(
      "70 people waiting in 8 emergency departments, 26 beds ready now.",
    );
  });

  it("gives an empty network empty lists rather than invented rows", () => {
    const empty = commandFigures({
      movements: [],
      units: [],
      referrals: [],
      bedReleases: [],
      leaveBeds: [],
      now: NOW_ANCHOR,
    });
    expect(empty.waitingInEd).toBe(0);
    expect(empty.readyBeds).toBe(0);
    expect(empty.attention).toEqual([]);
    expect(empty.longest).toBeUndefined();
  });
});
