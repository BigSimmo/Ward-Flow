import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  DECLINE_TARGET_ANSWERED_ELSEWHERE,
  DECLINE_TARGET_WITHDRAWN,
  declineTargetLeftNote,
} from "@/components/ward-management/ward/decline-target-left";
import { WardHomeTab } from "@/components/ward-management/ward/ward-home-tab";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

// A4-10 (H-0121): a decline form whose referral leaves this ward's queue used to vanish with no word.
const unit = unitById("rph-adult-secure")!;
const seedMovement = seedWardFlowState().movements[0]!;
const props: ComponentProps<typeof WardHomeTab> = {
  unit,
  units: [unit],
  capacity: { available: 2, occupied: 18 },
  accepted: [],
  incoming: [],
  withdrawn: [],
  overridesHere: [],
  now: NOW_ANCHOR,
  presentation: "answer",
  activeAnswerIndex: 0,
  setAnswerIndex: vi.fn(),
  visibleIncoming: [],
  declineOpenFor: seedMovement.id,
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
  resolvePatientIdentity: () => ({ displayName: "Synthetic Person", formalName: "Person, Synthetic", umrn: "UM100001", initials: "SP" }),
  lastActionRejection: null,
  overrideReasonForm: vi.fn(),
  liveFormAlerts: [],
};

function renderHome(overrides: Partial<ComponentProps<typeof WardHomeTab>>) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardHomeTab {...props} {...overrides} />
    </WardFlowProvider>,
  );
}

describe("a decline form whose referral has left the queue says why (A4-10)", () => {
  it("says nothing while the referral is still waiting, or once this ward answered it", () => {
    const never = () => false;
    expect(declineTargetLeftNote("MV-1", [{ id: "MV-1" }], [], never)).toBeUndefined();
    expect(declineTargetLeftNote("MV-1", [], [{ movementId: "MV-1" }], never)).toBeUndefined();
    expect(declineTargetLeftNote(null, [], [], never)).toBeUndefined();
  });

  it("names a withdrawal apart from another desk's answer", () => {
    expect(declineTargetLeftNote("MV-1", [], [], () => true)).toBe(DECLINE_TARGET_WITHDRAWN);
    expect(declineTargetLeftNote("MV-1", [], [], () => false)).toBe(DECLINE_TARGET_ANSWERED_ELSEWHERE);
  });

  it("shows the note on ward Home when another desk answered first", () => {
    renderHome({});
    expect(screen.getByTestId("ward-decline-target-left")).toHaveTextContent(DECLINE_TARGET_ANSWERED_ELSEWHERE);
  });

  it("shows the withdrawn note on ward Home for a withdrawn referral", () => {
    renderHome({ withdrawn: [seedMovement] });
    expect(screen.getByTestId("ward-decline-target-left")).toHaveTextContent(DECLINE_TARGET_WITHDRAWN);
  });

  it("shows no note when this ward answered the referral itself", () => {
    renderHome({ recentAnswers: [{ key: "k", movementId: seedMovement.id, outcome: "Declined" }] });
    expect(screen.queryByTestId("ward-decline-target-left")).not.toBeInTheDocument();
  });
});
