import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  GovernanceAccessRecordPanel,
  GovernanceOverridesRegisterPanel,
  GovernanceWorkbench,
} from "@/components/ward-management/governance-registers";
import { NO_OVERRIDE_RECORDED_NOTICE } from "@/components/ward-management/override-register";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { MovementId } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * These are the legacy source panels that `GovernanceView` now exposes separately from its captured
 * session-event register. This suite keeps their narrower claims honest while the mounted Governance
 * suite covers the real audit-event review workflow.
 *
 * The access-record finding this build exists to catch: the drawing's Access record tab
 * (`governance-third-edition.html:5790`) claims, unqualified, "Every time somebody opened a
 * person's record, most recent first, across the whole network." That is false — the only access
 * log in this app is session-only, per-page, and has no `who` (`search/access-record.ts`). The
 * second `describe` block below is the guard that this screen never renders that sentence, or any
 * paraphrase of it.
 */

const NOW = NOW_ANCHOR;
const REASON: OverrideReason = OVERRIDE_REASONS[1];
const UNIT_A = allUnits()[0];

/** A movement the reducer will actually accept a referral for, resolved from the real seed rather
 *  than hand-built — same technique as `tests/ward-override-register-render.dom.test.tsx`. */
const REFERABLE: MovementId = (() => {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.stage === "placement_requested");
  if (!movement) throw new Error("the seed no longer holds a referable movement");
  return movement.id;
})();

function RegisterHarness() {
  const { movements, units, now, dispatch, rejections } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid="record-override"
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: REFERABLE,
            unitIds: [UNIT_A.id],
            overrideReason: REASON,
          })
        }
      >
        Record an override
      </button>
      {/* A refused dispatch is silent on screen — surfaced so a mistyped event does not leave every
          assertion below quietly measuring an empty register. */}
      <span data-testid="rejection-count">{rejections.length}</span>
      <GovernanceOverridesRegisterPanel movements={movements} units={units} now={now} />
    </>
  );
}

function renderRegister() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <RegisterHarness />
    </WardFlowProvider>,
  );
}

describe("GovernanceOverridesRegisterPanel", () => {
  it("labels the legacy override source as a register without inventing a historical gate verdict", () => {
    renderRegister();
    const panel = screen.getByTestId("ward-governance-overrides-register");
    expect(within(panel).getByRole("heading", { name: "Overrides register" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Every override this system has recorded, across the network");
    // A recorded override does not retain evidence that an eligibility gate failed at that time.
    expect(panel).not.toHaveTextContent("Gate overridden");
  });

  it("shows the real empty state on the seeded fixture — nothing is fabricated", () => {
    renderRegister();
    const panel = screen.getByTestId("ward-governance-overrides-register");
    expect(within(panel).getByTestId("ward-override-register-empty")).toHaveTextContent(NO_OVERRIDE_RECORDED_NOTICE);
  });

  it("renders a real override the moment one is dispatched through the live reducer", () => {
    renderRegister();
    const panel = screen.getByTestId("ward-governance-overrides-register");
    expect(within(panel).queryByTestId("ward-override-register")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("record-override"));
    expect(screen.getByTestId("rejection-count"), "the dispatch was refused by the reducer").toHaveTextContent("0");

    const list = within(panel).getByTestId("ward-override-register");
    expect(within(list).getByTestId(`ward-override-entry-${REFERABLE}`)).toBeInTheDocument();
    expect(within(list).getByTestId(`ward-override-reason-${REFERABLE}`)).toHaveTextContent(REASON);
    const destinations = within(list).getByTestId(`ward-override-units-${REFERABLE}`);
    expect(destinations).toHaveTextContent(`Referred by override to ${UNIT_A.name}`);
    // A recorded override does not establish that an eligibility gate failed at that time.
    expect(destinations).not.toHaveTextContent(/failing gate/i);
  });
});

describe("GovernanceAccessRecordPanel", () => {
  it("never claims a durable, network-wide, who-naming access record — the one finding this build must not cross", () => {
    render(<GovernanceAccessRecordPanel />);
    const panel = screen.getByTestId("ward-governance-access-record");
    // The exact false claim the drawing makes (governance-third-edition.html:5790) — proven absent
    // here rather than merely undocumented, in either its verbatim or its "whole network" form.
    expect(panel).not.toHaveTextContent("Every time somebody opened a person's record");
    expect(panel).not.toHaveTextContent(/across the whole network/i);
  });

  it("states plainly what the real access record is, and that it is not this", () => {
    render(<GovernanceAccessRecordPanel />);
    const panel = screen.getByTestId("ward-governance-access-record");
    expect(panel).toHaveTextContent("Kept for this session only, and none is sent anywhere.");
    expect(within(panel).getByTestId("ward-governance-access-record-scope")).toHaveTextContent(
      "no row names who looked",
    );
  });
});

describe("the Session Access Record tab", () => {
  it("says in plain view that it is this session only and not saved, and lists no invented access", () => {
    const seed = seedWardFlowState();
    render(<GovernanceWorkbench movements={seed.movements} units={seed.units} now={NOW} />);
    fireEvent.click(screen.getByRole("tab", { name: "Session Access Record" }));
    expect(screen.getByTestId("ward-governance-access-session-only").textContent).toBe("This session only, not saved");
    const table = screen.getByRole("table", { name: /kept for this session only/ });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(table.textContent).not.toMatch(/WF-\d+/);
  });
});

describe("the override and decision registers hold only what this session records", () => {
  it("starts empty, says so, and states no invented safety record", () => {
    const seed = seedWardFlowState();
    const { container } = render(<GovernanceWorkbench movements={seed.movements} units={seed.units} now={NOW} />);
    const text = container.textContent ?? "";
    expect(text).toContain("No override audit is recorded in this session.");
    expect(text).toContain("Safety incidents not recorded");
    expect(text).toContain("This session");
    for (const invented of ["Pendelton", "OVR-107", "Zero Safety Incidents", "Past 24 Hours Statewide"]) {
      expect(text, invented).not.toContain(invented);
    }
  });

  it("opens the endorse form empty, so nobody records a review they did not write", () => {
    const seed = seedWardFlowState();
    render(<GovernanceWorkbench movements={seed.movements} units={seed.units} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Endorse current audit" }));
    expect((document.getElementById("endorseVerdict") as HTMLSelectElement).value).toBe("");
    expect((document.getElementById("endorseRole") as HTMLSelectElement).value).toBe("");
    expect((document.getElementById("endorseNotes") as HTMLTextAreaElement).value).toBe("");
    expect(document.body.textContent).not.toContain("no adverse patient safety events");
  });
});
