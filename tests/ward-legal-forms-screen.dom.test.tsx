import { useEffect, useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/wf";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { RecordFormSheet } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import {
  legalFormBreakdown,
  legalFormGroupRows,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { typedDateFor } from "./helpers/ward-date-input";

const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const seededMovements = seed.movements;
const withDeadline = legalFormGroupRows(seededMovements, NOW, "with-deadline");
const noDeadline = legalFormGroupRows(seededMovements, NOW, "no-deadline");
const rows = [...withDeadline, ...noDeadline];
const openMovements = seededMovements.filter(isOpen);
const breakdown = legalFormBreakdown(rows, NOW);

/** Selects the first row with no due time recorded, opening its side panel. */
function selectRowWithoutDueTime() {
  const target = noDeadline[0];
  if (!target) throw new Error("the fixture no longer carries a form with no due time recorded");
  const row = document.querySelector(`[data-record-key="${target.id}"]`) as HTMLElement;
  fireEvent.click(within(row).getAllByRole("button")[0]!);
}

/** Any wording of the removed Act-period countdown (owner, 20 Oct 2026). */
const COMPUTED_ACT_PERIOD = /would end|Synthetic demo|Act period|under-18 period|demo period|count from/iu;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <LegalFormsScreen />
    </WardFlowProvider>,
  );
}

describe("the Forms screen", () => {
  it("keeps the visible time-entry wording in each contextual button name", () => {
    renderScreen();
    const actions = screen.getAllByRole("button", { name: /^Add the time for / });
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action).toHaveTextContent("Add the time");
      expect(action).toHaveAccessibleName(/^Add the time for /);
    }
  });

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
    // Time not written folds after six rows (redesign, 31 Oct 2026); the helper opens it.
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
  // v6 (LegalForms.png): a "Within Nh" state beside each typed expiry. D-77 change 5 removed the
  // Board now panel and its Warning windows block; the windows stay in Settings.
  it("marks seeded typed expiries inside the warning windows and works out no Act period", () => {
    renderScreen();
    expect(screen.getAllByText(/^Within \dh$/).length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Legal forms list" })).not.toHaveTextContent(COMPUTED_ACT_PERIOD);
  });
});

describe("LegalFormsScreen shows only a recorded due time (owner, 20 Oct 2026, replacing D-29)", () => {
  it("says no deadline is recorded for a form with no due time, and works out no Act period", () => {
    renderScreen();
    selectRowWithoutDueTime();
    const panel = screen.getByTestId("ward-legal-selected");
    expect(panel).toHaveTextContent("No deadline recorded");
    expect(panel).not.toHaveTextContent(COMPUTED_ACT_PERIOD);
    expect(screen.queryByTestId("ward-legal-act-period")).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: /^Form \w+$/ }));
    const sheet = screen.getByTestId("ward-legal-requirements");
    expect(within(sheet).getByTestId("ward-legal-requirements-due")).toHaveTextContent(
      "Ward Flow does not work out when a form ends",
    );
    expect(sheet).not.toHaveTextContent(COMPUTED_ACT_PERIOD);
    expect(sheet).not.toHaveTextContent(/\bs \d+/u);
  });
});

