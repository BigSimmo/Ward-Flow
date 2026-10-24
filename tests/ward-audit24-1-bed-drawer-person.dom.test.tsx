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

import { WF_PHONE_QUERY } from "@/components/wf";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit 24-1 B-04: the bed drawer follows the person it was opened for. When another tab or a
 * refresh moves them out and someone else in, the drawer says so and offers none of the new
 * occupant's actions, and an open departure confirm closes.
 */
const UNIT = allUnits()[0];

function occupant(admissionId: string, alias: string): BedItem {
  return {
    bedNumber: 3,
    bedLabel: "Bed 03",
    status: "occupied",
    statusText: "Occupied",
    patientAlias: alias,
    admissionId,
    stayAdmissionId: admissionId,
    umrn: "SYN0000",
  } as BedItem;
}

function drawer(bedItem: BedItem | undefined, onRecordLeft = vi.fn(), onClose = vi.fn()) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBedDossierDrawer
        selectedBed={3}
        bedItem={bedItem}
        unit={UNIT}
        onClose={onClose}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={onRecordLeft}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />
    </WardFlowProvider>
  );
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
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ["desktop", () => {}],
  ["phone", asPhone],
])("Audit 24-1 B-04 on %s: the bed drawer follows the person", (_layout, setup) => {
  it("names the person who left and hides the new occupant's actions", () => {
    setup();
    const onRecordLeft = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(drawer(occupant("adm-x", "Synthetic Person X"), onRecordLeft, onClose));
    fireEvent.click(screen.getByRole("button", { name: "Record that they have left" }));
    expect(screen.getByTestId("ward-drawer-confirm")).toBeInTheDocument();

    rerender(drawer(occupant("adm-y", "Synthetic Person Y"), onRecordLeft, onClose));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "Synthetic Person X is no longer in bed 03. Close and reopen the bed to see who is there now.",
    );
    expect(screen.queryByTestId("ward-drawer-confirm")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record that they have left" })).not.toBeInTheDocument();
    expect(screen.queryByText("Synthetic Person Y")).not.toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
    expect(onRecordLeft).not.toHaveBeenCalled();
  });

  it("says so when the bed becomes empty", () => {
    setup();
    const { rerender } = render(drawer(occupant("adm-x", "Synthetic Person X")));
    rerender(
      drawer({
        ...occupant("adm-x", "Synthetic Person X"),
        patientAlias: undefined,
        admissionId: undefined,
        stayAdmissionId: undefined,
        status: "ready",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Synthetic Person X is no longer in bed 03.");
  });

  it("keeps showing the same person when nothing moved", () => {
    setup();
    const { rerender } = render(drawer(occupant("adm-x", "Synthetic Person X")));
    rerender(drawer(occupant("adm-x", "Synthetic Person X")));
    expect(screen.queryByTestId("ward-drawer-person-gone")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record that they have left" })).toBeInTheDocument();
  });
});
