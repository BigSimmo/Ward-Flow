// tests/ward-statistics-ed-wait-chart.dom.test.tsx
//
// THE ED SCREEN'S WAIT-TIME CENTREPIECE — BUILT 2026-09-06, PROVEN HERE FOR THE FIRST TIME.
//
// `StatisticsEdScreen` computed no wait duration at all before this task: the page showed only
// "on the list" / "marked urgent" / "no ward yet", none of which touch `Movement.openedAt`. This
// file proves the new figures — elapsed wait per movement, the 24h/48h threshold counts, the
// longest wait named, and the "no free bed" vs "not suitable" decline split — against a fixture
// with known instants, rather than trusting whatever the shared seed happens to contain today.
//
// ⚠️ **A DOM TEXTCONTENT TRAP LIVES ON THIS SCREEN MORE THAN MOST.** `document.body.textContent`
// (or any unscoped container's `.textContent`) joins adjacent element text with NO separator, so
// "…North Metro2Ready to admit3Vacant…" is what a naive read actually sees, and a regex like
// `/\b2\b/` can match the wrong digit pair across an element boundary. This page is mostly numbers,
// so every assertion below reads ONE testid's own `.textContent` and never the page as a whole.
//
// ⚠️ **`splitDuration` NEVER SPELLS OUT "minutes", AND SWITCHES TO DAYS AT 24 HOURS.** A wait of
// 1500 minutes (25 hours) renders "1d 1h", not "25h 00m" — this file computes its expected strings
// the same way `splitDuration` itself would (days once `totalMinutes >= 1440`, hours+minutes
// below that), so a regression that prints raw minutes (the exact defect this estate has already
// shipped and fixed once, on a sibling screen) fails a real assertion rather than a guess.
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { expectSays } from "./helpers/ward-caption";

const DEPARTMENTS = allEmergencyDepartments();
const DEPARTMENT = DEPARTMENTS[0];
const OTHER_DEPARTMENT = DEPARTMENTS[1];
if (!DEPARTMENT || !OTHER_DEPARTMENT) {
  throw new Error(
    "ward-sites.ts no longer lists two emergency departments — this file needs a second one for its attribution checks.",
  );
}

/** The minimum valid `Movement`, overridable per test — same template `tests/ward-ed-home-
 *  derivations.test.ts` already uses for this exact type, so this fixture cannot drift from what
 *  a real movement actually needs. */
