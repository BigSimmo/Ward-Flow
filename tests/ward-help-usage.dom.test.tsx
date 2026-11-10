import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HOW_TO_IDS } from "@/components/ward-management/help/ward-help-howto";
import { WardHelpUsageCard } from "@/components/ward-management/help/ward-help-usage-card";
import {
  HELP_RECENT_STORAGE_KEY,
  HELP_USED_STORAGE_KEY,
  clearHelpUsed,
  parseHelpRecent,
  parseHelpUsed,
  recordHowToUsed,
  useRecentHowTos,
} from "@/components/ward-management/help/ward-help-usage";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";

/**
 * Help usage counts (Josh, 26 Oct 2026): which Ask help answers are used on this device, kept as
 * known answer ids and whole counts only, never typed words.
 */
afterEach(() => {
  window.localStorage.removeItem(HELP_USED_STORAGE_KEY);
  window.localStorage.removeItem(HELP_RECENT_STORAGE_KEY);
});

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
    expect(window.localStorage.getItem(HELP_RECENT_STORAGE_KEY)).toBeNull();
  });

  it("keeps a separate list in the order last used, so Recently opened lists the newest first", () => {
    recordHowToUsed("pull-bed", HOW_TO_IDS);
    recordHowToUsed("log-call", HOW_TO_IDS);
    recordHowToUsed("chase-discharge-dates", HOW_TO_IDS);
    recordHowToUsed("pull-bed", HOW_TO_IDS);
    expect(window.localStorage.getItem(HELP_USED_STORAGE_KEY)).toBe("pull-bed:2,log-call:1,chase-discharge-dates:1");
    expect(window.localStorage.getItem(HELP_RECENT_STORAGE_KEY)).toBe("log-call,chase-discharge-dates,pull-bed");
    const { result } = renderHook(() => useRecentHowTos(HOW_TO_IDS, 2));
    expect(result.current).toEqual(["pull-bed", "chase-discharge-dates"]);
  });

  it("does not read an old counts record, saved in first-used order, as last used (audit F-52)", () => {
    // Before 9 Nov the pairs were kept in the order first used; that order says nothing about recency.
    window.localStorage.setItem(HELP_USED_STORAGE_KEY, "pull-bed:5,log-call:2,chase-discharge-dates:1");
    const { result, rerender } = renderHook(() => useRecentHowTos(HOW_TO_IDS));
    expect(result.current).toEqual([]);
    act(() => recordHowToUsed("log-call", HOW_TO_IDS));
    rerender();
    expect(result.current).toEqual(["log-call"]);
    // The old counts still count.
    expect([...parseHelpUsed(window.localStorage.getItem(HELP_USED_STORAGE_KEY) ?? "", HOW_TO_IDS)]).toEqual([
      ["pull-bed", 5],
      ["log-call", 3],
      ["chase-discharge-dates", 1],
    ]);
  });

  it("keeps known ids only, each once at its latest place, in the recent list", () => {
    expect(parseHelpRecent("pull-bed,Wren Tobias,log-call,pull-bed,,theme:1", HOW_TO_IDS)).toEqual([
      "log-call",
      "pull-bed",
    ]);
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
