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
 * T3 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner answers 1 and 5: the
 * clinician types the expiry written on a legal form and, on a later occasion, an extension
 * written on a fresh form — for ANY selected form, never a computed statutory duration. This file
 * drives the intake fields, the "Record expiry from the form"/"Record an extension" actions block,
 * and the property that a past expiry only ever WARNS, never blocks a clinical control.
 *
 * Everything here goes through the real screen, the real provider and the real reducer — nothing
 * dispatches directly. `dueAt` is read back from `useWardFlow()`, never from an input's own value,
 * the same discipline `ward-ed-transport-booking.dom.test.tsx`'s `TransportProbe` documents: a
 * control that dispatched something the reducer refused would look identical on screen to one that
 * did nothing.
 *
 * `dayZero` is the real calendar day the test runs on (`ward-flow-provider.tsx`'s
 * `demoDayZero(new Date())`), not derived from `NOW_ANCHOR` — see
 * `tests/ward-ed-due-at-parsing.dom.test.tsx`'s own comment on this. Dates below are computed from
 * the real clock at run time for the same reason.
 */

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TODAY = dateInputValue(new Date());
const TOMORROW = dateInputValue(new Date(new Date().setDate(new Date().getDate() + 1)));

/** Surfaces the last raised movement's id, code and expiry, so assertions read the MODEL rather
 *  than an input's own value. */
function LastMovementProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <p data-testid="last-movement-probe">
      {last?.id ?? "no-movement"}|{last?.legalForm?.code ?? "no-form"}|{last?.legalForm?.dueAt ?? "no-deadline"}
    </p>
  );
}

const REQUIRED = [
  { testId: "ward-ed-referral-cohort", value: "Adult" },
  { testId: "ward-ed-referral-security", value: "Open" },
  { testId: "ward-ed-referral-sex", value: "Female" },
  // T11 (item 8, after T10, owner answer 17 September 2026): a sixth required field this file's
  // own raise-referral flow must also answer, or the form blocks before this file's own subject
  // (the typed expiry controls) is ever reached.
  { testId: "ward-ed-referral-gender", value: "Female" },
  { testId: "ward-ed-referral-legal-status", value: "Voluntary" },
  { testId: "ward-ed-referral-urgency", value: "3" },
] as const;

function renderEdScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <LastMovementProbe />
    </WardFlowProvider>,
  );
}

function openReferralForm() {
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
}

function fillRequiredFields() {
  for (const field of REQUIRED) {
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
  fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
}

function lastMovementProbeParts(): { id: string; code: string; dueAt: string } {
  const [id, code, dueAt] = (screen.getByTestId("last-movement-probe").textContent ?? "").split("|");
  return { id: id ?? "", code: code ?? "", dueAt: dueAt ?? "" };
}

describe("intake: the typed expiry reaches the movement for any selected form", () => {
  it("intake with a date and time on a Form 3D files dueAt", () => {
    renderEdScreen();
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "3D" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "15:45" } });
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    // 15:45 on day 0 (today) is 945 minutes past dayZero.
    expect(lastMovementProbeParts()).toEqual({ id: expect.any(String), code: "3D", dueAt: "945" });
  });

  it("a time without a date blocks, with the exact sentence, and never raises the referral", () => {
    renderEdScreen();
    // The seed fixture already carries movements, so "nothing was raised" is proved by the probe
    // being UNCHANGED across the blocked submit attempt, not by a fixed "no-movement" string.
    const before = screen.getByTestId("last-movement-probe").textContent;

    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "09:00" } });
    // The date field is left untouched — a real, half-typed pair.

    const submit = screen.getByTestId("ward-ed-referral-submit");
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(submit.getAttribute("title")).toBe(
      "Enter both the date and the time written on the form, or leave both blank.",
    );

    // The button being aria-disabled stops a click; this form is a real <form>, so Enter inside a
    // field submits it regardless — `submitReferral`'s own direct guard is what must catch that.
    fireEvent.submit(screen.getByTestId("ward-ed-referral-form"));
    expect(
      screen.getByTestId("last-movement-probe").textContent,
      "a half-typed expiry must not raise the referral at all",
    ).toBe(before);
  });
});

