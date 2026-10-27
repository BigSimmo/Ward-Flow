import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (e: unknown) => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

import { TvFooterText, TvLeaveLink } from "@/components/ward-management/bed-meeting/tv-leave-link";
import { noteWardRoute, resetWardRouteHistory } from "@/components/ward-management/shell/ward-back";

const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

afterEach(() => {
  back.mockClear();
  resetWardRouteHistory();
});

describe("Leave TV view (audit P129)", () => {
  it("returns to the screen the TV was opened from", () => {
    noteWardRoute("/ward-flow/wards");
    noteWardRoute("/ward-flow/bed-meeting/tv");
    render(<TvLeaveLink className="x" />);
    const link = screen.getByRole("link", { name: "Leave TV view" });
    fireEvent.click(link);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("falls back to Capacity when the TV was opened directly", () => {
    render(<TvLeaveLink className="x" />);
    const link = screen.getByRole("link", { name: "Leave TV view" });
    expect(link).toHaveAttribute("href", "/ward-flow/capacity");
    fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
  });
});

describe("TV footer scenario wording (audit P128)", () => {
  it("names the scenario as demo data, not as a statement about today", () => {
    const text = TvFooterText({ scope: "Statewide", shift: "Day shift", scenario: "Quiet day", dayNote: "today" });
    expect(text).toContain("Demo data: Quiet day");
    expect(text).not.toContain("Scenario: Quiet day");
  });
});
