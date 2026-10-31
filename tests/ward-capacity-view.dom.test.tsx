/**
 * 🔴 **NOTHING HERE RENDERS THE DEAD MODE ANY MORE. THIS FILE WAS THE LAST ONE IN THE REPOSITORY
 * THAT DID, AND THE REACHABILITY GUARD NOW PASSES WITH AN EMPTY LIST.**
 *
 * This file began with 13 cases against `<WardModeWorkspace mode="capacity" />`, the mode MERGE 02
 * replaced with `CapacityScreen`. It now holds four, all against the live screen. Every reduction is
 * recorded in `diff-integrity.json`, and each note below names the mutation or the ruling behind it —
 * "the subject moved" and "the subject is guarded where it moved to" are different claims, and only
 * the second justifies a retirement.
 *
 * ## What happened to the other nine
 *
 * Three retired because their subject moved to `ward-screen.tsx` at `/ward/[unitId]` and was
 * PROVED guarded there by mutation. Two retired because the zero-as-words rule is now obeyed and
 * guarded on the live capacity screen itself. One re-pointed into
 * `ward-bed-release.dom.test.tsx` — the "a expected release must never soften Available now" rule,
 * which turned out to be guarded by nothing at all and is the most serious defect this exercise
 * found. Three more became live cases here once the owner approved building what they asked for:
 * the coordinator's capacity-refresh control, the excluded-beyond-horizon count, and Mental Health
 * Act authorisation on the network view. The six-figure headline retired on the owner's own ruling —
 * leave the strip out. And the last one is the subject of the section below.
 *
 * ## The last one, and the fact that I argued against retiring it before I did it
 *
 * **A ward's sex mix and its specialling headroom, as FIGURES, on a network view.** This header
 * previously said the case must stay parked, on the reasoning that building the figures OR retiring
 * the case would each answer a product question on the owner's behalf. That standoff was the right
 * call while it stood. **Two things changed it, and neither is impatience.**
 *
 * **First, the sex-mix half stopped being an open question.** Ward Lead ruled that this screen
 * carries the sex-mix SIGNAL and never the FIGURE — *"this ward's bed records are mid-update"* when a
 * ward's recorded total disagrees with its occupancy, because `RELEASE_BED` raises occupancy without
 * being able to say which sex left. That ruling is built (`b98103167`) and
 * `ward-capacity-sexmix-release.dom.test.tsx` guards the OPPOSITE of what the retired case demanded:
 * that no sex-mix figure reaches the screen. A case cannot be re-pointed into a screen a ruling has
 * just cleared.
 *
 * **Second, both underlying clinical properties were proved guarded by mutation, not by grep.**
 * Disabling the specialling gate in `ward-flow-reducer.ts` turns 5 cases red across 4 files; blinding
 * the sex-mix occupancy in `ward-eligibility.ts` turns a long list red across the eligibility and
 * reducer suites. Source hashes `cf9a0868` and `10a42eda`, identical either side of both.
 *
 * ⚠️ **WHAT RETIRING IT COSTS, STATED PLAINLY RATHER THAN GLOSSED.** A red case forces a question to
 * be answered; a JSON entry does not. Whether a coordinator should be able to see specialling
 * headroom across the network at a glance is STILL an open product question, and this retirement
 * removes the thing that kept asking it. **That is a real loss and the reason it is written here, in
 * `diff-integrity.json`, and in the message that carried it to Ward Lead** — three places, because
 * the guard that used to ask is gone.
 *
 * It was retired anyway because a permanently red gate is the worse hazard: it stands over a screen
 * no coordinator can open, so it protects nothing, and a gate everybody knows is red is a gate
 * nobody reads when it goes red for a new reason.
 *
 * ## The Capacity redesign (Josh, 31 Oct 2026)
 *
 * The network ward table these cases read is gone. Each ward's facts now sit in its ward drawer,
 * opened from its bed map card: Mental Health Act authorisation ("Authorised hospital"), "Ask the
 * ward" (the capacity-refresh control) and the ward's discharge records and bed releases. The
 * excluded-beyond-the-horizon count is stated on Capacity's bed meeting sheet ("N more expected after
 * tomorrow, left out of these figures"), and held-up releases are counted in "This shift". Every
 * case below is the same rule read in its new place.
 */

// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Mirrors tests/ward-flow-clock-consistency.dom.test.tsx: the ward chrome renders next/link anchors
// and this suite never checks routing itself, so a plain <a> avoids requiring an App Router context
// jsdom cannot provide. It used to say "WardModeWorkspace renders next/link", which stopped being
// true the moment this file's last case against that component was retired — and a comment naming a
// component the file no longer imports is how the next reader is sent somewhere that does not exist.
// Measured 2026-09-06 rather than assumed: all four remaining cases pass with this mock removed, so
// it is insurance rather than a requirement. Kept because `ClinicalRail` does render links and the
// cost of the insurance is nothing.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Raises a real `FLAG_BED_RELEASE` with no `blocker` — Phase 5 spec D3: a flag with no blocker
 * is a plain prediction — for `unitId`, at the live `now`. `expectedAt` is an optional override;
 * every existing call site below omits it and gets `now` by default, matching this suite's
 * original behaviour. The excluded-count test below once reached a later `expectedAt` by
 * advancing the shared clock with a demo `ADVANCE_CLOCK` event; REWRITTEN 2026-08-30 for WB-DB-7,
 * it instead passes `expectedAt` two days out directly (`FLAG_BED_RELEASE.expectedAt` no longer
 * has to equal `event.now` — see `ward-flow-events.ts`'s own doc comment — but nothing stops a
 * caller choosing to make them equal, which is what a default of `now` does here).
 */
function ExpectedReleaseFlagger({ unitId, expectedAt }: { unitId: string; expectedAt?: number }) {
  const { now, dispatch, admissions, bedReleases } = useWardFlow();
  // A bed release names the occupant whose stay it belongs to: one with no live release yet.
  const occupant = admissions.find(
    (a) =>
      a.unitId === unitId &&
      a.state === "occupied" &&
      !bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  return (
    <button
      type="button"
      data-testid="test-flag-expected-release"
      onClick={() =>
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now,
          unitId,
          actingUnitId: unitId,
          admissionId: occupant?.id ?? "",
          waitingOn: "Awaiting ward round",
          expectedAt: expectedAt ?? now,
        })
      }
    >
      flag expected release
    </button>
  );
}

/** Reads the live `refreshRequests` list straight from the shared provider, so a test can prove
 * a click on the coordinator's control actually reached the reducer rather than merely changing
 * on-screen text the reducer never saw. */
/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

/** Opens a ward's drawer from its bed map card, as a coordinator would. */
function openWardDrawer(unitId: string): HTMLElement {
  const unit = unitById(unitId);
  if (!unit) throw new Error(`no unit ${unitId}`);
  const map = document.getElementById("capacity-bed-map");
  if (!map) throw new Error("no bed map on the Capacity screen");
  const card = Array.from(map.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')).find(
    (button) => visibleName(button.firstElementChild) === unit.name,
  );
  if (!card) throw new Error(`no bed map card for ${unitId}`);
  fireEvent.click(card);
  const drawer = screen.getByTestId("ward-capacity-ward-drawer");
  expect(drawer).toHaveAccessibleName(unit.name);
  return drawer;
}

/** The value beside a label in the drawer's facts ("Authorised hospital" → "Yes"). */
function drawerFact(drawer: HTMLElement, label: string): string {
  return within(drawer).getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? "";
}

/** Opens Capacity's bed meeting sheet from the hero's Bed meeting menu. */
function openMeetingSheet(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Bed meeting" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Print the meeting sheet" }));
  return screen.getByTestId("bed-meeting-sheet-print-copy");
}

/** The number in the sheet's "N more expected after tomorrow, left out of these figures" (0 when
 *  the line is absent). Since 25 September 2026 the derived seed carries releases beyond today, so
 *  the tests below diff this number rather than assert the line is absent. */
function excludedBeyondTodayCount(): number {
  const discharges = within(screen.getByTestId("bed-meeting-sheet-print-copy")).getByTestId("bed-meeting-discharges");
  const line = within(discharges).queryByText(/more expected after tomorrow, left out of these figures/u);
  return line ? Number(line.textContent?.match(/\d+/)?.[0]) : 0;
}

/** The "This shift" card's held-up release count. */
function heldUpCount(): number {
  const section = screen.getByRole("region", { name: "Held-up releases" });
  return Number(/(\d+)\s*held-up/u.exec(section.textContent ?? "")?.[1]);
}

