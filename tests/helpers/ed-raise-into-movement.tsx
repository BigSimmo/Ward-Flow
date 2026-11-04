import { fireEvent, screen, within } from "@testing-library/react";

import { securityWord } from "@/components/ward-management/ward-model-vocabulary";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { FIXTURE_HISTORY } from "./ward-referral-history";

/**
 * Option B (Josh, 13 Oct 2026): the ED's "Raise referral" now opens the one referral slide-out, so
 * the inline ED form is reached only through an inbox referral's "Ask for a bed". These
 * suites test that form's own fields, so they reach it the way a clinician now does: a referral
 * addressed to this department arrives, and its inbox row's raise button opens the form.
 *
 * The referral names no ward arm and no person, so only its own age band and urgency fill in the
 * cohort and urgency (proved in `ward-ed-raise-from-referral-gender-prefill.dom.test.tsx`).
 */
export function EdInboxReferralFixture({ edId }: { edId: string }) {
  const flow = useWardFlow();
  const { dispatch, now } = flow;
  return (
    <>
      <button
        type="button"
        hidden
        data-testid="fixture-ed-inbox-referral"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [{ kind: "emergency_department", edId, purpose: "psychiatric_review" }],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Armadale" },
            source: "community",
            urgency: 2,
            originSiteCode: "SCGH",
            transportNeeded: false,
            ...FIXTURE_HISTORY,
          } as never)
        }
      />
      <button
        type="button"
        hidden
        data-testid="fixture-ed-inbox-arrived"
        onClick={() => {
          const referralId = flow.referrals.at(-1)?.id;
          if (referralId) dispatch({ type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now, referralId });
        }}
      />
    </>
  );
}

/** Receives a referral into this department and opens "Ask for a bed" for it. */
export function openRaiseIntoMovementForm() {
  fireEvent.click(screen.getByTestId("fixture-ed-inbox-referral"));
  fireEvent.click(screen.getByTestId("fixture-ed-inbox-arrived"));
  const raise = screen.getAllByTestId(/^ward-ed-inbox-raise-/u).at(-1);
  if (!raise) throw new Error("the received referral offers no Ask for a bed");
  fireEvent.click(raise);
}

/**
 * A2-1 (audit 13 Oct 2026): the form starts from a person. Raised from an inbox referral with no
 * person on it, the form already opens as "Not yet identified"; this makes sure it is, without
 * toggling it back off.
 */
export function markNotYetIdentified() {
  const box = screen.getByTestId("ward-ed-referral-unidentified") as HTMLInputElement;
  if (!box.checked) fireEvent.click(box);
}

/**
 * L31 (3 Nov 2026): the "Ask for a bed" questions are kit choices, not browser drop-downs. A few
 * answers are a segmented control (its wrapper carries the test id and `data-value`), a longer list
 * is the kit list picker (the test id is on its field button, the value in its hidden input).
 * `value` is the stored value, as the old `<select>` options carried it.
 */
export function chooseEdChoice(testId: string, value: string) {
  const field = screen.getByTestId(testId);
  if (field.hasAttribute("data-value")) {
    const label = SEGMENT_LABELS[testId]?.(value) ?? value;
    fireEvent.click(within(field).getByRole("radio", { name: label }));
    return;
  }
  if (field.getAttribute("aria-expanded") !== "true") fireEvent.click(field);
  const option =
    value === ""
      ? screen.getByRole("option", { name: "Clear" })
      : document.querySelector<HTMLElement>(`[role="option"][data-value="${CSS.escape(value)}"]`);
  if (!option) throw new Error(`${testId} offers no option ${value}`);
  fireEvent.click(option);
}

/** The stored value of a kit choice on the form, "" while unanswered. */
export function edChoiceValue(testId: string): string {
  const field = screen.getByTestId(testId);
  if (field.hasAttribute("data-value")) return field.getAttribute("data-value") ?? "";
  const hidden = field.parentElement?.parentElement?.querySelector<HTMLInputElement>('input[type="hidden"]');
  return hidden?.value ?? "";
}

/**
 * What a kit choice offers, in order: a list picker's options (opened and closed again, the Clear
 * row left out), or a segmented control's answers (their labels, which are what a person reads).
 */
export function edChoiceOptions(testId: string): Array<{ value: string; label: string }> {
  const field = screen.getByTestId(testId);
  if (field.hasAttribute("data-value")) {
    return within(field)
      .getAllByRole("radio")
      .map((radio) => ({ value: radio.textContent?.trim() ?? "", label: radio.textContent?.trim() ?? "" }));
  }
  fireEvent.click(field);
  const options = screen
    .getAllByRole("option")
    .filter((option) => option.hasAttribute("data-value"))
    .map((option) => ({ value: option.getAttribute("data-value") ?? "", label: option.textContent?.trim() ?? "" }));
  fireEvent.keyDown(field, { key: "Escape" });
  return options;
}

const SEGMENT_LABELS: Record<string, (value: string) => string> = {
  "ward-ed-referral-security": (value) => securityWord(value),
  "ward-ed-referral-observation-interval": (value) => `${value} minutes`,
  "ward-ed-referral-observation-review-day": (value) => (value === "today" ? "Today" : "Tomorrow"),
};
