import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeEdPressure } from "@/components/ward-management/coordinator/home-ed-pressure";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useDueSoonThresholds: () => DEFAULT_DUE_SOON_THRESHOLDS,
  useWardFlowSelect: () => ({
    configuration: {
      dueSoonUrgentMinutes: 60,
      dueSoonMinutes: 180,
      edAccessTargetMinutes: 1440,
    },
  }),
}));

afterEach(cleanup);
const now = 642;
const seed = seedWardFlowStateAt(0);
const occupied = seed.admissions.find((admission) => admission.state === "occupied")!;
const referralBase = seed.referrals[0]!;
const ward = seed.units[0]!;
const referral: Referral = {
  ...referralBase,
  id: "SYN-episode-acceptance",
  patientId: occupied.patientId ?? undefined,
  raisedAt: 600,
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        unitId: ward.id,
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      state: "accepted",
      acceptedUnitId: ward.id,
    },
  ],
};
function census(overrides: Partial<Parameters<typeof buildCensus>[0]> = {}) {
  return buildCensus({
    movements: [],
    referrals: [referral],
    units: seed.units,
    patients: seed.patients,
    admissions: [],
    now,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: new Date("2026-10-01T00:00:00+08:00"),
    ...overrides,
  });
}

describe("WF-FIG-002 referral episode membership", () => {
  it("keeps a new accepted ward episode despite an unrelated departed stay", () => {
    const old = { ...occupied, state: "departed" as const, referralId: "SYN-old-referral" };
    expect(census({ admissions: [old] }).rows.find((row) => row.key === referral.id)?.group).toBe("found");
  });
  it("settles an acceptance once its own admission exists, including a departed admission", () => {
    const linked = { ...occupied, state: "departed" as const, referralId: referral.id };
    expect(census({ admissions: [linked] }).rows.some((row) => row.key === referral.id)).toBe(false);
  });
  it("does not ask for a bed after a community team's acceptance", () => {
    const team: Referral = {
      ...referral,
      destinations: [{ destination: { kind: "community_team", teamName: "Synthetic team" }, state: "accepted" }],
    };
    expect(census({ referrals: [team] }).rows.some((row) => row.key === referral.id)).toBe(false);
  });
  it("keeps a community-origin acceptance by a ward", () => {
    expect(
      census({ referrals: [{ ...referral, source: "community" }] }).rows.find((row) => row.key === referral.id)?.group,
    ).toBe("found");
  });
});

describe("WF-FIG-013 near-term discharge wording", () => {
  it.each([
    [700, "Expected in 58m"],
    [642, "Expected now"],
    [641, "Expected 1m ago"],
    [null, "No date set"],
  ])("describes EDD %s accurately", (expectedDischargeAt, text) => {
    const row = census({
      referrals: [],
      admissions: [{ ...occupied, expectedDischargeAt: expectedDischargeAt as number | null }],
    }).rows.find((candidate) => candidate.kind === "admission");
    expect(row?.to).toBe(text);
  });
});

describe("WF-FIG-006 Home recorded due facts", () => {
  const base: Movement = {
    ...seed.movements[0]!,
    closure: undefined,
    examination: undefined,
    legalStatus: "Involuntary inpatient",
    legalForm: { code: "4A", kind: "transport", dueAt: 672 },
  };
  it.each([671, 672, 673])("does not count an ended deadline at minute %s", (at) => {
    const ended: Movement = { ...base, examination: { outcome: "inpatient_order", at: 642 } };
    render(
      <HomeEdPressure now={at} movements={[ended]} selectedEdId={undefined} onSelectEd={() => {}} service={null} />,
    );
    expect(screen.getByTestId(`ward-ed-${base.originEdId}`)).toHaveTextContent("1 on form");
    expect(screen.getByTestId(`ward-ed-${base.originEdId}`)).not.toHaveTextContent(/1 due/);
  });
  it("still counts the recorded due time of an active form", () => {
    render(
      <HomeEdPressure now={671} movements={[base]} selectedEdId={undefined} onSelectEd={() => {}} service={null} />,
    );
    expect(screen.getByTestId(`ward-ed-${base.originEdId}`)).toHaveTextContent(/1\s+due/);
  });
});