function ConfirmCapacityProbe({ unitId, now }: { unitId: string; now: number }) {
  const { dispatch, units } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === unitId)!;
  return (
    <button
      type="button"
      data-testid="test-confirm-capacity"
      onClick={() =>
        dispatch({
          type: "CONFIRM_CAPACITY",
          role: "ward",
          now,
          unitId,
          actingUnitId: unitId,
          value: unit.allocatable.value,
          expectedRevision: unit.allocatable.revision ?? 0,
        })
      }
    >
      confirm
    </button>
  );
}

function RefreshRequestsProbe() {
  const { refreshRequests } = useWardFlow();
  return <div data-testid="test-refresh-requests-count">{refreshRequests.length}</div>;
}

/**
 * Task 8 (spec item 6). The capacity board already showed bed counts and freshness but not the
 * three properties that actually gate whether a patient can go to a unit — sex mix, specialling
 * headroom, and Mental Health Act authorisation — even though all three already exist on `Unit`
 * and already gate placement in `ward-eligibility.ts`.
 *
 * SJGS Adult Secure (`sjgs-adult-secure`) is authorised: false — private and not MHA-authorised,
 * per SJGS Adult Open's sibling fixture comment in ward-sites.ts (both SJGS units share that
 * note). Mental Health Unit (`scgh-adult-open`) is authorised: true. Both are chosen deliberately
 * for an ASYMMETRIC sex mix (Female != Male) rather than the first false/true units found —
 * SJGS Adult Open (4F/4M) and Ward 2K (9F/9M) both have equal Female/Male counts, so a
 * Female<->Male swap mutation on the render line would be invisible against them. Both units
 * used here have distinct counts, so the "both counts" requirement actually has teeth.
 */
const SJGS_ADULT_SECURE = unitById("sjgs-adult-secure");
const SCGH_ADULT_OPEN = unitById("scgh-adult-open");

describe("ward capacity board", () => {
  it("fixture assumption: SJGS Adult Secure is unauthorised with an asymmetric sex mix, Mental Health Unit is authorised with an asymmetric sex mix", () => {
    expect(SJGS_ADULT_SECURE?.authorised).toBe(false);
    expect(SJGS_ADULT_SECURE?.sexMix).toEqual({ Female: 4, Male: 3 });
    expect(SCGH_ADULT_OPEN?.authorised).toBe(true);
    expect(SCGH_ADULT_OPEN?.sexMix).toEqual({ Female: 10, Male: 9 });
  });

  /*
   * 🔴 **SPLIT 2026-09-05. The MHA half is re-pointed at the live screen; the sex-mix and
   * specialling halves stay parked, because nothing reachable shows either of them.**
   */
  it("names every ward's Mental Health Act authorisation on the network view, both directions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    expect(drawerFact(openWardDrawer("sjgs-adult-secure"), "Authorised hospital")).toBe("No");

    // Both directions, or this would pass on a screen that said "No" on every ward.
    expect(drawerFact(openWardDrawer("scgh-adult-open"), "Authorised hospital")).toBe("Yes");
  });

  /*
   * RETIRED 2026-09-06 — "shows sex mix and specialling capacity per unit row — both directions".
   * Recorded in `diff-integrity.json`. **This was the last case in the repository rendering a dead
   * `WardModeWorkspace` mode, so the reachability guard now passes with an empty list.**
   *
   * ⚠️ **THE SEX-MIX HALF CONTRADICTED A RULING ALREADY TAKEN, WHICH IS WHY IT COULD NOT BE
   * RE-POINTED.** Ward Lead ruled that the capacity screen carries the sex-mix SIGNAL and no sex-mix
   * FIGURE — whether a ward's recorded male/female total is mid-update, never the numbers
   * themselves, because `RELEASE_BED` raises occupancy without being able to say which sex left.
   * That ruling is built (`b98103167`) and guarded by `ward-capacity-sexmix-release.dom.test.tsx`,
   * which asserts the OPPOSITE of the case retired here: that no sex-mix figure reaches the screen.
   * Re-pointing this case would have meant building a figure a ruling had just removed.
   *
   * ⚠️ **NEITHER CLINICAL PROPERTY IS DROPPED, AND THAT WAS PROVED BY MUTATION RATHER THAN BY
   * GREP.** A file list containing the word is not evidence a property is guarded, so both gates
   * were broken and the reds counted:
   *
   *   - Disabling the specialling gate in `ward-flow-reducer.ts` (`if (false && movement.specialling
   *     && …)`) turns **5 cases red across 4 files**, among them "refuses the second one-to-one pull,
   *     and names specialling rather than 'no bed'". Source hash `cf9a0868` before and after.
   *   - Blinding the sex-mix occupancy in `ward-eligibility.ts` (`sameSexOccupants = 0`) turns a long
   *     list red across the eligibility and reducer suites. Source hash `10a42eda` before and after.
   *
   * **What is genuinely given up is a DISPLAY, not a rule:** no reachable screen shows specialling
   * headroom as a network figure. Whether it should is a product question nobody has ruled on — it
   * is recorded here and with Ward Lead rather than settled by keeping a guard that stands over a
   * screen no coordinator can open. A guard aimed at a dead surface does not protect the property;
   * it only makes the gap harder to see.
   */

  /*
   * RETIRED 2026-09-05 — "replaces the per-unit row's undifferentiated Potential lump with its own
   * Confirmed/Expected breakdown". Recorded in `diff-integrity.json`.
   *
   * The subject MOVED and is guarded at its new home, proved by mutation rather than by reading:
   * `ward-screen.tsx` renders `Confirmed {breakdown.confirmedToday}` and `Expected
   * {breakdown.expectedToday}` in its bed grid, reachable at `/ward/[unitId]`. Making the Confirmed
   * chip read the Expected field turns THREE cases red across `ward-screen.dom.test.tsx`, one of
   * them "never renders 'Potential', and renders Confirmed/Expected/Leave from capacityBreakdown()".
   */
});

