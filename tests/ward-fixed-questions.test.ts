import { describe, expect, it } from "vitest";

import { fixedQuestionAnswers, type FixedQuestionId } from "@/components/ward-management/reports/fixed-questions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function answersFor(movements?: Movement[]) {
  const state = seedWardFlowState();
  return fixedQuestionAnswers({
    movements: movements ?? state.movements,
    bedReleases: state.bedReleases,
    admissions: state.admissions,
    units: state.units,
    now: NOW_ANCHOR,
  });
}

function rowsOf(id: FixedQuestionId, movements?: Movement[]) {
  return answersFor(movements).find((answer) => answer.id === id)!.rows;
}

describe("fixedQuestionAnswers", () => {
  it("offers the fixed menu in a fixed order", () => {
    expect(answersFor().map((answer) => answer.question)).toEqual([
      "Which accepted referrals still need transport?",
      "Which discharge dependencies have no owner?",
      "Which requests have no ward asked?",
      "Which pulled beds are past their pull time limit?",
      "Which transfers have no recorded escort?",
    ]);
  });

  it("has an answer for every question in the demo seed", () => {
    for (const answer of answersFor()) expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("lists accepted referrals with no transport booked, and drops one once transport is booked", () => {
    const rows = rowsOf("accepted_need_transport");
    expect(rows.map((row) => row.source)).toContainEqual({ kind: "movement", id: "WF-003" });
    const state = seedWardFlowState();
    const booked = state.movements.map((movement) =>
      movement.id === "WF-003"
        ? { ...movement, transport: { id: "T-1", provider: "Ward escort" as const, escortRequired: true } }
        : movement,
    );
    expect(rowsOf("accepted_need_transport", booked).map((row) => row.key)).not.toContain("WF-003");
  });

  it("lists a pulled bed past its recorded pull time limit, and shows the limit without releasing", () => {
    const rows = rowsOf("pulls_past_limit");
    const row = rows.find((each) => each.key === "WF-004");
    expect(row?.detail).toContain("Pull time limit 10:32");
    expect(row?.detail).toContain("until a person releases it");
  });

  it("lists open requests with no ward asked, in recorded order", () => {
    const state = seedWardFlowState();
    const keys = rowsOf("requests_no_ward_asked").map((row) => row.key);
    const order = state.movements.map((movement) => movement.id);
    expect(keys).toContain("WF-001");
    expect(keys).not.toContain("WF-002");
    expect([...keys].sort((a, b) => order.indexOf(a as Movement["id"]) - order.indexOf(b as Movement["id"]))).toEqual(
      keys,
    );
  });

  it("answers discharge owners from the single blocker, saying no owner is recorded", () => {
    const rows = rowsOf("dependencies_no_owner");
    expect(rows.every((row) => row.source.kind === "discharge")).toBe(true);
    expect(rows[0]?.detail).toContain("no owner recorded");
  });

  it("names rows without a journey number", () => {
    for (const answer of answersFor()) {
      for (const row of answer.rows) expect(row.label).not.toMatch(/WF-/);
    }
  });
});
