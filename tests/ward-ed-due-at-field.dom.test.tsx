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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **REWRITTEN, T3 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner
 * answer 1 — 17 September 2026.** Until this date the field this file guards was asked only for a
 * Form 4A/4C transport or transfer order — the title above used to read "THE DUE-TIME FIELD
 * APPEARS FOR A TRANSPORT OR TRANSFER ORDER AND FOR NOTHING ELSE" and named that as the owner's
 * own 2026-09-07 ruling. T2 (the same plan) overturned that ruling with a later, wider one, quoted
 * in `ward-flow-reducer.ts`'s own `RAISE_REFERRAL` capture comment: *"the clinician types the
 * expiry written on whichever form they hold, of any code."* The reducer no longer reads `kind` at
 * all, so a UI that still gated the field on `kind` would ask on two forms and silently drop
 * whatever the clinician typed on the other three — the exact "asks, but the reducer discards it"
 * failure this file's own original comment warned about, just aimed at the wrong two forms.
 *
 * What this file still guards, unchanged: whether the clinician is ever ASKED, and on which
 * forms — the half no reducer test can see. `tests/ward-legal-form-due-at-capture.test.ts` and
 * `tests/ward-ed-due-at-parsing.dom.test.tsx` cover the two halves either side of this one.
 *
 * The field is now two inputs, `Date` and `Time` (`ed-screen.tsx`'s `instantFromDateAndTimeInputs`
 * resolves them against the provider's `dayZero`), replacing the single `HH:MM` time field this
 * file used to pin.
 */

const DATE_FIELD = "ward-ed-referral-legal-form-due-at-date";
const TIME_FIELD = "ward-ed-referral-legal-form-due-at-time";
const PICKER = "ward-ed-referral-legal-form";

function openReferralForm() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
}

function chooseForm(code: string) {
  fireEvent.change(screen.getByTestId(PICKER), { target: { value: code } });
}

describe("the expiry field is asked for whichever form is selected", () => {
  it("is absent before any form is chosen", () => {
    openReferralForm();
    expect(
      screen.queryByTestId(DATE_FIELD),
      "no form chosen is a real answer, and it cannot carry a deadline",
    ).toBeNull();
    expect(screen.queryByTestId(TIME_FIELD)).toBeNull();
  });

  it("has a non-empty form list, or the loop below proves nothing", () => {
    // Anti-vacuity. If the picker's contents ever collapse, an empty loop would leave the next
    // block asserting nothing at all while still reporting green.
    expect(SELECTABLE_LEGAL_FORMS.length, "expected at least one selectable legal form").toBeGreaterThan(0);
  });

  /**
   * Driven from `SELECTABLE_LEGAL_FORMS` rather than a hand-written list, so a form added to the
   * picker is covered the day it is added — the same discipline the file's original loop over
   * "transportish" forms held to, now applied to every form rather than two of them.
   */
  for (const form of SELECTABLE_LEGAL_FORMS) {
    it(`asks for an expiry date and time on a Form ${form.code}`, () => {
      openReferralForm();
      chooseForm(form.code);
      const dateField = screen.getByTestId(DATE_FIELD) as HTMLInputElement;
      const timeField = screen.getByTestId(TIME_FIELD) as HTMLInputElement;
      expect(dateField.type, "a date field, so the browser does the parsing").toBe("date");
      expect(timeField.type, "a time field, so the browser does the parsing").toBe("time");
      expect(
        dateField.value,
        "it must open EMPTY — a prefilled deadline is a claim nobody made wearing the clothes of one somebody did",
      ).toBe("");
      expect(timeField.value).toBe("");
    });
  }

  it("clears a typed date and time when the clinician switches to a different form", () => {
    // P1, Opus review of T2 (2026-09-17): a value typed for one form must not silently attach to
    // whichever form is selected at submit. This is the field-level half of that fix — the
    // end-to-end proof that the STALE VALUE never reaches a movement lives in
    // tests/ward-ed-form-expiry-controls.dom.test.tsx.
    openReferralForm();
    chooseForm("4A");
    fireEvent.change(screen.getByTestId(DATE_FIELD), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByTestId(TIME_FIELD), { target: { value: "14:30" } });
    expect((screen.getByTestId(DATE_FIELD) as HTMLInputElement).value).toBe("2026-09-20");
    expect((screen.getByTestId(TIME_FIELD) as HTMLInputElement).value).toBe("14:30");

    chooseForm("1A");
    expect(
      (screen.getByTestId(DATE_FIELD) as HTMLInputElement).value,
      "switching forms must clear a typed date — it belonged to the form selected when it was typed",
    ).toBe("");
    expect((screen.getByTestId(TIME_FIELD) as HTMLInputElement).value).toBe("");
  });
});
