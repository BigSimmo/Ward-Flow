import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite (ward-capacity-view.dom.test.tsx,
// ward-escalation.dom.test.tsx, ward-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids requiring an App Router
// context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const REFERABLE_MOVEMENT = (() => {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.stage === "placement_requested");
  if (!movement) throw new Error("the seed no longer holds a referable movement");
  return movement.id;
})();

const OVERRIDE_UNIT = allUnits()[0];

/** Raises a real CHANGE_URGENCY event through the live reducer — mirrors `ClockAdvancer` in
 * ward-escalation.dom.test.tsx / ward-flow-provider.dom.test.tsx — so this suite proves the
 * governance board's change audit reacts to the same dispatch path the real screens use, not a
 * fixture snapshot frozen at render time. */
function UrgencyChanger({ movementId }: { movementId: string }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now,
          movementId,
          urgency: 1,
          reason: "reassessed",
        })
      }
    >
      raise urgency change
    </button>
  );
}

function OverrideRecorder() {
  const { now, dispatch, rejections } = useWardFlow();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: REFERABLE_MOVEMENT,
            unitIds: [OVERRIDE_UNIT.id],
            overrideReason: OVERRIDE_REASONS[1],
          })
        }
      >
        record governance override
      </button>
      <span data-testid="governance-override-rejections">{rejections.length}</span>
    </>
  );
}

function DemoResetter() {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>
      reset governance demo
    </button>
  );
}

function renderGovernance(includeOverrideRecorder = false) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardModeWorkspace mode="governance" />
      <UrgencyChanger movementId="WF-002" />
      {includeOverrideRecorder ? <OverrideRecorder /> : null}
      <DemoResetter />
    </WardFlowProvider>,
  );
}

/** The captured-event register sits on the Audit trail tab since the Tabs build (9 Oct 2026). */
function openAuditTrail() {
  fireEvent.click(screen.getByRole("radio", { name: /^Audit trail/ }));
}

describe("GovernanceView", () => {
  it("carries the not-a-medical-device statement, the same wording the coordinator screen uses", () => {
    renderGovernance();
    const notice = screen.getByTestId("ward-governance-medical-device-notice");
    expect(notice).toHaveTextContent("This screen is not a medical device. It orders operational placement work only");
    expect(notice.querySelector("strong")).toHaveTextContent("not a medical device");
  });

  it("describes a recorded override without inventing a historical gate verdict", () => {
    renderGovernance(true);
    fireEvent.click(screen.getByRole("button", { name: "record governance override" }));

    expect(screen.getByTestId("governance-override-rejections"), "the reducer refused the override").toHaveTextContent(
      "0",
    );
    openAuditTrail();
    const register = screen.getByRole("region", { name: "Captured events" });
    fireEvent.click(within(register).getByRole("button", { name: /Refer to wards/i }));
    const detail = screen.getByTestId("ward-governance-override-detail");
    expect(detail).toHaveTextContent(OVERRIDE_REASONS[1]);
    expect(detail).toHaveTextContent(/Override fact recorded\s*Yes/);
    expect(detail).toHaveTextContent(/Prior gate verdict\s*Not captured/);
    expect(detail).toHaveTextContent(OVERRIDE_UNIT.name);
    expect(detail).not.toHaveTextContent(/failing gate was overridden/i);
  });

  it("records an administrative review against a real captured event and guards the resulting review event", () => {
    renderGovernance(true);
    fireEvent.click(screen.getByRole("button", { name: "record governance override" }));

    openAuditTrail();
    const register = screen.getByRole("region", { name: "Captured events" });
    const overrideEvent = within(register).getByRole("button", { name: /Refer to wards/i });
    expect(overrideEvent).toHaveTextContent("Accepted");
    expect(overrideEvent).toHaveTextContent("Flow coordinator");
    expect(overrideEvent).toHaveTextContent("Unreviewed");

    fireEvent.click(overrideEvent);
    const eventFacts = screen.getByRole("region", { name: "Event facts" });
    expect(eventFacts).toHaveTextContent("10:42");
    expect(eventFacts).toHaveTextContent("Flow coordinator");
    expect(screen.getByRole("region", { name: "Review history" })).toHaveTextContent(
      "No review recorded for this event.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    const reviewPanel = screen.getByTestId("ward-governance-decision-record");
    expect(within(reviewPanel).getByRole("status")).toHaveTextContent("Reviewed recorded.");
    expect(reviewPanel).toHaveTextContent("1 recorded review · role recorded");
    expect(overrideEvent).toHaveTextContent("Reviewed");
    const history = within(reviewPanel).getByRole("region", { name: "Review history" });
    const recordedReview = within(history).getByRole("listitem");
    expect(recordedReview).toHaveTextContent("Reviewed");
    expect(recordedReview).toHaveTextContent("10:42 · Flow coordinator");

    const reviewEvent = within(register).getByRole("button", { name: /Review event/i });
    expect(reviewEvent).toHaveTextContent("Accepted");
    expect(reviewEvent).toHaveTextContent("Review attempt");
    fireEvent.click(reviewEvent);

    expect(screen.getByRole("region", { name: "Review history" })).toHaveTextContent(
      "Review attempts cannot be reviewed.",
    );
    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Follow-up required" })).toBeDisabled();
  });

  it("clears the captured-event selection and review controls when the demo resets", () => {
    renderGovernance(true);
    fireEvent.click(screen.getByRole("button", { name: "record governance override" }));

    openAuditTrail();
    const register = screen.getByRole("region", { name: "Captured events" });
    fireEvent.click(within(register).getByRole("button", { name: /Refer to wards/i }));
    expect(screen.getByRole("heading", { name: "Refer to wards" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "reset governance demo" }));

    expect(screen.getByRole("heading", { name: "No events captured yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event detail" })).toBeInTheDocument();
    // Since 26 Sept 2026 the override list starts empty (no typed example is pre-selected), so the
    // inspector's own empty state carries the same instruction beside the header's screen-reader copy.
    expect(screen.getAllByText("Select an event from the register").length).toBeGreaterThan(0);
    const reviewPanel = screen.getByTestId("ward-governance-decision-record");
    expect(reviewPanel).toHaveTextContent("No event selected");
    expect(within(reviewPanel).getByRole("button", { name: "Mark reviewed" })).toBeDisabled();
    expect(within(reviewPanel).getByRole("button", { name: "Follow-up required" })).toBeDisabled();
  });

  it("does not offer a legacy facts tab or a change-audit panel", () => {
    renderGovernance();
    fireEvent.click(screen.getByRole("button", { name: "raise urgency change" }));
    expect(screen.queryByRole("tab", { name: "Legacy facts" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-change-audit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-change-audit-empty")).not.toBeInTheDocument();
  });

  it("does not offer an effectiveness tab or publish effectiveness figures", () => {
    renderGovernance();
    expect(screen.queryByRole("tab", { name: "Effectiveness" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-effectiveness")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-effectiveness-acceptance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-dropped-measure")).not.toBeInTheDocument();
  });

  it("does not show a session access record, an audit id, or a route", () => {
    renderGovernance();
    expect(screen.queryByRole("tab", { name: "Session Access Record" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Audit ID" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Location · Route" })).not.toBeInTheDocument();
    expect(screen.queryByText("Override Audit ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer Route")).not.toBeInTheDocument();
  });
});
