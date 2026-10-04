import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import {
  legalFormBreakdown,
  legalFormGroupRows,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const seededMovements = seed.movements;
const withDeadline = legalFormGroupRows(seededMovements, NOW, "with-deadline");
const noDeadline = legalFormGroupRows(seededMovements, NOW, "no-deadline");
const rows = [...withDeadline, ...noDeadline];
const openMovements = seededMovements.filter(isOpen);
const breakdown = legalFormBreakdown(rows, NOW);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <LegalFormsScreen />
    </WardFlowProvider>,
  );
}

describe("the Legal forms screen", () => {
  it("has a population to render, or the assertions below are vacuous", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("has the page shell — a main landmark, one <h1>, and the synthetic-data disclosure every ward screen carries", () => {
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Legal forms" })).toBeInTheDocument();
    // `tests/ward-prototype-disclosure.test.ts` walks every ROUTE for the `prototypeBadge` class;
    // this is the component-level half, checked directly by its visible text rather than assumed.
    expect(screen.getAllByText("Synthetic prototype")[0]).toBeInTheDocument();
  });

  /**
   * NO SENTENCE ABOVE THE GROUPS MAY CLAIM ONE ORDER FOR BOTH OF THEM.
   *
   * The page subtitle used to describe the whole screen as running in order of time remaining. It
   * was true of the first group and false of the second, whose records hold no deadline to order
   * by, and it sat directly above a panel sentence saying the two groups are NOT ordered against
   * each other. The page's largest sentence contradicted its own panel.
   *
   * The direction of the error is what makes it worth a guard rather than a tidy-up: a reader who
   * believes the subtitle reads the deadline-less rows at the bottom as the least urgent, which is
   * the single misreading the group split was built to prevent. Each group heading states its own
   * order; nothing above them may.
   *
   * The floor comes first ON PURPOSE. The interesting half of this case is a negative, and a
   * negative alone is disarmed in silence by a rename or a deletion of the element it reads -- it
   * would pass loudest over no subtitle at all. So the subtitle is first proved to exist and to say
   * something, and only then checked for the claim it must not make.
   */
  it("states the population above the groups without claiming an order for them", () => {
    renderScreen();
    const heading = screen.getByRole("heading", { level: 1, name: "Legal forms" });
    const subtitle = screen.getByText("Recorded forms and deadlines for open movements.");

    expect(heading).toBeVisible();
    expect(subtitle, "the page has no subtitle under its <h1> - this case now proves nothing").toBeVisible();
    const text = subtitle.textContent ?? "";
    expect(text.trim().length, "the subtitle is empty - this case now proves nothing").toBeGreaterThan(20);
    expect(text, "the subtitle no longer names the population it covers").toMatch(
      /forms and deadlines for open movements/i,
    );

    expect(
      text,
      `the subtitle claims an order for the whole screen. Only one of the two groups has a deadline ` +
        `to be ordered by, and the panel below states in as many words that the groups are not ordered ` +
        `against each other - so this sentence makes the clockless rows read as the least urgent. ` +
        `Subtitle was: "${text.trim()}"`,
    ).not.toMatch(/ordered by|in order of|by (?:how much )?time (?:left|remaining)|most urgent|least urgent/i);
  });

  /**
   * 🔴 REPLACED BY RULING — Ward Lead, 2026-09-12. This asserted ONE ordered list.
   *
   * The single list gave a form with no deadline the sort key `Infinity`, landing the forms the
   * owner deliberately left clockless — the referral and detention forms — at the bottom of a list
   * whose stated order is time remaining, where they read as LEAST urgent. ⚠️ A missing sort key at
   * either end of an urgency-ordered list is wrong, and both ends look fine.
   *
   * ✅ So the screen renders two groups that are never ordered against each other, and this pins
   * that: every row appears, in its own group, in that group's own order.
   */
  it("renders both groups, each in its own order, and never one ordered against the other", () => {
    expect(withDeadline.length, "no rows with a deadline - the grouping is untested one way").toBeGreaterThan(0);
    expect(noDeadline.length, "no rows without a deadline - the screen's whole subject is untested").toBeGreaterThan(0);

    renderScreen();
    const lists = screen.getAllByRole("list");
    // Owner, 26 Sept 2026: the visible id slot now carries the patient's name, never the WF journey
    // number, so a row is found here by its hidden `data-record-key` (the movement id) instead.
    const renderedIds = lists.flatMap((list) =>
      Array.from(list.querySelectorAll("[data-record-key]")).map((node) => node.getAttribute("data-record-key")),
    );

    // Every row still appears exactly once...
    expect(new Set(renderedIds).size, "a movement is rendered twice").toBe(renderedIds.length);
    expect([...renderedIds].sort(), "the screen and the groups disagree about the population").toEqual(
      rows.map((movement) => movement.id).sort(),
    );

    // ...and the deadline-bearing rows all precede the deadline-less ones, because they are in
    // separate groups rather than interleaved by a sentinel sort key.
    const lastWithDeadline = Math.max(...withDeadline.map((m) => renderedIds.indexOf(m.id)));
    const firstWithout = Math.min(...noDeadline.map((m) => renderedIds.indexOf(m.id)));
    expect(lastWithDeadline, "the two groups are interleaved - they are being ordered against each other").toBeLessThan(
      firstWithout,
    );
  });

  it("names each group by what the record holds, so neither position reads as a priority", () => {
    renderScreen();
    expect(screen.getByText("Forms with a deadline recorded")).toBeInTheDocument();
    expect(screen.getByText("Forms with no deadline recorded")).toBeInTheDocument();
  });

  // Owner, 26 Sept 2026: the patient's name, never the WF journey number.
  it("identifies a row by the hidden movement id, and names it by the resolved patient, never the WF number", () => {
    renderScreen();
    const expectedIds = rows.map((movement) => movement.id);
    const listRegion = screen.getByRole("region", { name: "Legal forms list" });
    const rowEls = Array.from(listRegion.querySelectorAll("[data-ward-primitive='record-row']"));
    const renderedKeys = rowEls.map((row) => row.getAttribute("data-record-key") ?? "");
    expect(renderedKeys.length, "each listed row carries one movement id in the hidden record-key attribute").toBe(
      expectedIds.length,
    );
    expect([...renderedKeys].sort(), "the record-key attribute names movements, not something else").toEqual(
      [...expectedIds].sort(),
    );

    const expectedNames = rows.map((movement) => resolveSubjectPatient(movement, seed).formalName);
    const renderedNames = rowEls.map(
      (row) => row.querySelector("[data-ward-primitive='record-id']")?.textContent ?? "",
    );
    expect([...renderedNames].sort(), "the visible id slot no longer shows the resolved patient's formal name").toEqual(
      [...expectedNames].sort(),
    );
    for (const name of renderedNames) {
      expect(name, "a WF journey number is visible where the patient's name should be").not.toMatch(/^WF-/u);
    }
  });

  it("states the population in the scope sentence, matching the panel's own count exactly", () => {
    renderScreen();
    const panel = screen.getByRole("region", { name: "Legal forms and deadlines" });
    expect(
      within(panel).getByText(new RegExp(`^${rows.length} of ${openMovements.length} open`, "u")),
    ).toBeInTheDocument();
  });

  it("gives a structurally clockless row (a real 1A/3B/3D with no dueAt) no chip and neutral tone — the one case that must render silently", () => {
    renderScreen();
    const clockless = rows.find((movement) => movement.legalForm?.dueAt === undefined);
    if (!clockless) {
      throw new Error("the fixture no longer carries a structurally clockless legal form to test against");
    }
    // Owner, 26 Sept 2026: the visible id slot carries the patient's name, so this row is found by
    // its hidden `data-record-key` (the movement id) instead of its visible text.
    const listRegion = screen.getByRole("region", { name: "Legal forms list" });
    const row = listRegion.querySelector(`[data-record-key="${clockless.id}"]`) as HTMLElement;
    expect(row, "no row carries the clockless movement's id in data-record-key").toBeTruthy();
    expect(row.getAttribute("data-tone")).toBe("neutral");
    expect(within(row).queryByText("Form expiry passed")).not.toBeInTheDocument();
    // ⚠️ UPDATED WITH THE CHIP'S RENAME, OR THIS ASSERTION WOULD HAVE BECOME UNFAILABLE: a negative
    // match on text that no longer exists anywhere can never fire, and would go on reporting success
    // while checking nothing. The gap chip now reads "No deadline recorded" — which is also the
    // opening of this row's own paired sentence, so the assertion is scoped to the CHIP element
    // rather than to the row's text, or it would match that sentence and fail on correct work.
    expect(within(row).queryByText("No deadline recorded", { selector: "[data-ward-primitive='chip']" })).toBeNull();
    // Never rendered bare: always paired with real elapsed ED time (build contract §5).
    expect(within(row).getByText(/No deadline recorded; .+ in the emergency department/u)).toBeInTheDocument();
  });

  it("renders a breakdown paragraph whose figures agree with the derivation the screen calls", () => {
    renderScreen();
    const breakdownEl = screen.getByTestId("legal-form-breakdown");
    for (const form of breakdown) {
      expect(breakdownEl.textContent).toContain(`${form.name}, ${form.openCount}`);
    }
  });

  it("never states 'No owner' — Movement.owner is a required string with no absent state to render", () => {
    renderScreen();
    expect(screen.queryByText(/No owner/u)).not.toBeInTheDocument();
  });
});

describe("LegalFormsScreen expiry reminder (item 13 synthetic demo)", () => {
  it("shows the reminder banner for seeded typed expiries inside the warning windows, labelled as a synthetic, not legally checked demo", () => {
    renderScreen();
    const banner = screen.getByTestId("ward-legal-expiry-reminder");
    expect(banner).toHaveTextContent(/^Synthetic demo reminder:/);
    expect(banner).toHaveTextContent("not legally checked");
    expect(screen.getAllByText(/^Expires within \dh$/).length).toBeGreaterThan(0);
  });
});

describe("LegalFormsScreen Act period demo (owner ruling D-29)", () => {
  it("labels every Act period line as a synthetic demo that is not legally checked", () => {
    renderScreen();
    const lines = screen.getAllByTestId("ward-legal-act-period");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toHaveTextContent(/^Synthetic demo, not legally checked: /);
  });
});
