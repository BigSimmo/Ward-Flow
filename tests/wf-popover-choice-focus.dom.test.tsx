import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Popover, RadioGroup } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NextRailBody as WardRail } from "@/components/ward-management/shell-next/next-rail-body";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Spec item 14 (C07, 13 Nov 2026): a pop-up of choices opens on its current choice; arrows move,
 * Enter picks, Escape closes and returns focus to the button. The theme choices are a radio group.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("kit Popover", () => {
  function Sort() {
    const [order, setOrder] = useState("Oldest");
    return (
      <Popover label="Sort" trigger={(props) => <button {...props}>Sort</button>}>
        {() => (
          <RadioGroup aria-label="Order" selectOnMove={false}>
            {["Newest", "Oldest", "Name"].map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={order === choice}
                onClick={() => setOrder(choice)}
              >
                {choice}
              </button>
            ))}
          </RadioGroup>
        )}
      </Popover>
    );
  }

  it("opens on the current choice, arrows move without picking, Enter picks, Escape returns", async () => {
    const user = userEvent.setup();
    render(<Sort />);
    const button = screen.getByRole("button", { name: "Sort" });
    await user.click(button);
    expect(screen.getByRole("radio", { name: "Oldest" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Name" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Oldest" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("radio", { name: "Name" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(button).toHaveFocus();
  });
});

describe("Appearance pop-up on the rail", () => {
  it("is a radio group that takes focus on its current choice and hands it back on Escape", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    const toggle = screen.getByTestId("ward-rail-appearance-toggle");
    act(() => toggle.focus());
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const current = group.querySelector('[role="radio"][aria-checked="true"]');
    expect(current).not.toBeNull();
    expect(current).toHaveFocus();

    // Arrows move focus only; Enter picks.
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));
    const dark = screen.getByRole("radio", { name: "Dark" });
    while (document.activeElement !== dark) await user.keyboard("{ArrowRight}");
    expect(dark).toHaveAttribute("aria-checked", "false");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([dark]);
    await user.keyboard("{Enter}");
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });
});
