import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardTvView } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { TV_CHANGE_MARK_MINUTES } from "@/components/ward-management/bed-meeting/tv-change-marks";
import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS, formatInstant } from "@/components/ward-management/ward-clock";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Plan item 43 (D-137): the ward TV's tiles say "Changed HH:MM" for 15 minutes after a figure changes. */
function sheetAt() {
  const state = seedWardFlowStateAt(0);
  const unit = state.units[0];
  return wardTvSheet({
    units: state.units,
    movements: state.movements,
    bedReleases: state.bedReleases,
    admissions: state.admissions,
    leaveBeds: state.leaveBeds,
    now: NOW_ANCHOR,
    nameOf: () => "",
    unit,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
  });
}

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe("the ward TV's change marks", () => {
  it("shows none on first load, marks a changed tile, and clears it after 15 minutes", () => {
    const sheet = sheetAt();
    const view = render(<WardTvView sheet={sheet} now={NOW_ANCHOR} scenario="Synthetic" />);
    expect(document.querySelector("[data-tv-change-mark]")).toBeNull();

    const changed = {
      ...sheet,
      overdue: [...sheet.overdue, ...sheet.overdue.slice(0, 1)],
      askedCount: sheet.askedCount + 1,
    };
    view.rerender(<WardTvView sheet={changed} now={NOW_ANCHOR + 2} scenario="Synthetic" />);
    expect(screen.getByTestId("ward-tv-asked-changed")).toHaveTextContent(`Changed ${formatInstant(NOW_ANCHOR + 2)}`);
    expect(screen.queryByTestId("ward-tv-ready-changed")).toBeNull();
    // The bed count's own age line stays beside a mark on the same tile.
    expect(screen.getByTestId("ward-tv-ready-age")).toHaveTextContent("Confirmed");

    view.rerender(
      <WardTvView sheet={changed} now={NOW_ANCHOR + 2 + TV_CHANGE_MARK_MINUTES - 1} scenario="Synthetic" />,
    );
    expect(screen.getByTestId("ward-tv-asked-changed")).toBeInTheDocument();
    view.rerender(<WardTvView sheet={changed} now={NOW_ANCHOR + 2 + TV_CHANGE_MARK_MINUTES} scenario="Synthetic" />);
    expect(screen.queryByTestId("ward-tv-asked-changed")).toBeNull();
  });

  it("invents no change while the screen is frozen", () => {
    const sheet = sheetAt();
    const view = render(<WardTvView sheet={sheet} now={NOW_ANCHOR} scenario="Synthetic" frozen />);
    view.rerender(
      <WardTvView
        sheet={{ ...sheet, askedCount: sheet.askedCount + 3 }}
        now={NOW_ANCHOR + 1}
        scenario="Synthetic"
        frozen
      />,
    );
    expect(document.querySelector("[data-tv-change-mark]")).toBeNull();
  });

  it("is plain text with reduced motion asked for: no live region, nothing that moves", () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const sheet = sheetAt();
    const view = render(<WardTvView sheet={sheet} now={NOW_ANCHOR} scenario="Synthetic" />);
    view.rerender(
      <WardTvView sheet={{ ...sheet, askedCount: sheet.askedCount + 1 }} now={NOW_ANCHOR + 1} scenario="Synthetic" />,
    );
    const mark = screen.getByTestId("ward-tv-asked-changed");
    expect(mark.tagName).toBe("SPAN");
    expect(mark).not.toHaveAttribute("aria-live");
    expect(mark).not.toHaveAttribute("role");
    expect(mark.getAttribute("style")).toBeNull();
    expect(mark).toHaveTextContent(/^Changed \d{2}:\d{2}$/);
  });
});
