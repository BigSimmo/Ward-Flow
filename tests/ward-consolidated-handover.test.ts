import { expect, it } from "vitest";
import {
  HANDOVER_CHIPS,
  toHandoverRow,
  groupRows,
  nextStep,
} from "@/components/ward-management/handover/handover-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
const state = seedWardFlowState();
const row = toHandoverRow(state.movements[0]!, state.units, state.patients, state.referrals);
it.each([
  ["coordinator", "Bed coordinator"],
  ["ward", "Ward nurse in charge"],
  ["ed", "ED mental health team"],
] as const)("Mine represents the %s desk and only highlights its owner", (role, owner) => {
  const chip = HANDOVER_CHIPS.find((chip) => chip.id === "mine")!;
  expect(chip.test({ ...row, owner }, NOW_ANCHOR, role)).toBe(true);
  const foreign = role === "coordinator" ? "ED mental health team" : "Bed coordinator";
  expect(chip.test({ ...row, owner: foreign }, NOW_ANCHOR, role)).toBe(false);
});
it("describes held beds accurately while preserving the Move by instruction and due grouping", () => {
  const held = {
    ...row,
    stage: "pulled" as const,
    actNow: false,
    urgent: false,
    formDueAt: undefined,
    pullExpiresAt: NOW_ANCHOR + 180,
  };
  const groups = groupRows([held], "meet", "wait", NOW_ANCHOR, NOW_ANCHOR + 30);
  const group = groups.find((group) => group.rows.length)!;
  expect(group.id).toBe("acc");
  expect(group.title + group.why).not.toMatch(/not ready|not yet free/i);
  expect(nextStep(held, NOW_ANCHOR, NOW_ANCHOR + 30, () => 1).text).toMatch(/Move by/);
  expect(groupRows([held], "meet", "wait", NOW_ANCHOR, NOW_ANCHOR + 200).find((group) => group.rows.length)?.id).toBe(
    "due",
  );
});
