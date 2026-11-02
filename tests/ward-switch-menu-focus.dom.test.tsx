// A4 (accessibility check, 2 Nov 2026): the Switch ward panel keeps Tab inside, like the other
// pop-ups, and Escape gives focus back to Switch ward.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { WardSwitchMenu } from "@/components/ward-management/ward/ward-switch-menu";

afterEach(cleanup);

function renderMenu() {
  const unit = allUnits().find((candidate) => candidate.id === "rph-adult-secure")!;
  const others = allUnits().filter((candidate) => candidate.id !== unit.id && candidate.siteCode === unit.siteCode);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardSwitchMenu unit={unit} switchUnits={others.slice(0, 3)} onChoose={() => {}} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-switch-btn"));
  const panel = screen.getByTestId("ward-switch-menu");
  const buttons = Array.from(panel.querySelectorAll<HTMLElement>("button"));
  // jsdom lays nothing out, so give the buttons a box for the trap's visibility filter.
  for (const button of buttons) button.getClientRects = () => [{}] as unknown as DOMRectList;
  return { panel, buttons };
}

describe("Switch ward panel focus", () => {
  it("is a modal dialog that keeps Tab and Shift+Tab inside", () => {
    const { panel, buttons } = renderMenu();
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAttribute("aria-modal", "true");
    buttons.at(-1)!.focus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons.at(-1));
  });

  it("returns focus to Switch ward on Escape", () => {
    const { buttons } = renderMenu();
    buttons[1]!.focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("ward-switch-menu")).toBeNull();
    expect(screen.getByTestId("ward-switch-btn")).toHaveFocus();
  });
});
