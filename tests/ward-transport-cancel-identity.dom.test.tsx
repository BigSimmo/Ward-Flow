import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommunityScreenTransportCancelDialog } from "@/components/ward-management/community/community-screen-transport-dialogs";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);

function harness() {
  const state = seedWardFlowState();
  const first = state.movements[0]!;
  const patient = state.patients.find((record) => record.id === first.patientId)!;
  const movement: Movement = {
    ...first,
    transport: { id: "synthetic-job-1", provider: "Ambulance (St John)", escortRequired: false, cadNumber: "CAD-4567" },
  };
  const submit = vi.fn();
  const view = {
    transportCancelFor: movement.id,
    cancelTransportReason: "provider_unavailable",
    setCancelTransportReason: vi.fn(),
    cancelTransportBlocked: undefined,
    closeTransportCancel: vi.fn(),
    transportCancelDialogRef: createRef<HTMLDivElement>(),
    submitCancelTransport: submit,
    movements: [movement],
    umrnLookup: { patients: state.patients, referrals: state.referrals, movements: [movement] },
  } as unknown as CommunityScreenView;
  const rendered = render(<CommunityScreenTransportCancelDialog view={view} />);
  return { ...rendered, view, movement, patient, submit };
}

// Omitting either the second patient identifier or job identity makes a mistaken row selection
// impossible to check independently once this modal covers the table.
it("identifies both the patient and the transport job before cancellation", () => {
  const h = harness();
  const dialog = screen.getByRole("dialog", { name: "Cancel this team's transport booking" });
  expect(dialog).toHaveTextContent(h.patient.umrn);
  expect(dialog).toHaveTextContent("Ambulance (St John)");
  expect(dialog).toHaveTextContent("CAD-4567");
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancel" }));
  expect(h.submit).toHaveBeenCalledWith(h.movement.id, expect.any(Function));
});

it.each(["missing movement", "replaced job"] as const)(
  "requires review when the cancellation target is %s",
  (change) => {
    const h = harness();
    const movements =
      change === "missing movement"
        ? []
        : [
            {
              ...h.movement,
              transport: { ...h.movement.transport!, id: "synthetic-job-2", cadNumber: "CAD-8910" },
            },
          ];
    h.rerender(<CommunityScreenTransportCancelDialog view={{ ...h.view, movements }} />);
    const confirm = screen.getByRole("button", { name: "Confirm cancel" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm);
    expect(h.submit).not.toHaveBeenCalled();
  },
);
