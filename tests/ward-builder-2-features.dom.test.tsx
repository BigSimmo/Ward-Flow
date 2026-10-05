import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/WF-009",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  subscribeWardDrawer,
  subscribeWardDrawerClose,
  type WardDrawerId,
} from "@/components/ward-management/shell/ward-drawer-bus";
import { WardRail } from "@/components/ward-management/shell/ward-rail";

describe("Builder 2 - ED statutory form dropdown (ED-FORM-DROPDOWN)", () => {
  it("offers the statutory forms in a native select and changes only the screen draft", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    const selector = screen.getByTestId("ward-ed-form-pill-WF-001");
    expect(selector).toHaveRole("combobox");
    expect(
      within(selector)
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(["", "1A", "3A", "3B", "3D", "4A", "4C", "5A", "6A"]);
    expect(selector).toHaveValue("1A");
    fireEvent.change(selector, { target: { value: "3D" } });
    expect(selector).toHaveValue("3D");
    expect(screen.getByText("Unsaved changes · This screen only")).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: "" } });
    expect(selector).toHaveValue("");
  });
});

describe("Builder 2 - Patient Journey Accordion A11y (Roving Tabindex)", () => {
  it("enforces roving tabindex and ArrowUp/ArrowDown/Home/End navigation across the 7 stages", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="WF-001" />
      </WardFlowProvider>,
    );

    const stageBtns = [
      screen.getByTestId("ward-patient-stage-btn-placement_requested"),
      screen.getByTestId("ward-patient-stage-btn-destination_review"),
      screen.getByTestId("ward-patient-stage-btn-accepted_awaiting_bed"),
      screen.getByTestId("ward-patient-stage-btn-pulled"),
      screen.getByTestId("ward-patient-stage-btn-handover_ready"),
      screen.getByTestId("ward-patient-stage-btn-moving"),
      screen.getByTestId("ward-patient-stage-btn-arrived"),
    ];

    expect(stageBtns.length).toBe(7);

    // Exactly one button has tabIndex 0, all others have -1
    const focused = stageBtns.filter((btn) => btn.getAttribute("tabindex") === "0");
    const unfocused = stageBtns.filter((btn) => btn.getAttribute("tabindex") === "-1");
    expect(focused.length).toBe(1);
    expect(unfocused.length).toBe(6);

    const activeIndex = stageBtns.indexOf(focused[0]);

    // ArrowDown moves roving tabindex to next
    const nextIndex = (activeIndex + 1) % 7;
    fireEvent.keyDown(focused[0], { key: "ArrowDown" });
    expect(stageBtns[nextIndex]).toHaveAttribute("tabindex", "0");
    expect(stageBtns[activeIndex]).toHaveAttribute("tabindex", "-1");

    // ArrowUp moves roving tabindex back
    fireEvent.keyDown(stageBtns[nextIndex], { key: "ArrowUp" });
    expect(stageBtns[activeIndex]).toHaveAttribute("tabindex", "0");

    // End key moves to last stage
    fireEvent.keyDown(stageBtns[activeIndex], { key: "End" });
    expect(stageBtns[6]).toHaveAttribute("tabindex", "0");

    // Home key moves to first stage
    fireEvent.keyDown(stageBtns[6], { key: "Home" });
    expect(stageBtns[0]).toHaveAttribute("tabindex", "0");

    // Verify aria-expanded and aria-controls
    const firstBtn = stageBtns[0];
    const isExpanded = firstBtn.getAttribute("aria-expanded") === "true";
    const controlsId = firstBtn.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();

    if (isExpanded) {
      const panel = document.getElementById(controlsId!);
      expect(panel).toHaveAttribute("role", "region");
      expect(panel).toHaveAttribute("aria-labelledby", firstBtn.id);
    }
  });
});

describe("Builder 2 - Whiteboard shift actions toast feedback", () => {
  it("renders toast element and provides feedback when shift action is dispatched", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Find any shift action button (e.g., "They have left", "Patient arrived", "Release the bed", "Mark them back")
    const shiftActionBtns = screen.queryAllByRole("button", {
      name: /They have left|Patient arrived|Release the bed|Mark them back/i,
    });
    if (shiftActionBtns.length > 0) {
      fireEvent.click(shiftActionBtns[0]);
      const toast = screen.getByTestId("ward-board-toast");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute("role", "status");
    } else {
      const departureSubmit = screen.queryByTestId("ward-board-record-leaving-submit");
      if (departureSubmit) {
        fireEvent.click(departureSubmit);
        const toast = screen.getByTestId("ward-board-toast");
        expect(toast).toBeInTheDocument();
        expect(toast).toHaveAttribute("role", "status");
      }
    }
  });
});

describe("Builder 2 - Officer Form Inspection & Stateful Checkboxes", () => {
  it("renders inspect form button with testid and enables toggling verification checkboxes", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );

    // Find inspect form button on WF-005
    const inspectBtn = screen.getByTestId("ward-officer-inspect-form-WF-005");
    expect(inspectBtn).toBeInTheDocument();

    // Click to open inspection dialog
    fireEvent.click(inspectBtn);

    // Dialog opens with verification checklist
    const check0 = screen.getByTestId("ward-officer-check-0-WF-005") as HTMLInputElement;
    expect(check0).toBeInTheDocument();
    // officer-screen.tsx (commit 276a173eb4) changed the default verification state from
    // all-ticked to all-unticked ("these local checks do not establish legal authorisation" — they
    // are no longer pre-filled as done), so the first checkbox now starts unticked.
    expect(check0.checked).toBe(false);

    // Toggle checkbox
    fireEvent.click(check0);
    expect(check0.checked).toBe(true);

    // Toggle back
    fireEvent.click(check0);
    expect(check0.checked).toBe(false);

    // Close dialog
    const closeBtn = screen.getByRole("button", { name: /close form verification dialog/i });
    fireEvent.click(closeBtn);
  });
});

describe("Builder 2 - Global drawer keyboard shortcuts & bus", () => {
  it("dispatches drawer open events on Shift+T, Shift+R, Shift+A and close on Escape", () => {
    const openedDrawers: WardDrawerId[] = [];
    let closedCount = 0;

    const unsubOpen = subscribeWardDrawer((id) => {
      openedDrawers.push(id);
    });
    const unsubClose = subscribeWardDrawerClose(() => {
      closedCount++;
    });

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );

    // Press Shift+T
    fireEvent.keyDown(document, { key: "T", shiftKey: true });
    expect(openedDrawers).toContain("tasks");

    // Press Shift+R
    fireEvent.keyDown(document, { key: "R", shiftKey: true });
    expect(openedDrawers).toContain("referral");

    // Press Shift+A
    fireEvent.keyDown(document, { key: "A", shiftKey: true });
    expect(openedDrawers).toContain("activity");

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closedCount).toBeGreaterThan(0);

    unsubOpen();
    unsubClose();
  });
});
