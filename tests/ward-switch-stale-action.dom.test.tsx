// tests/ward-switch-stale-action.dom.test.tsx
import { act, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * AUD-06: an action started on one ward must not land on another after a quick ward switch.
 * Every engine event names its own ward (`actingUnitId`), so the record is right; the risk is the
 * screen. Both ward views now start fresh per ward, and a save answering after its screen has gone
 * is dropped. Synthetic ids only.
 */
let mounts = 0;
vi.mock("@/components/ward-management/ward/ward-screen-lazy", () => ({
  WardAnswerFromLink: ({ unitId }: { unitId: string }) => {
    const [instance] = useState(() => ++mounts);
    return <p data-testid="answer-view">{`${unitId} view ${instance}`}</p>;
  },
  WardDailySheetDialog: () => null,
  WardDischargeNotices: () => null,
  WardReferralInbox: () => null,
}));

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { useWardCommandCompletion } from "@/components/ward-management/ward/use-ward-command-completion";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

describe("AUD-06: a quick ward switch", () => {
  it("starts a fresh answer view for the new ward, so the last ward's open answer cannot carry over", () => {
    mounts = 0;
    const { rerender } = render(<WardScreen unitId="ward-a" presentation="answer" />);
    expect(screen.getByTestId("answer-view")).toHaveTextContent("ward-a view 1");
    rerender(<WardScreen unitId="ward-b" presentation="answer" />);
    expect(screen.getByTestId("answer-view")).toHaveTextContent("ward-b view 2");
  });

  it("drops a save's answer that arrives after its ward's screen has gone", async () => {
    let answer: (outcome: WardCommandOutcome) => void = () => {};
    const save = new Promise<WardCommandOutcome>((resolve) => {
      answer = resolve;
    });
    const settled = vi.fn();
    const { result, unmount } = renderHook(() => useWardCommandCompletion(vi.fn()));
    act(() => {
      result.current("decline:MV-1", () => save, settled);
    });
    unmount();
    await act(async () => answer({ commandId: "c1", status: "accepted" }));
    expect(settled).not.toHaveBeenCalled();
  });
});