function movement(overrides: Partial<Movement> & Pick<Movement, "id" | "originEdId">): Movement {
  return {
    openedAt: NOW_ANCHOR - 60,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "Test owner",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

function renderEd(movements: Movement[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsEdScreen edId={DEPARTMENT.id} movements={movements} />
    </WardFlowProvider>,
  );
}

describe("the elapsed-wait chart and its named longest waits", () => {
  // 30 minutes: under 24h, no threshold breached.
  const under = movement({ id: "WF-under", originEdId: DEPARTMENT.id, openedAt: NOW_ANCHOR - 30 });
  // 1500 minutes = 25h: past 24h, not past 48h. splitDuration(1500) === "1d 1h".
  const past24 = movement({ id: "WF-past24", originEdId: DEPARTMENT.id, openedAt: NOW_ANCHOR - 1500 });
  // 3000 minutes = 50h: past both. splitDuration(3000) === "2d 2h", and this is the longest wait.
  const past48 = movement({ id: "WF-past48", originEdId: DEPARTMENT.id, openedAt: NOW_ANCHOR - 3000 });
  // A different department entirely, waiting far longer than everyone above — must never be
  // attributed to DEPARTMENT's figures.
  const distractor = movement({
    id: "WF-distractor",
    originEdId: OTHER_DEPARTMENT.id,
    openedAt: NOW_ANCHOR - 100_000,
  });

  it("counts past-24h and past-48h from real elapsed time, never the distractor from another department", () => {
    renderEd([under, past24, past48, distractor]);

    expect(screen.getByTestId("ward-stat-ed-over-24h").textContent).toContain("2 of the 3");
    expect(screen.getByTestId("ward-stat-ed-over-48h").textContent).toContain("1 of the 3");
  });

  // Owner, 26 Sept 2026: the patient's name, never the WF journey number. These fixtures carry no
  // `patientId`/`referralId`, so `resolveSubjectPatient` cannot attribute an identity and the screen
  // falls back to the same "Unknown Patient" text it shows for any other unlinked movement.
  it("names the longest wait by the resolved patient (Unknown Patient, unlinked) and formats it through splitDuration, never as raw minutes", () => {
    renderEd([under, past24, past48, distractor]);

    const longest = screen.getByTestId("ward-stat-ed-longest-wait").textContent ?? "";
    expect(longest).toContain("Unknown Patient");
    expect(longest).not.toMatch(/WF-/u);
    expect(longest).toContain("2d 2h");
    // The regression this whole file exists to stop: a wait this long printed as a bare number of
    // minutes on a sibling screen while every other screen printed hours and minutes.
    expect(longest).not.toMatch(/\bminutes\b/i);
    expect(longest).not.toContain("3000");
  });

  it("draws one dot per waiting person, toned by threshold, and never one for the distractor", () => {
    renderEd([under, past24, past48, distractor]);

    const chart = screen.getByTestId("ward-stat-ed-wait-chart");
    expect(within(chart).getByTestId("ward-stat-ed-wait-dot-WF-under").getAttribute("data-tone")).toBeNull();
    expect(within(chart).getByTestId("ward-stat-ed-wait-dot-WF-past24").getAttribute("data-tone")).toBe("warning");
    expect(within(chart).getByTestId("ward-stat-ed-wait-dot-WF-past48").getAttribute("data-tone")).toBe("danger");
    expect(within(chart).queryByTestId("ward-stat-ed-wait-dot-WF-distractor")).toBeNull();

    // Both threshold lines are drawn regardless of how long anyone has actually waited.
    expect(within(chart).getByTestId("ward-stat-ed-wait-threshold-24h")).toBeTruthy();
    expect(within(chart).getByTestId("ward-stat-ed-wait-threshold-48h")).toBeTruthy();
  });

  it("names every waiting person in a table, longest first, with duration read through splitDuration", () => {
    renderEd([under, past24, past48, distractor]);

    const table = screen.getByTestId("ward-stat-ed-wait-table");
    const rowUnder = within(table).getByTestId("ward-stat-ed-wait-row-WF-under");
    const rowPast24 = within(table).getByTestId("ward-stat-ed-wait-row-WF-past24");
    const rowPast48 = within(table).getByTestId("ward-stat-ed-wait-row-WF-past48");

    expect(within(table).queryByTestId("ward-stat-ed-wait-row-WF-distractor")).toBeNull();

    expect(rowUnder.getAttribute("data-level")).toBeNull();
    expect(rowPast24.getAttribute("data-level")).toBe("stalled");
    expect(rowPast48.getAttribute("data-level")).toBe("urgent");

    expect(rowUnder.textContent).toContain("30m");
    expect(rowPast24.textContent).toContain("1d 1h");
    expect(rowPast48.textContent).toContain("2d 2h");

    // Longest first: WF-past48's row precedes WF-under's in document order.
    const rows = within(table).getAllByRole("row");
    const indexOfPast48 = rows.indexOf(rowPast48);
    const indexOfUnder = rows.indexOf(rowUnder);
    expect(indexOfPast48).toBeGreaterThanOrEqual(0);
    expect(indexOfUnder).toBeGreaterThan(indexOfPast48);
  });
});

describe("nobody currently waiting", () => {
  it("states the absence rather than drawing an empty chart or an empty table", () => {
    renderEd([]);

    expect(screen.getByTestId("ward-stat-ed-wait-empty")).toBeTruthy();
    expect(screen.queryByTestId("ward-stat-ed-wait-chart")).toBeNull();
    expect(screen.queryByTestId("ward-stat-ed-wait-table")).toBeNull();
    expect(screen.queryByTestId("ward-stat-ed-over-24h")).toBeNull();
    expect(screen.queryByTestId("ward-stat-ed-over-48h")).toBeNull();
    expect(screen.queryByTestId("ward-stat-ed-longest-wait")).toBeNull();
  });
});

describe("declines: no free bed vs not suitable, never summed, counted past closure", () => {
  const noFreeBedDecline = movement({
    id: "WF-declined-no-bed",
    originEdId: DEPARTMENT.id,
    declines: [{ unitId: "unit-a", at: NOW_ANCHOR - 10, reason: "no_bed" }],
  });
  // Closed (arrived, admitted) but its declines must still be counted — a decline is a historical
  // fact that outlives the movement it was made against, per `declinesByReason`'s own contract.
  const notSuitableClosedDecline = movement({
    id: "WF-declined-not-suitable",
    originEdId: DEPARTMENT.id,
    stage: "arrived",
    closure: { at: NOW_ANCHOR - 5, outcome: "arrived", reason: "Admitted" },
    declines: [
      { unitId: "unit-b", at: NOW_ANCHOR - 20, reason: "sex_mix" },
      { unitId: "unit-c", at: NOW_ANCHOR - 15, reason: "acuity_mix" },
    ],
  });
  // A different department's decline, must never be attributed to DEPARTMENT.
  const distractorDecline = movement({
    id: "WF-declined-distractor",
    originEdId: OTHER_DEPARTMENT.id,
    declines: [{ unitId: "unit-d", at: NOW_ANCHOR - 5, reason: "no_bed" }],
  });

  it("keeps the two counts separate and attributes only this department's movements", () => {
    renderEd([noFreeBedDecline, notSuitableClosedDecline, distractorDecline]);

    expect(screen.getByTestId("ward-stat-ed-declined-no-free-bed").textContent).toContain("1");
    expect(screen.getByTestId("ward-stat-ed-declined-not-suitable").textContent).toContain("2");
  });

  it('never uses the retired wording "no bed free", only the correct "no free bed"', () => {
    renderEd([noFreeBedDecline, notSuitableClosedDecline]);

    const panel = screen.getByTestId("ward-statistics-ed-declines");
    const text = (panel.textContent ?? "").toLowerCase();
    expect(text).not.toContain("no bed free");
    expect(text).toContain("no free bed");
  });
});

describe("what this screen still refuses to show, stated rather than omitted", () => {
  it("states left-before-being-seen does not exist in the model, distinctly from the closure outcome", () => {
    renderEd([]);

    const text = screen.getByTestId("ward-statistics-ed-left-before-seen-absent").textContent ?? "";
    expect(text.length).toBeGreaterThan(100);
    expectSays(text, "the left-before-being-seen absence", ["left before being seen"]);
    // 🔴 **A BYSTANDER. Measured 2026-09-09.** This guards the REASON the figure is refused rather
    // than approximated — the closing sentence, *"a wrong figure claiming to measure a safety
    // event would be worse than showing none."* But "safety event" also appears earlier, naming
    // what the phrase means. Dropping the closing sentence entirely left the guard **GREEN**: the
    // page had stopped giving its reason and kept the word.
    expectSays(text, "why it is refused rather than approximated", [
      "worse than showing none",
      "worse than none",
      "wrong figure claiming to measure",
      "would be worse than",
    ]);
    expectSays(text, "that no field records it", ["no field", "nothing on a movement"]);
  });

  it("still declines to publish a disposition split from closure state", () => {
    renderEd([]);

    const text = screen.getByTestId("ward-statistics-ed-near-miss").textContent ?? "";
    /*
     * 🔴 **TWO DIFFERENT CLAIMS OR'D TOGETHER. Measured 2026-09-09.** "did not proceed" states
     * what the closure outcome MEANS; "clinical outcome" belongs to the separate sentence saying
     * why publishing it under that heading would mislead. **Deleting the second sentence outright
     * left the file GREEN**, held up by a phrase belonging to the first claim — so the page had
     * stopped saying why the figure misleads and nothing noticed.
     *
     * ⚠️ **CORRECTION TO MY OWN FIRST WRITE-UP OF THIS SITE, kept because the mistake is the
     * lesson.** I first recorded this as measured "in both directions". It was not. The other
     * direction replaced "did not proceed" with "stopped short" — which is a REWORD of the same
     * claim, not a break — so its green result was the guard behaving correctly and proved
     * nothing about a hole. One direction was measured; one was mislabelled. A break arm that
     * quietly rewords instead of breaking manufactures a defect that is not there, which is the
     * mirror of the reword arm that quietly breaks.
     *
     * ⚠️ An OR-list is sound only when every spelling dies with the claim. Where the entries are
     * different claims it is not a spelling list at all, and the repair is to require both. The
     * first list below deliberately keeps several spellings because the paragraph states that one
     * claim twice, so either statement surviving means the claim is still on the page — the same
     * reasoning that recorded the neighbouring no-field guard SOUND rather than defective.
     */
    expectSays(text, "what the closure outcome actually means", [
      "did not proceed",
      "ended without admission",
      "admission was not needed",
    ]);
    expectSays(text, "why publishing it under that heading would mislead", [
      "rename a clinical outcome",
      "clinical outcome as a failure of flow",
      "failure of flow",
    ]);
  });

  it("states why the individual journey legs are not broken out, without naming raw field identifiers", () => {
    renderEd([]);

    const text = screen.getByTestId("ward-statistics-ed-legs-not-built").textContent ?? "";
    expect(text.length).toBeGreaterThan(100);
    /*
     * 🔴 **AN OR-LIST OVER A SET THAT MUST BE COMPLETE. Measured 2026-09-09.** The paragraph's job
     * is to name WHICH legs are not broken out. Rewriting the list from *"referral raised, ward
     * acceptance, bed pulled, arrival"* to *"referral raised and arrival"* dropped half the legs
     * and the file stayed **GREEN**, because one surviving member satisfied the whole list.
     *
     * ⚠️ This is the same shape as the invented-figures group the owner ruled on the same day: one
     * compliant member vouching for the set. Each leg is now its own required concept.
     */
    expectSays(text, "the referral leg", ["referral raised", "raising the referral"]);
    expectSays(text, "the acceptance leg", ["ward acceptance", "a ward accepting", "ward accepts"]);
    expectSays(text, "the bed-pull leg", ["bed pulled", "pulling the bed"]);
    expectSays(text, "why it cannot be built honestly", ["optional"]);
  });
});
