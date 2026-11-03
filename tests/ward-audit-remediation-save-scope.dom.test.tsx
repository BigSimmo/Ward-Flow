import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
const world = vi.hoisted(() => ({ lifetime: "world-a" }));
vi.mock("@/components/ward-management/shell/ward-shell-public-context", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-shell-public-context")>()),
  useWardShellPublic: () => ({ accessLifetime: world.lifetime }),
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({ useOptionalWardFlowSelect: () => null }));
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const accepted = (id: string): WardCommandOutcome => ({ commandId: id, status: "accepted" });
describe("form completion ownership", () => {
  it("lets a new subject save without an old subject completion releasing its pending owner", async () => {
    world.lifetime = "world-a";
    const a = deferred<WardCommandOutcome>();
    const b = deferred<WardCommandOutcome>();
    const oldDone = vi.fn();
    const nextDone = vi.fn();
    const recordB = vi.fn(() => b.promise);
    const { result, rerender } = renderHook(({ scope }) => useWardFormSave(scope), {
      initialProps: { scope: "subject-a" },
    });
    act(() => result.current.submit(() => a.promise, oldDone));
    expect(result.current.pending).toBe(true);
    rerender({ scope: "subject-b" });
    expect(result.current.pending).toBe(false);
    act(() => result.current.submit(recordB, nextDone));
    expect(recordB).toHaveBeenCalledOnce();
    await act(async () => a.resolve(accepted("a")));
    expect(oldDone).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
    await act(async () => b.resolve(accepted("b")));
    expect(nextDone).toHaveBeenCalledOnce();
    expect(result.current.pending).toBe(false);
  });
  it("does not resend an unresolved subject after closing and reopening its scope", async () => {
    world.lifetime = "world-a";
    const first = deferred<WardCommandOutcome>();
    const done = vi.fn();
    const again = vi.fn(() => accepted("again"));
    const { result, rerender } = renderHook(({ scope }) => useWardFormSave(scope), {
      initialProps: { scope: "subject-a" },
    });
    act(() => result.current.submit(() => first.promise, done));
    rerender({ scope: "" });
    rerender({ scope: "subject-a" });
    expect(result.current.pending).toBe(true);
    act(() => result.current.submit(again, done));
    expect(again).not.toHaveBeenCalled();
    await act(async () => first.resolve(accepted("first")));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it("keeps subject ownership when an uncertain reply arrives while another subject is selected", async () => {
    world.lifetime = "world-a";
    const first = deferred<WardCommandOutcome>();
    const terminal = deferred<WardCommandOutcome>();
    const done = vi.fn();
    const { result, rerender } = renderHook(({ scope }) => useWardFormSave(scope), {
      initialProps: { scope: "subject-a" },
    });
    act(() => result.current.submit(() => first.promise, done));
    rerender({ scope: "subject-b" });
    await act(async () => first.resolve({ commandId: "first", status: "failed", confirmation: terminal.promise }));
    rerender({ scope: "subject-a" });
    expect(result.current.pending).toBe(true);
    await act(async () => terminal.resolve(accepted("first")));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it("retires a completion when the world changes but the selected synthetic identifier repeats", async () => {
    world.lifetime = "world-a";
    const a = deferred<WardCommandOutcome>();
    const done = vi.fn();
    const { result, rerender } = renderHook(() => useWardFormSave("same-subject"));
    act(() => result.current.submit(() => a.promise, done));
    world.lifetime = "world-b";
    rerender();
    await act(async () => a.resolve(accepted("a")));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it("holds an uncertain command through reopening and completes only its matching accepted confirmation", async () => {
    world.lifetime = "world-a";
    const terminal = deferred<WardCommandOutcome>();
    const done = vi.fn();
    const replacement = vi.fn(() => accepted("b"));
    const { result } = renderHook(() => useWardFormSave("subject"));
    act(() =>
      result.current.submit(() => ({ commandId: "a", status: "failed", confirmation: terminal.promise }), done),
    );
    expect(result.current.pending).toBe(true);
    act(() => result.current.forget());
    act(() => result.current.submit(replacement, done));
    expect(replacement).not.toHaveBeenCalled();
    await act(async () => terminal.resolve(accepted("a")));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
  it("does not release an uncertain command for a mismatched confirmation", async () => {
    world.lifetime = "world-a";
    const terminal = deferred<WardCommandOutcome>();
    const done = vi.fn();
    const { result } = renderHook(() => useWardFormSave("subject"));
    act(() =>
      result.current.submit(() => ({ commandId: "a", status: "failed", confirmation: terminal.promise }), done),
    );
    await act(async () => terminal.resolve(accepted("different-command")));
    expect(done).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(true);
  });
});
describe("recovered command Undo presentation", () => {
  it("announces success once when an uncertain offered command is later accepted", async () => {
    const terminal = deferred<WardCommandOutcome>();
    const say = vi.fn();
    const { result } = renderHook(() =>
      useUndoableStep({
        dispatch: vi.fn(),
        requireConfirmation: true,
        rejections: [],
        now: 0,
        routeRole: "coordinator",
        onMessage: say,
      }),
    );
    act(() =>
      result.current.offer(
        { success: "Recorded" },
        { completion: { commandId: "a", status: "failed", confirmation: terminal.promise } },
      ),
    );
    expect(say.mock.calls.some((c) => c[1] === "success")).toBe(false);
    expect(say.mock.calls.some((c) => c[1] === "warning")).toBe(true);
    await act(async () => terminal.resolve(accepted("a")));
    expect(say.mock.calls.filter((c) => c[1] === "success")).toHaveLength(1);
  });
});
