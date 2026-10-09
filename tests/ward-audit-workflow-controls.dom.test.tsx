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
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
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
      <WardFlowProvider initialNow={NOW_ANCHOR}>
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
        />
      </WardFlowProvider>,
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

describe("bed dossier inbound bed", () => {
  it("offers no blocker or ED action on a bed with no admission yet", () => {
    const unit = seedWardFlowState().units[0];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedDossierDrawer
          selectedBed={4}
          bedItem={{ bedNumber: 4, bedLabel: "Bed 04", status: "incoming", statusText: "Inbound" }}
          unit={unit}
          onClose={() => {}}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={() => {}}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("button", { name: /Record blocker/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark at an ED/ })).toBeNull();
  });

  it("still offers the blocker and ED actions on a bed with an admission", () => {
    const unit = seedWardFlowState().units[0];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedDossierDrawer
          selectedBed={5}
          bedItem={{
            bedNumber: 5,
            bedLabel: "Bed 05",
            status: "occupied",
            statusText: "Inpatient",
            admissionId: "synthetic-admission",
            patientAlias: "Synthetic person",
          }}
          unit={unit}
          onClose={() => {}}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={() => {}}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("button", { name: /Record blocker/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark at an ED/ })).toBeInTheDocument();
  });
});

describe("bed dossier patient page link", () => {
  it("opens the person's own page, read through the admission, and is absent with no person", () => {
    const state = seedWardFlowState();
    const admission = state.admissions.find((row) => row.patientId);
    expect(admission).toBeDefined();
    const unit = state.units.find((row) => row.id === admission!.unitId)!;
    const drawer = (admissionId: string | undefined) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedDossierDrawer
          selectedBed={3}
          bedItem={{
            bedNumber: 3,
            bedLabel: "Bed 03",
            status: "occupied",
            statusText: "Inpatient",
            admissionId,
            patientAlias: "Synthetic person",
          }}
          unit={unit}
          onClose={() => {}}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={() => {}}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>
    );
    const view = render(drawer(admission!.id));
    expect(screen.getByRole("link", { name: /Patient page/ })).toHaveAttribute(
      "href",
      `/mockups/ward-flow/people/${encodeURIComponent(String(admission!.patientId))}`,
    );
    view.unmount();
    render(drawer(undefined));
    expect(screen.queryByRole("link", { name: /Patient page/ })).toBeNull();
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

describe("optional clinician-recorded ATS remains distinct from Ward Flow urgency", () => {
  it("offers ATS on the referral slide-out without changing the selected urgency", () => {
    wrap(<WardReferralDrawer onClose={() => {}} />);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
    );
    const chooser = screen.getByRole("combobox", { name: "ATS category (optional)" });
    expect(chooser).toHaveValue("");
    expect(
      within(chooser)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["ATS not recorded", "ATS 1", "ATS 2", "ATS 3", "ATS 4", "ATS 5"]);
    const urgencyBefore = (
      within(screen.getByRole("group", { name: "Urgency" }))
        .getAllByRole("radio")
        .find((input) => (input as HTMLInputElement).checked) as HTMLInputElement | undefined
    )?.value;
    expect(urgencyBefore).toBeTruthy();
    fireEvent.change(chooser, { target: { value: "5" } });
    expect(chooser).toHaveValue("5");
    const urgencyAfter = (
      within(screen.getByRole("group", { name: "Urgency" }))
        .getAllByRole("radio")
        .find((input) => (input as HTMLInputElement).checked) as HTMLInputElement | undefined
    )?.value;
    expect(urgencyAfter).toBe(urgencyBefore);
  });
});
