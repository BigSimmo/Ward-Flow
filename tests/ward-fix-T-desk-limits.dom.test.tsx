import "@testing-library/jest-dom/vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow/people/WF-005" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { MIDLAND_DEMO_TEAM } from "@/components/ward-management/community/team-2026/midland-demo";
import { PatientTransitOperations } from "@/components/ward-management/patients/patient-transit-operations";
import { setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { DEMO_COMMUNITY_TEAM_ID } from "@/components/ward-management/tools/ward-demo-roles";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { roleLimitFrom, useRoleGate } from "@/components/ward-management/ward-role-gate";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/*
 * F-54 (A9-35, K35, A12-03, A14-17) and F-108 (A14-14, A14-15, approved by Josh 13 Nov 2026): a desk
 * was shown buttons it could never use, and the ward desk could ask more wards and withdraw a referral,
 * which are the coordinator's. DESIGN-SYSTEM.md, Actions: never usable by this desk, not shown.
 * Synthetic data only.
 */

const WARD_DESK: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["scgh-adult-open"] } };
const COMMUNITY_DESK: WardAccess = { role: "community", scope: { kind: "team", teamName: "Midland" } };

function useDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
}

afterEach(() => {
  cleanup();
  setWardAccess(STATEWIDE_COORDINATOR);
  setWardFeatureFlagOnDevice("role-access", null);
  nav.pathname = "/ward-flow/people/WF-005";
});

describe("F-54: a control this desk can never use is left out, not greyed", () => {
  it("a community desk's discharge date limit is 'never', so the control is left out", () => {
    useDesk(COMMUNITY_DESK);
    const { result } = renderHook(() => useRoleGate());
    const gate = result.current("UPDATE_EXPECTED_DISCHARGE");
    expect(gate.allowed).toBe(false);
    expect(gate.never).toBe(true);
    expect(roleLimitFrom(result.current)("UPDATE_EXPECTED_DISCHARGE")).toBeNull();
  });

  it("the coordinator, who can switch desk, still sees the greyed control with its reason", () => {
    nav.pathname = "/ward-flow/community/midland";
    const { result } = renderHook(() => useRoleGate());
    const gate = result.current("UPDATE_EXPECTED_DISCHARGE");
    // The community route gives the community role, which may not; the coordinator can switch desk.
    expect(gate.allowed).toBe(false);
    expect(gate.never).toBe(false);
    expect(typeof roleLimitFrom(result.current)("UPDATE_EXPECTED_DISCHARGE")).toBe("string");
  });

  it("an allowed action has no limit", () => {
    const { result } = renderHook(() => useRoleGate());
    expect(roleLimitFrom(result.current)("UPDATE_EXPECTED_DISCHARGE")).toBeUndefined();
  });
});

function Deck({ id, patch }: { id: string; patch?: (movement: Movement) => Movement }) {
  const movement = useWardFlow().movements.find((row) => row.id === id)!;
  return <PatientTransitOperations movement={patch ? patch(movement) : movement} showMetrics={false} bare />;
}

function SearchingMovementId() {
  const movement = useWardFlow().movements.find(
    (row) =>
      !row.closure &&
      ["placement_requested", "destination_review"].includes(row.stage) &&
      !row.acceptedUnitId &&
      row.referredUnitIds.length > 0,
  );
  return movement ? <Deck id={movement.id} /> : <p>no searching movement in the seed</p>;
}

describe("F-108: asking wards and withdrawing a referral stay with the coordinator", () => {
  function renderSearching() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <SearchingMovementId />
        </ToastProvider>
      </WardFlowProvider>,
    );
  }

  it("the coordinator is offered the Ask count and Withdraw referral", () => {
    renderSearching();
    expect(screen.queryByText("no searching movement in the seed")).toBeNull();
    expect(screen.getByTestId("ward-ask-count")).toBeInTheDocument();
    expect(screen.getAllByText("Withdraw referral", { selector: "summary" })).toHaveLength(1);
  });

  it("a ward desk is offered neither", () => {
    useDesk(WARD_DESK);
    renderSearching();
    expect(screen.queryByTestId("ward-ask-count")).toBeNull();
    expect(screen.queryAllByText("Withdraw referral", { selector: "summary" })).toHaveLength(0);
  });

  it("the community desk opens on the Midland demo team, which has its referrals", () => {
    expect(COMMUNITY_TEAM_PAGES.some((team) => team.id === DEMO_COMMUNITY_TEAM_ID)).toBe(true);
    expect(MIDLAND_DEMO_TEAM.test(DEMO_COMMUNITY_TEAM_ID)).toBe(true);
  });
});
