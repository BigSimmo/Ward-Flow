import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import { popSheet, pushSheet } from "@/components/wf/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function trigger() {
  return screen.getByTestId("ward-rail-persona-trigger");
}

describe("rail persona follows the desk", () => {
  it("shows a transport officer for the Transport desk and a community clinician for the Community desk", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );

    act(() => dispatchPersonaSyncForRole("officer"));
    expect(trigger().getAttribute("aria-label")).toContain("Transport officer");
    expect(trigger().getAttribute("aria-label")).not.toContain("psychiatrist");

    act(() => dispatchPersonaSyncForRole("community"));
    expect(trigger().getAttribute("aria-label")).toContain("Community team clinician");
  });
});

describe("rail popover and sheets share one Escape", () => {
  it("leaves the persona popover open while a sheet is open, and closes it on the next press", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    const sheetNode = document.createElement("div");
    document.body.appendChild(sheetNode);
    pushSheet("test-rail-sheet", sheetNode);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    popSheet("test-rail-sheet");
    sheetNode.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("rail persona keyboard navigation", () => {
  it("opens on the selected option, navigates without selecting, and returns focus after Enter", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    trigger().focus();
    await user.keyboard("{Enter}");
    const options = screen.getAllByRole("option");
    expect(screen.getByRole("listbox")).toHaveAttribute("tabindex", "-1");
    expect(document.getElementById(trigger().getAttribute("aria-controls") ?? "")).toBe(screen.getByRole("listbox"));
    expect(options[0]).toHaveFocus();
    expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1);
    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveFocus();
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(options.at(-1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(options.at(-1)).toHaveFocus();
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("option")[1]).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("allows Tab to leave the option list and closes the popover without trapping focus", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    await user.click(trigger());
    await user.tab();
    expect(screen.getByRole("link", { name: "Policy 2026.3" })).toHaveFocus();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the popover open when a press inside blurs without a focus target (Safari, macOS Firefox)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const selected = screen.getAllByRole("option").find((option) => option.getAttribute("aria-selected") === "true")!;
    // WebKit does not focus a pressed <button>: focus leaves the option with relatedTarget null.
    fireEvent.blur(selected, { relatedTarget: null });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByText("Go to a desk…"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
