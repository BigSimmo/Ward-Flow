import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * CAD to follow (Josh, 27 Oct 2026): a dispatched job booked without its CAD number warns, and the
 * officer adds the number later. Synthetic seed only.
 */

afterEach(cleanup);

const MOVEMENT = "WF-004";

function Harness() {
  const raise = useWardRaise("coordinator");
  const { movements } = useWardFlow();
  const transport = movements.find((movement) => movement.id === MOVEMENT)?.transport;
  return (
    <>
      <button
        type="button"
        data-testid="book"
        onClick={() =>
          raise("BOOK_TRANSPORT", {
            movementId: MOVEMENT,
            provider: "Ambulance (St John)",
            escortRequired: true,
            cadNumber: "",
            transportLegalStatus: "involuntary",
            estimatedAt: NOW_ANCHOR + 30,
          })
        }
      >
        Book
      </button>
      <output data-testid="cad">{transport?.cadNumber ?? "none"}</output>
      <TransportCadToFollow movementId={MOVEMENT} role="officer" testId="cad-follow" />
    </>
  );
}

describe("adding a CAD number that was to follow", () => {
  it("names why the save is greyed, refuses a placeholder, and clears the box only once saved", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("book"));
    expect(screen.getByTestId("cad")).toHaveTextContent("none");
    expect(screen.getByTestId("cad-follow-warning")).toHaveTextContent("CAD to follow");

    const save = screen.getByTestId("cad-follow-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("cad-follow")).toHaveTextContent("Type the CAD number from the provider first");

    const input = screen.getByTestId("cad-follow-input");
    fireEvent.change(input, { target: { value: "TBC" } });
    expect(screen.getByTestId("cad-follow-save")).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(input, { target: { value: " CAD-SYN-4410 " } });
    fireEvent.click(screen.getByTestId("cad-follow-save"));
    expect(screen.getByTestId("cad")).toHaveTextContent("CAD-SYN-4410");
    expect(screen.getByTestId("cad-follow-input")).toHaveValue("");
  });
});