/**
 * Task 7 (Phase 5, spec D6/D12). Before this task the headline above the unit table was a single
 * `unitCapacity()` total keyed by five DIFFERENT states (available/held/potential/blocked/
 * occupied), where "potential" counted every bed release regardless of state or timing. This
 * suite proves the headline instead shows `capacityBreakdown()`'s five figures — Available now,
 * Confirmed today, Expected today, Held, Leave (usable) — as five separate cards, that
 * `Available now` is never softened by a expected or confirmed-but-unreleased bed, that the
 * excluded-beyond-tonight count is surfaced rather than silently dropped, and that the
 * coordinator's one permitted action (asking a ward to restate its numbers) is a real dispatch
 * that moves no bed figure at all.
 */
describe("ward capacity headline (Task 7)", () => {
  /*
   * RETIRED 2026-09-06 — "renders the capacity headline as six separate figures and never a sum".
   * Recorded in `diff-integrity.json`. **The owner ruled on it**, with the recommendation put to him:
   * leave the strip out.
   *
   * The case guarded a structural property of a headline that no longer exists — exactly six cards
   * under the headline, so a seventh "total" could not be added unnoticed. `CapacityScreen` has no
   * headline of that shape, so the guard had nothing to stand over.
   *
   * ⚠️ **THE REASONING BEHIND THE RULING IS WORTH KEEPING, because it is the reason not to
   * reintroduce the strip casually.** The six figures count different things — beds ready now, beds
   * confirmed to free today, beds expected to free, blocked releases, held beds, usable leave beds.
   * A total of them would be a number with no referent, and a row of figures side by side is an
   * invitation to add them. The screen answers "where is the network short" instead, which is a
   * question no sum helps with.
   *
   * If a summary strip is ever wanted here, this guard is the one to bring back with it.
   */

  /*
   * RE-POINTED 2026-09-05 into `ward-bed-release.dom.test.tsx`, against the live `WardScreen` and
   * the ward's own flagging control, so the rule runs end to end through a real `FLAG_BED_RELEASE`.
   *
   * 🔴 **THIS ONE WAS A LIVE HOLE.** Rendering `Ready {capacity.available -
   * breakdown.expectedToday}` — a discharge that has not happened reducing the beds a ward can fill
   * now — was run against all 41 test files that render `WardScreen` or touch
   * `unitCapacity`/`capacityBreakdown`: 714 passed, nothing red. The mutation was live: two of the
   * five units those suites render carry `ready=2, expectedToday=1` and rendered `Ready 1`.
   */

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05, AFTER THE CONTROL WAS PUT BACK.**
   *
   * ⚠️ **THIS WAS A CAPABILITY LOST BY ACCIDENT.** Measured before rebuilding it:
   * `REQUEST_CAPACITY_REFRESH` was dispatched from exactly ONE place in the whole codebase — the
   * capacity view MERGE 02 retired — while the event type, the reducer case, the provider list and
   * the ward-side DISPLAY of a request all kept working. So no coordinator could ask a ward to
   * restate its numbers, and `ward/ward-screen.tsx` carried a mark for something nothing could
   * produce. Every half was individually correct, which is why no gate saw it.
   *
   * The second half of this case is the clinical one and is not decoration: **asking must move no
   * bed figure.** A control that quietly adjusted a number while claiming only to record a request
   * would be the worst kind of defect on this screen.
   */
  it("the coordinator's refresh control is a real button that dispatches REQUEST_CAPACITY_REFRESH and moves no bed figure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <RefreshRequestsProbe />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("0");
    const drawer = openWardDrawer("rph-adult-secure");
    const refreshButton = within(drawer).getByRole("button", { name: "Ask the ward" });
    // Every figure in the drawer's "Beds now" and its facts must stay put.
    const wardFigures = () =>
      [
        within(drawer).getByRole("region", { name: "Beds now" }).textContent,
        ...within(drawer)
          .getAllByRole("region")
          .filter((region) => ["Today", "Ward"].includes(region.getAttribute("aria-label") ?? ""))
          .map((region) => region.textContent),
      ].join(" | ");
    const readyBefore = wardFigures();

    // A real, wired <button> — never an advisory element with no handler.
    expect(refreshButton.tagName).toBe("BUTTON");
    expect(refreshButton).not.toHaveAttribute("disabled");
    expect(refreshButton).not.toHaveAttribute("aria-disabled");

    fireEvent.click(refreshButton);

    // The one observable effect: a real dispatch reached the reducer's own `refreshRequests` list.
    expect(screen.getByTestId("test-refresh-requests-count")).toHaveTextContent("1");
    expect(within(drawer).getByRole("status")).toHaveTextContent(/^Update requested/u);
    expect(
      wardFigures(),
      "asking a ward to restate its numbers moved one of its figures; this control records that " +
        "somebody asked and must change nothing else",
    ).toBe(readyBefore);
    // The acknowledged control must not append a duplicate request on a second click.
    fireEvent.click(within(drawer).getByRole("button", { name: "Ask the ward" }));
    expect(
      screen.getByTestId("test-refresh-requests-count"),
      "a second press while the ward has not yet answered appended a duplicate request",
    ).toHaveTextContent("1");
  });

  it("lets the coordinator ask again once the ward has confirmed its capacity", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <ConfirmCapacityProbe unitId="rph-adult-secure" now={NOW_ANCHOR + 5} />
      </WardFlowProvider>,
    );
    const drawer = openWardDrawer("rph-adult-secure");
    fireEvent.click(within(drawer).getByRole("button", { name: "Ask the ward" }));
    expect(within(drawer).getByRole("status")).toHaveTextContent(/^Update requested/u);
    fireEvent.click(screen.getByTestId("test-confirm-capacity"));
    // The confirmation answered the request, so it is no longer outstanding and asking is open again.
    expect(within(drawer).queryByText(/^Update requested/u)).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Ask the ward" })).toBeEnabled();
  });

  // DEC-L5-04 (21 Oct 2026): the confirmation stamps the request answered, so events order it, not
  // minutes. Before, a same-minute tie stayed outstanding because timestamps could not order it.
  it("treats a confirmation in the same minute, after the request, as answering it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <ConfirmCapacityProbe unitId="rph-adult-secure" now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const drawer = openWardDrawer("rph-adult-secure");
    fireEvent.click(within(drawer).getByRole("button", { name: "Ask the ward" }));
    expect(within(drawer).getByRole("status")).toHaveTextContent(/^Update requested/u);
    fireEvent.click(screen.getByTestId("test-confirm-capacity"));
    expect(within(drawer).queryByText(/^Update requested/u)).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Ask the ward" })).toBeEnabled();
  });

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05, AFTER THE FIGURE IT ASKS FOR WAS BUILT.**
   *
   * The rule is this file's own words: *"a release beyond the horizon must be counted and shown,
   * never quietly omitted."* `networkWardRows` drops a release whose `dayOf` is not today —
   * correctly, since "freeing today" must not include tomorrow — and said nothing about having
   * dropped it. `releasesBeyondToday` now counts them and the screen states them.
   *
   * Both halves matter and both are kept: the count must be ABSENT before anything falls outside
   * the horizon. An assertion that only ever sees the count present would pass on a screen showing
   * it unconditionally.
   */
  it("shows the excluded count once a release falls beyond the board's horizon, and not before", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <ExpectedReleaseFlagger unitId="fre-adult-open" expectedAt={NOW_ANCHOR + 2 * MINUTES_PER_DAY} />
      </WardFlowProvider>,
    );
    openMeetingSheet();

    // CHANGED 25 September 2026: the derived seed already carries releases beyond today, so the
    // count starts above zero; the property survives as the change: one more far-future release
    // raises it by exactly one.
    const before = excludedBeyondTodayCount();

    fireEvent.click(screen.getByTestId("test-flag-expected-release"));

    expect(
      excludedBeyondTodayCount(),
      "a release beyond the horizon must be counted and shown, never quietly omitted",
    ).toBe(before + 1);
  });
});

