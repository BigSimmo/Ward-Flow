// Coordinator phone (Josh, 8 Nov 2026): Call and log, and Capacity at a glance. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ToolCallLog } from "@/components/ward-management/tools/ward-tool-call-log";
import { NextCapacityGlance } from "@/components/ward-management/shell-next/next-capacity-glance";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  installMatchMediaStub(false);
  window.localStorage.clear();
});

describe("Call and log", () => {
  it("logs a picked ward and outcome, sets the ring-back, and stores no typed text", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolCallLog onNavigate={() => {}} />
      </WardFlowProvider>,
    );
    const save = screen.getByRole("button", { name: /Save call/u });
    expect(save).toHaveAttribute("aria-disabled", "true");
    const wards = screen.getByRole("group", { name: "Which ward" });
    const first = within(wards).getAllByRole("button")[0]!;
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("radio", { name: /No answer/u }));
    expect(screen.getByRole("switch", { name: /Remind me to ring back/u })).toHaveAttribute("aria-checked", "true");
    expect(first).toHaveAttribute("aria-pressed", "true");
    const ready = screen.getByRole("button", { name: /Save call/u });
    expect(ready).not.toHaveAttribute("aria-disabled");
    fireEvent.click(ready);
    expect(screen.getByRole("status")).toHaveTextContent(/no answer\. Ring-back set for/u);
    const calls = screen.getByRole("heading", { name: "Your calls" }).parentElement!;
    expect(within(calls).getByText(/No answer/u)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    const stored = JSON.parse(window.localStorage.getItem("wf-mock-tools-call-log") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(Object.keys(stored[0]).sort()).toEqual(["at", "id", "outcome", "wardId", "wardLabel"]);
    expect(JSON.parse(window.localStorage.getItem("wf-mock-tools-reminders") ?? "[]")[0].reason).toBe("Call back");
  });
});

describe("Capacity at a glance", () => {
  it("shows ready beds against waiting, by bed type, and links to the full page", () => {
    installMatchMediaStub(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NextCapacityGlance open onClose={() => {}} returnFocusRef={{ current: null }} />
      </WardFlowProvider>,
    );
    const sheet = screen.getByTestId("ward-phone-capacity-sheet");
    expect(within(sheet).getByRole("heading", { level: 2 })).toHaveTextContent(/\d+ beds ready for \d+ waiting/u);
    expect(within(sheet).getByRole("heading", { name: /Place someone now/u })).toBeInTheDocument();
    expect(within(sheet).getByRole("heading", { name: /Freeing up today/u })).toBeInTheDocument();
    expect(screen.getByTestId("ward-phone-capacity-open")).toHaveAttribute("href", "/ward-flow/capacity");
  });
});
