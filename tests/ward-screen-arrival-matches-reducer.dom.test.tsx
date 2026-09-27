import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";

/**
 * Live walkthrough code-read, 25 September 2026: the ward screen's arrival and release controls
 * disagreed with the reducer. A patient recorded as needing no transport could never be marked
 * arrived here (the reducer allows it from pulled), and "Release the pulled bed" was offered while
 * a transport job was booked (the reducer refuses it).
 */
function RecordNoTransport({ movementId }: { movementId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "RECORD_TRANSPORT_NEED", role: "ward", now, movementId, needed: false })}
    >
      record no transport for {movementId}
    </button>
  );
}

function BookTransport({ movementId }: { movementId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "BOOK_TRANSPORT",
          role: "ed",
          now,
          movementId,
          provider: TRANSPORT_PROVIDERS[0],
          escortRequired: false,
          cadNumber: "CAD-TEST-1",
          transportLegalStatus: "voluntary",
          estimatedAt: now + 30,
        })
      }
    >
      book transport for {movementId}
    </button>
  );
}

describe("ward screen arrival and release controls follow the reducer", () => {
  const seed = seedWardFlowState();

  it("offers Confirm Arrival for a pulled patient once no transport is needed", () => {
    const pulled = seed.movements.find(
      (movement) => movement.stage === "pulled" && movement.transport === undefined && !movement.closure,
    )!;
    expect(pulled, "a seeded pulled movement with no transport job").toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RecordNoTransport movementId={pulled.id} />
        <WardScreen unitId={pulled.acceptedUnitId!} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId(`ward-confirm-arrival-${pulled.id}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `record no transport for ${pulled.id}` }));
    const arrive = screen.getByTestId(`ward-confirm-arrival-${pulled.id}`);
    expect(arrive).not.toHaveAttribute("aria-disabled", "true");
  });

  it("does not offer Release the pulled bed once a transport job is booked", () => {
    const pulled = seed.movements.find(
      (movement) => movement.stage === "pulled" && movement.transport === undefined && !movement.closure,
    )!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BookTransport movementId={pulled.id} />
        <WardScreen unitId={pulled.acceptedUnitId!} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId(`ward-release-pull-toggle-${pulled.id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `book transport for ${pulled.id}` }));
    expect(screen.queryByTestId(`ward-release-pull-toggle-${pulled.id}`)).not.toBeInTheDocument();
  });
});
