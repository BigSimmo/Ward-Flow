import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import { LegalFormDetailsSection } from "@/components/ward-management/legal-forms/legal-form-details";
import type { Movement } from "@/components/ward-management/ward-model";

/*
 * C19 (design critique v2, Josh 13 Nov 2026): the phone and wide layouts are separate component
 * trees, so an open form's unsaved entries were lost when the screen crossed the phone width. The
 * bed drawer's observation level and review time, and a legal form's details from the paper (Form
 * 6B review date, "copy given"), now survive the switch; closing the form still drops them. Synthetic
 * seed data only; no clinical rule changes.
 */

let phone = false;
const listeners = new Set<() => void>();

function stubMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return phone && query === WF_PHONE_QUERY;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })),
  );
}

function crossPhoneWidth(toPhone: boolean) {
  act(() => {
    phone = toPhone;
    for (const listener of [...listeners]) listener();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  listeners.clear();
  phone = false;
});

const SEEDED = seedWardFlowState().admissions.find(
  (admission) => admission.unitId === allUnits()[0]!.id && admission.state === "occupied",
)!;

function showDrawer() {
  stubMedia();
  const item = {
    bedNumber: 3,
    bedLabel: "Bed 03",
    status: "occupied",
    statusText: "Inpatient",
    patientAlias: "Synthetic Person B",
    admissionId: SEEDED.id,
    stayAdmissionId: SEEDED.id,
    stayDays: 3,
    observation: { level: "general", intervalMinutes: null, reviewAt: null },
  } as BedItem;
  const drawer = (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBedDossierDrawer
        selectedBed={3}
        bedItem={item}
        unit={allUnits()[0]}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
        onSetObservation={() => ({ ok: true }) as never}
      />
    </WardFlowProvider>
  );
  return render(drawer);
}

describe("C19: unsaved entries survive the phone width", () => {
  for (const startPhone of [false, true]) {
    it(`bed drawer observation level and review time (${startPhone ? "phone to wide" : "wide to phone"})`, () => {
      phone = startPhone;
      showDrawer();
      fireEvent.click(screen.getByTestId("ward-observation-change"));
      const chips = within(screen.getByTestId("ward-observation-level")).getAllByRole("button");
      fireEvent.click(chips[chips.length - 1]!);
      fireEvent.change(screen.getByTestId("ward-observation-review-time"), { target: { value: "14:30" } });
      const chosen = screen.getByTestId("ward-observation-level").getAttribute("data-value");
      expect(chosen).not.toBe("general");

      crossPhoneWidth(!startPhone);

      expect(screen.getByTestId("ward-observation-level")).toHaveAttribute("data-value", chosen);
      expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("14:30");

      // And back again.
      crossPhoneWidth(startPhone);
      expect(screen.getByTestId("ward-observation-level")).toHaveAttribute("data-value", chosen);
      expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("14:30");
    });
  }

  it("a cancelled form, or a drawer closed and opened again, starts from the record, not the old draft", () => {
    const first = showDrawer();
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    fireEvent.change(screen.getByTestId("ward-observation-review-time"), { target: { value: "09:15" } });
    first.unmount();
    showDrawer();
    expect(screen.queryByTestId("ward-observation-review-time")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-observation-change"));
    expect(screen.getByTestId("ward-observation-review-time")).toHaveValue("");
  });

  it("legal form details: the review date and copy given survive a remount into the other layout", () => {
    const movement = seedWardFlowState().movements.find((each) => each.legalForm !== undefined) as Movement;
    expect(movement, "the seed has a journey with a form").toBeDefined();
    const sixB = { ...movement, legalForm: { ...movement.legalForm!, code: "6B" } } as Movement;
    const details = (
      <LegalFormDetailsSection
        movement={sixB}
        dayZero={new Date("2026-11-13T00:00:00+08:00")}
        onSave={() => ({ ok: true }) as never}
      />
    );
    // The legal forms screen renders the same section in its phone sheet or its wide panel.
    const { rerender } = render(<div key="wide">{details}</div>);
    fireEvent.click(screen.getByTestId("ward-legal-form-details-edit"));
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Copy to the person" })).getByRole("radio", { name: "Given" }),
    );
    const review = screen.getByLabelText(/Review by, as on the form/);
    fireEvent.change(review, { target: { value: "20/11/2026" } });
    fireEvent.input(review, { target: { value: "20/11/2026" } });

    rerender(<section key="phone">{details}</section>);

    expect(
      within(screen.getByRole("radiogroup", { name: "Copy to the person" })).getByRole("radio", { name: "Given" }),
    ).toBeChecked();
    expect(screen.getByLabelText(/Review by, as on the form/)).toHaveValue("20/11/2026");
  });
});
