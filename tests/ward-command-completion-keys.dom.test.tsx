import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  WARD_STILL_SAVING,
  useWardCommandCompletion,
  wardCommandKey,
} from "@/components/ward-management/ward/use-ward-command-completion";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

/** A shared save that answers only when the test says so. */
function pendingSave() {
  let answer: (outcome: WardCommandOutcome) => void = () => {};
  const promise = new Promise<WardCommandOutcome>((resolve) => {
    answer = resolve;
  });
  return { record: () => promise, answer };
}

describe("ward command keys (review: gitar)", () => {
  it("lets a second stay's departure go while the first is still saving", async () => {
    const say = vi.fn();
    const { result } = renderHook(() => useWardCommandCompletion(say));
    const first = pendingSave();
    const second = pendingSave();
    const settled = vi.fn();
    act(() => {
      result.current(wardCommandKey("departure", "ADM-1"), first.record, settled);
      result.current(wardCommandKey("departure", "ADM-2"), second.record, settled);
    });
    await act(async () => second.answer({ commandId: "c2", status: "accepted" }));
    expect(settled).toHaveBeenCalledTimes(1);
    expect(say).not.toHaveBeenCalled();
  });

  it("says it is still saving, and returns false, for a repeat on the same stay", async () => {
    const say = vi.fn();
    const { result } = renderHook(() => useWardCommandCompletion(say));
    const first = pendingSave();
    const repeat = vi.fn();
    let returned: false | undefined;
    act(() => {
      result.current(wardCommandKey("departure", "ADM-1"), first.record, vi.fn());
      returned = result.current(wardCommandKey("departure", "ADM-1"), repeat, vi.fn());
    });
    expect(returned).toBe(false);
    expect(repeat).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(WARD_STILL_SAVING);
    await act(async () => first.answer({ commandId: "c1", status: "accepted" }));
    const again = vi.fn(() => undefined);
    act(() => {
      result.current(wardCommandKey("departure", "ADM-1"), again, vi.fn());
    });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("retains departure ownership until its same-command recovery confirms", async () => {
    const say = vi.fn();
    const { result } = renderHook(() => useWardCommandCompletion(say));
    const recovery = pendingSave();
    const settled = vi.fn();
    const repeat = vi.fn();
    const failed: WardCommandOutcome = { commandId: "departure-1", status: "failed", confirmation: recovery.record() };
    act(() => result.current("departure:ADM-1", () => failed, settled));
    expect(settled).toHaveBeenCalledWith(failed);
    act(() => result.current("departure:ADM-1", repeat, settled));
    expect(repeat).not.toHaveBeenCalled();
    const accepted: WardCommandOutcome = {
      commandId: "departure-1",
      status: "accepted",
      undoStep: { undoType: "UNDO_DEPARTURE", subjectId: "ADM-1", seq: 7 },
    };
    await act(async () => recovery.answer(accepted));
    expect(settled).toHaveBeenLastCalledWith(accepted);
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it("ignores a different command's recovery receipt", async () => {
    const { result } = renderHook(() => useWardCommandCompletion());
    const recovery = pendingSave();
    const settled = vi.fn();
    act(() =>
      result.current(
        "departure:ADM-1",
        () => ({ commandId: "one", status: "failed", confirmation: recovery.record() }),
        settled,
      ),
    );
    await act(async () => recovery.answer({ commandId: "two", status: "accepted" }));
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("keeps a departure, its Undo, an acceptance Undo and a referral on separate keys", () => {
    const keys = [
      wardCommandKey("departure", "ADM-1"),
      wardCommandKey("undo-departure", "ADM-1"),
      wardCommandKey("undo-accept", "MV-1"),
      wardCommandKey("undo-accept", "MV-2"),
      wardCommandKey("raise-referral", 4),
      wardCommandKey("board", 4),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
