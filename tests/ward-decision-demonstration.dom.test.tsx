import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { WardDecisionsCockpit } from "@/components/ward-management/ward/ward-decisions-cockpit";
import { WardHomeTab } from "@/components/ward-management/ward/ward-home-tab";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
const unit = unitById("rph-adult-secure")!;
const props: ComponentProps<typeof WardHomeTab> = {
  unit,
  units: [unit],
  capacity: { available: 2, occupied: 18 },
  accepted: [],
  incoming: [],
  withdrawn: [],
  overridesHere: [],
  now: NOW_ANCHOR,
  presentation: "overview",
  activeAnswerIndex: 0,
  setAnswerIndex: vi.fn(),
  visibleIncoming: [],
  declineOpenFor: null,
  toggleDecline: vi.fn(),
  declineReason: undefined,
  setDeclineReason: vi.fn(),
  submitDecline: vi.fn(),
  priorRejectionCountRef: { current: 0 },
  rejections: [],
  dispatch: vi.fn(),
  setCheckToken: vi.fn(),
  recentAnswers: [],
  breakdown: { confirmedToday: 0, expectedToday: 0, onLeave: 0 },
  pendingBedReleasesCount: 0,
  unitLeaveBedsCount: 0,
  resolvePatientIdentity: vi.fn(),
  lastActionRejection: null,
  overrideReasonForm: vi.fn(),
  liveFormAlerts: [],
};
describe("ward decision demonstration boundaries", () => {
  it("does not expose fictional clinical actions on the default operational surface", () => {
    render(<WardDecisionsCockpit unit={unit} />);
    expect(screen.getByText(/Not wired in this prototype/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Declare AWOL/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Aaron K\./)).not.toBeInTheDocument();
  });
  it("does not show the illustrative banner or fictional clinical actions", () => {
    render(<WardDecisionsCockpit unit={unit} demonstration />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Declare AWOL/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Aaron K\./)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toBeInTheDocument();
    expect(screen.getByText("Not wired in this prototype.")).toBeInTheDocument();
  });
  it("does not invent a named patient or form deadline when the ward has no supplied alerts", () => {
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardHomeTab {...props} />
      </WardFlowProvider>,
    );
    expect(view.container.textContent).not.toMatch(/Gianna Marrowvale|54m left|11:42 AWST/);
  });
  it("renders the supplied ward alerts rather than a fixed example", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardHomeTab
          {...props}
          liveFormAlerts={[
            {
              key: "recorded-form",
              title: "Recorded review",
              countdown: "20m",
              text: "Review time entered by clinician",
              tone: "warning",
            },
          ]}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Recorded review")).toBeVisible();
    expect(screen.getByText("20m")).toBeVisible();
    expect(screen.getByText("Review time entered by clinician")).toBeVisible();
  });
});
