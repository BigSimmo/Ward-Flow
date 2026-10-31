import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdActionsMenu } from "@/components/ward-management/ed/ed-board-controls";
import { EdConfirmedStep } from "@/components/ward-management/ed/ed-screen-row-menu";

// Audit 1 CS-07: "Record no referral" (redesign, Josh 31 Oct 2026; "No referral raised" before)
// asks first, through `EdConfirmedStep`. Inside the row's actions menu it must still be a menu item
// in "Legal and referral" (the redesign's plain "and", not "&"), like the plain buttons.
describe("a confirmed step in the ED actions menu", () => {
  it("is a menu item in its group and still asks before it records", () => {
    const onConfirm = vi.fn();
    render(
      <EdActionsMenu
        patientName="Synthetic patient"
        testId="actions-menu"
        triggerTestId="actions-trigger"
        onViewRecord={() => undefined}
        onEditPresentation={() => undefined}
        onEditPlan={() => undefined}
      >
        <EdConfirmedStep
          label="Record no referral"
          title="Record that no referral was raised for Synthetic patient?"
          consequence="This cannot be undone here."
          who="Synthetic patient"
          umrn="UM100081"
          testId="ward-ed-no-referral-raised-m1"
          className=""
          onConfirm={onConfirm}
        />
      </EdActionsMenu>,
    );

    const group = within(screen.getByTestId("actions-menu")).getByRole("group", {
      name: "Legal and referral",
      hidden: true,
    });
    const item = within(group).getByRole("menuitem", { name: "Record no referral", hidden: true });
    fireEvent.click(item);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByTestId("ward-ed-no-referral-raised-m1-confirm")).getByRole("button", {
        name: "Record no referral",
      }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
