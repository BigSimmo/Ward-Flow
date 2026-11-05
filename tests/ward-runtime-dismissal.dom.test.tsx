import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmHost } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { useState } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ward-flow/officer",
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const movement = seedWardFlowState().movements.find((record) => record.stage === "pulled")!;
function ArrivalHarness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <ConfirmHost />
      <ArrivalTimeModal isOpen={open} movement={movement} onClose={() => setOpen(false)} />
    </>
  );
}
describe("unfinished journey editor dismissal", () => {
  it("retains arrival answers on Keep editing and closes only on explicit discard", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalHarness />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("CAD or tracking number"), { target: { value: "SYNTHETIC-TRACKING" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("CAD or tracking number")).toHaveValue("SYNTHETIC-TRACKING");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Discard details" })));
    expect(screen.queryByLabelText("CAD or tracking number")).toBeNull();
  });
  it("guards the officer booking's outer close", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfirmHost />
        <OfficerScreen />
      </WardFlowProvider>,
    );
    const open = screen.getAllByRole("button", { name: "Log booking" })[0];
    fireEvent.click(open);
    const inputs = screen.getAllByRole("textbox");
    const editable =
      inputs.find((input) => input.getAttribute("placeholder")?.includes("CAD")) ??
      screen.getByLabelText(/CAD number/i);
    fireEvent.change(editable, { target: { value: "SYNTHETIC-TRACKING" } });
    fireEvent.click(screen.getByRole("button", { name: "Close booking" }));
    expect(await screen.findByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(editable).toHaveValue("SYNTHETIC-TRACKING");
  });
});