/**
 * Second-edition pass, capacity table (Part 2/3 of the task brief). Design language binding rule:
 * "a number that could be zero or unknown is rendered as a stated absence IN WORDS, never as `0`,
 * a dash or a blank". Scoped deliberately to the Ready ("available") figure alone — the row's other
 * five bed-state figures (Held/Confirmed/Expected/Blocked/Occupied) are asserted with literal
 * "0Confirmed"/"0Expected" text by `tests/ward-bed-release.dom.test.tsx` and
 * `tests/ward-bed-release-lifecycle.test.ts`, both outside this task's file ownership, so widening
 * the word-for-zero treatment to those cells would break coverage this task may not edit.
 */
/*
 * RETIRED 2026-09-05 — the two cases asserting that a unit with no ready bed reads "none" rather
 * than the digit "0", and the fixture assumption underneath them. Recorded in `diff-integrity.json`.
 *
 * **The rule is now OBEYED and GUARDED on the live screen**, which was not true when this file was
 * last touched: `capacity-screen.tsx` renders `row.ready === 0` as the word, and
 * `ward-capacity-screen.dom.test.tsx`'s "names every ward's real ready and locked-ready counts"
 * case asserts the claim for every row — including both directions on the absence, so a cell
 * reading "0 none" fails there too. That case also floors on there being a zero-ready ward at all,
 * so the branch cannot silently stop being covered.
 *
 * Re-pointing these here instead would have put a second guard over one fact. Two guards over one
 * fact drift apart, and the weaker one teaches the next reader that the stronger is redundant.
 */

