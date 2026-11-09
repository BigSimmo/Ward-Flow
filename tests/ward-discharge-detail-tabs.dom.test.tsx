import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { giveOnBehalfReason } from "./helpers/ward-on-behalf-reason";

describe("discharge detail tabs", () => {
  it.each(["release", "record"])("links %s tabs and panels, with one tab stop and arrow navigation", async (kind) => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    if (kind === "record") await user.click(screen.getByTestId("ward-discharge-history"));
    const worklist = screen.getByRole("region", { name: "Discharge worklist" });
    await user.click(within(worklist).getAllByRole("button")[0]);
    if (kind === "record") giveOnBehalfReason();
    // Drawer review (6 Nov 2026): the kit drawer's tabs sit under its head, and the drawer shows the
    // selected tab's panel as the one scroll area.
    const tablist = screen.getByRole("tablist", { name: "Discharge inspection sections" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    const panelFor = (tab: HTMLElement) => document.getElementById(tab.getAttribute("aria-controls") ?? "");
    expect(panelFor(tabs[0])).toHaveAttribute("role", "tabpanel");
    expect(panelFor(tabs[0])).toHaveAttribute("aria-labelledby", tabs[0].id);
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(panelFor(tabs[1])).toHaveAttribute("aria-labelledby", tabs[1].id);
    expect(screen.getByRole("tabpanel", { name: /^Held up/u })).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(tabs[3]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tabs[3]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});
