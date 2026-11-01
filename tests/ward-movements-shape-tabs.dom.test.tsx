import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function openShapeOfTheDay(): HTMLElement {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Movement side view" })).getByRole("button", { name: "Shape of the day" }),
  );
  return screen.getByRole("region", { name: "Shape of the day" });
}

describe("Shape of the day tabs", () => {
  it("follow the WAI-ARIA tabs pattern: aria-controls, roving tabIndex, arrow, Home and End keys", () => {
    const region = openShapeOfTheDay();
    const tablist = within(region).getByRole("tablist", { name: "Shape of the day" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    const selected = () => tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");

    const expectSelected = (index: number, panelName: string) => {
      expect(selected()).toEqual([tabs[index]]);
      tabs.forEach((tab, i) => expect(tab.tabIndex).toBe(i === index ? 0 : -1));
      expect(document.activeElement).toBe(tabs[index]);
      const panel = within(region).getByRole("tabpanel", { name: panelName });
      expect(tabs[index].getAttribute("aria-controls")).toBe(panel.id);
      expect(document.getElementById(tabs[index].getAttribute("aria-controls")!)).toBe(panel);
    };

    expect(selected()).toEqual([tabs[0]]);
    tabs[0].focus();
    expectSelected(0, "Where they wait");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expectSelected(1, "Flow today");
    fireEvent.keyDown(tabs[1], { key: "ArrowRight" });
    expectSelected(2, "Outcomes today");
    fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    expectSelected(0, "Where they wait");
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expectSelected(2, "Outcomes today");
    fireEvent.keyDown(tabs[2], { key: "Home" });
    expectSelected(0, "Where they wait");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expectSelected(2, "Outcomes today");
  });
});
