import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const { raise } = vi.hoisted(() => ({ raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-raise", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-flow-raise")>()),
  useWardRaise: () => raise,
}));

it("warns on a rejected legal-save completion while keeping the editable draft and sheet", async () => {
  raise.mockRejectedValueOnce(new Error("Synthetic save rejection"));
  const movement = seedWardFlowState().movements.find(isOpen)!;
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Record a form" })[0]!);
  const sheet = screen.getByTestId("ward-legal-record");
  const type = within(sheet).getByLabelText("Form type") as HTMLSelectElement;
  fireEvent.change(type, { target: { value: Array.from(type.options).find((option) => option.value !== "")!.value } });
  fireEvent.change(within(sheet).getByLabelText("Movement"), { target: { value: movement.id } });
  fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "10:00" } });
  const save = screen.getByTestId("ward-legal-forms-register-confirm");
  expect(save).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(save);
  await waitFor(() =>
    expect(raise).toHaveBeenCalledWith(
      "RECORD_LEGAL_FORM_WRITTEN",
      expect.objectContaining({ movementId: movement.id }),
    ),
  );
  const notConfirmed = "Save is not confirmed. Check the board. If your change is not there, make it again.";
  // Form-friction 204: the answer is said inside the sheet, not only on a toast behind it.
  expect(await within(sheet).findByTestId("ward-legal-forms-record-refusal")).toHaveTextContent(notConfirmed);
  expect(within(sheet).getByRole("alert")).toHaveTextContent(notConfirmed);
  expect(sheet).toBeVisible();
  const time = within(sheet).getByLabelText("Time on form");
  expect(time).toHaveValue("10:00");
  expect(time).not.toBeDisabled();
  fireEvent.change(time, { target: { value: "10:01" } });
  expect(time).toHaveValue("10:01");
  expect(save).not.toHaveAttribute("aria-disabled", "true");
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});
