import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardSharedConnection } from "../src/components/ward-management/ward-shared-access";
import { WardFlowProvider, useWardFlow } from "../src/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("../src/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-shared-access")>();
  return { ...actual, useWardShared: () => fake.connection! };
});
function Probe() {
  const { configuration, now, dispatch } = useWardFlow();
  return (
    <>
      <output>{configuration.pullHoldMinutes}</output>
      <input aria-label="Local draft" defaultValue="draft" />
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 15 })}>
        Advance
      </button>
    </>
  );
}
function connection(): WardSharedConnection {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0)));
  state.configuration.pullHoldMinutes = 45;
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    receivedAt: Date.now(),
    snapshot: {
      revision: 1,
      now: 642,
      payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
    },
    dispatch: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
  };
}
beforeEach(() => {
  fake.connection = connection();
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("shared provider boundary", () => {
  it("adopts server state without reading or writing browser demo storage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByText("Coordinator · shared synthetic workspace")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Advance" }));
    expect(fake.connection!.dispatch).toHaveBeenCalledOnce();
    expect(screen.getByText("45")).toBeInTheDocument();
  });
  it("keeps drafts mounted while a newly committed server revision is adopted", () => {
    const tree = (
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>
    );
    const { rerender } = render(tree);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "keep this draft" } });
    fake.connection = {
      ...fake.connection!,
      snapshot: {
        ...fake.connection!.snapshot!,
        revision: 2,
        payload: {
          ...fake.connection!.snapshot!.payload,
          state: {
            ...fake.connection!.snapshot!.payload.state,
            configuration: { ...fake.connection!.snapshot!.payload.state.configuration, pullHoldMinutes: 60 },
          },
        },
      },
    };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("keep this draft");
    expect(screen.getByText("60")).toBeInTheDocument();
  });
  it("removes the board when coordinator access is revoked", () => {
    const { rerender } = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fake.connection = { ...fake.connection!, snapshot: null, status: "not-authorised" };
    rerender(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeInTheDocument();
  });
});
