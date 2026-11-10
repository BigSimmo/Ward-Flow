import { describe, expect, it } from "vitest";

import { ASK_CONFIRM_BEDS, askWardsFields } from "@/components/ward-management/alerts/ask-wards";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { bedRoundAnswers, notConfirmedOnly } from "@/components/ward-management/bed-meeting/bed-round-answers";
import { byServiceThenName } from "@/components/ward-management/ward-derivations-shortlist";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Batch 3 item 12: bed round answers on the bed meeting agenda. D-126 (Josh, 10 Nov 2026): wards
 * stay in the one fixed order, health service then ward name, with the filter on or off.
 */

const NOW = NOW_ANCHOR;

const confirmedAt = (unit: Unit, at: number, source: "ward" | "feed" = "ward"): Unit => ({
  ...unit,
  allocatable: { ...unit.allocatable, source, confirmedAt: at, staleAfterMinutes: 240 },
});

function ask(unitIds: string[], at: number): BroadcastAlert {
  return {
    ...askWardsFields(ASK_CONFIRM_BEDS, unitIds),
    id: `ask-${at}`,
    dispatchedAt: at,
    expiresAt: at + 240,
    dispatchedByRole: "coordinator",
    status: "active",
    acknowledgedUnits: [],
  };
}

function wards() {
  const units = seedWardFlowState().units;
  expect(units.length).toBeGreaterThanOrEqual(4);
  // Shuffled on purpose: the derivation, never the input, sets the order.
  const shuffled = [...units].reverse();
  // Two confirmed after the ask, one before it, one from the feed only, the rest left as seeded.
  const [a, b, c, d] = [...units].sort(byServiceThenName);
  const edited = new Map<string, Unit>([
    [a.id, confirmedAt(a, NOW - 30)],
    [b.id, confirmedAt(b, NOW - 90)],
    [c.id, confirmedAt(c, NOW - 20)],
    [d.id, confirmedAt(d, NOW - 10, "feed")],
  ]);
  return {
    units: shuffled.map((unit) => edited.get(unit.id) ?? unit),
    alerts: [ask([a.id, b.id, c.id, d.id], NOW - 60)],
    ids: { a: a.id, b: b.id, c: c.id, d: d.id },
  };
}

describe("bed round answers (D-126 fixed ward order)", () => {
  it("lists every ward in the fixed order, health service then ward name, with the filter off", () => {
    const { units, alerts } = wards();
    const answers = bedRoundAnswers(units, alerts, NOW);
    expect(answers.map((answer) => answer.unit.id)).toEqual([...units].sort(byServiceThenName).map((unit) => unit.id));
    // The answers never reorder the list: a different set of answers keeps the same order.
    const none = bedRoundAnswers(units, [], NOW);
    expect(none.map((answer) => answer.unit.id)).toEqual(answers.map((answer) => answer.unit.id));
  });

  it("reads Confirmed with its time only for a desk confirmation since the latest ask", () => {
    const { units, alerts, ids } = wards();
    const byId = new Map(bedRoundAnswers(units, alerts, NOW).map((answer) => [answer.unit.id, answer]));
    expect(byId.get(ids.a)).toMatchObject({ confirmed: true, confirmedAt: NOW - 30 });
    expect(byId.get(ids.c)).toMatchObject({ confirmed: true, confirmedAt: NOW - 20 });
    // Confirmed before the ask went out: the ward has not answered it.
    expect(byId.get(ids.b)).toMatchObject({ confirmed: false });
    expect(byId.get(ids.b)?.confirmedAt).toBeUndefined();
    // A feed figure is not a ward's answer.
    expect(byId.get(ids.d)).toMatchObject({ confirmed: false });
  });

  it("goes back to Not confirmed once the figure passes its own time limit", () => {
    const { units, ids } = wards();
    const later = bedRoundAnswers(units, [], NOW + 240);
    expect(later.find((answer) => answer.unit.id === ids.a)?.confirmed).toBe(false);
  });

  it("the Not confirmed filter shows only the wards not confirmed, in the same fixed order", () => {
    const { units, alerts, ids } = wards();
    const answers = bedRoundAnswers(units, alerts, NOW);
    const filtered = notConfirmedOnly(answers);
    expect(filtered.every((answer) => !answer.confirmed)).toBe(true);
    expect(filtered.map((answer) => answer.unit.id)).not.toContain(ids.a);
    expect(filtered.map((answer) => answer.unit.id)).not.toContain(ids.c);
    expect(filtered.map((answer) => answer.unit.id)).toContain(ids.b);
    expect(filtered).toHaveLength(answers.filter((answer) => !answer.confirmed).length);
    // Same relative order as the full list.
    const fullOrder = answers.map((answer) => answer.unit.id);
    const positions = filtered.map((answer) => fullOrder.indexOf(answer.unit.id));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });
});
