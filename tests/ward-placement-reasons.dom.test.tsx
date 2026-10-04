import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { eligibility, type EligibilityVerdict } from "@/components/ward-management/ward-eligibility";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { PLACEMENT_REASON_GROUPS, placementReason } from "@/components/ward-management/ward-placement-reasons";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const gender = PLACEMENT_REASON_GROUPS.find((group) => group.key === "gender")!;

/**
 * Owner request, 4 October 2026: each suggested ward shows why it fits or does not. Every reason
 * must be the engine's own verdict, regrouped — never a second opinion.
 */
describe("placement reasons", () => {
  it("says Not met with the engine's own sentence when a gate in the group fails", () => {
    const verdict: EligibilityVerdict = {
      eligible: false,
      gates: [
        { gate: "gender_designation", pass: false, detail: "Male-only ward; referral records Female." },
        { gate: "sex_mix", pass: true, detail: "Sex mix within limits." },
      ],
    };
    expect(placementReason(verdict, gender)).toEqual({
      label: "Not met",
      tone: "danger",
      detail: "Male-only ward; referral records Female.",
    });
  });

  it("says Met only when every emitted gate passed, and Not checked when none was emitted", () => {
    const passed: EligibilityVerdict = {
      eligible: true,
      gates: [{ gate: "sex_mix", pass: true, detail: "Sex mix within limits." }],
    };
    expect(placementReason(passed, gender).label).toBe("Met");
    expect(placementReason({ eligible: true, gates: [] }, gender).label).toBe("Not checked");
  });

  it("agrees with eligibility() for every seeded movement and ward: a failing gate is never shown as Met", () => {
    const units = allUnits();
    for (const movement of wardMovements.slice(0, 6)) {
      for (const unit of units) {
        const verdict = eligibility(movement, unit, NOW_ANCHOR);
        for (const group of PLACEMENT_REASON_GROUPS) {
          const anyFailed = verdict.gates.some((gate) => group.gates.includes(gate.gate) && !gate.pass);
          expect(placementReason(verdict, group).label === "Not met", `${movement.id} ${unit.id} ${group.key}`).toBe(
            anyFailed,
          );
        }
      }
    }
  });

  it("renders a visible reason row per group on the network shortlist, with the caveat as text", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Placement workspace" }));
    const shortlist = screen.getByRole("complementary", { name: "Explainable shortlist" });
    for (const group of PLACEMENT_REASON_GROUPS) {
      const row = within(shortlist).getByTestId(`ward-network-reason-${group.key}`);
      expect(within(row).getByRole("rowheader")).toHaveTextContent(group.heading);
      expect(row.querySelectorAll("td").length).toBeGreaterThan(0);
    }
    expect(within(shortlist).getByTestId("ward-network-reason-distance")).toBeInTheDocument();
    expect(within(shortlist).getByTestId("ward-network-reason-caveat")).toHaveTextContent(
      "home catchment and where family live are not recorded",
    );
    // The eligibility reason is on screen, not only in a tooltip.
    expect(within(shortlist).getByRole("row", { name: /Eligibility/ })).toHaveTextContent(/Eligible now|Not eligible/);
  });
});