describe("Forms v10 pass (10 Oct 2026)", () => {
  // D-77 change 5: desktop drops the record-and-tell strip and the side panels, so the list takes the
  // full width and a chosen patient's form opens in a drawer over it.
  it("shows the list without the strip or side panels, and opens a chosen form in a drawer", () => {
    renderScreen();
    for (const gone of ["Board now", "Check a form time", "Forms in force", "Record on the form", "Tell people"]) {
      expect(screen.queryByRole("heading", { name: gone })).toBeNull();
    }
    expect(screen.queryByTestId("ward-legal-clock-rail")).toBeNull();
    expect(screen.queryByTestId("ward-legal-form-sheet")).toBeNull();
    selectRowWithoutDueTime();
    expect(screen.getByTestId("ward-legal-form-sheet")).toContainElement(screen.getByTestId("ward-legal-selected"));
  });

  it("keeps the record-and-tell tasks one button away on desktop, and steps aside for a task", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /^Record and tell/ }));
    const drawer = screen.getByTestId("ward-legal-tasks-sheet");
    for (const heading of ["Forms in force", "Record on the form", "Tell people"]) {
      expect(within(drawer).getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    fireEvent.click(within(drawer).getByRole("button", { name: /Requirements/ }));
    expect(screen.queryByTestId("ward-legal-tasks-sheet")).toBeNull();
  });

  // Josh, 31 Oct 2026 ("yes to all", answer 15): every Time not written row shows, with no Show more
  // fold (audit A3-6's "never folded" stands). A highlight never hides a row either.
  it("shows every Time not written row with no Show more", () => {
    expect(noDeadline.length, "too few rows without a deadline - this case proves nothing").toBeGreaterThan(6);
    renderScreen();
    const region = screen.getByRole("region", { name: "Legal forms list" });
    expect(region.querySelectorAll("[data-record-key]").length).toBe(rows.length);
    expect(screen.getAllByText("Time not written").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /more with no time written/ })).toBeNull();
  });

  it("highlights by dimming the other rows by colour, keeps every row and counts the highlighted rows", () => {
    renderScreen();
    const before = document.querySelectorAll("[data-record-key]").length;
    fireEvent.click(screen.getByRole("button", { name: /time not written/ }));
    expect(document.querySelectorAll("[data-record-key]").length).toBe(before);
    const dimmed = document.querySelectorAll('[data-record-key][data-dim="true"]').length;
    expect(dimmed).toBe(before - noDeadline.length);
    expect(screen.getByText(`${noDeadline.length} of ${rows.length} highlighted, all rows stay`)).toBeInTheDocument();
  });

  it("offers Undo on the toast after extending a breached form, and restores the deadline when Undo is pressed", () => {
    const target = withDeadline[0]!;
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <AdvanceClock minutes={240} />
          <LegalFormsScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const row = document.querySelector(`[data-record-key="${target.id}"]`) as HTMLElement;
    fireEvent.click(within(row).getAllByRole("button")[0]!);
    const panel = screen.getByTestId("ward-legal-selected");
    expect(within(panel).getByText(/^Ended, as typed from the form/u)).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Extend recorded form" }));
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-date"), {
      target: { value: typedDateFor(NOW_ANCHOR + 240, screenDayZero) },
    });
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), { target: { value: "23:45" } });
    fireEvent.click(screen.getByTestId("ward-legal-forms-renew-confirm"));

    expect(within(panel).getByText(/^Ends, as typed from the form/u)).toBeInTheDocument();
    // Design audit (Josh, 1 Nov 2026): the toast names the person, surname first, both ways.
    const name = resolveSubjectPatient(target, { patients: seed.patients, referrals: seed.referrals }).formalName;
    expect(name).toMatch(/^[^,]+, .+$/u);
    expect(screen.getByText(`Form ${target.legalForm?.code ?? ""} extended for ${name}`)).toBeInTheDocument();
    const undoBtn = screen.getByRole("button", { name: "Undo" });
    fireEvent.click(undoBtn);
    expect(within(panel).getByText(/^Ended, as typed from the form/u)).toBeInTheDocument();
    expect(screen.getByText(`Form extension undone for ${name}.`)).toBeInTheDocument();
  });

  it("blocks Form 3C on a movement that arrived on Form 3D in Record a form and keeps the sheet open", () => {
    const on3D = openMovements.find((movement) => movement.legalForm?.code === "3D");
    if (!on3D) throw new Error("the fixture no longer carries an open movement on Form 3D");
    let closed = false;
    render(
      <RecordFormSheet
        open
        onClose={() => {
          closed = true;
        }}
        draft={{ form: "3C", movement: on3D.id }}
        onDraft={() => undefined}
        openMovements={openMovements}
        labelOf={(movement) => movement.id}
        now={NOW_ANCHOR}
      />,
    );
    const sheet = screen.getByTestId("ward-legal-record");
    fireEvent.change(within(sheet).getByLabelText("Time on form"), { target: { value: "20:00" } });

    const confirm = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveAttribute("title", "Form 3C is refused when the person arrived on a Form 3D.");
    fireEvent.click(confirm);
    expect(closed).toBe(false);
  });

  it("names a time that is not a real time (such as 2505) on the field once it is left, before any save", () => {
    const movement = openMovements[0]!;
    render(
      <RecordFormSheet
        open
        onClose={() => undefined}
        draft={{ form: "1A", movement: movement.id }}
        onDraft={() => undefined}
        openMovements={openMovements}
        labelOf={(m) => m.id}
        now={NOW_ANCHOR}
      />,
    );
    const time = within(screen.getByTestId("ward-legal-record")).getByLabelText("Time on form");
    fireEvent.change(time, { target: { value: "2505" } });
    expect(time).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.blur(time);
    expect(time).toHaveAttribute("aria-invalid", "true");
    expect(time).toHaveAccessibleDescription(/Enter the time written on the form as HH:MM/);
    fireEvent.change(time, { target: { value: "" } });
    expect(time).not.toHaveAttribute("aria-invalid", "true");
  });

  it("disables Record next form and Extend recorded form with a reason when the active desk role is not allowed", () => {
    const target = withDeadline[0]!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock minutes={240} />
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    setDeskRole("officer");
    try {
      const row = document.querySelector(`[data-record-key="${target.id}"]`) as HTMLElement;
      fireEvent.click(within(row).getAllByRole("button")[0]!);
      const panel = screen.getByTestId("ward-legal-selected");
      const extend = within(panel).getByRole("button", { name: "Extend recorded form" });
      const recordNext = within(panel).getByRole("button", { name: "Record next form" });
      for (const button of [extend, recordNext]) {
        expect(button).toHaveAttribute("aria-disabled", "true");
        // The role gate's reason is announced with the button, not only the greyed state.
        expect(button).toHaveAccessibleDescription(/\S/);
      }
    } finally {
      setDeskRole("coordinator");
    }
  });
});

