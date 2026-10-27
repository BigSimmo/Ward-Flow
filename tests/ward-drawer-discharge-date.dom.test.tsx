import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";

/**
 * Walk-through WT-16 (26 Oct 2026): Going out read "No date" in the ward bed drawer with no way to
 * set it there. The nurse in charge now sets the date from the drawer, with the time they type.
 * Synthetic seed only.
 */
const state = seedWardFlowState();
const admission = state.admissions.find((row) => row.state === "occupied" && row.patientId)!;
const unit = state.units.find((row) => row.id === admission.unitId)!;

function Probe() {
  const { admissions, rejections } = useWardFlow();
  const stay = admissions.find((row) => row.id === admission.id);
  return (
    <>
      <output data-testid="edd">{String(stay?.expectedDischargeAt ?? "none")}</output>
      <output data-testid="rejections">{rejections.map((entry) => entry.reason).join(" / ")}</output>
    </>
  );
}

afterEach(() => setDeskRole("coordinator"));

describe("the ward sets the discharge date from the bed drawer (WT-16)", () => {
  it("records tomorrow at the typed time as the ward", () => {
    setDeskRole("ward");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
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
          onClose={() => {}}
          drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
          setDrawerLeavingDestination={() => {}}
          onRecordLeft={() => {}}
          bedDrawerRef={createRef<HTMLElement>()}
          onKeyDown={() => {}}
        />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Plan to leave" }));
    fireEvent.click(screen.getAllByTestId("ward-drawer-discharge-date-open")[0]);
    const form = screen.getByTestId("ward-drawer-discharge-date");
    fireEvent.change(within(form).getByLabelText("Day"), { target: { value: "1" } });
    fireEvent.change(within(form).getByLabelText("Expected discharge time"), { target: { value: "10:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save date" }));
    const tomorrowTen = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY + MINUTES_PER_DAY + 600;
    expect(screen.getByTestId("rejections").textContent).toBe("");
    expect(screen.getByTestId("edd").textContent).toBe(String(tomorrowTen));
    expect(screen.queryByTestId("ward-drawer-discharge-date")).toBeNull();

    // Form-friction 63: changing a recorded date opens on that day and time, and Save waits for a change.
    fireEvent.click(screen.getAllByTestId("ward-drawer-discharge-date-open")[0]);
    const again = screen.getByTestId("ward-drawer-discharge-date");
    expect(within(again).getByLabelText("Day")).toHaveValue("1");
    expect(within(again).getByLabelText("Expected discharge time")).toHaveValue("10:00");
    expect(within(again).getByRole("button", { name: "Save date" })).toBeDisabled();
    expect(again).toHaveTextContent("Change the day or time to save");
    fireEvent.change(within(again).getByLabelText("Expected discharge time"), { target: { value: "11:00" } });
    fireEvent.click(within(again).getByRole("button", { name: "Save date" }));
    expect(screen.getByTestId("edd").textContent).toBe(String(tomorrowTen + 60));
  });
});
