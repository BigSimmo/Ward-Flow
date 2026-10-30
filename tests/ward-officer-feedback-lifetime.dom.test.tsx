import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const world = vi.hoisted(() => ({ generation: 1 }));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useOptionalWardFlowSelect: () => ({ worldGeneration: world.generation }),
}));

import { useTransportCommandFeedback } from "@/components/ward-management/officer/use-transport-command-feedback";

function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<WardCommandOutcome>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

type Feedback = ReturnType<typeof useTransportCommandFeedback>;
// OfficerScreen already uses this lifetime predicate before rendering its StatusLine/Undo.
const visibleMessage = ({ toastMessage }: Feedback) =>
  toastMessage?.isCurrent?.() === false ? undefined : toastMessage?.message;

beforeEach(() => {
  world.generation = 1;
});
afterEach(cleanup);

describe("transport command feedback belongs to the workspace that sent it", () => {
  it("hides the prior world's feedback during the first render of the new world", async () => {
    const { result, rerender } = renderHook(() => {
      const feedback = useTransportCommandFeedback();
      return { feedback, renderedMessage: visibleMessage(feedback) };
    });
    await act(async () => {
      await result.current.feedback.reportOutcome(
        "synthetic-job",
        () => ({ commandId: "old", status: "accepted" }),
        "Collected.",
        "Collection",
      );
    });
    expect(result.current.renderedMessage).toBe("Collected.");
    world.generation++;
    rerender();
    expect(result.current.renderedMessage).toBeUndefined();
  });

  it("does not turn a retired accepted answer into a persistent failure warning", async () => {
    const { result } = renderHook(useTransportCommandFeedback);
    await act(async () => {
      expect(
        await result.current.reportOutcome(
          "synthetic-job",
          () => ({ commandId: "old", status: "accepted", isCurrent: () => false }),
          "Collected.",
          "Collection",
        ),
      ).toBe(false);
    });
    expect(visibleMessage(result.current)).toBeUndefined();
  });

  it.each(["accepted", "refused", "failed", "cancelled", "reject"] as const)(
    "ignores a late %s answer after a workspace change and a newer command",
    async (status) => {
      const old = deferred();
      const { result, rerender } = renderHook(useTransportCommandFeedback);
      let oldFinished!: Promise<boolean>;
      act(() => {
        oldFinished = result.current.reportOutcome("synthetic-job", () => old.promise, "Old success.", "Old step");
      });
      world.generation++;
      rerender();
      expect(visibleMessage(result.current)).toBeUndefined();
      await act(async () => {
        expect(
          await result.current.reportOutcome(
            "synthetic-job",
            () => ({ commandId: "new", status: "accepted" }),
            "New success.",
            "New step",
          ),
        ).toBe(true);
      });
      await act(async () => {
        if (status === "reject") old.reject(new Error("Synthetic connection failure"));
        else old.resolve({ commandId: "old", status, message: "Old answer." });
        expect(await oldFinished).toBe(false);
      });
      expect(visibleMessage(result.current)).toBe("New success.");
    },
  );

  it("does not complete a screen action after unmount", async () => {
    const pending = deferred();
    const { result, unmount } = renderHook(useTransportCommandFeedback);
    let finished!: Promise<boolean>;
    act(() => {
      finished = result.current.reportOutcome("synthetic-job", () => pending.promise, "Collected.", "Collection");
    });
    unmount();
    pending.resolve({ commandId: "old", status: "accepted" });
    expect(await finished).toBe(false);
  });

  it("keeps same-workspace duplicate suppression and persistent failure feedback", async () => {
    const pending = deferred();
    const { result } = renderHook(useTransportCommandFeedback);
    let finished!: Promise<boolean>;
    act(() => {
      finished = result.current.reportOutcome("synthetic-job", () => pending.promise, "Collected.", "Collection");
    });
    const duplicate = vi.fn();
    expect(await result.current.reportOutcome("synthetic-job", duplicate, "Collected.", "Collection")).toBe(false);
    expect(duplicate).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve({ commandId: "current", status: "failed", message: "Synthetic retry required." });
      expect(await finished).toBe(false);
    });
    expect(visibleMessage(result.current)).toBe("Synthetic retry required.");
    expect(result.current.toastMessage?.warning).toBe(true);
  });

  it("keeps the new world's duplicate guard when old commands finish across 30 replacements", async () => {
    const { result, rerender } = renderHook(useTransportCommandFeedback);
    for (let replacement = 0; replacement < 30; replacement++) {
      const old = deferred();
      const current = deferred();
      let oldFinished!: Promise<boolean>;
      let currentFinished!: Promise<boolean>;
      act(() => {
        oldFinished = result.current.reportOutcome("synthetic-job", () => old.promise, "Old success.", "Old step");
      });
      world.generation++;
      rerender();
      act(() => {
        currentFinished = result.current.reportOutcome(
          "synthetic-job",
          () => current.promise,
          "Current success.",
          "Current step",
        );
      });
      await act(async () => {
        old.resolve({ commandId: `old-${replacement}`, status: replacement % 2 ? "accepted" : "failed" });
        expect(await oldFinished).toBe(false);
      });
      const duplicate = vi.fn();
      expect(await result.current.reportOutcome("synthetic-job", duplicate, "Duplicate.", "Duplicate")).toBe(false);
      expect(duplicate).not.toHaveBeenCalled();
      expect(visibleMessage(result.current)).toBe("Current step pending confirmation.");
      await act(async () => {
        current.resolve({ commandId: `current-${replacement}`, status: "accepted" });
        expect(await currentFinished).toBe(true);
      });
      expect(visibleMessage(result.current)).toBe("Current success.");
    }
  });
});
