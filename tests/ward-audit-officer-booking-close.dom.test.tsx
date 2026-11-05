import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmHost } from "@/components/wf";
import { OfficerBookingPanel } from "@/components/ward-management/officer/officer-needs-transport";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardRaise, type WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardCommandOutcome, WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

const movement = seedWardFlowState().movements.find((m) => m.stage === "pulled" && !m.transport)!;
afterEach(cleanup);
function Harness({
  phone,
  raise = wardRaise(() => undefined, "coordinator", NOW_ANCHOR),
}: {
  phone: boolean;
  raise?: WardRaise;
}) {
  const [open, setOpen] = useState(true);
  const side = useRef<HTMLDivElement>(null);
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ConfirmHost />
      {open && (
        <OfficerBookingPanel
          sideRef={side}
          movement={movement}
          name="Synthetic person"
          umrn="SYN-123"
          route="Synthetic route"
          now={NOW_ANCHOR}
          isPhone={phone}
          raise={raise}
          acting={{}}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      )}
    </WardFlowProvider>
  );
}
const cad = () => screen.getByTestId(`ward-officer-transport-cad-${movement.id}`);
function answerBooking() {
  fireEvent.change(screen.getByTestId(`ward-officer-transport-provider-${movement.id}`), {
    target: { value: "Ambulance (St John)" },
  });
  fireEvent.change(cad(), { target: { value: "CAD-SYN-438" } });
  fireEvent.change(screen.getByTestId(`ward-officer-transport-estimated-time-${movement.id}`), {
    target: { value: "11:15" },
  });
  fireEvent.click(screen.getByTestId(`ward-officer-transport-estimated-day-today-${movement.id}`));
  fireEvent.click(screen.getByTestId(`ward-officer-transport-escort-no-${movement.id}`));
  fireEvent.click(screen.getByTestId(`ward-officer-transport-legal-involuntary-${movement.id}`));
}
describe.each([false, true])("Transport booking close protection (phone %s)", (phone) => {
  it("keeps entered answers through outer close and only discards explicitly", async () => {
    render(<Harness phone={phone} />);
    fireEvent.change(cad(), { target: { value: "CAD-SYN-438" } });
    fireEvent.click(screen.getByRole("button", { name: "Close booking" }));
    const question = await screen.findByTestId("wf-confirm-dialog");
    expect(cad()).toHaveValue("CAD-SYN-438");
    fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
    await act(async () => {});
    fireEvent.keyDown(cad(), { key: "Escape" });
    fireEvent.click(
      within(await screen.findByTestId("wf-confirm-dialog")).getByRole("button", { name: "Discard answers" }),
    );
    await act(async () => {});
    expect(screen.queryByTestId("ward-officer-booking")).toBeNull();
  });
  it("blocks outer close and Escape while the initial save is in flight", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const pending = new Promise<WardCommandOutcome>((done) => {
      resolve = done;
    });
    const dispatch = vi.fn<WardCommandDispatch>(() => pending);
    const raise = wardRaise(dispatch, "coordinator", NOW_ANCHOR);
    render(<Harness phone={phone} raise={raise} />);
    answerBooking();
    fireEvent.click(screen.getByTestId(`ward-officer-book-transport-confirm-${movement.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Close booking" }));
    fireEvent.keyDown(cad(), { key: "Escape" });
    expect(cad()).toHaveValue("CAD-SYN-438");
    expect(screen.queryByTestId("wf-confirm-dialog")).toBeNull();
    await act(async () => resolve({ commandId: "synthetic-booking", status: "refused", message: "Synthetic refusal" }));
    expect(cad()).toHaveValue("CAD-SYN-438");
  });
  it("keeps pending command recovery mounted until its matching acceptance", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((done) => {
      resolve = done;
    });
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "synthetic-booking",
      status: "failed",
      message: "Save not confirmed",
      confirmation,
    }));
    const raise = wardRaise(dispatch, "coordinator", NOW_ANCHOR);
    render(<Harness phone={phone} raise={raise} />);
    answerBooking();
    fireEvent.click(screen.getByTestId(`ward-officer-book-transport-confirm-${movement.id}`));
    expect(dispatch).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(cad(), { key: "Escape" });
    fireEvent.click(
      within(await screen.findByTestId("wf-confirm-dialog")).getByRole("button", { name: "Keep editing" }),
    );
    await act(async () => resolve({ commandId: "synthetic-booking", status: "accepted" }));
    expect(screen.queryByTestId("ward-officer-booking")).toBeNull();
  });
});

it("protects entered answers when the phone scrim is tapped", async () => {
  render(<Harness phone />);
  fireEvent.change(cad(), { target: { value: "CAD-SYN-438" } });
  const dialog = screen.getByTestId("ward-officer-booking");
  fireEvent.click(dialog.parentElement!.firstElementChild!);
  const question = await screen.findByTestId("wf-confirm-dialog");
  fireEvent.click(within(question).getByRole("button", { name: "Keep editing" }));
  await act(async () => {});
  expect(cad()).toHaveValue("CAD-SYN-438");
});