let screenDayZero: Date;
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, dayZero } = useWardFlowSelect("dispatch", "dayZero");
  useEffect(() => {
    screenDayZero = dayZero;
  }, [dayZero]);
  useEffect(() => {
    dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes });
  }, [dispatch, minutes]);
  return null;
}

it("clears an unsaved paper-form region on Clear and when the movement changes", () => {
  expect(openMovements.length).toBeGreaterThan(1);
  function RegionForm() {
    const [draft, setDraft] = useState<{ form: string; movement: string }>({
      form: "1A",
      movement: openMovements[0]!.id,
    });
    return (
      <RecordFormSheet
        open
        onClose={() => undefined}
        draft={draft}
        onDraft={setDraft}
        openMovements={openMovements}
        labelOf={(movement) => movement.id}
        now={NOW_ANCHOR}
      />
    );
  }
  render(<RegionForm />);
  fireEvent.change(screen.getByTestId("ward-legal-forms-record-region"), { target: { value: "country" } });
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: openMovements[1]!.id } });
  expect(screen.getByTestId("ward-legal-forms-record-region")).toHaveValue("");
  // Empty the movement first, so Clear (not the movement-change reset) must clear the region.
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: "" } });
  fireEvent.change(screen.getByTestId("ward-legal-forms-record-region"), { target: { value: "metro" } });
  expect(screen.getByTestId("ward-legal-forms-record-region")).toHaveValue("metro");
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.change(screen.getByLabelText("Form type"), { target: { value: "1A" } });
  expect(screen.getByTestId("ward-legal-forms-record-region")).toHaveValue("");
});
