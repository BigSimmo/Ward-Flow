import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Lets a test hold an assign command open while the dialog changes; every other call runs as normal.
const commandGate = vi.hoisted(() => ({ next: undefined as Promise<unknown> | undefined }));
vi.mock("@/components/ward-management/ward-command-completion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-command-completion")>();
  return {
    ...actual,
    confirmedWardCommand: (...args: Parameters<typeof actual.confirmedWardCommand>) => {
      const held = commandGate.next;
      commandGate.next = undefined;
      return held ?? actual.confirmedWardCommand(...args);
    },
  };
});

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import {
  CommunityScreenNoteModal,
  CommunityScreenReferralModal,
} from "@/components/ward-management/community/community-screen-modals";
import { CommunityScreenTransportCancelDialog } from "@/components/ward-management/community/community-screen-transport-dialogs";
import {
  CommunityTeamPhone,
  CommunityWorthAttention,
} from "@/components/ward-management/community/community-team-phone";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * The Community team redesign (Josh, approved 31 Oct 2026): the community desk's own-team view, the
 * phone lists' Show more, and the redesigned pop-ups. The pop-up states below cannot be reached from
 * the synthetic sample (no waiting referral, pulled bed or community booking there, and nothing
 * opens the crisis dialog), so these tests are their evidence.
 */

const team = COMMUNITY_TEAM_PAGES[0];

function renderTeam() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreen teamId={team.id} />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function asCommunityDesk() {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "community", scope: { kind: "team", teamName: team.name } });
  });
}

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  vi.unstubAllGlobals();
});

describe("the community desk sees its own team only", () => {
  it("keeps the coordinator's way across: Change team, the Caseload foot item and the other teams", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Change team" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Other community teams" })).toBeInTheDocument();
    expect(screen.getByText("The bed coordinator's view of this team's referrals and bed flow.")).toBeInTheDocument();
  });

  it("hides Change team, the Caseload foot item and the other teams, and says it is the team's own view", () => {
    asCommunityDesk();
    renderTeam();
    expect(screen.queryByRole("button", { name: "Change team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Other community teams" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-community-switch-team")).not.toBeInTheDocument();
    expect(screen.getByText("Your team's referrals and bed flow.")).toBeInTheDocument();
    expect(screen.queryByText("The bed coordinator's view of this team's referrals and bed flow.")).toBeNull();
    // The title still says how many are on the caseload.
    expect(screen.getByTestId("ward-community-hero-answer")).toHaveTextContent("on the caseload");
  });

  it("has no Switch team on a phone for the community desk", () => {
    asPhone();
    asCommunityDesk();
    renderTeam();
    expect(screen.getByTestId("ward-community-phone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch team" })).not.toBeInTheDocument();
  });
});

