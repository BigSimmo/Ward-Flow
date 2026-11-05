import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TeamHome } from "@/components/ward-management/community/team-2026/team-home";
import {
  MIDLAND_DECISIONS_KEY,
  recordMidlandContact,
} from "@/components/ward-management/community/team-2026/midland-decisions";

describe("Record contact logs in Today's log with time and role (Josh, 5 Nov 2026)", () => {
  beforeEach(() => window.localStorage.clear());

  it("the Act-now row records the contact, shows it done, and the log lists it", () => {
    render(<TeamHome go={vi.fn()} now="10:00" />);
    fireEvent.click(screen.getByText("Record contact").closest("button")!);
    expect(screen.getByText(/^Contact recorded at \d\d:\d\d$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Today's log/ }));
    expect(screen.getByText("Thornbury, Cleo · by Community")).toBeTruthy();
    // Only the row key and time are stored: no typed note, no name.
    const stored = window.localStorage.getItem(MIDLAND_DECISIONS_KEY) ?? "";
    expect(stored).not.toContain("Thornbury");
  });

  it("a team-level contact from the dialog joins the log too", () => {
    recordMidlandContact("team", 1_000);
    render(<TeamHome go={vi.fn()} now="10:00" />);
    fireEvent.click(screen.getByRole("radio", { name: /Today's log/ }));
    expect(screen.getByText("Team contact · by Community")).toBeTruthy();
  });
});
