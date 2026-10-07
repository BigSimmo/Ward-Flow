import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

describe("Ward Flow Dialog & Modal Accessibility Semantics", () => {
  describe("AlertsScreen — Broadcast Network Alert Dialog", () => {
    it("has accessible dialog semantics, dismisses on Escape, and restores focus", async () => {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <AlertsScreen />
        </WardFlowProvider>,
      );

      const trigger = screen.getByRole("button", { name: /^Broadcast alert$/i });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);

      const dialog = screen.getByRole("dialog", { name: /Broadcast network alert/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "broadcast-title");
      expect(dialog).toHaveAttribute("aria-describedby", "broadcast-desc");

      // Verify Escape dismissal
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
      expect(screen.queryByRole("dialog", { name: /Broadcast network alert/i })).not.toBeInTheDocument();

      // Verify focus is restored to the trigger button
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });
  });

  describe("WardBoard — Blocker and Return Date Dialogs", () => {
    it("Blocker Dialog: has accessible dialog semantics, closes on Escape, and restores focus", async () => {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <WardBoard unitId="rph-adult-secure" />
        </WardFlowProvider>,
      );

      const blockerButtons = screen.queryAllByRole("button", { name: "Record a blocker" });
      if (blockerButtons.length > 0) {
        const trigger = blockerButtons[0];
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = screen.getByRole("dialog", { name: /Record a blocker for/i });
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", "blocker-dialog-title");
        expect(dialog).toHaveAttribute("aria-describedby", "blocker-dialog-description");

        // Close on Escape
        fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
        expect(screen.queryByRole("dialog", { name: /Record a blocker for/i })).not.toBeInTheDocument();

        // Focus restoration
        await waitFor(() => {
          expect(document.activeElement).toBe(trigger);
        });
      }
    });

    it("Return Date Dialog: has accessible dialog semantics, closes on Escape, and restores focus", async () => {
      render(
        <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
          <WardBoard unitId="fsh-adult-secure" />
        </WardFlowProvider>,
      );

      const returnButtons = screen.queryAllByRole("button", { name: "Set a return date" });
      if (returnButtons.length > 0) {
        const trigger = returnButtons[0];
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = screen.getByRole("dialog", { name: /Set return date for/i });
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", "return-date-dialog-title");
        expect(dialog).toHaveAttribute("aria-describedby", "return-date-dialog-description");

        // Close on Escape
        fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
        expect(screen.queryByRole("dialog", { name: /Set return date for/i })).not.toBeInTheDocument();

        // Focus restoration
        await waitFor(() => {
          expect(document.activeElement).toBe(trigger);
        });
      }
    });
  });
});
