import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as the sibling ward dom suites: `ClinicalRail` renders next/link anchors and this
// suite never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WHAT THE CLINICIAN TYPED IS WHAT THE MOVEMENT CARRIES — END TO END, THROUGH THE REAL FORM.
 *
 * 🔴 **REWRITTEN, T3 — the field this file drives through the form used to be a single `HH:MM`
 * time with no date at all, so "what was typed" and "what the movement carries" were both bare
 * minute-of-day numbers.** `RECORD_LEGAL_FORM_EXPIRY` and `RAISE_REFERRAL`'s own capture (T2) both
 * store an `Instant` — minutes from the provider's `dayZero` — which a time alone cannot express
 * once a deadline may fall on a day other than the one the referral is raised on. This file now
 * drives `Date` and `Time` inputs and asserts `instantFromDateAndTimeInputs`'s (`ed-screen.tsx`)
 * resolution against `dayZero`, not only the old minute-of-day arithmetic.
 *
 * 🔴 **THIS FILE EXISTS BECAUSE A MUTATION SURVIVED**, and that history still governs what it
 * drives: `tests/ward-ed-due-at-field.dom.test.tsx` proves the fields are offered on the right
 * forms, `tests/ward-legal-form-due-at-capture.test.ts` proves the reducer stores what it is
 * handed, and **neither touches the code between them** — the conversion from typed strings to an
 * `Instant`. Breaking `minutesFromTimeInput` so that it COERCES instead of refusing —
 * `if (parts.length !== 2) return Number(value) || 0;` — left every case in the two files above
 * green; only a test that types into the real fields and reads the resulting movement can catch
 * that.
 *
 * ⚠️ **MEASURED, BECAUSE IT CHANGES WHICH CASES ARE WORTH WRITING — AND MEASURED IN JSDOM ONLY.**
 * Typing `"14"`, `"14:3"` or `"99:99"` into `<input type="time">`, or a malformed string into
 * `<input type="date">`, leaves the element's value as `""`; only a well-formed value is retained.
 * So under this suite the parser's malformed branches are unreachable, and asserting on them would
 * test the platform rather than this code. The reachable inputs here are `""` and a well-formed
 * value, and those are what this file drives.
 *
 * 🔴 **`dayZero` IS THE REAL CALENDAR DAY THE TEST RUNS ON** (`ward-flow-provider.tsx`'s own
 * `dayZeroRef.current = demoDayZero(new Date())` — real, unmockable `Date`, not derived from
 * `initialNow`). This file cannot pin a fixed date string the way it pinned `NOW_ANCHOR`'s minute
 * of day; it computes "today" and "tomorrow" from the real clock at run time, the same way the
 * provider itself does, so the typed date always resolves against the `dayZero` this render
 * actually gets.
 */

/** Surfaces the last movement's deadline, so the assertion reads the MODEL rather than the form it
 *  was typed into — a test that read the input back would pass with the dispatch disconnected. */
function DeadlineProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <p data-testid="deadline-probe">
      {last?.legalForm?.code ?? "no-form"}|{last?.legalForm?.dueAt ?? "no-deadline"}
    </p>
  );
}

/** `YYYY-MM-DD` for an `<input type="date">`, from a real `Date` — the same shape the browser
 *  itself would report, built by hand rather than with `toISOString` (which reports UTC and would
 *  disagree with the LOCAL date `demoDayZero` anchors to, exactly the drift that function's own
 *  doc comment warns a UTC epoch would cause for a Perth session). */
function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TODAY = dateInputValue(new Date());
const TOMORROW = dateInputValue(new Date(new Date().setDate(new Date().getDate() + 1)));

const REQUIRED = [
  { testId: "ward-ed-referral-cohort", value: "Adult" },
  { testId: "ward-ed-referral-security", value: "Open" },
  { testId: "ward-ed-referral-sex", value: "Female" },
  // T11 (item 8, after T10, owner answer 17 September 2026): a sixth required field this file's
  // own raise-referral flow must also answer, or the form blocks before this file's own subject
  // (typed expiry parsing) is ever reached.
  { testId: "ward-ed-referral-gender", value: "Female" },
  { testId: "ward-ed-referral-legal-status", value: "Voluntary" },
  { testId: "ward-ed-referral-urgency", value: "3" },
] as const;

function raiseTransportReferral(typed: { date: string; time: string } | undefined) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <DeadlineProbe />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
  for (const field of REQUIRED) {
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
  fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
  fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "4A" } });
  if (typed !== undefined) {
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), {
      target: { value: typed.date },
    });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), {
      target: { value: typed.time },
    });
  }
  fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
  return screen.getByTestId("deadline-probe").textContent ?? "";
}

describe("the typed deadline reaches the movement, and an untyped one stays absent", () => {
  it("carries a date and time the clinician actually typed, on dayZero itself", () => {
    // 14:30 on day 0 (today, the day this test runs) is 870 minutes past dayZero — asserted as the
    // resolved number rather than the strings, because the point of this file is the conversion
    // between them.
    expect(raiseTransportReferral({ date: TODAY, time: "14:30" })).toBe("4A|870");
  });

  /**
   * 🔴 THE CASE THE ORIGINAL SURVIVING MUTANT BROKE, PRESERVED THROUGH THE REWRITE. Leaving both
   * fields untouched must produce NO deadline — not midnight, not the current time, not zero.
   * `no-deadline` here is the probe's word for `undefined`, and any number appearing in its place
   * is a deadline nobody set.
   */
  it("leaves it absent when the clinician typed nothing, and absent means absent", () => {
    const shown = raiseTransportReferral(undefined);
    expect(shown, "untouched date and time fields must not become a deadline").toBe("4A|no-deadline");
    expect(shown, "and specifically it must not become midnight, which reads as a real time").not.toContain("|0");
  });

  /**
   * The day-offset half of `instantFromDateAndTimeInputs` — new with T3, and untested by the
   * pre-T3 version of this file, which had no date field to carry a day at all. Tomorrow's 14:30 is
   * a full day (1440 minutes) later than today's, so the resolved `Instant` must be 2310, not 870
   * again — a parser that silently discarded the date and kept only the time would pass every case
   * above and fail only this one.
   */
  it("resolves a date on a different day against dayZero, not only the time of day", () => {
    expect(raiseTransportReferral({ date: TOMORROW, time: "14:30" })).toBe("4A|2310");
  });
});