/**
 * Task brief requirement: "tests/ward-capacity-reconciliation.test.ts already asserts
 * available/held/blocked/occupied sum to a unit's total beds — assert the screen SHOWS figures
 * obeying that identity." That file checks `unitCapacity()`'s own return value; this checks the
 * SCREEN, independently, against `unit.beds` — a raw fixture field, never a value read back from
 * `unitCapacity`/`capacityBreakdown` — so a defect that broke only the RENDERING of an otherwise
 * correct identity (a wrong label pointing at a sibling cell, a row reading another unit's figure)
 * would be caught here even though the underlying arithmetic test stays green.
 */

/**
 * "A leave bed is not counted as available (a leave bed is a bed a patient is expected back into)."
 * `rph-adult-secure` carries the live fixture's one usable leave bed (`WL-001`,
 * `ward-movements.ts`). The expected Ready figure is computed here from the unit's own
 * `allocatable`/`empty` fields — one layer below `unitCapacity`, never by calling it — so this
 * cannot pass merely because the screen and the test share the same derivation.
 */

/**
 * WLQ-10, owner ruling 2026-09-15. Two real events, not a fixture literal: `FLAG_BED_RELEASE`
 * raises an expected release with no blocker (the seed fixture carries no blocked release older
 * than today, so a stale one has to be raised), then `BLOCK_BED_RELEASE` — the only event that
 * ever sets `blocker` — marks it stuck. The created release is found back by its own `expectedAt`,
 * which this harness controls precisely, rather than by a guessed id the reducer assigns.
 */
