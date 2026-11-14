import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BedMeetingTvLoading from "@/app/ward-flow/bed-meeting/loading";
import { TvFooterText } from "@/components/ward-management/bed-meeting/tv-leave-link";

describe("R-FIGS-21 and R-FIGS-22", () => {
  it("shows the TV heading from the loading state", () => {
    render(<BedMeetingTvLoading />);
    expect(screen.getByRole("heading", { level: 1, name: "Bed meeting" })).toBeInTheDocument();
  });
  it("uses the shared notice, with no invented day count", () => {
    const text = TvFooterText({ scope: "Statewide", shift: "Day shift", scenario: "Quiet day" });
    expect(text).toContain("Synthetic data. Read only.");
    expect(text).not.toMatch(/day \d+ of/u);
  });
});
