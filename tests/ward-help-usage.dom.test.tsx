import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HOW_TO_IDS } from "@/components/ward-management/help/ward-help-howto";
import { WardHelpUsageCard } from "@/components/ward-management/help/ward-help-usage-card";
import {
  HELP_USED_STORAGE_KEY,
  clearHelpUsed,
  parseHelpUsed,
  recordHowToUsed,
} from "@/components/ward-management/help/ward-help-usage";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";

/**
 * Help usage counts (Josh, 26 Oct 2026): which Ask help answers are used on this device, kept as
 * known answer ids and whole counts only, never typed words.
 */
afterEach(() => window.localStorage.removeItem(HELP_USED_STORAGE_KEY));

describe("help usage counts", () => {
  it("keeps known answer ids with whole positive counts and drops anything else", () => {
    expect([
      ...parseHelpUsed("pull-bed:3,Wren Tobias:2,theme:x,tv:0,tv:-1,book-transport:2.5,buzz:1", HOW_TO_IDS),
    ]).toEqual([
      ["pull-bed", 3],
      ["buzz", 1],
    ]);
  });

  it("adds one use at a time, ignores unknown ids and clears", () => {
    recordHowToUsed("pull-bed", HOW_TO_IDS);
    recordHowToUsed("pull-bed", HOW_TO_IDS);
    recordHowToUsed("theme", HOW_TO_IDS);
    recordHowToUsed("Wren Tobias", HOW_TO_IDS);
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBe("pull-bed:2,theme:1");
    clearHelpUsed();
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBeNull();
  });

  it("survives sign-out, because it holds nothing about a person", () => {
    recordHowToUsed("tv", HOW_TO_IDS);
    endWardFlowBrowserSession();
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBe("tv:1");
  });

  it("lists the most used answers by title in Settings, and clears them", () => {
    render(<WardHelpUsageCard />);
    expect(screen.getByText(/No answers used yet/)).toBeTruthy();
    act(() => {
      recordHowToUsed("theme", HOW_TO_IDS);
      recordHowToUsed("pull-bed", HOW_TO_IDS);
      recordHowToUsed("pull-bed", HOW_TO_IDS);
    });
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows[0]).toMatch(/^Pull the bed for a patient2$/);
    expect(rows).toHaveLength(2);
    fireEvent.click(screen.getByTestId("ward-settings-help-usage-clear"));
    expect(screen.getByText(/No answers used yet/)).toBeTruthy();
  });
});
