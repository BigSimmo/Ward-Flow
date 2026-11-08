/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEscalationDiscard } from "@/components/ward-management/use-escalation-discard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * WF-RUN-01 hardening (8 Nov 2026): the discard question is answered later, so the answer is checked
 * against the drawer as it is then. A save that started meanwhile, or a drawer that has closed,
 * keeps its draft and the step is not re-run. No browser host is mounted, so the kit falls back to
 * `window.confirm`. Its answer is still read in a later microtask, so each test changes the
drawer in the same act() as the question to land between the prompt and the answer.
 */
function setup() {
  vi.spyOn(window, "confirm").mockImplementation(() => true);
  const setEscalating = vi.fn();
  const setContact = vi.fn();
  const retry = vi.fn();
  const hook = renderHook(
    ({ pending }: { pending: boolean }) =>
      useEscalationDiscard({
        hasUnsavedEscalation: true,
        setEscalating,
        setContact,
        approveNextHistoryNavigation: () => {},
        pending,
      }),
    { initialProps: { pending: false } },
  );
  return { hook, setEscalating, setContact, retry };
}

describe("unsaved escalation contact: a late discard answer (WF-RUN-01)", () => {
  it("clears and re-runs the step when nothing changed while asking", async () => {
    const { hook, setEscalating, setContact, retry } = setup();
    let allowed = true;
    await act(async () => {
      allowed = hook.result.current.discardEscalation(retry);
    });
    expect(allowed).toBe(false);
    expect(setEscalating).toHaveBeenCalledWith(null);
    expect(setContact).toHaveBeenCalledWith("");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft when a save started while the question was open", async () => {
    const { hook, setEscalating, setContact, retry } = setup();
    act(() => {
      hook.result.current.discardEscalation(retry);
      // The save begins before the answer is read (same task as the prompt, before `.then`).
      hook.rerender({ pending: true });
    });
    await act(async () => {});
    expect(setEscalating).not.toHaveBeenCalled();
    expect(setContact).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("does nothing once the drawer has closed", async () => {
    const { hook, setEscalating, retry } = setup();
    act(() => {
      hook.result.current.discardEscalation(retry);
      hook.unmount();
    });
    await act(async () => {});
    expect(setEscalating).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });
});
