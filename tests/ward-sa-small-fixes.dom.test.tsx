import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Stream A small fixes (26 Oct 2026): H-0097 bed drawer focus, H-0127 urgency picker refresh. */
afterEach(() => cleanup());

describe("H-0097: the bed drawer opens on Close", () => {
  it("starts focus on Close, not on Previous bed", () => {
    const occupant = {
      bedNumber: 3,
      bedLabel: "Bed 03",
      status: "occupied",
      statusText: "Occupied",
      patientAlias: "Synthetic Person X",
      admissionId: "adm-x",
      stayAdmissionId: "adm-x",
      umrn: "SYN0000",
    } as BedItem;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedDossierDrawer
          selectedBed={3}
          bedItem={occupant}
          unit={allUnits()[0]}
          onClose={vi.fn()}
          onPrevBed={vi.fn()}
          onNextBed={vi.fn()}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={vi.fn()}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("button", { name: "Previous bed" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close bed drawer" }));
  });
});

describe("H-0127: the urgency picker opens on the tier the board shows now", () => {
  it("refreshes after another desk changes the tier", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => candidate.id === "WF-308")!;
    const panel = (shown: Movement) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ShortlistPanel
          movement={shown}
          now={NOW_ANCHOR}
          units={seed.units}
          bedReleases={seed.bedReleases}
          leaveBeds={seed.leaveBeds}
          admissions={wardAdmissions}
          referrals={seed.referrals}
          selectedUnitId={undefined}
          onSelectUnit={() => {}}
          dispatch={vi.fn()}
          parallelReferralCap={seed.configuration.parallelReferralCap}
        />
      </WardFlowProvider>
    );
    const changed = (movement.urgency === 1 ? 3 : 1) as 1 | 3;
    const { rerender } = render(panel(movement));
    rerender(panel({ ...movement, urgency: changed }));
    fireEvent.click(screen.getByTestId("ward-change-urgency-toggle"));
    const picker = screen.getByTestId("ward-change-urgency").querySelector("select")!;
    expect(picker.value).toBe(String(changed));
  });
});
