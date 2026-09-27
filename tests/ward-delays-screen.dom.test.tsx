import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING, type Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allUnits, edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * MERGE 01 — the priority queue, the exceptions inbox and the escalation board become one screen
 * answering one question: why is this person still waiting?
 *
 * ⚠️ The counts below are DERIVED from the seeded night (fixture plus rulings demo overlay), not
 * from `wardMovements` alone. A hand-written total is the thing that goes stale the day the seed
 * changes, and it goes stale by passing.
 */
const seededMovements = seedWardFlowState().movements;
const OPEN_COUNT = seededMovements.filter(isOpen).length;

function renderScreen(aliasFrom?: "queue" | "exceptions" | "escalation" | null) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen aliasFrom={aliasFrom} />
    </WardFlowProvider>,
  );
}

/**
 * Reports the shared `focusMovementId` into the DOM. `CoordinatorScreen` reads no search params —
 * its selection is `useState` seeded from this value — so this is not an implementation detail
 * standing in for the real thing: **it IS the whole channel between the two screens.**
 */
function FocusProbe() {
  const { focusMovementId } = useWardFlow();
  return <output data-testid="focus-probe">{focusMovementId ?? "nobody"}</output>;
}

function renderScreenWithProbe() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
      <FocusProbe />
    </WardFlowProvider>,
  );
}

/**
 * ⚠️ **THE THREE-COLUMN REBUILD MOVED THE FULL RECORD BEHIND SELECTION.** Before, every patient's
 * full `DelayRow` — blocker, escalation, owner, stage, actions — rendered at once in one long list.
 * Now the middle-left column is a compact index (`PersonRow`, one `<button
 * data-testid="delays-select-<id>">` per person) and the full record renders for the SELECTED
 * person only, inside the detail panel. Selecting is clicking that button.
 *
 * ⚠️ **RENAMED, task D1 — the panel is titled "The person you have chosen" NO LONGER.** The
 * drawing (`delays-third-edition.html`) draws two titles depending on state: "Nobody selected"
 * with nobody chosen, "Why this person is waiting" once somebody is. This helper always selects
 * first, so it always lands in the second state and the fixed name below is safe here — a helper
 * that had to work in BOTH states would need to match either.
 *
 * ⚠️ **A QUERY AFTER SELECTING MUST BE SCOPED TO THE RETURNED PANEL, NOT `screen`.** The full
 * record (`DelayRow`, via `WardRecordRow`) carries the SAME `data-ward-primitive="record-row"` /
 * `"record-id"` primitives the compact list row (`PersonRow`) already carries — so once somebody is
 * selected there are TWO such primitives on screen for their id at once: the list row and the
 * detail row. An unscoped `getByText`/`getByRole` lookup for that id finds both and throws; a
 * lookup scoped to the panel this helper returns (`within(panel)...`) finds only the detail row's.
 */
function selectPerson(id: string): HTMLElement {
  fireEvent.click(screen.getByTestId(`delays-select-${id}`));
  return screen.getByRole("region", { name: /Why this person is waiting/u });
}