describe("the actions block: recording a first expiry and an extension", () => {
  it("Record expiry from the form dispatches the first typed expiry, and never shows an extension history line for it", () => {
    renderEdScreen();
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    // No expiry typed at raise time — the clinician does not have the form's expiry yet.
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const { id } = lastMovementProbeParts();

    const toggle = screen.getByTestId(`ward-ed-legal-form-expiry-toggle-${id}`);
    expect(toggle.textContent).toBe("Record expiry from the form");
    fireEvent.click(toggle);

    const save = screen.getByTestId(`ward-ed-legal-form-expiry-save-${id}`) as HTMLButtonElement;
    expect(save.disabled, "nothing typed yet — the save control must not offer to submit a blank pair").toBe(true);

    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-date-${id}`), { target: { value: TODAY } });
    expect(save.disabled, "date only — still an incomplete pair").toBe(true);
    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-time-${id}`), { target: { value: "11:00" } });
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    expect(lastMovementProbeParts()).toEqual({ id, code: "1A", dueAt: "660" });
    expect(
      screen.queryByTestId(`ward-ed-legal-form-expiry-history-${id}`),
      "the first typed expiry has no earlier one to be an extension against, so no history line yet",
    ).toBeNull();
  });

  it("Save extension dispatches, and the history line appears", () => {
    renderEdScreen();
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const { id } = lastMovementProbeParts();
    expect(lastMovementProbeParts().dueAt).toBe("600"); // 10:00 today

    const toggle = screen.getByTestId(`ward-ed-legal-form-expiry-toggle-${id}`);
    expect(toggle.textContent, "a dueAt is already recorded, so this is now an extension").toBe("Record an extension");
    fireEvent.click(toggle);

    const save = screen.getByTestId(`ward-ed-legal-form-expiry-save-${id}`) as HTMLButtonElement;

    // An earlier or equal expiry is refused — "An extension's new expiry must be later than the
    // expiry already recorded." (the reducer's own sentence, T2). Proved by the save control
    // declining to offer a dispatch it already knows the reducer would refuse.
    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-date-${id}`), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-time-${id}`), { target: { value: "10:00" } });
    expect(save.disabled, "the same expiry again is not later than the one already recorded").toBe(true);

    // A genuinely later expiry is accepted.
    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-date-${id}`), { target: { value: TOMORROW } });
    fireEvent.change(screen.getByTestId(`ward-ed-legal-form-expiry-time-${id}`), { target: { value: "10:00" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    // Tomorrow 10:00 is 1440 + 600 = 2040 minutes past dayZero.
    expect(lastMovementProbeParts()).toEqual({ id, code: "1A", dueAt: "2040" });

    const historyLine = screen.getByTestId(`ward-ed-legal-form-expiry-history-${id}`);
    expect(historyLine.textContent).toMatch(/^Extension recorded .+: new expiry .+$/);
  });
});

describe("a past expiry only ever warns — it never blocks a clinical control", () => {
  it("Book transport and Mark handover ready are exactly as available on a breached-expiry movement as on one with no legal form at all", () => {
    renderEdScreen();

    // Movement A: a legal form whose expiry is already well past NOW_ANCHOR (10:42 today).
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const breached = lastMovementProbeParts();
    expect(breached.dueAt).toBe("540"); // 09:00 today, before NOW_ANCHOR's 10:42 (642)

    const warning = screen.getByTestId(`ward-ed-form-expiry-warning-${breached.id}`);
    expect(warning.textContent, "the breach must actually be showing, or this test proves nothing").toBe(
      "Warning: past the expiry written on the form. Check the form.",
    );

    // Movement B: no legal form at all, otherwise identical.
    openReferralForm();
    fillRequiredFields();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    const noForm = lastMovementProbeParts();
    expect(noForm.code).toBe("no-form");
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${noForm.id}`)).toBeNull();

    // Titles embed the movement's own id (`${movement.id} is …`), so a byte-for-byte comparison
    // would fail on the id difference alone, not on anything about the legal form. Normalise each
    // one's own id out before comparing the two.
    const withIdRedacted = (text: string | null, id: string) => text?.split(id).join("<id>") ?? null;

    for (const action of ["book-transport-toggle", "handover"] as const) {
      const breachedButton = screen.getByTestId(`ward-ed-${action}-${breached.id}`);
      const noFormButton = screen.getByTestId(`ward-ed-${action}-${noForm.id}`);
      expect(
        breachedButton.getAttribute("aria-disabled"),
        `${action}: a breached legal-form expiry must not change this control's availability`,
      ).toBe(noFormButton.getAttribute("aria-disabled"));
      expect(withIdRedacted(breachedButton.getAttribute("title"), breached.id)).toBe(
        withIdRedacted(noFormButton.getAttribute("title"), noForm.id),
      );
    }
  });
});

describe("a stale typed value never lands on the wrong form", () => {
  it("does not carry a time typed for 4A onto 1A after the form is switched", () => {
    // P1, Opus review of T2 (2026-09-17): picking 4A, typing a time, then switching to 1A used to
    // leave the stale value sitting in the (now-widened) fields, unseen, and submit still sent it.
    renderEdScreen();
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "4A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "14:00" } });

    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    expect((screen.getByTestId("ward-ed-referral-legal-form-due-at-date") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("ward-ed-referral-legal-form-due-at-time") as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(
      lastMovementProbeParts(),
      "switching to 1A with the fields cleared and left blank must raise 1A with no deadline at all",
    ).toEqual({ id: expect.any(String), code: "1A", dueAt: "no-deadline" });
  });

  it("carries a fresh expiry typed for 1A after switching away from 4A, unaffected by the earlier value", () => {
    renderEdScreen();
    openReferralForm();
    fillRequiredFields();
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "4A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "14:00" } });

    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "1A" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-date"), { target: { value: TODAY } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form-due-at-time"), { target: { value: "16:00" } });
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    // 16:00 today is 960 minutes — the fields still work after being cleared, they are not dead.
    expect(lastMovementProbeParts()).toEqual({ id: expect.any(String), code: "1A", dueAt: "960" });
  });
});
