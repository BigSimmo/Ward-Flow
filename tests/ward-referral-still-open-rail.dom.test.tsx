import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import type { WardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  ReferralDrawerFoot,
  ReferralSummaryRail,
} from "@/components/ward-management/referrals/ward-referral-drawer-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 10 (10 Nov 2026): the Ready to send rail's "Still open" list. It lists what the record holds
 * open and never blocks Send. Synthetic seed records only.
 */
afterEach(() => {
  cleanup();
  discardReferralDraft();
});

const ARRIVED = NOW_ANCHOR - 90;

function stubState(): WardReferralDrawerState {
  const seed = seedWardFlowState().movements.find((movement) => !movement.closure && movement.originEdId)!;
  const rest: Partial<Movement> = { ...seed };
  delete rest.medicalClearance;
  delete rest.referralId;
  const movement = { ...rest, id: "WF-SYN-1", patientId: "PT-SYN-1", openedAt: ARRIVED } as Movement;
  const referral = {
    id: "RF-SYN-1",
    patientId: "PT-SYN-1",
    raisedAt: ARRIVED + 10,
    urgency: 2,
    destinations: [
      {
        destination: { kind: "psychiatric_ward", unitId: "rph-adult-secure", sex: "Female" },
        state: "queued",
        referredAt: ARRIVED + 10,
        informationNeeds: [{ need: "legal_form_copy", at: ARRIVED + 20, by: "Ward nurse in charge" }],
      },
    ],
  } as unknown as Referral;
  const noop = () => undefined;
  return {
    onClose: noop,
    bodyRef: { current: null },
    sectionId: "syn",
    previewOpen: false,
    setPreviewOpen: noop,
    summaryOpen: true,
    setSummaryOpen: noop,
    sentReferralId: null,
    draftKeptAt: null,
    draftNowMs: 0,
    itemsTotal: 6,
    itemsLeft: 0,
    itemsReady: 6,
    readyRows: [],
    destType: "ward",
    communityNeeds: {},
    sendWarnings: [],
    patientRecord: { id: "PT-SYN-1" },
    referrals: [referral],
    movements: [movement],
    openJourney: { movementId: movement.id, siteCode: "RPH", edName: "Synthetic ED" },
    documentation: { medical: "" },
    now: NOW_ANCHOR,
    view: "compose",
    onRestart: noop,
    sendGate: { allowed: true, buttonProps: {}, reason: "" },
    confirmationOpen: false,
    setConfirmationOpen: noop,
    sendPending: false,
    submissionAwaitingRecord: false,
    setFlowError: noop,
    isPhone: false,
    setPhoneStepOpen: noop,
    activeSection: "placement",
    dirty: true,
    requestClose: noop,
    keepAndClose: noop,
    goNext: noop,
    goBack: noop,
    handleDispatch: noop,
    footStatus: { tone: "neutral", first: "Ready to send", second: "", alert: false },
    phMode: "list",
    phFirstNeeded: undefined,
    phNeededLabels: [],
    phNeedsLine: "",
    phCloseSheet: noop,
    phOpenStep: noop,
    phStepIndex: 3,
    sectionIds: ["patient", "referral", "documentation", "placement"],
    needed: { patient: 0, referral: 0, documentation: 0, placement: 0 },
  } as unknown as WardReferralDrawerState;
}

describe("Still open in the Ready to send rail", () => {
  it("lists exactly the recorded needs and clearance timing, and Send stays enabled", () => {
    const s = stubState();
    render(
      <>
        <ReferralSummaryRail s={s} alreadyOpen={undefined} />
        <ReferralDrawerFoot s={s} />
      </>,
    );
    const list = screen.getByTestId("ward-referral-still-open");
    expect(within(list).getByText("Still open")).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Medical clearance not recorded (since 09:12)", "Ward asked for: legal form copy"]);
    const send = screen.getByRole("button", { name: "Send referral" });
    expect(send).toBeEnabled();
    expect(send).not.toHaveAttribute("aria-disabled");
  });

  it("is hidden when nothing is open", () => {
    const s = { ...stubState(), referrals: [], openJourney: undefined } as unknown as WardReferralDrawerState;
    render(<ReferralSummaryRail s={s} alreadyOpen={undefined} />);
    expect(screen.queryByTestId("ward-referral-still-open")).not.toBeInTheDocument();
  });

  it("shows the seeded ED patient's clearance timing in the real slide-out", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.id === "WF-001")!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer
          onClose={vi.fn()}
          initialCategory="ed"
          initialDestination="ward"
          initialPatientId={movement.patientId}
          initialOriginSiteCode={edById(movement.originEdId)?.siteCode}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-referral-still-open-clearance")).toHaveTextContent(
      "Medical clearance not recorded (since 09:07)",
    );
  });
});
