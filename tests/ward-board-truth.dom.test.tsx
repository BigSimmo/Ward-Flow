// The setup file already loads these matchers; importing them here as well lets the commit-time
// per-file type check see them.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * Walkthrough fixes on the bed board, 25 September 2026 (D12, D9, D10). The board used to announce
 * success whether or not the reducer refused, and printed "Unknown Patient" and admission ids.
 * These cases read the provider's own state, so they hold whichever way the reducer decides.
 */
type Probe = ReturnType<typeof useWardFlow>;
const probeRef: { current: Probe | null } = { current: null };

function ProviderProbe() {
  const flow = useWardFlow();
  useLayoutEffect(() => {
    probeRef.current = flow;
  });
  return null;
}

/** A ward whose board lists a discharge due today or overdue, found from the seed, never assumed. */
function unitWithDueDischarge(): string {
  const due = wardAdmissions.find(
    (a) => a.state === "occupied" && a.expectedDischargeAt !== null && a.expectedDischargeAt <= WARD_ADMISSIONS_ANCHOR,
  );
  if (!due) throw new Error("the seed has nobody due to leave today");
  return due.unitId;
}

function renderBoard(unitId: string) {
  probeRef.current = null;
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <ProviderProbe />
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the bed board says what the reducer actually did", () => {
  it("D12: after They have left, the message matches the reducer's outcome, refusal or success", () => {
    renderBoard(unitWithDueDischarge());
    const button = screen.getAllByRole("button", { name: "They have left" })[0];
    expect(button).toBeDefined();
    const before = probeRef.current!.rejections.length;

    fireEvent.click(button);

    const toast = screen.getByTestId("ward-board-toast");
    const after = probeRef.current!.rejections;
    if (after.length > before) {
      expect(toast).toHaveTextContent(`Not recorded: ${after[after.length - 1].reason}`);
      expect(toast).not.toHaveTextContent("Recorded departure");
    } else {
      expect(toast).toHaveTextContent(/^Recorded departure: /u);
    }
    // D10: the message names a person, never an admission id.
    expect(toast.textContent ?? "").not.toMatch(/\bAD-[A-Z0-9-]+/u);
  });

  it("D9: the side panel never reads Unknown Patient, for any occupied bed on the ward", () => {
    const { container } = renderBoard(unitWithDueDischarge());
    const tiles = [...container.querySelectorAll<HTMLElement>('[data-bed-kind="occupied"]')];
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      fireEvent.click(within(tile).getByRole("button"));
      const detail = screen.getByTestId("ward-board-detail");
      expect(detail).toHaveAttribute("data-detail-kind", "occupied");
      expect(detail).not.toHaveTextContent("Unknown Patient");
    }
  });
});
