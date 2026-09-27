import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowDiagram } from "@/components/ward-management/coordinator/flow-diagram";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The diagram's sideways-scroll affordance (task C, Command mockup parity): a border on
 * `.diagramScroll` plus the sentence "This diagram is wider than the panel — scroll sideways to
 * see the rest." appear only while the diagram genuinely overflows, and are absent while it fits.
 *
 * jsdom performs no real layout, so `scrollWidth`/`clientWidth` are always `0` there and the
 * mockup's own mechanism (`updateDiagramAffordance()`, comparing the two) cannot be exercised by
 * rendering alone. This suite instead overrides those two properties on the REAL rendered
 * `.diagramScroll` element and fires a native `resize` event — the exact event
 * `flow-diagram.tsx`'s own window-resize listener already reacts to — so the assertion drives the
 * same measure pass (`measure()`, shared with the connector layout) the browser will run, rather
 * than a fabricated stand-in for it.
 *
 * Every expected value below is read straight off the rendered `data-overflowing` attribute and
 * the note's own text — never by importing and calling the comparison `flow-diagram.tsx` itself
 * makes, so a bug in that comparison cannot be invisible to this test the way it would be if the
 * test re-derived the identical boolean the identical way.
 */
describe("FlowDiagram's sideways-scroll affordance", () => {
  function renderDiagram() {
    return render(
      <FlowDiagram
        movement={undefined}
        movements={wardMovements}
        now={NOW_ANCHOR}
        units={allUnits()}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        parallelReferralCap={PARALLEL_REFERRAL_CAP}
      />,
    );
  }

  it("carries no overflow border or note on an ordinary render (jsdom's own 0/0 width, left unmocked)", () => {
    renderDiagram();
    const scroller = screen.getByTestId("ward-diagram-scroll");

    expect(scroller).not.toHaveAttribute("data-overflowing");
    expect(screen.queryByTestId("ward-diagram-scroll-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/scroll sideways/i)).not.toBeInTheDocument();
  });

  it("adds the border and the exact sentence once scrollWidth genuinely exceeds clientWidth", () => {
    renderDiagram();
    const scroller = screen.getByTestId("ward-diagram-scroll");

    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 600 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 900 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(scroller).toHaveAttribute("data-overflowing", "true");
    const note = screen.getByTestId("ward-diagram-scroll-note");
    expect(note).toHaveTextContent("This diagram is wider than the panel — scroll sideways to see the rest.");
  });

  it("removes the border and the note again once the width difference closes back up", () => {
    renderDiagram();
    const scroller = screen.getByTestId("ward-diagram-scroll");

    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 600 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 900 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(scroller).toHaveAttribute("data-overflowing", "true");

    // The diagram is unchanged; only the container's own available width grew back to fit it —
    // the same event a real window resize fires, carrying the same measure pass back the other way.
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 600 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(scroller).not.toHaveAttribute("data-overflowing");
    expect(screen.queryByTestId("ward-diagram-scroll-note")).not.toBeInTheDocument();
  });

  it("treats a one-pixel-wider scrollWidth as fitting, matching the `+ 1` tolerance `measure()` applies", () => {
    renderDiagram();
    const scroller = screen.getByTestId("ward-diagram-scroll");

    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 600 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 601 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(scroller).not.toHaveAttribute("data-overflowing");
    expect(screen.queryByTestId("ward-diagram-scroll-note")).not.toBeInTheDocument();
  });
});
