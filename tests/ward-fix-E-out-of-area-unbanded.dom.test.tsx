import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { CHECKED_TRAVEL_BANDS } from "@/components/ward-management/ward-travel-bands";
import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * A16-04 (Josh, 13 Nov 2026): the app shows only travel bands someone has checked. With none
 * checked, nobody can be placed far from home, and the Out of area page must not read that as
 * "Nobody is far from home". This file deliberately does NOT load the tests' own band table.
 */
describe("A16-04: Out of area with no checked travel bands", () => {
  it("says nobody is shown as far from home and how many have no travel time, not that nobody is far", () => {
    // D-193: no checked bands before the demo. Once Josh adds them, rewrite this test for the new state.
    expect(CHECKED_TRAVEL_BANDS).toHaveLength(0);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard />
      </WardFlowProvider>,
    );
    const empty = screen.getByTestId("ward-out-of-area-empty");
    expect(empty).toHaveTextContent(/^Nobody is shown as far from home\. \d+ people have no travel time recorded\.$/u);
    expect(empty).not.toHaveTextContent("Nobody on these records is in a bed far from home.");
  });

  /**
   * D-193 (Josh, 13 Nov 2026): no checked travel times before the demo. The phone's Everyone list
   * was simply empty; it now says the same sentence as the desktop list, from the same source.
   */
  describe("at phone width", () => {
    afterEach(() => installMatchMediaStub(false));

    it("says the same sentence in Everyone instead of an empty list", () => {
      // D-193: the honest "not recorded" state is the one under test; adding checked times changes it.
      expect(CHECKED_TRAVEL_BANDS).toEqual([]);
      installMatchMediaStub(true);
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OutOfAreaBoard />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByRole("radio", { name: /^Everyone/u }));
      const empty = screen.getByTestId("ward-out-of-area-phone-empty");
      expect(empty).toBeVisible();
      expect(empty).toHaveTextContent(
        /^Nobody is shown as far from home\. \d+ people have no travel time recorded\.$/u,
      );
      expect(screen.queryByTestId("ward-out-of-area-table")).toBeNull();
    });
  });
});
