import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WF_PHONE_QUERY } from "@/components/wf";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

/*
 * C03 (design critique v2, Josh 13 Nov 2026): a closed bed with nobody in it opened as an empty
 * patient record ("No occupant recorded", the "This person" and "Legal" tabs), because the drawer
 * branched on "ready" rather than on whether anyone is in the bed. It now opens in the empty-bed
 * layout with the closure, in the bed list's and bed board's own words, and the reason chosen on
 * closing. Synthetic data only.
 */

function show(phone: boolean, reason: "staffing" | undefined, closedReview?: string) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: phone && query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const base = allUnits()[0]!;
  const unit: Unit = {
    ...base,
    closedBeds: [{ bedNumber: 4, at: NOW_ANCHOR - 90, by: "Nurse in charge", ...(reason ? { reason } : {}) }],
  };
  const item = {
    bedNumber: 4,
    bedLabel: "Bed 04",
    status: "closed",
    statusText: "Closed",
    closedReview,
  } as BedItem;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBedDossierDrawer
        selectedBed={4}
        bedItem={item}
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
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("C03: a closed empty bed opens as the bed and its closure", () => {
  for (const phone of [false, true]) {
    const layout = phone ? "phone" : "tablet and desktop";
    it(`shows Closed, Not offered and the reason, never a patient record (${layout})`, () => {
      show(phone, "staffing", "Review 14:00");
      const drawer = screen.getAllByTestId("bed-telemetry-drawer").at(-1)!;
      expect(drawer).toHaveTextContent("Closed bed");
      expect(drawer).toHaveTextContent("Not offered");
      expect(drawer).toHaveTextContent("Closed until reopened · Review 14:00");
      expect(screen.getByTestId("ward-drawer-closed-reason")).toHaveTextContent("Staffing");
      expect(drawer).not.toHaveTextContent("No occupant recorded");
      expect(drawer).not.toHaveTextContent("This person");
      expect(screen.queryByRole("tab", { name: /Legal/ })).toBeNull();
    });

    it(`says when no reason was recorded (${layout})`, () => {
      show(phone, undefined);
      expect(screen.getByTestId("ward-drawer-closed-reason")).toHaveTextContent("No reason recorded");
      expect(screen.getAllByTestId("bed-telemetry-drawer").at(-1)!).toHaveTextContent("Closed until it is reopened");
    });
  }
});