describe("the Delays screen", () => {
  it("moves phone focus to details only after an explicit row selection", () => {
    installMatchMediaStub(true);
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    const view = renderScreen();

    expect(screen.queryByRole("region", { name: "Selected patient delay details" })).toBeNull();
    view.rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    expect(frame).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(`delays-select-${wardMovements.find(isOpen)!.id}`));
    expect(frame).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(screen.getByRole("region", { name: "Selected patient delay details" })).toHaveFocus();
  });

  it("dismisses the slide-over detail inspection panel when clicking the backdrop", () => {
    renderScreen();
    expect(screen.queryByTestId("delays-detail-backdrop")).toBeNull();

    const openPatient = wardMovements.find(isOpen)!;
    fireEvent.click(screen.getByTestId(`delays-select-${openPatient.id}`));

    const backdrop = screen.getByTestId("delays-detail-backdrop");
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected patient delay details" })).toBeInTheDocument();

    fireEvent.click(backdrop);
    expect(screen.queryByTestId("delays-detail-backdrop")).toBeNull();
    expect(screen.queryByRole("region", { name: "Selected patient delay details" })).toBeNull();
  });

  it("declares the responsive slide-over drawer contract (< 768px) and print static reset in delays.module.css", () => {
    const css = readFileSync("src/components/ward-management/delays/delays.module.css", "utf8");

    // Drawer contract on mobile/tablet viewports (< 768px)
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*position:\s*fixed;/u);
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*bottom:\s*0;/u);
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*left:\s*0;/u);
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*right:\s*0;/u);
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*max-height:\s*85dvh;/u);
    expect(css).toMatch(/@media[^{]*768px[^{]*\{[\s\S]*?\.colDetail\s*\{[^}]*z-index:\s*100;/u);

    // Static reset in @media print
    expect(css).toMatch(/@media print\s*\{[\s\S]*?\.colDetail[^{]*\{[^}]*position:\s*static;/u);
  });

  /*
   * 🔴 **CARRIED ACROSS FROM `ward-pull-vocabulary.dom.test.tsx` ON 2026-09-05, BECAUSE MERGE 01
   * MOVED THE SCREEN THIS CLINICAL RULE GUARDS AND LEFT THE GUARD BEHIND.**
   *
   * That file pins "a lapsed bed reservation is called a **pull**, never a **hold**" against
   * `<WardModeWorkspace mode="exceptions" />`. MERGE 01 folded the exceptions inbox into this
   * screen and turned `/mockups/ward-flow/exceptions` into a redirect — so the pin still runs,
   * still passes, and **now stands over a surface no coordinator can reach.**
   *
   * ⚠️ **THE HOLE WAS REAL AND THIS CLOSES IT.** Measured before writing this: the live string
   * `"Bed pull expired"` reaches this screen from `ORDER` in `delays-derivations.ts`, and NOTHING
   * in this file asserted anything about pull-or-hold wording. Changing the live label to "Bed hold
   * expired" would have left every test in the repository green while the screen a coordinator
   * actually reads broke the vocabulary rule. **The word was correct here by inheritance, not by
   * guard** — which is the state that looks identical to being protected right up until it isn't.
   *
   * ⚠️ **DELIBERATELY NOT A BLANKET BAN ON THE WORD "hold".** The same catalogue entry carries the
   * note *"the hold lapsed before the bed was used"*, which is honest copy about a BED reservation
   * rather than about detaining a person. A repository-wide ban would go red on it, and the
   * dishonest repair would then be to weaken this guard. **Whether that note should also say "pull"
   * is a vocabulary question for the owner, recorded in the handover rather than decided here.**
   */
  it("calls a lapsed bed reservation a pull, never a hold — the rule ward-pull-vocabulary pins against the screen this one replaced", () => {
    renderScreen();
    const text = document.body.textContent ?? "";

    /*
     * The positive claim is also the anti-vacuity floor: if the fixture stops producing a lapsed
     * pull, this goes red rather than letting the negative pin below pass over an absent group.
     */
    expect(
      text,
      "the Delays screen renders no lapsed-bed-pull group at all, so the vocabulary pin below has " +
        "nothing to stand over. Re-seed the fixture or retire this pair — do not leave it passing.",
    ).toContain("Reserved time has passed, bed still held");

    expect(text, "a lapsed bed reservation is called a hold; the ward vocabulary rule is pull").not.toContain(
      "Bed hold expired",
    );
  });

  it("has a waiting population to render, or every assertion below is vacuous", () => {
    expect(OPEN_COUNT).toBeGreaterThan(8);
  });

  it("says how many of the waiting population it is showing, and does not imply it shows them all", () => {
    renderScreen();
    // ⚠️ THE HEADER NOW HAS TWO STATES, AND ONLY ONE OF THEM CARRIES "of N". Unmarked it states
    // the population alone; a second figure there would read as a measured "0 marked" over a
    // control nobody has pressed. Pressing any chip is what makes the "of N" claim appear, so the
    // regex below is asserted against the MARKED state — which is the only state that makes it.
    fireEvent.click(screen.getByRole("button", { name: /^Needs a locked bed \d+$/u }));
    // ⚠️ `\\b`, NOT `\b`. In a TEMPLATE LITERAL `\b` is the backspace character U+0008, so this
    // regex was /of 43<BACKSPACE>/ - a literal 0x08 byte where a word-boundary escape was meant -
    // and could never match anything. The honest-looking repair is to
    // weaken the assertion until it passes; the real one is the second backslash. This exact
    // substitution has bitten this repository before and it leaves every gate green.
    expect(
      within(screen.getByRole("region", { name: "Waiting" })).getByText(new RegExp(`of ${OPEN_COUNT}\\b`, "u")),
    ).toBeInTheDocument();
  });

  it("carries the panels the three old screens each carried alone", () => {
    renderScreen();
    // The wait bar and owner cards did not disappear — they moved into one panel, renamed from
    // "How long" to "Who is holding people up" in the three-column rebuild.
    expect(screen.getByRole("region", { name: /Who is holding people up/u })).toBeInTheDocument();
    // Renamed again, task D1: "Who is waiting" -> "Waiting", the drawing's own word.
    expect(screen.getByRole("region", { name: /Waiting/u })).toBeInTheDocument();
    // "Worth your attention" is integrated into the middle register panel as an Attention tab.
    expect(screen.getByRole("tab", { name: /Attention/u })).toBeInTheDocument();
  });

  /**
   * ⚠️ THE WHOLE POINT OF THE MERGE. The three old screens listed the same person up to three times
   * — WF-009 stood on all three at once, as a long wait, as "five wards have declined", and as a
   * recorded escalation. Three rows, one man, one problem.
   */
  it("lists every patient at most once across every group", () => {
    renderScreen();
    const ids = Array.from(document.querySelectorAll("[data-ward-primitive='record-row'][data-record-key]")).map(
      (node) => node.getAttribute("data-record-key") ?? "",
    );
    expect(ids.length, "no rows rendered — the assertion below would be vacuous").toBeGreaterThan(0);
    expect(new Set(ids).size, `duplicated: ${ids.join(", ")}`).toBe(ids.length);
  });

  /**
   * ⚠️ **NO ELIGIBILITY RULE IS ABSOLUTE IN THIS PRODUCT.** A refusal is a decision to be recorded,
   * never a block — so wherever this screen shows one, it must also offer the override. A screen
   * that displays a refusal with no way past it has quietly turned a coordinator's judgement into
   * the software's.
   */
  /*
   * ⚠️ **UPDATED 2026-09-06, AND THE OLD VERSION WOULD HAVE PASSED ON A DEAD CONTROL.** It required
   * `getByRole("button", { name: /Override/ })` — and the button it was finding had no `onClick`, no
   * `aria-disabled` and no note. It looked live, did nothing when pressed, and this guard called
   * that "an override is offered".
   *
   * **The claim is that a refusal is never presented as a dead end. The role is not the claim.**
   * An override is not its own event — it is an `overrideReason` carried on `REFER_TO_UNITS`, raised
   * from the coordinator's shortlist panel — so on this screen the honest affordance is a route to
   * that screen, and the assertion now requires the affordance to actually GO somewhere.
   */
  it("never presents a refusal as a block — an override is offered wherever one is refused", () => {
    renderScreen();
    /*
     * ⚠️ MERGE 01 MOVED THIS BEHIND SELECTION. "declined" and the Override link both live on the
     * full `DelayRow`, which now renders for the SELECTED person only ("The person you have
     * chosen"), not on every row at once. So this walks every open movement with a refusal,
     * selecting each in turn, rather than scanning the whole page for "declined" text the way it
     * did when every row's full record rendered simultaneously.
     */
    const refused = wardMovements.filter((movement) => isOpen(movement) && movement.declines.length > 0);
    expect(refused.length, "no refusal rendered — this guard proved nothing").toBeGreaterThan(0);
    for (const movement of refused) {
      const panel = selectPerson(movement.id);
      // Scoped to "N declined" rather than a bare /declined/ — the panel also shows prose like
      // "the last thing recorded was a ward declined" (`lastRecordedActivity`), which contains the
      // same word and would otherwise make this an ambiguous, multi-match query.
      expect(within(panel).getByText(/\d+ declined/u), `${movement.id}'s refusal is not stated`).toBeInTheDocument();
      const offer = within(panel).getByRole("link", { name: /Override/u });
      expect(
        offer.getAttribute("href"),
        "the override affordance leads nowhere — a control that looks actionable and is not is worse " +
          "than none, because a coordinator presses it and believes something happened",
      ).toBeTruthy();
    }
  });

  /*
   * 🔴 **AN href IS NOT AN ARRIVAL, AND THE GUARD ABOVE CANNOT TELL THE DIFFERENCE.** Found
   * 2026-09-06 by clicking the link in a browser rather than by reading either file: it landed on
   * the coordinator screen showing *"Select a movement from the priority queue to see its
   * explainable shortlist"* — **right screen, no patient, 43 people in that queue.** The guard above
   * was green before and after, because it asks whether the affordance has a destination.
   *
   * ⚠️ **THE REASON IS WORTH KNOWING BECAUSE IT WILL RECUR.** `CoordinatorScreen` reads NO search
   * params — `grep useSearchParams` over `coordinator/` returns nothing. Its selection is `useState`
   * seeded from the shared `focusMovementId`. So a URL cannot carry a patient to that screen, and a
   * plain `<Link>` never could have: **the only channel is the one this test observes.**
   *
   * ⚠️ **THIS ASSERTS THE ARRIVAL, NOT THE onClick.** The probe reads the same context value the
   * destination seeds itself from, so replacing the handler with any other mechanism that sets it
   * keeps this green, and removing the mechanism turns it red no matter how live the link looks.
   */
  it("carries the patient to the coordinator screen, because a URL cannot", () => {
    renderScreenWithProbe();

    const probe = screen.getByTestId("focus-probe");
    expect(
      probe.textContent,
      "the fixture already had somebody focused, so this test could not tell a working link from a " + "dead one",
    ).toBe("nobody");

    /*
     * ⚠️ MERGE 01 MOVED THE OVERRIDE LINK BEHIND SELECTION — it now renders only inside the full
     * `DelayRow`, for whoever is chosen in the selected-person panel (task D1: titled "Nobody
     * selected" or "Why this person is waiting", depending on state), so a patient carrying a
     * refusal has to be selected before the link exists at all.
     */
    const refused = wardMovements.filter((movement) => isOpen(movement) && movement.declines.length > 0);
    expect(refused.length, "no refusal rendered — this guard proved nothing").toBeGreaterThan(0);
    const panel = selectPerson(refused[0].id);

    const offers = within(panel).getAllByRole("link", { name: /Override/u });
    expect(offers.length, "no override affordance rendered — this guard proved nothing").toBeGreaterThan(0);

    // The row this affordance belongs to, read from the row rather than assumed from fixture order.
    const row = offers[0].closest("[data-ward-primitive='record-row']");
    expect(row, "an override affordance rendered outside a record row").not.toBeNull();
    const id = (row as HTMLElement).getAttribute("data-record-key")?.trim();
    expect(id, "the row carries no record id, so there is nothing to compare the arrival against").toBeTruthy();

    fireEvent.click(offers[0]);

    expect(
      screen.getByTestId("focus-probe").textContent,
      `pressing "override a refusal" for ${id} leaves the coordinator screen seeded with ` +
        `"${screen.getByTestId("focus-probe").textContent}" — a coordinator arrives at a queue of ` +
        `${OPEN_COUNT} open movements and has to find the person again, or worse, acts on whoever ` +
        `was selected last`,
    ).toBe(id);
  });

  /*
   * 🔴 **A LAPSED BED PULL MUST OFFER ITS NEXT STEP — owner-approved 2026-09-06.** The exceptions
   * inbox this screen replaced offered "reconfirm or release bed pull"; this screen named the delay
   * and stopped, so a bed could stay held for somebody who may never arrive with nothing on screen
   * suggesting otherwise.
   *
   * The route is asserted, not the wording: it must lead to the ward actually holding the bed,
   * because that is where `RELEASE_PULL`'s control and the owner's four-reason picker live.
   */
  it("offers a route to release a bed pull that has expired, pointing at the ward holding the bed", () => {
    const expired = wardMovements.filter(
      (movement) =>
        isOpen(movement) &&
        movement.stage === "pulled" &&
        movement.pullExpiresAt !== undefined &&
        movement.pullExpiresAt < NOW_ANCHOR,
    );
    expect(
      expired.map((movement) => movement.id),
      "no movement has an expired bed pull in this fixture, so this guard would prove nothing",
    ).not.toEqual([]);

    renderScreen();
    // The release action is on the full `DelayRow`, which now renders only for whoever is
    // selected — see `selectPerson`'s own comment for why the panel scoping matters here.
    for (const movement of expired) {
      const panel = selectPerson(movement.id);
      const link = within(panel).getByTestId(`delays-release-pull-${movement.id}`);
      expect(
        link.getAttribute("href"),
        `${movement.id}'s lapsed pull links nowhere, or to a ward other than the one holding its bed`,
      ).toBe(`/mockups/ward-flow/ward/${movement.acceptedUnitId}`);
    }
  });

  /**
   * ⚠️ **AN ABSENCE IS STATED, NEVER BLANK** — rule five of the design language. An empty panel that
   * merely renders nothing reads as a bug, and on THIS screen it reads as "nothing is wrong in that
   * category", which is the same falsehood an empty group heading tells one level up.
   */
  it("states its two absences in words rather than rendering an empty panel", () => {
    renderScreen();
    const noPerson = screen.getByRole("region", { name: /Delays with no named person/u });
    expect(noPerson).toHaveTextContent(/records delays only against a movement/u);
    expect(noPerson).toHaveTextContent(/Ward-wide closures and transport outages are not represented/u);

    /*
     * ⚠️ "Resolved today" MOVED OUT OF ITS OWN PANEL. It is now a TAB inside the panel titled
     * "Escalations and resolved" (renamed from "Registers", task D1), alongside "Escalations",
     * and its absence sentence only renders once that tab is the active pane.
     */
    fireEvent.click(screen.getByRole("tab", { name: /Resolved today/u }));
    const resolved = screen.getByRole("tabpanel");
    expect(resolved).toHaveTextContent(/Kept until midnight for handover/u);
  });

  /**
   * ⚠️ **THE COUNT SLOT MUST NOT CLAIM A MEASUREMENT HAPPENED.** `count="none"` used to sit beside
   * this panel's title — a hard-coded literal nothing computed, for a kind of delay the data model
   * cannot represent (owner ruling, 2026-09-07; see `delays-screen.tsx`). The fix removes the slot
   * rather than filling it with different words, because any string there — "none", "n/a",
   * "not tracked" — still occupies the position a real count occupies elsewhere on this screen
   * (`"Who is waiting, and on what"` reads `${shown} of ${open.length} shown` there) and so still
   * reads as an answer to "how many", which is exactly the false claim being corrected. This
   * asserts the badge itself is absent, not merely that its old wording changed.
   */
  it("does not present a computed zero in the 'no named person' panel's count slot", () => {
    renderScreen();
    const noPerson = screen.getByRole("region", { name: /Delays with no named person/u });
    expect(noPerson.querySelector("[data-ward-panel-count]")).toBeNull();
  });

  /**
   * STRUCTURAL GUARD FOR THE PANEL'S PREMISE — driven against the actual population every producer
   * contributes to `wardMovements` (`ward-movements.ts`'s twenty hand-authored movements plus its
   * thirty generated ones), not read from the type.
   *
   * The panel's copy says this model cannot record a delay with no person behind it, because
   * `Movement.owner` (`ward-model.ts`) is a required, non-optional `string` that every producer
   * sets. This test is the runtime half of that claim: it goes red the moment any producer stops
   * setting a non-empty `owner`, which is the realistic way an ownerless delay would actually start
   * appearing.
   *
   * ⚠️ **WHAT THIS DOES NOT DETECT.** Widening `Movement["owner"]` to `string | undefined` in the
   * TYPE does not, by itself, change what any existing producer emits at runtime — nothing here
   * forces a literal owner string to become empty just because the field became optional — so this
   * test would keep passing through that change alone. The type-level check immediately below is
   * what catches that half; it fails `npm run typecheck` rather than `vitest`, because vitest's
   * esbuild transform does not typecheck (see the correction atop `delays-derivations.ts`). Neither
   * check can see a wholly new delay concept introduced OUTSIDE `Movement` — both only prove that
   * this model's one existing carrier of a delay always names somebody. `delayGroups()`
   * (`delays-derivations.ts`) takes only a `Movement[]`, so a second delay source would first have
   * to change that signature, which is itself a typechecked surface.
   */
  it("every movement this model can currently produce already has a non-empty owner", () => {
    expect(wardMovements.length).toBeGreaterThan(0);
    for (const movement of wardMovements) {
      expect(movement.owner, `${movement.id} has no owner`).toBeTruthy();
    }
  });

  /**
   * Type-level half of the guard above. `[undefined] extends [Movement["owner"]]` is `false` while
   * `owner` stays a required `string`, so `OwnerMustStayRequired` is `true` and the assignment below
   * typechecks. The day `owner` gains a `?` in `ward-model.ts`, `Movement["owner"]` becomes
   * `string | undefined`, the extends check flips, `OwnerMustStayRequired` becomes `never`, and this
   * assignment stops compiling — caught by `npm run typecheck`, not by running this test file.
   */
  it("Movement.owner stays a required, non-optional string (typecheck-enforced)", () => {
    type OwnerMustStayRequired = [undefined] extends [Movement["owner"]] ? never : true;
    const ownerIsRequired: OwnerMustStayRequired = true;
    expect(ownerIsRequired).toBe(true);
  });

  /**
   * ⚠️ **THE SCREEN MUST NOT SAY "waiting waiting", AND NOTHING ELSE HERE WOULD CATCH IT.** Every
   * other assertion on this screen checks a duration is PRESENT. `elapsedLabel` already ends in the
   * word, so composing it with a following word or a sub-label produced "7h 00m waiting waiting."
   * and a clock reading "7h 00m waiting" above a label reading "in ED". Both shipped green.
   */
  it("never doubles the word a duration already carries", () => {
    const { container } = renderScreen();
    const text = (container.textContent ?? "").replace(/\s+/gu, " ");
    expect(text, "a duration is composed with a word it already contains").not.toMatch(/waiting waiting/u);
    expect(text, "the clock carries the word its own sub-label supplies").not.toMatch(/waitingin ED/u);
  });

  /**
   * 🔴 **THE THREE FIELDS THE FOLD WOULD OTHERWISE HAVE DELETED.** `movement.escalation` carries
   * `at`, `triedUnitIds` and `contact`, and the escalation board is the ONLY surface in the app
   * that has ever rendered them — neither the priority queue nor `buildActionInbox` reads
   * `movement.escalation` at all. Folding that board in without carrying these three removes them
   * from the product while every test stays green, which is why this assertion exists at all.
   */
  it("carries all three escalation facts onto the row: when, who to, and which wards were tried", () => {
    renderScreen();
    const escalated = wardMovements.filter((movement) => isOpen(movement) && movement.escalation !== undefined);
    expect(escalated.length, "no escalated movement in the fixture — this guard proved nothing").toBeGreaterThan(0);

    /*
     * ⚠️ THIS IS AN "EVERY ROW" GUARD, AND THE DETAIL PANEL NOW SHOWS ONE PERSON AT A TIME. Weakening
     * it to check a single escalated movement would not have caught the original defect this test
     * exists for — the escalation facts vanishing from the product while every test stayed green —
     * because a single-person check cannot tell "this one person's facts survived" from "every
     * person's facts survived". So this still walks every escalated movement; it just SELECTS each
     * one before reading its facts, instead of reading every row at once the way it did when every
     * full record rendered simultaneously.
     */
    for (const movement of escalated) {
      const panel = selectPerson(movement.id);
      const note = within(panel).getByTestId("delays-escalation");

      expect(note, `the escalation time is missing for ${movement.id}`).toHaveTextContent(/Escalated/u);
      expect(note, `who it was escalated to is missing for ${movement.id}`).toHaveTextContent(
        movement.escalation?.contact ?? "",
      );
      // Every ward tried, by NAME rather than by id — an id is not a fact a coordinator can use.
      expect(within(note).getAllByTestId("delays-tried-unit")).toHaveLength(
        movement.escalation?.triedUnitIds.length ?? 0,
      );
    }
  });

  /**
   * 🔴 AUDIT RESTORE 1. `movement.blocker` is the single most useful sentence the old priority
   * queue showed and this screen dropped entirely. It is a REQUIRED string on every movement and
   * is never actually `""` — a movement with nothing holding it up carries one of
   * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` ("No blocker", "None — in transit", …) instead, so this
   * asserts against that closed set rather than against a literal empty string, the same
   * distinction `ward-priority.ts`'s own `hasActiveBlocker` and `ward-flow-reducer.ts` both draw.
   */
  it("restores the blocker sentence onto the row, but only when something actually names an obstruction", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    const withActiveBlocker = openMovements.filter((movement) => {
      const trimmed = movement.blocker.trim();
      return trimmed !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === trimmed);
    });
    expect(
      withActiveBlocker.length,
      "no open movement carries an active blocker — this guard proved nothing",
    ).toBeGreaterThan(0);

    // Every "row" walk below selects the movement in question first — the blocker annotation now
    // renders only on the full `DelayRow` inside the selected-person panel (see `selectPerson`).
    for (const movement of withActiveBlocker) {
      const panel = selectPerson(movement.id);
      expect(within(panel).getByTestId("delays-blocker")).toHaveTextContent(movement.blocker.trim());
    }

    const withoutActiveBlocker = openMovements.filter((movement) => !withActiveBlocker.includes(movement));
    expect(
      withoutActiveBlocker.length,
      "no open movement lacks an active blocker — this half of the guard proved nothing",
    ).toBeGreaterThan(0);
    for (const movement of withoutActiveBlocker) {
      const panel = selectPerson(movement.id);
      expect(within(panel).queryByTestId("delays-blocker")).toBeNull();
    }
  }, 90_000);

  /** 🔴 AUDIT RESTORE 2 and 3. Who is responsible for the delay, and the clinician's own urgency
   * tier — both on `Movement` already, both dropped by the fold, neither needing a new derivation.
   * The urgency text is the app's one shared spelling (`urgencyTierLabel`), never a bare digit or
   * an invented "P1"/"P2"/"P3" badge, so a coordinator reading this row and the referral board
   * read the same words for the same tier. */
  it("restores who owns the delay and the clinician's urgency tier onto every row", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    /*
     * ⚠️ THIS IS AN "EVERY ROW" GUARD, AND THE DETAIL PANEL NOW SHOWS ONE PERSON AT A TIME. Checking
     * a single movement would not distinguish "this one survived" from "every one survived" — which
     * is exactly the distinction that matters, since these two facts were once silently dropped for
     * everybody while the fixture kept some green test passing on the movement it happened to check.
     * So this still walks every open movement; it selects each one first, because the full record
     * carrying "Owner: …" and the urgency tier now renders only for whoever is chosen.
     */
    for (const movement of openMovements) {
      const panel = selectPerson(movement.id);
      expect(panel, `Owner missing for ${movement.id}`).toHaveTextContent(`Owner: ${movement.owner}`);
      expect(panel, `urgency tier missing for ${movement.id}`).toHaveTextContent(urgencyTierLabel(movement.urgency));
    }
  }, 90_000);

  /** 🔴 AUDIT RESTORE 4. The movement's own stage, in the one label every other screen already uses
   * (`stageCopy`) rather than a second copy of the same mapping. */
  it("restores the movement's stage onto every row, using the existing stageCopy label", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    // Another "every row" guard against the detail panel's one-at-a-time surface — see the comment
    // on the owner/urgency-tier test above for why this stays a full walk rather than one sample.
    for (const movement of openMovements) {
      const panel = selectPerson(movement.id);
      expect(panel, `stage missing for ${movement.id}`).toHaveTextContent(stageCopy[movement.stage].label);
    }
  }, 90_000);

  /**
   * 🔴 AUDIT RESTORE 5. The origin department's NAME, resolved via the same `edById` lookup every
   * other ward surface uses — never the raw id, and an unresolved id states its own absence rather
   * than rendering a blank (the same discipline `escalation-board.tsx`'s `departmentLabel` holds
   * to for this exact lookup).
   */
  it("restores the origin department's name onto every row, by name and never by id", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    // ⚠️ The fallback half of `expected` below is never actually exercised against this fixture —
    // measured, task D1: all 50 seeded movements resolve. It is kept in the same wording as the
    // component's (see `delays-screen.tsx`'s `originLabel`) so this test cannot silently drift from
    // it; `tests/ward-delays-third-edition.dom.test.tsx` is what actually reaches this branch, with
    // a hand-built dangling `originEdId` the seed cannot produce.
    for (const movement of openMovements) {
      const panel = selectPerson(movement.id);
      const originEd = edById(movement.originEdId);
      const expected = originEd
        ? originEd.name
        : `This movement names a department we cannot find: "${movement.originEdId}"`;
      expect(panel, `origin department missing or wrong for ${movement.id}`).toHaveTextContent(expected);
    }
  }, 90_000);

  /**
   * 🔴 AUDIT RESTORE 6. The escalation board showed WHEN an escalation happened both ways —
   * relative ("2h ago") and absolute (`formatInstantWithDay`) — and the merge kept only the
   * relative half, which loses the moment it actually happened.
   */
  it("restores the absolute escalation time alongside the relative age", () => {
    renderScreen();
    const escalated = wardMovements.filter((movement) => isOpen(movement) && movement.escalation !== undefined);
    expect(escalated.length, "no escalated movement in the fixture — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of escalated) {
      const panel = selectPerson(movement.id);
      const note = within(panel).getByTestId("delays-escalation");
      const absolute = formatInstantWithDay(movement.escalation!.at, NOW_ANCHOR);
      expect(note, `absolute escalation time missing for ${movement.id}`).toHaveTextContent(absolute);
    }
  });

  /**
   * 🔴 AUDIT RESTORE 7 — NOT COVERABLE AGAINST THE SHARED FIXTURE, RECORDED RATHER THAN FAKED.
   *
   * "An absence is stated, never blank" (this screen's own fifth design rule) means an escalation
   * with zero tried units must say "No units recorded" instead of rendering nothing after "tried".
   * The code path exists (`delays-screen.tsx`'s `DelayRow`, mirroring `escalation-board.tsx`'s own
   * `triedUnitsLabel`), but `wardMovements` (ward-movements.ts) carries exactly one `escalation`
   * record and it has non-empty `triedUnitIds` — grepped, not assumed. `WardFlowProvider` has no
   * seam to inject a different movement list, and `ward-movements.ts` belongs to another owner in
   * this task's scope. A test asserting `escalatedNoUnitsTried.length > 0` against today's fixture
   * is not a weak assertion to strengthen; the population is genuinely zero, so the honest report is
   * "unverified", not a test manufactured to pass. Left here as a note rather than a green test that
   * would prove nothing (the same failure this file's own floor-the-population rule exists to catch).
   */
});

