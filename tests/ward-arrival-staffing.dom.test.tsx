// Feature 7, "Plan staff for an arrival" (D-117 item 3): the receiving ward's incoming card asks the
// nurse in charge to plan staff when the referral records aggression or absconding. Synthetic seed
// data only.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { ArrivalStaffingNote } from "@/components/ward-management/ward-arrival-staffing-note";
import {
  arrivalStaffingPrompt,
  type CardReferral,
} from "@/components/ward-management/patients/patient-referral-safety";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

function movement(overrides: Partial<Movement> = {}): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: 0, referralId: "RF-SYNTH-1", ...overrides } as Movement;
}

function referral(riskFlags: string[], id = "RF-SYNTH-1"): CardReferral {
  return { id, raisedAt: -60, intake: { riskFlags } } as unknown as CardReferral;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("arrivalStaffingPrompt", () => {
  it("asks for nothing when the referral records neither aggression nor absconding", () => {
    expect(arrivalStaffingPrompt(movement(), [referral([])])).toBeUndefined();
    expect(arrivalStaffingPrompt(movement(), [referral(["suicide", "medical", "securityEscort"])])).toBeUndefined();
  });

  it("asks when the referral records aggression", () => {
    expect(arrivalStaffingPrompt(movement(), [referral(["vulnerable", "aggression"])])).toEqual({
      reasons: ["aggression"],
    });
  });

  it("asks when the referral records absconding, in the word list's words", () => {
    expect(arrivalStaffingPrompt(movement(), [referral(["absconding"])])).toEqual({
      reasons: ["absent without leave"],
    });
    expect(arrivalStaffingPrompt(movement(), [referral(["aggression", "absconding"])])?.reasons).toEqual([
      "aggression",
      "absent without leave",
    ]);
  });

  it("asks for nothing when the referral is not shared with this desk", () => {
    expect(arrivalStaffingPrompt(movement(), [])).toBeUndefined();
    expect(arrivalStaffingPrompt(movement(), [referral(["aggression"], "RF-SYNTH-2")])).toBeUndefined();
  });

  it("reads a referral from the ward's own inbox (FD-23), and nothing from one sent elsewhere", () => {
    const sent = seedWardFlowState().referrals.find((entry) =>
      entry.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
    )!;
    const arm = sent.destinations.find((entry) => entry.destination.kind === "psychiatric_ward")!;
    const unitId = arm.acceptedUnitId ?? (arm.destination as { unitId: string }).unitId;
    const flagged = { ...sent, intake: { ...sent.intake, riskFlags: ["absconding"] } } as Referral;
    const request = movement({ referralId: sent.id });
    expect(arrivalStaffingPrompt(request, wardReferralInboxEntries([flagged], unitId))?.reasons).toEqual([
      "absent without leave",
    ]);
    expect(arrivalStaffingPrompt(request, wardReferralInboxEntries([flagged], "not-this-ward"))).toBeUndefined();
  });

  it("renders one calm line with the reason", () => {
    render(<ArrivalStaffingNote movement={movement()} referrals={[referral(["aggression"])]} testId="note" />);
    expect(screen.getByTestId("note")).toHaveTextContent(
      "Plan staffing for this arrival · Referral records aggression",
    );
    expect(screen.getByTestId("note")).not.toHaveAttribute("role", "alert");
  });
});

function renderAnswer(unitId: string, movementId: string) {
  window.history.replaceState(
    null,
    "",
    `/ward-flow/ward/${unitId}/answer?movement=${encodeURIComponent(encodeRecordAddress(movementId))}`,
  );
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} presentation="answer" />
    </WardFlowProvider>,
  );
}

describe("ward incoming card", () => {
  it("shows the staffing note when the referral records aggression and absconding", async () => {
    renderAnswer("bty-adult-secure", "WF-017");
    const card = await screen.findByTestId("ward-incoming-WF-017");
    expect(within(card).getByTestId("ward-answer-arrival-staffing-WF-017")).toHaveTextContent(
      "Referral records aggression and absent without leave",
    );
  });

  it("shows no staffing note when the referral records neither flag", async () => {
    renderAnswer("bun-adult-open", "WF-022");
    const card = await screen.findByTestId("ward-incoming-WF-022");
    expect(within(card).getByTestId("ward-answer-safety-tags-WF-022")).toHaveTextContent("Suicide or self-harm");
    expect(within(card).queryByText(/Plan staffing for this arrival/u)).toBeNull();
  });
});