describe("a long list folds only when two or more rows would be hidden (Josh, 31 Oct 2026)", () => {
  function phoneWithRows(count: number) {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: `row-${index}`,
      name: `Testperson, Row${index}`,
      testId: `fixture-row-${index}`,
    }));
    return render(
      <ToastProvider>
        <CommunityTeamPhone
          teamName="Synthetic Team"
          caseload={count}
          sub={null}
          figures={[]}
          list="ctos"
          onList={() => {}}
          lists={[{ id: "ctos", label: "Caseload", groups: [{ id: "ctos", rows }] }]}
          onIntake={() => {}}
          onSwitchTeam={() => {}}
          switchTriggerRef={createRef<HTMLButtonElement>()}
          since={null}
          notices={null}
          howToReach={null}
          onDuty={null}
          coverage={null}
          samples={[]}
          actions={[]}
          attention={[]}
        />
      </ToastProvider>,
    );
  }

  it("shows all nine rows, with no Show more, rather than saying Show 1 more", () => {
    asPhone();
    phoneWithRows(9);
    const list = screen.getByTestId("ward-community-phone-list-ctos");
    expect(within(list).getAllByTestId(/^fixture-row-/u)).toHaveLength(9);
    expect(within(list).queryByRole("button", { name: /^Show/u })).toBeNull();
  });

  it("folds ten rows to eight, names the two more, then shows all of them", () => {
    asPhone();
    phoneWithRows(10);
    const list = screen.getByTestId("ward-community-phone-list-ctos");
    expect(within(list).getAllByTestId(/^fixture-row-/u)).toHaveLength(8);
    const more = within(list).getByRole("button", { name: "Show 2 more in Caseload" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(within(list).getAllByTestId(/^fixture-row-/u)).toHaveLength(10);
    expect(within(list).getByRole("button", { name: "Show fewer in Caseload" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("Worth attention shows three items in full, and folds four to two with Show 2 more", () => {
    const three = render(<CommunityWorthAttention items={["One", "Two", "Three"]} data-testid="fixture-attention" />);
    expect(within(screen.getByTestId("fixture-attention")).getAllByRole("listitem")).toHaveLength(3);
    expect(within(screen.getByTestId("fixture-attention")).queryByRole("button", { name: /^Show/u })).toBeNull();
    three.unmount();
    render(<CommunityWorthAttention items={["One", "Two", "Three", "Four"]} data-testid="fixture-attention" />);
    const attention = screen.getByTestId("fixture-attention");
    expect(within(attention).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(within(attention).getByRole("button", { name: "Show 2 more" }));
    expect(within(attention).getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("the redesigned pop-ups (states the sample cannot reach)", () => {
  it("Assign referral: one step title, the person under it, the facts, and the desk-not-clinician line", () => {
    const view = {
      identityOf: () => "Testperson, Alex · UM900001",
      activeModal: { referral: { id: "RF-T1", urgency: 2, homeRegion: "Perth Metropolitan", source: "community" } },
      setActiveModal: vi.fn(),
      referralModalRef: createRef<HTMLDivElement>(),
      referralModalBackdropRef: createRef<HTMLDivElement>(),
    };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreenReferralModal view={view as never} />
      </WardFlowProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Assign referral" });
    expect(dialog).toHaveTextContent("Testperson, Alex · UM900001");
    expect(within(dialog).getByText("Urgency")).toBeInTheDocument();
    expect(within(dialog).getByText("Region")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("Patient:");
    expect(dialog).toHaveTextContent("This names the team's desk, not a clinician.");
    expect(within(dialog).getByTestId("community-assign-take-RF-T1")).toHaveTextContent("Take for this team");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(view.setActiveModal).toHaveBeenCalledWith(null);
  });

  it("Assign referral: an answer still on its way for one referral never shows under the next", async () => {
    const referralA = { id: "RF-TA", urgency: 2, homeRegion: "Perth Metropolitan", source: "community" };
    const referralB = { id: "RF-TB", urgency: 3, homeRegion: "Perth Metropolitan", source: "community" };
    const viewFor = (referral: typeof referralA | null) => ({
      identityOf: (r: { id: string }) => `Testperson, ${r.id}`,
      activeModal: referral ? { referral } : null,
      setActiveModal: vi.fn(),
      referralModalRef: createRef<HTMLDivElement>(),
      referralModalBackdropRef: createRef<HTMLDivElement>(),
    });
    const shown = (referral: typeof referralA | null) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreenReferralModal view={viewFor(referral) as never} />
      </WardFlowProvider>
    );
    for (const closeFirst of [true, false]) {
      let answer: (outcome: { status: "accepted" }) => void = () => {};
      commandGate.next = new Promise((resolve) => {
        answer = resolve;
      });
      const { rerender, unmount } = render(shown(referralA));
      fireEvent.click(screen.getByTestId("community-assign-take-RF-TA"));
      if (closeFirst) rerender(shown(null));
      rerender(shown(referralB));
      await act(async () => {
        answer({ status: "accepted" });
        await Promise.resolve();
      });
      const dialog = screen.getByRole("dialog", { name: "Assign referral" });
      expect(dialog).toHaveTextContent("Testperson, RF-TB");
      expect(within(dialog).queryByRole("status")).toBeNull();
      expect(dialog).not.toHaveTextContent("Assigned to this team's desk.");
      unmount();
    }
  });

  function noteView(type: "contact" | "handover" | "crisis") {
    return {
      now: NOW_ANCHOR,
      team: { name: "Synthetic Team" },
      activeModalType: type,
      setActiveModalType: vi.fn(),
      contactRecord: null,
      contactSaveMessage: null,
      contactSaveDisabled: true,
      handleSaveClinicalContact: vi.fn(),
      noteModalRef: createRef<HTMLDivElement>(),
      noteModalOverlayRef: createRef<HTMLDivElement>(),
      teamConfig: {
        name: "Synthetic Team",
        consultant: "Dr A. Example",
        campus: "Synthetic Campus",
        service: "Synthetic Service",
      },
      waitingReferrals: [],
      caseloadRows: [],
      recordedCtoCount: 0,
    };
  }

  it("Record contact: says why Save contact waits, and keeps the dialog's id", () => {
    render(<CommunityScreenNoteModal view={noteView("contact") as never} />);
    const dialog = screen.getByRole("dialog", { name: "Record clinical contact" });
    expect(dialog).toHaveAttribute("id", "contactModal");
    expect(within(dialog).getByTestId("ward-community-contact-save")).toHaveAttribute("aria-disabled", "true");
    expect(dialog).toHaveTextContent("Wait for confirmation or use Retry before submitting again.");
    expect(within(dialog).getByTestId("ward-community-contact-save-status")).toHaveTextContent(
      "No contact has been confirmed in this session.",
    );
  });

  it("Catchment counts: three counts as tiles, as at the moment shown, synthetic", () => {
    render(<CommunityScreenNoteModal view={noteView("handover") as never} />);
    const dialog = screen.getByRole("dialog", { name: "Print catchment counts" });
    expect(dialog).toHaveAttribute("id", "handoverModal");
    for (const word of ["active caseload", "waiting referrals", "recorded Form 5A/5B"]) {
      expect(within(dialog).getByText(word)).toBeInTheDocument();
    }
    expect(dialog).toHaveTextContent("Synthetic figures, not a record of any real day.");
    expect(within(dialog).getByRole("button", { name: "Print report" })).toBeInTheDocument();
  });

  it("crisis example: kept on the kit frame, labelled synthetic, never live", () => {
    render(<CommunityScreenNoteModal view={noteView("crisis") as never} />);
    const dialog = screen.getByRole("dialog", { name: "Catchment crisis response & outreach duty" });
    expect(dialog).toHaveAttribute("id", "crisisModal");
    expect(dialog).toHaveTextContent("Synthetic example. Not a live roster, vehicle or deployment.");
    expect(dialog).toHaveTextContent("Example deployment (synthetic):");
    expect(dialog).toHaveTextContent("0491 570 110");
  });

  it("Cancel this team's booking: names the booking, shows why Confirm cancel waits, and keeps the provider wording", () => {
    const view = {
      transportCancelFor: "MV-T1",
      cancelTransportReason: undefined,
      setCancelTransportReason: vi.fn(),
      cancelTransportBlocked: "Choose why the job is being cancelled.",
      closeTransportCancel: vi.fn(),
      transportCancelDialogRef: createRef<HTMLDivElement>(),
      submitCancelTransport: vi.fn(),
      movements: [],
      umrnLookup: new Map(),
    };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityScreenTransportCancelDialog view={view as never} />
      </WardFlowProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Cancel this team's transport booking" });
    // No person resolves for this movement, so the booking is named by its id, never guessed.
    expect(dialog).toHaveTextContent("Booking MV-T1");
    const select = within(dialog).getByLabelText("Why is the job being cancelled?");
    expect(select).toHaveValue("");
    expect(within(dialog).getByRole("option", { name: "Choose a reason…" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Cancel the booking with the provider by phone.");
    const confirm = within(dialog).getByTestId("ward-community-cancel-transport-confirm-MV-T1");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    // The reason is shown, not only read to a screen reader.
    expect(dialog).toHaveTextContent("Choose why the job is being cancelled.");
    fireEvent.click(confirm);
    expect(view.submitCancelTransport).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep booking" }));
    expect(view.closeTransportCancel).toHaveBeenCalled();
  });
});
