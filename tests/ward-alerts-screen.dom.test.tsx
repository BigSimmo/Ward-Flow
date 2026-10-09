import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { wardPlannedAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **THE ALERTS SCREEN — and the tests are mostly about what it says when nothing is firing.**
 *
 * 🔴 Ward Lead's ruling, 2026-09-12: **an empty alerts screen must never say "nothing is wrong".**
 * That is a clinical claim about the whole service, made by a screen that checks a handful of
 * conditions against one fixture. It says **what it looked at and found none of** — by name, per
 * section, whether the section is empty or not.
 *
 * ⚠️ **And the hazard the ruling exists for: a coordinator acts on what is loudest.** A screen
 * somebody opens four times and finds blank is one they stop opening, and the fifth time is the one
 * that matters. **A screen that names its conditions and reports on all of them is still worth
 * opening when most are empty. One that says "all clear" is not.**
 */

const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

/**
 * 🔴 **COUNTED BY ID PREFIX, NEVER BY `kind`.** Every member of `INBOX_CATEGORIES` carries
 * `kind: "fact"` — measured — so `items.filter((i) => i.kind === "legal_timing_breached")` matches
 * **zero items on any data, forever**. The build contract for this screen proposed exactly that
 * filter as its catcher: it would have passed against a screen rendering nothing and against a
 * screen rendering garbage, both green.
 *
 * Filtered to `isOpen` — matching `AlertsScreen`'s own call — so this helper cannot silently
 * diverge from the screen it is meant to be checking; see
 * `tests/ward-alerts-open-movements-only.dom.test.tsx` for the case that scoping fixes.
 */
function countInCategory(category: keyof typeof INBOX_CATEGORIES): number {
  const prefix = INBOX_CATEGORIES[category].idPrefix;
  return buildActionInbox(wardMovements.filter(isOpen), NOW, allUnits()).filter((item) => item.id.startsWith(prefix))
    .length;
}

/** Every condition this screen claims to watch, by its name in the hero's Checking list. */
const CONDITIONS = [
  "Form due passed",
  "Every ward declined",
  "Unsuitable destination",
  "Bed hold expired",
  "Transport not left",
  "Target overdue",
  "Triage waiting",
  "ED over a day",
  "Override recorded",
] as const;

function checkingList() {
  return screen.getByRole("list", { name: "Conditions checked" });
}

describe("the Alerts screen reports on every condition it watches, firing or not", () => {
  it("renders every named condition, including the ones with nothing to show", () => {
    renderScreen();
    for (const condition of CONDITIONS) {
      expect(
        within(checkingList()).getByRole("listitem", { name: condition }),
        `"${condition}" is not on the screen. A condition that appears only when it fires makes an ` +
          `empty screen claim a completeness it does not have: the reader cannot tell "checked and ` +
          `clear" from "not checked at all".`,
      ).toBeInTheDocument();
    }
  });

  /**
   * 🔴 **THE ASSERTION THIS SCREEN EXISTS FOR.** Three of its conditions are legitimately empty on
   * today's fixture, and the tempting summary for that state is "all clear" — which is a claim
   * about the service, not about the SEVEN things this screen measured. ⚠️ This said FOUR, as did
   * two sentences in the screen itself. 🔴 The screen has always rendered seven and the CONDITIONS
   * array in this very file lists seven — and when the screen's two were corrected, this one was
   * left standing, because the report that found them named those two. **Fixing the instances a
   * report shows you and calling that the set is the defect underneath half of tonight's
   * findings.**
   */
  it("never tells a coordinator that nothing is wrong", () => {
    const { container } = renderScreen();
    const text = container.textContent ?? "";

    for (const forbidden of [/all clear/iu, /nothing is wrong/iu, /no alerts/iu, /everything is fine/iu]) {
      expect(
        text,
        `the screen says something matching ${forbidden} — a claim about the whole service, made by a ` +
          `screen that checked a handful of conditions against one fixture`,
      ).not.toMatch(forbidden);
    }
  });

  /**
   * ⚠️ **THE SCOPE SENTENCE MUST SURVIVE THE ROWS ARRIVING.** This project has a recorded defect
   * where the honest qualifier lived in an empty state and vanished exactly when the list filled —
   * so the reader lost the only statement of scope at the moment there was something to misread.
   *
   * 🔴 **So this asserts it on a POPULATED section**, not an empty one, and floors itself on that
   * population being non-empty first.
   */
  it("keeps each condition's scope sentence when that condition has rows", () => {
    const populated = countInCategory("transport_awaiting_departure");
    expect(
      populated,
      "no transport row in the fixture — this test would assert the scope sentence on an EMPTY " +
        "section, which is the one case it is not about",
    ).toBeGreaterThan(0);

    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Transport not left" });

    expect(
      within(section).getByText(/Watches accepted transport legs/u),
      "the scope sentence is gone now that the section has rows — the qualifier lived in the empty " +
        "state and vanished when there was finally something to qualify",
    ).toBeInTheDocument();
  });

  /**
   * 🔴 **THE UNBUILDABLE CONDITION IS VISIBLE AS A GAP, NOT ABSENT.** The design carries a
   * "handover sheet due" alert and nothing in this model records when a shift hands over — no
   * deadline, no timestamp, no condition, and therefore no catcher. **Silently omitting it would
   * let an empty screen imply it had checked.**
   */
  it("says out loud that it cannot watch handover sheets", () => {
    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Not checked: handover sheets" });

    expect(section).toHaveTextContent(/handover/iu);
    expect(
      section,
      "the screen names handover sheets without saying WHY it cannot watch them, so a reader cannot " +
        "tell a missing feature from a missing fact",
    ).toHaveTextContent(/records when a shift hands over/u);
  });

  /**
   * The override section reports twice, and the second half outlives the first: the fixture has
   * zero overrides today, but the record does not retain a prior gate verdict even if it had one.
   * A reader who saw only "none recorded" would assume the row works and has no data.
   */
  it("states the override record's prior-gate absence and retained record facts", () => {
    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Override recorded" });
    expect(section).toHaveTextContent(/cannot identify a prior gate verdict/u);
    expect(section).toHaveTextContent(/who, when, which fixed reason and which wards/u);
    expect(section).toHaveTextContent(/does not retain a prior gate verdict/u);
  });

  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR FOR THE WHOLE FILE.** Every assertion above reads a screen rendered
   * from the shared fixture. If that fixture ever renders nothing at all, the tests above pass over
   * an empty page — so this proves the screen actually drew rows, using a count derived the only
   * way that discriminates a category.
   */
  it("actually rendered the fixture's rows, so the assertions above are not over an empty page", () => {
    const rows =
      countInCategory("bed_pull_expired") +
      countInCategory("destinations_declined") +
      countInCategory("transport_awaiting_departure") +
      // Planned admissions past their expected arrival (stream D) also draw a row.
      buildActionInbox([], NOW, allUnits(), { plannedAdmissions: wardPlannedAdmissions }).length;
    expect(rows, "no inbox row in the fixture — every assertion in this file would be vacuous").toBeGreaterThan(0);

    const { container } = renderScreen();
    /*
     * 🔴 THIS USED TO ASSERT THE FIXTURE HAD ROWS AND THEN CHECK ONLY THAT THE PAGE EXISTED.
     * Deleting the row-rendering branch from `Condition` left every test in this file green — the
     * headings render, the forbidden phrases stay absent, the scope sentence is still there, and
     * the page id is still in the document. **A floor that measures the FIXTURE and not the DOM is
     * not a floor.** Found by an adversarial read.
     */
    const renderedRows = container.querySelectorAll("li[data-tone]");
    expect(
      renderedRows.length,
      "the screen drew no alert row at all, so every assertion in this file is over a page with no " + "alerts on it",
    ).toBe(rows);
    const triage = within(checkingList()).getByRole("listitem", { name: "Triage waiting" });
    expect(triage).toHaveTextContent(/\d+ of \d+ referrals have never been triaged/u);
  });
});
