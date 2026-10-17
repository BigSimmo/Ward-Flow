import React, { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function Harness() {
  const [open, setOpen] = useState(false);
  const { movements } = useWardFlow();
  const movement = movements.find((item) => item.id === "WF-004")!;
  return (
    <>
      <button onClick={() => setOpen(true)}>Record details</button>
      <output data-testid="metadata">{JSON.stringify(movement.uploadedForms ?? [])}</output>
      <UploadFormsModal isOpen={open} onClose={() => setOpen(false)} movement={movement} />
    </>
  );
}
function setup() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness />
    </WardFlowProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Record details" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}
describe("document metadata and modal lifecycle", () => {
  it("cannot record an absent or empty file, and records actual metadata only", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("File contents are not stored or sent");
    const submit = screen.getByTestId("confirm-upload-form-button");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    const input = within(dialog).getByLabelText("Upload document file");
    fireEvent.change(input, { target: { files: [new File([], "empty.pdf", { type: "application/pdf" })] } });
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByTestId("metadata")).toHaveTextContent("[]");
    fireEvent.change(input, {
      target: { files: [new File(["synthetic"], "example.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(submit);
    const records = JSON.parse(screen.getByTestId("metadata").textContent!);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      fileName: "example.pdf",
      sizeBytes: 9,
      formName: "Form 4A Transport Order",
      uploadedBy: "ward",
    });
    expect(records[0]).not.toHaveProperty("content");
  });
  it("contains keyboard focus, isolates the background and returns to its trigger", () => {
    // jsdom has no layout; the shared modal trap only cycles through controls that have client rects.
    const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);
    onTestFinished(() => rects.mockRestore());
    const trigger = setup();
    const dialog = screen.getByRole("dialog");
    const first = within(dialog).getByRole("button", { name: "Close dialog" });
    // The unavailable submit stays focusable (aria-disabled, not native disabled), so it is the last stop.
    const last = within(dialog).getByTestId("confirm-upload-form-button");
    expect(first).toHaveFocus();
    expect(trigger.closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger.closest("[inert]")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByTestId("confirm-upload-form-button")).toHaveAttribute("aria-disabled", "true");
  });
});
