/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhoneFocal } from "@/components/ward-management/on-call/on-call-phone";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Scenario() {
  return <output data-testid="selected-scenario">{useWardFlow().scenario}</output>;
}

describe("selection controls preserve their action contracts", () => {
  it("changes the real on-call focal choice with arrow keys and retains one Tab stop", () => {
    const entries = buildOnCallDirectory();
    render(
      <PhoneFocal
        entries={entries}
        onOpen={vi.fn()}
        actions={{
          minute: NOW_ANCHOR,
          entries,
          favourites: [],
          onPick: vi.fn(),
          onToggleFavourite: vi.fn(),
          onCopy: vi.fn(),
        }}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Bed flow for" });
    const state = within(group).getByRole("radio", { name: "State" });
    const nmhs = within(group).getByRole("radio", { name: "NMHS" });
    state.focus();
    fireEvent.keyDown(state, { key: "ArrowRight" });
    expect(nmhs).toHaveFocus();
    expect(nmhs).toHaveAttribute("aria-checked", "true");
    expect(state).toHaveAttribute("aria-checked", "false");
    expect(
      within(group)
        .getAllByRole("radio")
        .filter((radio) => radio.tabIndex === 0),
    ).toEqual([nmhs]);
    fireEvent.keyDown(nmhs, { key: "Home" });
    expect(state).toHaveFocus();
    expect(state).toHaveAttribute("aria-checked", "true");
  });

  it("does not open or load a scenario on an arrow; explicit activation still requires confirmation", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Scenario />
        <WardDemoPanel />
      </WardFlowProvider>,
    );
    const group = screen.getByRole("group", { name: "Demo scenario" });
    const buttons = within(group).getAllByRole("button");
    const current = buttons.find((button) => button.getAttribute("aria-current") === "true")!;
    const next = buttons.find((button) => button !== current)!;
    const original = screen.getByTestId("selected-scenario").textContent;
    expect(current).toHaveTextContent("Loaded");
    current.focus();
    fireEvent.keyDown(current, { key: "ArrowRight" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("selected-scenario")).toHaveTextContent(original!);
    fireEvent.click(next);
    const confirmation = screen.getByRole("dialog");
    expect(screen.getByTestId("selected-scenario")).toHaveTextContent(original!);
    expect(current).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("selected-scenario")).toHaveTextContent(original!);
    fireEvent.click(next);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Load / }));
    expect(screen.getByTestId("selected-scenario").textContent).not.toBe(original);
    expect(next).toHaveAttribute("aria-current", "true");
    expect(next).toHaveTextContent("Loaded");
  });
});
