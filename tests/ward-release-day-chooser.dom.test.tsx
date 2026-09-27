// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("both forms offer exactly Today and Tomorrow, Today checked by default, never free text", () => {
    renderOnDay1At10();

    for (const [formTestId, dayFieldPrefix] of [
      ["ward-flag-bed-release", "ward-bed-release-day"],
      ["ward-leave-bed-form", "ward-leave-bed-day"],
    ] as const) {
      const form = screen.getByTestId(formTestId);
      const today = within(form).getByTestId(`${dayFieldPrefix}-today`);
      const tomorrow = within(form).getByTestId(`${dayFieldPrefix}-tomorrow`);

      expect(today).toHaveAttribute("type", "radio");
      expect(tomorrow).toHaveAttribute("type", "radio");
      expect(today).toBeChecked();
      expect(tomorrow).not.toBeChecked();

      // "Day" legend, and exactly these two options — a fixed control, never free text.
      expect(within(form).getByText("Day")).toBeInTheDocument();
      expect(
        within(form)
          .getAllByRole("radio")
          .map((radio) => radio.getAttribute("data-testid")),
      ).toEqual([`${dayFieldPrefix}-today`, `${dayFieldPrefix}-tomorrow`]);
    }
  });

  it("release form: choosing Today with a past time shows the exact hint; Tomorrow never does", () => {
    renderOnDay1At10();

    // now is day 1, 10:00. 09:00 today has already passed.
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "09:00" } });
    expect(screen.getByTestId("ward-bed-release-day-hint")).toHaveTextContent(
      "That time has already passed today, so this bed will show as due now.",
    );

    // Switching to Tomorrow must clear the hint — 09:00 tomorrow has not passed, however early
    // the clock face reads. A same-day-only comparison (the shape the old bug would take if
    // half-fixed) would keep the hint showing here.
    fireEvent.click(screen.getByTestId("ward-bed-release-day-tomorrow"));
    expect(screen.queryByTestId("ward-bed-release-day-hint")).not.toBeInTheDocument();

    // Back to Today: the hint returns, proving the control is read live rather than latched.
    fireEvent.click(screen.getByTestId("ward-bed-release-day-today"));
    expect(screen.getByTestId("ward-bed-release-day-hint")).toBeInTheDocument();

    // A later-today time never shows the hint.
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "14:00" } });
    expect(screen.queryByTestId("ward-bed-release-day-hint")).not.toBeInTheDocument();
  });

  it("leave form behaves exactly the same, with its own exact hint wording", () => {
    renderOnDay1At10();

    fireEvent.change(screen.getByLabelText("Expected return"), { target: { value: "09:00" } });
    expect(screen.getByTestId("ward-leave-bed-day-hint")).toHaveTextContent(
      "That time has already passed today, so this bed will show as due back now.",
    );

    fireEvent.click(screen.getByTestId("ward-leave-bed-day-tomorrow"));
    expect(screen.queryByTestId("ward-leave-bed-day-hint")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-leave-bed-day-today"));
    expect(screen.getByTestId("ward-leave-bed-day-hint")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Expected return"), { target: { value: "14:00" } });
    expect(screen.queryByTestId("ward-leave-bed-day-hint")).not.toBeInTheDocument();
  });

  // 🔴 CHANGED 25 September 2026 (Josh chose "Refuse"): with no patient picker yet, a release
  // submit is refused and records nothing. What this test still proves is that a Tomorrow time
  // gets PAST the day-aware parse and reaches the patient check: the refusal message appears (a
  // parse failure returns silently before it). When the picker lands, restore the success half:
  // the form resets and the chooser returns to Today.
  it("release form: a Tomorrow time passes the day-aware parse and reaches the patient check, which refuses with no patient chosen", () => {
    renderOnDay1At10();

    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Nothing outstanding" } });
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByTestId("ward-bed-release-day-tomorrow"));
    expect(screen.getByTestId("ward-bed-release-day-tomorrow")).toBeChecked();

    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    expect(screen.getByText("Choose the patient whose bed is coming free. Nothing was recorded.")).toBeInTheDocument();
    // Refused, so nothing is reset: the choices stay as the ward left them.
    expect(screen.getByLabelText("Waiting on")).toHaveValue("Nothing outstanding");
    expect(screen.getByTestId("ward-bed-release-day-tomorrow")).toBeChecked();
  });

  // CHANGED 25 September 2026 (owner ruling: a leave bed names the stay it belongs to). The form has
  // no patient picker yet, so it refuses with a plain message, as the bed-release form beside it
  // does (case above). When the picker lands, restore the record half: the count rises by one and
  // the chooser resets to Today.
  it("leave form: submitting with Tomorrow chosen is refused with no patient chosen, and nothing is reset", () => {
    renderOnDay1At10();

    const before = screen.getByTestId("ward-leave-bed-form").textContent ?? "";

    fireEvent.change(screen.getByLabelText("Expected return"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByTestId("ward-leave-bed-day-tomorrow"));
    fireEvent.click(screen.getByTestId("ward-leave-bed-submit"));

    expect(screen.getByText("Choose the patient who is on leave. Nothing was recorded.")).toBeInTheDocument();
    const after = screen.getByTestId("ward-leave-bed-form").textContent ?? "";
    expect(after, "a refused submit must not change this ward's on-leave count").toBe(before);
    // Refused, so nothing is reset: the choice stays as the ward left it.
    expect(screen.getByTestId("ward-leave-bed-day-tomorrow")).toBeChecked();
  });

  it("on the opening day, before any midnight roll, existing same-day submits are unaffected", () => {
    // No clock advance here — the exact scenario every pre-existing test in
    // ward-screen.dom.test.tsx and ward-bed-release.dom.test.tsx already exercises, which must
    // keep passing unchanged: default Today, no interaction with the new chooser at all.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="scgh-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-leave-bed-day-hint")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Expected return"), { target: { value: "12:15" } });
    fireEvent.click(screen.getByTestId("ward-leave-bed-submit"));
    expect(screen.getByTestId("ward-leave-bed-form")).toHaveTextContent(
      "1 bed currently on leave at Mental Health Unit",
    );
  });
});
