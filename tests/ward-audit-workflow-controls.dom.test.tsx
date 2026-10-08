import { createRef, type ReactNode } from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/referrals/new",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import type { Referral } from "@/components/ward-management/ward-model";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";

function wrap(child: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{child}</WardFlowProvider>);
}
function shortcut() {
  return document.querySelector<HTMLButtonElement>('button[class*="restingItem"]');
}

describe("discharge actions stay usable and accessible across filters", () => {
  it("opens a visible blocked release and restores connected focus after close", async () => {
    wrap(<DischargeBoard />);
    const button = shortcut();
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("region", { name: "Discharge worklist" })),
    );
    expect(document.activeElement!.isConnected).toBe(true);
  });
  it("does not offer release shortcuts in incompatible status or record views", () => {
    wrap(<DischargeBoard />);
    expect(shortcut()).not.toBeNull();
    fireEvent.click(screen.getByTestId("ward-discharge-kpi-confirmed"));
    expect(shortcut()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Admission records/ }));
    expect(shortcut()).toBeNull();
  });
  it("offers every blocker in both populations and announces pipeline counts", () => {
    wrap(<DischargeBoard />);
    const labels = [
      "All blockers",
      "Accommodation",
      "Transport",
      "Coordination",
      "Clean / prep",
      "Pharmacy",
      "Placement",
      "Family / carer",
      "Funding / plan",
    ];
    expect(
      within(screen.getByRole("combobox", { name: "Blocker" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(labels);
    fireEvent.change(screen.getByRole("combobox", { name: "Blocker" }), { target: { value: "pharmacy" } });
    expect(screen.getByTestId("discharge-pipeline-announcement")).toHaveTextContent(/Bed releases: \d+ blocked/);
    fireEvent.click(screen.getByRole("button", { name: /Admission records/ }));
    expect(within(screen.getByRole("combobox", { name: "Blocker" })).getAllByRole("option")).toHaveLength(9);
    fireEvent.change(screen.getByRole("combobox", { name: "Blocker" }), { target: { value: "pharmacy" } });
    expect(screen.getByRole("combobox", { name: "Blocker" })).toHaveValue("pharmacy");
    expect(screen.getByTestId("discharge-pipeline-announcement")).toHaveTextContent(/Admission records: \d+ blocked/);
  });
});

describe("ready-bed dossier tells the truth", () => {
  it("offers actual referral review without inventing a patient or reservation", () => {
    const unit = seedWardFlowState().units[0];
    render(
      <WardBedDossierDrawer
        selectedBed={1}
        bedItem={{ bedNumber: 1, bedLabel: "Bed 01", status: "ready", statusText: "Ready" }}
        unit={unit}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />,
    );
    expect(screen.getByText("No patient match is recorded for this bed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review current referrals/ })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/referrals",
    );
    expect(document.body).not.toHaveTextContent("Medically cleared");
    expect(document.body).not.toHaveTextContent("Bed locked for transit");
    expect(screen.queryByRole("button", { name: /Allocate/ })).toBeNull();
  });
});

function AdmissionProbe({ id }: { id: string }) {
  const { admissions, leaveBeds } = useWardFlow();
  const admission = admissions.find((row) => row.id === id)!;
  return (
    <output
      data-testid="admission-date-probe"
      data-date={admission.expectedDischargeAt}
      data-state={admission.state}
      data-leave-count={leaveBeds.length}
    />
  );
}
describe("ward board departure correction uses the real admission", () => {
  it("cancels without changes and updates tomorrow without creating a leave bed", () => {
    const seed = seedWardFlowState();
    const admission = seed.admissions.find((row) => row.state === "occupied")!;
    wrap(
      <>
        <WardBoard unitId={admission.unitId} />
        <AdmissionProbe id={admission.id} />
      </>,
    );
    const tileButton = document.getElementById(`ward-board-tile-${admission.id}`)!;
    expect(tileButton).not.toBeNull();
    fireEvent.click(tileButton);
    const probe = screen.getByTestId("admission-date-probe");
    const original = probe.getAttribute("data-date");
    const leaveCount = probe.getAttribute("data-leave-count");
    fireEvent.click(screen.getByRole("button", { name: "Move the date" }));
    fireEvent.change(screen.getByLabelText("Expected departure time"), { target: { value: "16:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel date change" }));
    expect(probe).toHaveAttribute("data-date", original);
    fireEvent.click(screen.getByRole("button", { name: "Move the date" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Departure day" }), { target: { value: "tomorrow" } });
    fireEvent.change(screen.getByLabelText("Expected departure time"), { target: { value: "16:45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save departure date" }));
    expect(probe).toHaveAttribute(
      "data-date",
      String((Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY + 16 * 60 + 45),
    );
    expect(probe).toHaveAttribute("data-state", "occupied");
    expect(probe).toHaveAttribute("data-leave-count", leaveCount);
  });
});

describe("referral evidence is visible and honestly qualified", () => {
  it("shows absent hospital catchment data instead of inventing statewide routing", () => {
    window.history.replaceState({}, "", "/mockups/ward-flow/referrals/new");
    wrap(<ReferralIntakeForm />);
    expect(document.body).not.toHaveTextContent("Statewide hospital catchment");
    const wardOption = screen.getByTestId("ward-referral-intake-destination-option-psychiatric_ward");
    const disclosure = within(wardOption).getByText(/approved-hospital column is not seeded/);
    expect(disclosure).not.toHaveClass("sr-only");
    expect(disclosure.closest(".sr-only")).toBeNull();
  });
  it("qualifies a stale but available candidate as unresolved capacity", () => {
    const unit = seedWardFlowState().units.find((unit) => unit.id === "scgh-adult-open")!;
    const stale = {
      ...unit,
      allocatable: { ...unit.allocatable, value: 2, confirmedAt: NOW_ANCHOR - 10000 },
      empty: { ...unit.empty, value: 2, confirmedAt: NOW_ANCHOR - 10000 },
    };
    const referral: Referral = {
      id: "RF-AUDIT-CAPACITY",
      ageBand: "Adult",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      raisedAt: NOW_ANCHOR - 10,
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    };
    render(
      <ReferralMatchView referral={referral} units={[stale]} now={NOW_ANCHOR} dispatch={() => {}} rejections={[]} />,
    );
    expect(screen.getByText(/1 capacity unresolved/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("blocked, no bed");
  });
});

describe("draft handover cannot invent missing triage answers", () => {
  it("shows unanswered urgency and referral source in its letterhead and clipboard", async () => {
    window.history.replaceState({}, "", "/mockups/ward-flow/referrals/new");
    const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      wrap(<ReferralIntakeForm />);
      fireEvent.click(screen.getByRole("button", { name: "Copy Handover" }));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Urgency: Not answered"));
      fireEvent.click(screen.getByRole("button", { name: /Preview Referral/ }));
      const dialog = screen.getByRole("dialog", { name: "Referral Letterhead Preview" });
      expect(dialog).toHaveTextContent("Urgency: Not answered");
      expect(dialog).toHaveTextContent("Referral Source: Not answered");
      expect(dialog).not.toHaveTextContent("Tier 2 (Urgent)");
      expect(dialog).not.toHaveTextContent("Community CMHT");
      await waitFor(() => expect(screen.getByText("Clinical handover text copied to clipboard.")).toBeInTheDocument());
    } finally {
      if (previous) Object.defineProperty(navigator, "clipboard", previous);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});
