import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

// PR #1326 review: callers list this hook's result as a callback dependency (the tasks drawer's
// escalation discard guard), so it keeps one object while nothing a form shows has changed.
describe("useWardFormSave result identity", () => {
  it("keeps the same object across renders until pending or error changes", async () => {
    const { result, rerender } = renderHook(({ scope }) => useWardFormSave(scope), {
      initialProps: { scope: "synthetic-form" },
    });
    const first = result.current;
    rerender({ scope: "synthetic-form" });
    expect(result.current).toBe(first);

    let answer!: (outcome: WardCommandOutcome) => void;
    act(() => {
      result.current.submit(
        () =>
          new Promise<WardCommandOutcome>((resolve) => {
            answer = resolve;
          }),
        () => undefined,
      );
    });
    expect(result.current.pending).toBe(true);
    expect(result.current).not.toBe(first);
    expect(result.current.submit).toBe(first.submit);
    expect(result.current.forget).toBe(first.forget);

    await act(async () => {
      answer({ status: "failed", commandId: "synthetic-command" } as WardCommandOutcome);
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeTruthy();
    const failed = result.current;
    rerender({ scope: "synthetic-form" });
    expect(result.current).toBe(failed);
  });

  it("gives a new submit for a new scope", () => {
    const { result, rerender } = renderHook(({ scope }) => useWardFormSave(scope), {
      initialProps: { scope: "synthetic-a" },
    });
    const first = result.current;
    rerender({ scope: "synthetic-b" });
    expect(result.current.submit).not.toBe(first.submit);
  });
});
