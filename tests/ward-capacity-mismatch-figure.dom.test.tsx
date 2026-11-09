import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MismatchFigure } from "@/components/ward-management/capacity/capacity-mismatch-figure";

afterEach(cleanup);

/** Josh's fifth notes, option B (8 Nov 2026): one dot per person waiting, said again in words. */
describe("Mismatch drawer figure", () => {
  it("splits a short type into covered, freeing today and no bed yet, and says tomorrow's range", () => {
    const { container } = render(
      <MismatchFigure
        gap={-6}
        waiting={13}
        bedsThatFit={7}
        freeingToday={1}
        tomorrow={{ low: -7, likely: -6, high: 2 }}
      />,
    );
    const figure = screen.getByTestId("capacity-mismatch-figure");
    expect(figure).toHaveTextContent("6 short");
    expect(figure).toHaveTextContent("13 waiting");
    expect(figure).toHaveTextContent("7 ready beds fit");
    expect(screen.getByText("7 covered by a ready bed")).toBeInTheDocument();
    expect(screen.getByText("1 more if today's discharge goes ahead")).toBeInTheDocument();
    expect(screen.getByText("5 with no bed yet")).toBeInTheDocument();
    expect(figure).toHaveTextContent("Likely 6 short");
    expect(figure).toHaveTextContent("Could be 7 short to 2 spare that fit");
    const dots = container.querySelectorAll('[aria-hidden="true"] > [data-kind]');
    expect(dots).toHaveLength(13);
  });

  it("shows spare beds as their own dots and never a freeing dot when the type has enough", () => {
    const { container } = render(
      <MismatchFigure gap={1} waiting={0} bedsThatFit={1} freeingToday={2} tomorrow={undefined} />,
    );
    expect(screen.getByTestId("capacity-mismatch-figure")).toHaveTextContent("1 spare that fit");
    expect(screen.getByText("1 spare bed")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-kind="freeing"]')).toHaveLength(0);
    expect(screen.queryByText(/Tomorrow/u)).toBeNull();
  });
});