/**
 * 🔴 **TASK 1, 2026-09-07 — THE FILTER CHIPS RENDERED PRESSED, CARRIED REAL COUNTS, AND DID
 * NOTHING WHEN CLICKED.** `onChange={() => {}}` looked exactly like a working control. This
 * proves a click actually narrows who is shown, that the panel header — `${shown} of
 * ${open.length} shown` — follows the filter, and that a cause the filter empties entirely loses
 * its heading rather than crashing the screen on `WardGroupHeading`'s own "count of nought"
 * refusal (`delayGroups` already drops a cause with nobody in it — filtering on top of that can
 * empty a cause that arrived non-empty, and dropping it a second time, after this screen's own
 * filter runs, is the trap this task's brief names by name).
 */
describe("the Delays chips MARK who is shown, and never hide anybody", () => {
  const units = allUnits();
  const open = seededMovements.filter(isOpen);
  const baselineGroups = delayGroups(seededMovements, units, NOW_ANCHOR);
  const allOpenIds = open.map((movement) => movement.id).sort();

  /**
   * 🔴 **THIS BLOCK ASSERTED THE OPPOSITE UNTIL 2026-09-07, AND BOTH VERSIONS WERE HONEST TESTS.**
   *
   * It used to be called *"the Delays filter chips actually filter who is shown"*, and it proved —
   * correctly, against the code of the day — that pressing a chip REMOVED every non-matching row
   * and dropped any cause heading the removal emptied. That was a real guard over real behaviour.
   *
   * ⚠️ **The behaviour was then ruled wrong by the owner**, who extended his Capacity ruling to
   * this screen: *a chip highlights, it never hides.* On a bed board a filtered-out patient and a
   * placed patient look identical, and the coordinator has no way to tell which they are looking at.
   *
   * ⚠️ **SO THE INVERSION BELOW IS A RULING BEING RECORDED, NOT A TEST BEING RELAXED**, and it is
   * written down here because a test expectation flipped in a merge is indistinguishable from a
   * test expectation flipped by accident. The floors are deliberately STRONGER than the ones they
   * replace: the old tests could pass on a screen that showed too few people, and these cannot.
   */
  it("keeps every person and every heading on screen when a chip is pressed", () => {
    const locked = open.filter((movement) => movement.security === "Secure");
    // Anti-vacuity floors, unchanged in spirit from the hide-era tests: the mark must have
    // something to pick out, and must NOT pick out everybody, or "marks a subset" is unprovable.
    expect(locked.length, "no open movement needs a locked bed in this fixture").toBeGreaterThan(0);
    expect(locked.length, "every open movement needs a locked bed in this fixture").toBeLessThan(open.length);
    // The case that used to prove the old behaviour now proves the new one: a cause with NO locked
    // member is exactly the heading the old code deleted, so it is the sharpest place to check that
    // nothing is deleted any more.
    const emptiedUnderTheOldRule = baselineGroups.filter(
      (group) => !group.movements.some((movement) => movement.security === "Secure"),
    );
    expect(
      emptiedUnderTheOldRule.length,
      "no cause is free of locked-bed patients — the heading-survival check is vacuous here",
    ).toBeGreaterThan(0);

    renderScreen();
    const chip = screen.getByRole("button", { name: `Needs a locked bed ${locked.length}` });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    // Renamed from "Who is waiting, and on what" to "Who is waiting" in the three-column rebuild,
    // then to "Waiting" — the drawing's own word — in task D1.
    const region = screen.getByRole("region", { name: "Waiting" });
    const renderedIds = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"][data-record-key]'))
      .map((el) => el.getAttribute("data-record-key"))
      .sort();
    expect(renderedIds, "pressing a chip removed somebody from the board").toEqual(allOpenIds);

    /*
     * ⚠️ THE HEADING MOVED, NOT JUST THE REGION IT SITS IN. Cause headings are no longer drawn with
     * `WardGroupHeading` inside this list at all — they moved to the middle "What the blocker is"
     * panel, as a `data-testid="delays-cause-<cause>"` row rather than an `<h3>`. That panel is built
     * from `groups` alone and is never touched by `delayFilterId`/`markedOwner`, so the property this
     * test guards — a chip press cannot make a cause heading disappear — now holds even more
     * directly than before: nothing here can filter that panel's rows at all. Checked by testid,
     * globally, rather than `within(region)` by role, because the heading no longer lives in the
     * region this test presses the chip inside of.
     */
    for (const group of emptiedUnderTheOldRule) {
      expect(
        screen.getByTestId(`delays-cause-${group.cause}`),
        `"${group.title}" has no locked-bed patient and must STILL be headed — the old code dropped it`,
      ).toBeInTheDocument();
    }
  });

  it("names the mark on the matching rows, and on those rows only", () => {
    const escalated = open.filter((movement) => movement.escalation !== undefined);
    expect(escalated.length, "no escalated movement in this fixture").toBeGreaterThan(0);
    expect(escalated.length, "every open movement is escalated in this fixture").toBeLessThan(open.length);

    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: `Escalated ${escalated.length}` }));

    // Renamed from "Who is waiting, and on what" to "Who is waiting" in the three-column rebuild,
    // then to "Waiting" — the drawing's own word — in task D1.
    const region = screen.getByRole("region", { name: "Waiting" });
    // Everybody is still drawn, and the mark is carried by a WORD rather than by a tint — the
    // property that makes this a highlight a coordinator can read rather than a colour they must
    // interpret. `WardChip` refuses a wordless child, so a colour-only mark cannot be built here.
    const rows = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]'));
    expect(rows.length, "the board lost rows when a chip was pressed").toBe(open.length);

    // `Set<string>`, not the inferred `Set<`WF-${string}`>` — the ids read back out of the DOM are
    // plain strings, and a branded set would refuse them at the typecheck the test runner never runs.
    const escalatedIds = new Set<string>(escalated.map((movement) => movement.id));
    let markedRows = 0;
    for (const row of rows) {
      const id = (row.getAttribute("data-record-key") ?? "");
      const saysMarked = (row.textContent ?? "").includes("Marked: Escalated");
      if (escalatedIds.has(id)) {
        expect(saysMarked, `${id} is escalated and the pressed chip must name it as marked`).toBe(true);
        markedRows += 1;
      } else {
        expect(saysMarked, `${id} is NOT escalated and must not be marked`).toBe(false);
      }
    }
    expect(markedRows, "no row carried the mark — the chip is not wired").toBe(escalated.length);
  });

  it("reports the marked figure and the whole population as two separate numbers", () => {
    const escalated = open.filter((movement) => movement.escalation !== undefined);
    renderScreen();
    // Renamed from "Who is waiting, and on what" to "Who is waiting" in the three-column rebuild,
    // then to "Waiting" — the drawing's own word — in task D1.
    const region = screen.getByRole("region", { name: "Waiting" });
    const count = () => region.querySelector("[data-ward-panel-count]")?.textContent;

    // ⚠️ Unmarked, the header states ONE figure. A second number here would read as "0 marked",
    // which is a measured nought over a control nobody has touched. The word "waiting" that used to
    // sit beside the bare figure is gone from this slot — the panel's own title now reads "Who is
    // waiting", so the count no longer repeats it; the property this test guards (one figure, never
    // a false second one) is unchanged.
    expect(count()).toBe(`${open.length}`);

    fireEvent.click(screen.getByRole("button", { name: `Escalated ${escalated.length}` }));
    // ⚠️ TWO figures, because one count cannot carry two meanings — `capacity-screen.tsx` found
    // this the hard way. "N shown" is true while a control hides things and becomes a lie the
    // moment it only marks them.
    expect(count()).toBe(`${escalated.length} of ${open.length} marked \u00b7 Escalated`);
  });
});

describe("Wave 4 item 15 — Delays alias pedagogy banners", () => {
  it("names the Queue bookmark when aliasFrom is queue", () => {
    renderScreen("queue");
    const banner = screen.getByTestId("ward-delays-alias-banner");
    expect(banner).toHaveAttribute("data-from", "queue");
    expect(banner).toHaveTextContent("Opened from a Queue bookmark — that board is now Delays.");
  });

  it("dismisses the alias banner without leaving the Delays board", () => {
    renderScreen("exceptions");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("ward-delays-alias-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-delays-page")).toBeInTheDocument();
  });

  it("shows no alias banner on a direct Delays open", () => {
    renderScreen(null);
    expect(screen.queryByTestId("ward-delays-alias-banner")).not.toBeInTheDocument();
  });
});