function StaleBlockedReleaseSetup({ unitId, daysAgo }: { unitId: string; daysAgo: number }) {
  const { now, dispatch, bedReleases, admissions } = useWardFlow();
  // A bed release names the occupant whose stay it belongs to: one with no live release yet.
  const occupant = admissions.find(
    (a) =>
      a.unitId === unitId &&
      a.state === "occupied" &&
      // A stay that already records a blocker gives its new release that blocker, so use one that is not held up.
      a.blockReason === null &&
      !bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  const staleExpectedAt = now - daysAgo * MINUTES_PER_DAY;
  const created = bedReleases.find((release) => release.unitId === unitId && release.expectedAt === staleExpectedAt);
  return (
    <div>
      <button
        type="button"
        data-testid="test-flag-stale-release"
        onClick={() =>
          dispatch({
            type: "FLAG_BED_RELEASE",
            role: "ward",
            now,
            unitId,
            actingUnitId: unitId,
            admissionId: occupant?.id ?? "",
            waitingOn: "Awaiting ward round",
            expectedAt: staleExpectedAt,
          })
        }
      >
        flag stale release
      </button>
      {created ? (
        <button
          type="button"
          data-testid="test-block-stale-release"
          onClick={() =>
            dispatch({
              type: "BLOCK_BED_RELEASE",
              role: "ward",
              now,
              releaseId: created.id,
              actingUnitId: unitId,
              blocker: BED_RELEASE_BLOCKERS[0],
            })
          }
        >
          block stale release
        </button>
      ) : null}
    </div>
  );
}

describe("a discharge held up for days keeps counting, and shows since when (WLQ-10)", () => {
  /** The ward drawer's bed release entries (Discharges tab) expected two days ago, which the drawer
   *  states as "HH:MM, 2 days ago". The seed already carries some, so the cases below diff them. */
  function staleReleaseEntries(unitId: string): HTMLElement[] {
    const drawer = openWardDrawer(unitId);
    fireEvent.click(within(drawer).getByRole("radio", { name: /^Discharges/u }));
    const heading = within(drawer).queryByRole("heading", { name: "Bed releases without a name" });
    const list = heading?.nextElementSibling as HTMLElement | null | undefined;
    if (!list) return [];
    return within(list)
      .queryAllByText(/, 2 days ago$/u)
      .map((line) => line.closest("li") as HTMLElement)
      .filter(Boolean);
  }
  const blocked = (entries: HTMLElement[]) =>
    entries.filter((entry) => entry.textContent?.includes(BED_RELEASE_BLOCKERS[0])).length;

  it("still counts in the held-up figure and states since when, once blocked two days ago", () => {
    const unitId = "fre-adult-open";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <StaleBlockedReleaseSetup unitId={unitId} daysAgo={2} />
      </WardFlowProvider>,
    );

    const heldBefore = heldUpCount();
    expect(Number.isFinite(heldBefore), "the This shift card states no held-up count").toBe(true);
    const entriesBefore = staleReleaseEntries(unitId);
    openMeetingSheet();
    // CHANGED 25 September 2026: the derived seed already counts releases beyond today, so "never
    // reported as excluded" is checked as "this release does not move that count".
    const excludedBefore = excludedBeyondTodayCount();

    fireEvent.click(screen.getByTestId("test-flag-stale-release"));
    fireEvent.click(screen.getByTestId("test-block-stale-release"));

    expect(heldUpCount(), "a discharge held up since two days ago must still count in today's held-up figure").toBe(
      heldBefore + 1,
    );

    const entriesAfter = staleReleaseEntries(unitId);
    expect(entriesAfter.length, "the ward must say since when the held-up release was expected").toBe(
      entriesBefore.length + 1,
    );
    expect(blocked(entriesAfter), "the held-up release must name what it is waiting on").toBe(
      blocked(entriesBefore) + 1,
    );

    // And it must never be reported as excluded — the false pair this ruling exists to prevent.
    openMeetingSheet();
    expect(
      excludedBeyondTodayCount(),
      "a discharge held up in the past is not 'beyond today'; flagging and blocking it must not move this figure",
    ).toBe(excludedBefore);
  });

  it("shows no held-up mark once the release is no longer held up", () => {
    const unitId = "fre-adult-open";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
        <StaleBlockedReleaseSetup unitId={unitId} daysAgo={2} />
      </WardFlowProvider>,
    );
    const heldBefore = heldUpCount();
    const entriesBefore = staleReleaseEntries(unitId);

    fireEvent.click(screen.getByTestId("test-flag-stale-release"));
    // Deliberately NOT clicking "block stale release" — a release that was never held up must
    // never be counted or named as held up, or the screen would be describing something that never
    // happened.
    expect(heldUpCount()).toBe(heldBefore);
    const entriesAfter = staleReleaseEntries(unitId);
    expect(entriesAfter.length, "the flagged release is not on the ward's Discharges tab").toBe(
      entriesBefore.length + 1,
    );
    expect(blocked(entriesAfter), "a release never held up is named as held up").toBe(blocked(entriesBefore));
  });
});
