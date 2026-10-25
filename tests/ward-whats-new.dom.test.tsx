import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * What's new (Josh, 24 Oct 2026): a short note shown once per device that has had the tour, gone
 * once closed. A first visit gets the tour instead, which marks the note read.
 */

import {
  WHATS_NEW,
  WHATS_NEW_STORAGE_KEY,
  WardWhatsNew,
  markWhatsNewSeen,
} from "@/components/ward-management/help/ward-whats-new";

const TOUR_AUTO_DONE = "ward_flow_choice_tour_auto_done";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("what's new note", () => {
  it("stays hidden on a device that has not had the tour yet", () => {
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("shows once on a returning device, and Got it keeps it closed", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const { unmount } = render(<WardWhatsNew />);
    expect(screen.getByTestId("ward-whats-new").textContent).toContain(WHATS_NEW.lines[0]);
    fireEvent.click(screen.getByTestId("ward-whats-new-close"));
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW.id);
    unmount();
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("opens Help at the desk guide from its button", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardWhatsNew />);
    fireEvent.click(screen.getByRole("button", { name: "Open Help" }));
    expect(opened).toEqual(["desk"]);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
    window.removeEventListener("ward-flow-open-help", listener);
  });

  it("stays hidden once marked read, as the tour does on a first visit", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    act(() => markWhatsNewSeen());
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("keeps its lines short enough for a small card", () => {
    expect(WHATS_NEW.lines.length).toBeLessThanOrEqual(4);
    for (const line of WHATS_NEW.lines) expect(line.length).toBeLessThanOrEqual(120);
  });
});
