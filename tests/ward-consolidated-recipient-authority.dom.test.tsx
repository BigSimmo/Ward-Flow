import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Referral } from "@/components/ward-management/ward-model";
const desk = vi.hoisted(() => ({ role: "ward", unitId: "rph-adult-secure" }));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => desk.role,
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({
    role: desk.role,
    scope: desk.role === "ward" ? { kind: "ward", unitIds: [desk.unitId] } : { kind: "ed", edId: "rph-ed" },
  }),
}));
vi.mock("@/components/ward-management/ward-sender-presentation", () => ({
  useSenderPresentation: () => ({ required: false, referralFor: () => undefined }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const state = seedWardFlowState();
function renderDecision(kind: "psychiatric_ward" | "emergency_department") {
  const base = state.referrals.find((r) => r.destinations.some((d) => d.destination.kind === kind))!;
  const arm = base.destinations.find((d) => d.destination.kind === kind)!;
  const referral = {
    ...base,
    destinations: [
      {
        ...arm,
        state: "queued",
        destination: { ...arm.destination, ...(kind === "psychiatric_ward" ? { unitId: desk.unitId } : {}) },
      },
    ],
  } as Referral;
  const dispatch = vi.fn();
  render(
    <ReferralMatchView referral={referral} units={state.units} now={NOW_ANCHOR} dispatch={dispatch} rejections={[]} />,
  );
  return dispatch;
}
it.each(["ward", "ed"])("submits a receiving %s decline with the actual desk authority", (role) => {
  desk.role = role;
  const dispatch = renderDecision(role === "ward" ? "psychiatric_ward" : "emergency_department");
  fireEvent.click(screen.getByTestId("ward-referral-match-decline-open"));
  fireEvent.click(screen.getAllByRole("radio")[0]!);
  fireEvent.click(
    screen.getByTestId(
      role === "ward" ? "ward-referral-match-decline" : "ward-referral-match-decline-emergency_department",
    ),
  );
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "DECLINE_REFERRAL",
      role,
      ...(role === "ward" ? { actingUnitId: desk.unitId } : {}),
    }),
  );
});
it("submits ED acceptance using ED authority", () => {
  vi.useFakeTimers();
  desk.role = "ed";
  const dispatch = renderDecision("emergency_department");
  fireEvent.click(screen.getByTestId("ward-referral-match-accept-emergency_department"));
  vi.advanceTimersByTime(1000);
  fireEvent.click(screen.getByTestId("ward-referral-match-confirm-accept-emergency_department"));
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ACCEPT_REFERRAL", role: "ed" }));
});

it("submits a permitted ward acceptance with its own acting ward", async () => {
  const { referralCandidates } = await import("@/components/ward-management/ward-referrals");
  const eligible = state.referrals.flatMap((referral) =>
    referral.destinations.flatMap((arm) => {
      if (arm.destination.kind !== "psychiatric_ward" || !["Male", "Female"].includes(arm.destination.gender ?? ""))
        return [];
      return referralCandidates(referral, arm.destination, state.units, NOW_ANCHOR)
        .filter((candidate) => candidate.verdict.eligible)
        .map((candidate) => ({ referral, arm, candidate }));
    }),
  )[0];
  expect(eligible, "seed must include an eligible receiving ward").toBeDefined();
  const { referral, arm, candidate } = eligible!;
  desk.role = "ward";
  desk.unitId = candidate.unit.id;
  const dispatch = vi.fn();
  render(
    <ReferralMatchView
      referral={{
        ...referral,
        destinations: [
          { ...arm, state: "queued", destination: { ...arm.destination, unitId: desk.unitId } },
        ] as Referral["destinations"],
      }}
      units={state.units}
      now={NOW_ANCHOR}
      dispatch={dispatch}
      rejections={[]}
    />,
  );
  fireEvent.click(screen.getByTestId(`ward-referral-match-phone-cand-${desk.unitId}`));
  fireEvent.click(screen.getByTestId("ward-referral-match-phone-accept"));
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: "ACCEPT_REFERRAL", role: "ward", actingUnitId: desk.unitId, unitId: desk.unitId }),
  );
});
