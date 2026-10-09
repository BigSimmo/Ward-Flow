import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Issue 3: Movement Drawer Browser Back Sync", () => {
  function renderMovements() {
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
    // v6 (7 Oct 2026): the worklist shows the first rows of each group until Show all; the drawer
    // cases open a row that may sit past that point, so they open the full list first.
    fireEvent.click(screen.getByRole("button", { name: /^Show all \d+$/u }));
    return view;
  }

  function openDrawer(id: string) {
    // Rows show the patient's name (owner, 26 Sept 2026); find them by their hidden key.
    const rowNodes = document.querySelectorAll(`[data-ward-primitive='record-row'][data-record-key='${id}']`);
    for (const node of rowNodes) {
      const row = node;
      if (!row) continue;
      const trigger = within(row as HTMLElement).queryByRole("button", { name: /What is recorded/u });
      if (trigger) {
        fireEvent.click(trigger);
        return screen.getByRole("dialog");
      }
    }
    throw new Error(`could not find trigger for ${id}`);
  }

  it("pushes history state when MovementDrawer opens, and popstate closes drawer", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    renderMovements();

    const drawer = openDrawer("WF-001");
    expect(drawer).toBeInTheDocument();
    expect(pushSpy).toHaveBeenCalledWith({ wardMovementDetail: "WF-001" }, "");

    // Fire popstate to simulate browser back
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("manual drawer close calls history.back() when history state exists, and setDetailId(null)", () => {
    const backSpy = vi.spyOn(window.history, "back");
    renderMovements();

    const drawer = openDrawer("WF-001");
    expect(drawer).toBeInTheDocument();

    // Verify history state present
    window.history.replaceState({ wardMovementDetail: "WF-001" }, "");

    const closeBtn = within(drawer).getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(backSpy).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("manual drawer close without history state still closes drawer", () => {
    const backSpy = vi.spyOn(window.history, "back");
    renderMovements();

    const drawer = openDrawer("WF-001");
    expect(drawer).toBeInTheDocument();

    window.history.replaceState(null, "");
    backSpy.mockClear();

    const closeBtn = within(drawer).getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(backSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Issue 4: Dialog Focus Trap & Restoration", () => {
  describe("ED Screen Transport Booking Dialog", () => {
    it("captures trigger button on open and restores focus on closeTransportDialog", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <EdScreen edId="fsh-ed" />
        </WardFlowProvider>,
      );

      // The clinical action is reached through a patient's menu; closing returns to its
      // persistent trigger because the menu is hidden once the dialog opens.
      let menuTrigger: HTMLElement | undefined;
      let trigger: HTMLElement | undefined;
      for (const candidate of screen.getAllByTestId(/^ward-ed-unfold-/u)) {
        fireEvent.click(candidate);
        const id = candidate.getAttribute("data-testid")!.replace("ward-ed-unfold-", "");
        const action = screen.queryByTestId(`ward-ed-book-transport-toggle-${id}`);
        if (action && action.getAttribute("aria-disabled") !== "true") {
          menuTrigger = candidate;
          trigger = action;
          break;
        }
        fireEvent.click(candidate);
      }
      expect(trigger).toBeDefined();
      trigger!.focus();
      fireEvent.click(trigger!);

      // Dialog opens
      const dialog = screen.getByRole("dialog", { name: /Log the transport booking/i });
      expect(dialog).toBeInTheDocument();

      // Cancel button inside dialog
      const cancelBtn = within(dialog).getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);

      // Dialog closed and focus restored to trigger button
      expect(screen.queryByRole("dialog", { name: /Log the transport booking/i })).toBeNull();
      expect(document.activeElement).toBe(menuTrigger);
    });
  });

  // Tabs build (9 Oct 2026): the hand-rolled endorse modal became the shared Sheet, which owns the
  // focus trap and restore. These pin that the Governance call site still gets both.
  describe("Governance Registers Endorse Sheet", () => {
    it("captures trigger, sets initial focus, traps tab, and restores focus on close", async () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardModeWorkspace mode="governance" />
        </WardFlowProvider>,
      );

      const trigger = screen.getByRole("button", { name: "Record review" });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);

      const modal = screen.getByRole("dialog", { name: "Record a review" });
      await waitFor(() => expect(modal.contains(document.activeElement)).toBe(true));

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1");
      expect(focusable.length).toBeGreaterThanOrEqual(2);

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // The Sheet skips elements without layout boxes, which jsdom never gives, so lend them one.
      const rects = vi
        .spyOn(HTMLElement.prototype, "getClientRects")
        .mockReturnValue([new DOMRect(0, 0, 1, 1)] as unknown as DOMRectList);
      try {
        // Shift+Tab on first element wraps to last
        first.focus();
        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(last);

        // Tab on last element wraps to first
        last.focus();
        fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
        expect(document.activeElement).toBe(first);
      } finally {
        rects.mockRestore();
      }

      fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Record a review" })).not.toBeInTheDocument());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    it("restores focus on Escape key dismissal of the endorse sheet", async () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardModeWorkspace mode="governance" />
        </WardFlowProvider>,
      );

      const trigger = screen.getByRole("button", { name: "Record review" });
      trigger.focus();
      fireEvent.click(trigger);
      const modal = screen.getByRole("dialog", { name: "Record a review" });
      await waitFor(() => expect(modal.contains(document.activeElement)).toBe(true));

      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Record a review" })).not.toBeInTheDocument());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe("Officer Screen Modals", () => {
    it("captures trigger, sets initial focus, traps tab, and restores focus on close for formModal", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );

      // Trigger form modal. Transport page A: the job panel opens once a job is chosen.
      fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
      const trigger = screen.getByTestId("ward-officer-inspect-form-WF-005");
      trigger.focus();

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: /Verification/i });
      expect(dialog).toBeInTheDocument();

      // Initial focus inside modal
      expect(dialog.contains(document.activeElement)).toBe(true);

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Shift+Tab from first wraps to last
      first.focus();
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(last);

      // Tab from last wraps to first
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
      expect(document.activeElement).toBe(first);

      // Close modal
      const closeBtn = within(dialog).getByRole("button", { name: /Close form verification dialog/i });
      fireEvent.click(closeBtn);

      expect(screen.queryByRole("dialog", { name: /Verification/i })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it("restores focus on Escape key dismissal for officer modals", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );

      fireEvent.click(screen.getByTestId("ward-officer-select-WF-005"));
      const trigger = screen.getByTestId("ward-officer-inspect-form-WF-005");
      trigger.focus();
      fireEvent.click(trigger);

      expect(screen.getByRole("dialog", { name: /Verification/i })).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: /Verification/i })).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
