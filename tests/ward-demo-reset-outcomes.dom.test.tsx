import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { WardDemoReset } from "@/components/ward-management/demo-reset/ward-demo-reset";

const fixture = vi.hoisted(() => ({
  enabled: true,
  available: true,
  raise: vi.fn(),
  announce: vi.fn(),
}));

vi.mock("@/components/wf", async () => await import("@/components/wf/button"));
vi.mock("@/components/ward-management/shell/ward-live-region", () => ({
  announceToWardShell: fixture.announce,
}));
vi.mock("@/components/ward-management/shell/ward-feature-flag-store", () => ({
  useWardFeatureFlag: () => fixture.enabled,
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => ({
    scenario: "quiet-day",
    worldGeneration: 1,
    shared: { enabled: false },
  }),
}));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({
  DEMO_CONTROLS_OFF: "Demo controls are switched off on the shared workspace. Nothing will change.",
  useDemoControlsAvailable: () => fixture.available,
  useWardRaise: () => fixture.raise,
}));

beforeEach(() => {
  fixture.enabled = true;
  fixture.available = true;
  fixture.raise.mockReset();
  fixture.announce.mockReset();
});
afterEach(() => cleanup());

function start() {
  const view = render(<WardDemoReset />);
  fireEvent.click(screen.getByTestId("ward-demo-reset-winter-surge"));
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  fireEvent.click(screen.getByTestId("ward-demo-reset-confirm-load"));
  return view;
}
function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function accepted(generation = 2): WardCommandOutcome {
  return {
    commandId: "demo-command",
    status: "accepted",
    generation,
    isCurrent: () => true,
  };
}

describe("demo reset completion feedback", () => {
  it.each(["failed", "refused", "cancelled"] as const)("does not announce a %s command as loaded", (status) => {
    fixture.raise.mockReturnValue({ commandId: "demo-command", status });
    start();
    expect(fixture.announce).toHaveBeenCalledOnce();
    expect(fixture.announce).toHaveBeenCalledWith(expect.stringContaining("was not confirmed as loaded"));
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Check the current scenario");
    expect(screen.getByTestId("ward-demo-reset-feedback")).not.toHaveTextContent("Nothing changed");
  });

  it("waits for accepted completion before announcing success", async () => {
    const pending = deferred();
    fixture.raise.mockReturnValue(pending.promise);
    start();
    expect(fixture.announce).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-demo-reset")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Loading scenario");
    await act(async () => pending.resolve(accepted()));
    expect(fixture.announce).toHaveBeenCalledExactlyOnceWith("Winter surge loaded. Synthetic demo data only.");
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Winter surge loaded.");
    expect(screen.getByTestId("ward-demo-reset")).not.toHaveAttribute("aria-busy");
  });

  it.each(["void", "unchanged generation"])("keeps %s completion honest", (kind) => {
    fixture.raise.mockReturnValue(
      kind === "void"
        ? undefined
        : {
            commandId: "demo-command",
            status: "accepted",
            ...(kind === "unchanged generation" ? { generation: 1 } : {}),
          },
    );
    start();
    expect(fixture.announce).toHaveBeenCalledWith(expect.stringContaining("was not confirmed as loaded"));
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Check the current scenario");
  });

  it("recognises a successful shared completion whose accepted contract omits generation", () => {
    fixture.raise.mockReturnValue({
      commandId: "shared-command",
      status: "accepted",
      isCurrent: () => true,
    });
    start();
    expect(fixture.announce).toHaveBeenCalledExactlyOnceWith("Winter surge loaded. Synthetic demo data only.");
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Winter surge loaded.");
  });

  it.each(["synchronous throw", "promise rejection"])(
    "handles %s without a success or stuck busy state",
    async (kind) => {
      fixture.raise.mockImplementation(() => {
        if (kind === "synchronous throw") throw new Error("synthetic failure");
        return Promise.reject(new Error("synthetic failure"));
      });
      start();
      await act(async () => {});
      expect(fixture.announce).toHaveBeenCalledWith(expect.stringContaining("was not confirmed as loaded"));
      expect(screen.getByTestId("ward-demo-reset-winter-surge")).toBeEnabled();
      expect(screen.getByTestId("ward-demo-reset")).not.toHaveAttribute("aria-busy");
    },
  );

  it("does not announce an obsolete accepted outcome", async () => {
    const pending = deferred();
    fixture.raise.mockReturnValue(pending.promise);
    start();
    await act(async () => pending.resolve({ ...accepted(), isCurrent: () => false }));
    expect(fixture.announce).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ward-demo-reset-feedback")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-demo-reset-winter-surge")).toBeEnabled();
  });

  it("does not announce after unmount", async () => {
    const pending = deferred();
    fixture.raise.mockReturnValue(pending.promise);
    start().unmount();
    await act(async () => pending.resolve(accepted()));
    expect(fixture.announce).not.toHaveBeenCalled();
  });

  it("prevents another scenario submission while a command is unresolved", async () => {
    const pending = deferred();
    fixture.raise.mockReturnValue(pending.promise);
    start();
    const another = screen.getByTestId("ward-demo-reset-ed-crisis");
    expect(another).toBeDisabled();
    fireEvent.click(another);
    const confirm = screen.queryByTestId("ward-demo-reset-confirm-load");
    if (confirm) fireEvent.click(confirm);
    expect(fixture.raise).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(accepted()));
    expect(another).toBeEnabled();
  });

  it("withdraws pending feedback when controls turn off and allows a new request on return", async () => {
    const pending = deferred();
    fixture.raise.mockReturnValue(pending.promise);
    const view = start();
    fixture.available = false;
    view.rerender(<WardDemoReset />);
    expect(screen.queryByTestId("ward-demo-reset-feedback")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-demo-reset-winter-surge")).toBeDisabled();
    fixture.available = true;
    view.rerender(<WardDemoReset />);
    expect(screen.getByTestId("ward-demo-reset-winter-surge")).toBeEnabled();
    fixture.raise.mockReturnValue(accepted(3));
    fireEvent.click(screen.getByTestId("ward-demo-reset-winter-surge"));
    fireEvent.click(screen.getByTestId("ward-demo-reset-confirm-load"));
    expect(fixture.raise).toHaveBeenCalledTimes(2);
    expect(fixture.announce).toHaveBeenCalledExactlyOnceWith("Winter surge loaded. Synthetic demo data only.");
    await act(async () => pending.resolve(accepted()));
    expect(fixture.announce).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ward-demo-reset-feedback")).toHaveTextContent("Winter surge loaded.");
  });

  it("retains Cancel focus, restores the choice and keeps the flag-off surface absent", () => {
    const view = render(<WardDemoReset />);
    fireEvent.click(screen.getByTestId("ward-demo-reset-winter-surge"));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(fixture.raise).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-demo-reset-winter-surge")).toHaveFocus();
    fixture.enabled = false;
    view.rerender(<WardDemoReset />);
    expect(screen.queryByTestId("ward-demo-reset")).not.toBeInTheDocument();
  });
});
