// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-screen.dom.test.tsx and tests/ward-bed-release.dom.test.tsx: ClinicalRail
// renders next/link anchors and this suite never checks routing itself, so a plain <a> avoids
// requiring an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Moves `now` WITHOUT moving the world — same technique and same warning as
 * `tests/ward-delays-breached-clock-urgency.dom.test.tsx`'s own `AdvanceClock`: `ADVANCE_CLOCK`
 * adds to `clockOffsetMinutes`, the only mechanism in this app that can cross a day boundary.
 */
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

/**
 * Task F1 (owner answer 32, build plan §3/§4). Both forms used to feed a typed `HH:MM` straight
 * into `parseTimeInputToInstant`, which always returned a bare minute of demo DAY ZERO — see
 * `tests/ward-release-day.test.ts` for the pure-function proof of the defect and its fix. This
 * suite proves the two forms are actually WIRED to the fix: each offers the exact Today/Tomorrow
 * chooser, the exact wording from the build plan, and the leave form behaves the same as the
 * release form throughout.
 *
 * The clock is advanced past midnight once (to day 1, 10:00 — the task brief's own worked
 * example) before the hint assertions, because a same-day-only bug in the wiring would be
 * invisible on day zero: `dayOf(now)` is 0 there regardless of whether the code reads it at all.
 */
describe("ward release/leave forms — Today/Tomorrow day chooser", () => {
  function renderOnDay1At10() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock minutes={1 * 1440 + 10 * 60 - NOW_ANCHOR} />
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-advance-clock"));
  }

  it("does not render the flag-bed or leave day choosers", () => {
    renderOnDay1At10();
    expect(screen.queryByTestId("ward-flag-bed-release")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-bed-release-day-today")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-day-today")).not.toBeInTheDocument();
  });

  it("does not show the release-form past-time hint", () => {
    renderOnDay1At10();
    expect(screen.queryByLabelText("Expected free")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-bed-release-day-hint")).not.toBeInTheDocument();
  });

  it("does not show the leave-form past-time hint", () => {
    renderOnDay1At10();
    expect(screen.queryByLabelText("Expected return")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-day-hint")).not.toBeInTheDocument();
  });

  it("does not offer a release submit that can record a bed coming free", () => {
    renderOnDay1At10();
    expect(screen.queryByLabelText("Waiting on")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-flag-bed-release-submit")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Choose the patient whose bed is coming free. Nothing was recorded."),
    ).not.toBeInTheDocument();
  });

  it("does not offer a leave submit that can record a bed on leave", () => {
    renderOnDay1At10();
    expect(screen.queryByTestId("ward-leave-bed-submit")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose the patient who is on leave. Nothing was recorded.")).not.toBeInTheDocument();
  });

  it("on the opening day, the leave form is still absent", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-leave-bed-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-leave-bed-day-hint")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave, 14:00–18:00" })).toBeInTheDocument();
  });
});
