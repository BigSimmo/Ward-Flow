import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: the rail renders next/link anchors and this suite never
// checks routing, and `ReferralIntakeForm` reads the URL through `useSearchParams`, which jsdom has
// no App Router context for.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HISTORY_FIELDS, ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * RAISE A REFERRAL — THE THIRD EDITION'S GROUPING, AND THE TWO THINGS ITS DRAWING GETS WRONG.
 *
 * Lane C task 13. The form's thirteen question cards were a flat list; the third edition groups them
 * into numbered steps with named sections. These cases pin the grouping, the per-question state, and
 * — the two that matter most — **two places where this screen must NOT follow its own drawing.**
 *
 * 🔴 **A DRAWING IS NOT A RULING, AND THIS ONE IS BEHIND TWO OF THEM.** Both divergences were
 * measured on 2026-09-11 by reading `raise-a-referral-third-edition.html` against the decision
 * record, and in BOTH the form is right and the drawing is stale. A mockup sits outside every gate,
 * so a superseded design can be redrawn and then approved as part of a sixteen-screen run that
 * nobody diffs against the rulings — which is exactly what happened here.
 */

function renderIntake() {
  return render(
    <WardFlowProvider>
      <ReferralIntakeForm />
    </WardFlowProvider>,
  );
}

describe("raise a referral — grouping, state and the rulings the drawing lost", () => {
  /**
   * 🔴 THE Q-13 GUARD. This is the most valuable case in the file, because the thing it prevents is
   * a *helpful* change made by someone reading the drawing carefully.
   *
   * **The ruling:** `docs/ward-flow/owner-rulings-2026-09-05.md` §1, FD-13, verbatim — *"one story
   * box, optional, and keep the two-pane layout."* `historyWhyNow` + `historyBackground` +
   * `historyRiskAndSafety` were collapsed into a single `Referral.history`, and
   * `REFERRAL_HISTORY_LIMITS` became `{ history: 2000 }`. Ward Lead's third-edition master plan
   * settled it a second time at **Q-13 — _"The ruling — one field; Ward Mockups redraws"_** — and
   * listed three history fields under **"Not built"**.
   *
   * **The redraw never happened.** `raise-a-referral-third-edition.html` still draws three prose
   * blocks — `data-story="why"`, `data-story="background"`, `data-story="risk"`.
   *
   * ⚠️ **AND THE THIRD ONE IS WHY THIS IS A TEST RATHER THAN A NOTE.** The drawn "Risk and safety"
   * box is captioned *"Never scored"*, and `UNSAVED_HISTORY_WARNING` on this very screen says the
   * prose written here *"is never saved anywhere"*. **A referrer typing risk information into a box
   * that is discarded, on a screen that never says so beside that box, is a clinical hazard** — not
   * a styling question, and the strongest argument for why FD-13 went the way it did.
   *
   * This case does not assert "one" as a magic number: it reads `HISTORY_FIELDS`, which is also what
   * the section, the over-limit check and the rail's count read, so the form cannot grow a box that
   * this case does not see.
   */
  it("offers exactly one written-history box, per FD-13 — the drawing's three are superseded", () => {
    renderIntake();
    expect(HISTORY_FIELDS).toHaveLength(1);
    /*
     * ⚠️ COUNTS THE HISTORY BOXES, NOT EVERY TEXTBOX ON THE FORM. It was
     * `getAllByRole("textbox")).toHaveLength(1)` until 2026-09-12, which is a PROXY for the
     * property rather than the property: `role="textbox"` covers a one-line input too, so the
     * count rose to two the day the owner authorised the sending-team question ("Yes it should",
     * optional, free text) and the case went red on work it has no view about.
     *
     * 🔴 **What FD-13 settled is how many WRITTEN-HISTORY boxes this form offers, and the answer is
     * one.** A second history box still fails here. The three named checks below are the sharper
     * half anyway — they catch the superseded boxes returning under any markup at all — and they
     * are untouched.
     */
    expect(screen.getAllByRole("textbox").filter((el) => el.tagName === "TEXTAREA")).toHaveLength(1);
    /*
     * 🔴 AND THE `contenteditable` HALF, ASSERTED HERE RATHER THAN BORROWED FROM A SIBLING.
     *
     * Ward Verifier found that narrowing the line above to `TEXTAREA` dropped a case the old
     * `getAllByRole("textbox")` covered. ⚠️ **MEASURED, because the claim as stated is wider than
     * the behaviour**: `getAllByRole("textbox")` matches a `contenteditable` only when it ALSO
     * carries `role="textbox"` — a plain `contenteditable` div was never matched by either version.
     * So the lost case is real and narrow: a second history box built as a contenteditable that
     * declares the role.
     *
     * 🔴 **It was recoverable only through `ward-referral-destinations.dom.test.tsx`, which asserts
     * no `[contenteditable]` on the same component — an UNNAMED CROSS-FILE DEPENDENCY.** Either
     * file could be re-scoped or have its render helper changed and the coverage would vanish with
     * nothing going red. ✅ **So it is asserted here directly, which is stronger than both versions:
     * it catches a contenteditable whether or not it declares a role.**
     */
    expect(
      document.querySelectorAll("[contenteditable]"),
      "a second written-history box built as a contenteditable — free text wearing no control's clothes",
    ).toHaveLength(0);

    // Named by their drawn labels rather than by class, because the hazard is someone re-adding
    // the BOXES, whatever markup they reach for.
    for (const superseded of [/^background$/i, /risk and safety/i, /^why now$/i]) {
      expect(screen.queryByLabelText(superseded)).not.toBeInTheDocument();
    }
  });

  /**
   * 🔴 THE SECOND DIVERGENCE, AND IT RUNS THE OTHER WAY — the form has a question the drawing does
   * not. `highAcuityNursingNeeded` was added by owner ruling 2026-09-10: *the referring clinician
   * marks it*, in preference to the system working it out. It is read by an eligibility gate, so an
   * answer nobody gave would be filed as "not needed".
   *
   * **Pinned here because the tempting "reconcile to the drawing" edit is to DELETE it.** The
   * drawing is the older artefact; deleting a gate-read question to match it would be a silent
   * clinical default wearing the clothes of a tidy-up.
   */
  it("keeps the high-acuity nursing question, which the drawing's step 2 does not show", () => {
    renderIntake();
    expect(screen.getByText(/needs high-acuity nursing/i)).toBeInTheDocument();
  });

  /**
   * Step 3b of the task plan, kept verbatim in intent. Verified against `ward-model.ts` rather than
   * taken on relay: the `psychiatric_ward` arm of `ReferralDestination` carries only request facts —
   * `sex`, `secureBedNeeded`, `involuntaryBedNeeded`, `highAcuityNursingNeeded` — and **no unit id.**
   * A ward's identity attaches only at `acceptedUnitId`, on `ReferralAddressing`, which records what
   * a destination ANSWERED.
   *
   * ⚠️ So a ward picker here would be a promise the engine cannot keep: the form would compile,
   * render and pass every existing suite while offering an addressing the model has nowhere to put.
   */
  it("offers no way to address a referral to a named ward", () => {
    renderIntake();
    expect(screen.queryByLabelText(/which ward|choose a ward|ward name/i)).not.toBeInTheDocument();
  });

  /**
   * 🔴 D-19 CONDITION 2, THE BEHAVIOURAL HALF — NOBODY NAMED, NOTHING SAID.
   *
   * The duplicate sentence may only answer for the person already named on the form in progress.
   * This form names a person through `?patientId=`; with no id there is no subject, and the screen
   * must say nothing at all rather than fall back to anything.
   *
   * ⚠️ The structural half lives in `ward-referral-duplicate.test.ts` and is the one that catches
   * the dangerous case: a DOM test here cannot see a SEARCH screen starting to call
   * `duplicateSentence`, which is the shape that would turn this from a statement into a probe.
   */
  it("says nothing about open referrals when the form names nobody", () => {
    renderIntake();
    expect(screen.queryByTestId("ward-referral-intake-already-open")).not.toBeInTheDocument();
    expect(screen.queryByText(/already open/i)).not.toBeInTheDocument();
  });

  /**
   * The grouping itself. The step names come from the drawing, which is authoritative on LAYOUT even
   * where it is stale on content — the two divergences above are about which questions exist, not
   * about how the surviving ones are grouped.
   */
  it("groups the questions into the drawing's three numbered steps", () => {
    renderIntake();
    // ⚠️ ANCHORED TO THE STEP NUMBER, AND THE FIRST DRAFT WAS NOT. A bare /the history/i matched
    // TWO groups — the step section and the history fieldset nested inside it, whose own legend
    // begins with the same three words. The ambiguity was in the query, not in the markup, and a
    // name matched loosely enough to hit a child is a query that would also pass against the wrong
    // element once the nesting changed.
    for (const [step, heading] of [
      ["Step 1", "Who the referral is about"],
      ["Step 2", "What they need"],
      ["Step 3", "The history"],
    ] as const) {
      const section = screen.getByRole("group", { name: new RegExp(`^${step}\\s*${heading}$`) });
      // v6 (7 Oct 2026): the step is a number tile whose "Step" is screen-reader text, so the
      // words sit in two nodes; the tile as a whole still reads "Step n".
      expect(
        within(section).getByText((_, element) => element?.textContent?.replace(/\s+/g, " ").trim() === step, {
          ignore: "legend, fieldset",
        }),
      ).toBeInTheDocument();
    }
  });

  it("reads selected referral codes back with the form's human labels", () => {
    renderIntake();

    fireEvent.change(screen.getByLabelText(/^Suburb/), { target: { value: "not_known" } });
    fireEvent.change(screen.getByLabelText(/^Referral source/), { target: { value: "ed_medical" } });
    fireEvent.change(screen.getByLabelText(/^Urgency/), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^Origin site/), { target: { value: "RPH" } });
    fireEvent.click(screen.getByTestId("ward-referral-intake-secureBedNeeded-no"));

    const summary = within(screen.getByTestId("ward-referral-intake-summary"));
    const summaryValue = (label: string) => {
      const term = summary.getByText(label, { selector: "dt" });
      const value = term.parentElement?.querySelector<HTMLElement>("dd");
      expect(value, `${label} summary value`).not.toBeNull();
      return value as HTMLElement;
    };

    expect(summaryValue("Suburb")).toHaveTextContent("Suburb not known");
    expect(summaryValue("Referral source")).toHaveTextContent("ED medical staff");
    expect(summaryValue("Urgency")).toHaveTextContent("Tier 2 · urgent");
    expect(summaryValue("Origin site")).toHaveTextContent("Royal Perth Hospital (RPH)");
    expect(summaryValue("Secure bed needed")).toHaveTextContent("No");

    for (const rawCode of ["not_known", "ed_medical"]) {
      expect(summary.queryByText(rawCode, { exact: true })).not.toBeInTheDocument();
    }
  });

  /**
   * ⚠️ **ONE PREDICATE, AND THIS CASE IS HOW THAT STAYS TRUE.** The per-question word must come from
   * `fieldIsUnanswered` — the same function the summary rail, the progress figure and the Send
   * button's reason already use. A second rule written for the chip is how one question comes to
   * read "Answered" beside itself and "Not answered yet" in the rail, and the rail is the one a
   * clinician checks before sending.
   *
   * Asserted as a COUNT RELATIONSHIP rather than per-field, so the case cannot quietly stop covering
   * a question somebody adds later.
   */
  /**
   * 🔴 **THE TWO POPULATIONS ARE SEPARATED STRUCTURALLY, NOT BY THEIR WORDING — AND D-43 IS WHY.**
   *
   * This case used to read `getAllByText("Outstanding")` against `getAllByText("Not answered yet")`.
   * **D-43 unified both to `Not answered`**, and had the query been left alone the two sides would
   * have become the SAME query: every chip and every rail row in one list, compared against itself.
   * ⚠️ **The assertion would have passed forever, proving nothing, and it would have started doing
   * that at the exact moment the thing it guards was changed** — `a-property-whose-operands-can-
   * coincide`.
   *
   * So the chips are found by their `data-state` attribute and the rail rows by their own panel.
   * **Two populations, one predicate: `fieldIsUnanswered` over applicable `REQUIRED_FIELDS`.** If
   * these counts ever disagree, a second predicate has been introduced — which is the whole point,
   * because a chip reading one thing an inch from a rail row reading another is what a coordinator
   * would see.
   */
  /*
   * 🔴 THIS IS TASK 13'S MUTATION PROOF, AND IT WAS OWED RATHER THAN OFFERED.
   *
   * An audit of lane C's four built tasks found this one GREEN ONLY: both build commits
   * (`46f85f23b1`, `9b384b97a5`) recorded pass counts and nothing else, so nothing established
   * that any case here could fail for the right reason. ⚠️ **A passing suite written alongside
   * the code it tests proves the two agree, which is what they would do whether or not either is
   * right.**
   *
   * Mutation run 2026-09-11, restored and verified clean: `questionState` in
   * `referral-intake.tsx` was changed to return `"Answered"` unconditionally, discarding the
   * `fieldIsUnanswered` result entirely.
   *
   *     x marks every unanswered question Not answered, agreeing with the rail's own count
   *
   * ✅ **ONE of the six cases in this file went red, and it is this one.** The count matters as
   * much as the colour: a mutation that reddened all six would mean the render had collapsed,
   * which discriminates nothing. One red, in the case written for exactly that property, is the
   * result worth having.
   *
   * ⚠️ **What this does NOT license.** It proves the CHIP STATE is load-bearing. The other five
   * cases here — the single history box (FD-13), the absence of a named-ward destination, the
   * step grouping — are untouched by this mutant and remain unproven by it. A control licenses a
   * claim about the arm it tested and no other.
   */
  it("marks every unanswered question Not answered, agreeing with the rail's own count", () => {
    const { container } = renderIntake();
    const chips = container.querySelectorAll('[data-state="not-answered"]');
    const rail = within(screen.getByTestId("ward-referral-intake-summary")).getAllByText("Not answered");

    expect(chips.length, "no chips rendered — this case would prove nothing").toBeGreaterThan(0);
    expect(chips).toHaveLength(rail.length);
    expect(container.querySelectorAll('[data-state="answered"]')).toHaveLength(0);

    // D-43's wording, pinned on the rendered text as well as on the attribute: the attribute could
    // be right while the words drifted back apart, which is the defect this ruling closed.
    expect(chips[0]?.textContent).toBe("Not answered");
    expect(screen.queryAllByText("Outstanding")).toHaveLength(0);
    expect(screen.queryAllByText("Not answered yet")).toHaveLength(0);
  });
});
