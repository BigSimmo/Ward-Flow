import { createRef, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest} onClickCapture={(event) => event.preventDefault()}>
      {children}
    </a>
  ),
}));
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";

/**
 * Walk-through WT-15 (26 Oct 2026): Patient page in the ward bed drawer did nothing. The link closed
 * the drawer first, and closing steps history back over the drawer's own entry, which cancelled the
 * navigation. The link now leaves the drawer open and simply navigates. Synthetic seed only.
 */
describe("the bed drawer's Patient page link navigates (WT-15)", () => {
  it("does not close the drawer, which would step history back over the navigation", () => {
    const state = seedWardFlowState();
    const admission = state.admissions.find((row) => row.patientId && row.state === "occupied")!;
    const unit = state.units.find((row) => row.id === admission.unitId)!;
    const onClose = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedDossierDrawer
          selectedBed={3}
          bedItem={{
            bedNumber: 3,
            bedLabel: "Bed 03",
            status: "occupied",
            statusText: "Inpatient",
            admissionId: admission.id,
            patientAlias: "Synthetic person",
          }}
          unit={unit}
          onClose={onClose}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={() => {}}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("link", { name: /Patient page/ }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
