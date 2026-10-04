import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { panelTitlesInOrder } from "./helpers/ward-panels";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isOpen, searchMovements } from "@/components/ward-management/ward-derivations";
import { journeyStages } from "@/components/ward-management/movements/movements-derivations";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * TASK D1 — the Delays screen's panel names must read exactly as
 * `docs/ward-flow/mockups/delays-third-edition.html` draws them, and its two dangling-`originEdId`
 * sentences must name the RECORD as the fault rather than the network. Both halves are guarded
 * here because neither was reachable from an existing suite: the panel renames have no prior
 * test at all, and the dangling-id sentence's branch is never entered by the shared seed — measured
 * across all 50 seeded movements, zero carry an unresolvable `originEdId`.
 */

const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

/**
 * The panel titles this screen renders, in DOCUMENT order — read from `WardPanel`'s own
 * `data-ward-primitive="panel"` marker and its `aria-label` (which IS the title, by construction;
 * see `ward-panel.tsx`) rather than from heading text, so the check does not depend on which
 * heading level a panel happens to use.
 */

/**
 * A MINIMAL, VALID `Movement` carrying a deliberately DANGLING `originEdId` — every required field
 * on `Movement` (`ward-model.ts`), none of the optional ones, mirroring the same base literal
 * `tests/ward-delays-derivations.test.ts` already uses and typechecks. Built by hand rather than by
 * cloning a seeded movement because the ONE thing this fixture is about is the unresolvable id, and
 * a hand-built minimal object makes that the whole story rather than one property among fifty
 * inherited ones.
 *
 * ⚠️ **THE SEED CANNOT TEST THIS BRANCH AT ALL.** Measured: across all 50 seeded movements there
 * are zero unresolvable `originEdId` values, so a test rendering `wardMovements` would never enter
 * the fallback branch and would pass however that branch is worded. This fixture exists so the
 * branch is actually reached — checked below, before the wording is asserted at all.
 */
const DANGLING_ED_ID = "ED-DOES-NOT-EXIST-9999";
const DANGLING_MOVEMENT: Movement = {
  id: "WF-TEST-DANGLING",
  originEdId: DANGLING_ED_ID,
  openedAt: NOW - 500,
  flaggedUrgent: false,
  urgency: 1,
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
  owner: "ED mental health team",
  referredUnitIds: [],
  declines: [],
  blocker: "No blocker",
  withdrawnReferrals: [],
  unwinds: [],
  stageChanges: [],
};

describe("Delays — the drawing's panel names (task D1)", () => {
  /**
   * Catcher item 1 — every heading the drawing carries for this screen, present in the drawing's
   * OWN order, not merely present somewhere on the page. Order matters here because two adjacent
   * renames ("Waiting" beside "What the blocker is") could each individually be present while the
   * drawing's actual sequence was silently reshuffled.
   *
   * Nobody is selected on a fresh render, so the state-dependent panel (see the next `describe`)
   * is expected here as "Nobody selected".
   */
  it("renders the drawing's panels, in the drawing's order", () => {
    renderScreen();
    expect(panelTitlesInOrder()).toEqual([
      "Wait timeline",
      "Who is holding people up",
      "Waiting",
      "What the blocker is",
      "Escalations and resolved",
      "Delays with no named person",
    ]);

    // When a person is selected, "Why this person is waiting" appears
    const [firstSelectButton] = screen.getAllByTestId(/^delays-select-/u);
    fireEvent.click(firstSelectButton);
    expect(panelTitlesInOrder()).toEqual([
      "Wait timeline",
      "Who is holding people up",
      "Waiting",
      "Why this person is waiting",
      "What the blocker is",
      "Escalations and resolved",
      "Delays with no named person",
    ]);
  });

  /**
   * The "Escalations and resolved" panel's three tabs: Escalations, Attention, Resolved today.
   */
  it("carries the register tabs in order", () => {
    renderScreen();
    const tabs = within(screen.getByRole("tablist", { name: "Registers" })).getAllByRole("tab");
    expect(tabs.length, "the register tabs did not render — this guard proves nothing").toBe(3);
    expect(tabs[0]).toHaveTextContent(/Escalations/u);
    expect(tabs[1]).toHaveTextContent(/Attention/u);
    expect(tabs[2]).toHaveTextContent(/Resolved today/u);
  });

  /**
   * 🔴 **Q-12 — these items are NOT in the drawing, and the owner ruled they are never
   * dropped.** That is the whole reason this test exists: the drawing shows two register tabs and
   * carries neither "Worth your attention" nor the provenance panel, so a rebuild working TOWARDS
   * the drawing sheds exactly these. It has already happened once.
   *
   * ⚠️ **THE CITATION ITSELF IS LOAD-BEARING AND WAS LOST ONCE, ON 2026-09-18.** An
   * unidentified writer rewrote this file; `grep -c "Q-12"` went 2 → 0 while the assertions
   * kept working. A guard that still does its job but no longer says on whose authority is one
   * tidy-up away from being simplified by somebody who cannot see what it defends. Restored on the
   * owner's instruction — **do not remove the identifier, even if the assertions change.**
   *
   * ✅ **WHAT THE OWNER DID CHANGE, 2026-09-18: the FORM of one item.** "Worth your attention"
   * is now the "Attention" tab of the three-tab register rather than its own panel, and he chose
   * that over restoring the panel when both were offered. Q-12 is satisfied by the item being
   * present and reachable with its count shown — not by it being a `region`. The provenance
   * panel, by contrast, was restored as a panel.
   */
  it("keeps the Q-12 items: the 'Attention' tab and 'Delays with no named person' (provenance panel removed per owner instruction 2026-09-21)", () => {
    renderScreen();
    expect(screen.getByRole("tab", { name: /Attention/u })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Delays with no named person" })).toBeInTheDocument();
  });
});

describe("Delays — the selected-person panel (task D1)", () => {
  it("keeps the detail panel closed before anybody is chosen", () => {
    renderScreen();
    expect(screen.queryByRole("region", { name: "Nobody selected" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Why this person is waiting" })).toBeNull();
  });

  it("reads 'Why this person is waiting' once somebody is chosen", () => {
    renderScreen();
    const [firstSelectButton] = screen.getAllByTestId(/^delays-select-/u);
    expect(firstSelectButton, "no selectable person rendered — this guard proves nothing").toBeDefined();
    fireEvent.click(firstSelectButton);
    expect(screen.getByRole("region", { name: "Why this person is waiting" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nobody selected" })).toBeNull();
  });
});

describe("Delays — the dangling-originEdId sentence names the record, not the network (task D1)", () => {
  it("fixture precondition: the chosen originEdId genuinely does not resolve, or this whole suite is vacuous", () => {
    expect(
      edById(DANGLING_ED_ID),
      "the fixture's originEdId unexpectedly resolves to a real department — pick a different one",
    ).toBeUndefined();
  });

  it("reaches the fallback branch at all, then states the record — not the network — is at fault, with the id visible, at both sites", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <DelaysScreen movements={[DANGLING_MOVEMENT]} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`delays-select-${DANGLING_MOVEMENT.id}`));

    const detailPanel = screen.getByTestId(`delays-detail-${DANGLING_MOVEMENT.id}`);

    /*
     * ⚠️ THE REACHED-THE-BRANCH ASSERTION, FIRST — before anything about wording. This proves the
     * fixture's dangling id actually surfaces somewhere in the detail panel at all, so a pass below
     * cannot be "the branch was never entered and the assertion below happened to still hold".
     */
    expect(
      within(detailPanel).getByText(new RegExp(DANGLING_ED_ID, "u")),
      "the dangling originEdId never appears in the detail panel — the fallback branch was not reached",
    ).toBeInTheDocument();

    // Site 1 — `SelectedPerson`'s "From" field.
    expect(
      within(detailPanel).getByText(`This movement names a department we cannot find: "${DANGLING_ED_ID}"`),
    ).toBeInTheDocument();

    // Site 2 — `DelayRow`'s attribute list ("from …"), identical wording, no drift between the two.
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain(`from This movement names a department we cannot find: "${DANGLING_ED_ID}"`);

    // Neither site may still carry the old, network-blaming wording.
    expect(bodyText).not.toContain("No department matches");
  });
});

/**
 * 🔴 **D3's THIRD PARAGRAPH MAKES A CLAIM ABOUT A SCREEN THIS FILE DOES NOT RENDER, AND UNTIL NOW
 * NOTHING COULD HOLD IT TRUE.**
 *
 * The sentence, live on the Delays screen:
 *
 *     "The Movement screen keeps closed movements on its stage board; this screen does not,
 *      and search here refuses them."
 *
 * ⚠️ **The existing assertion over that sentence checks its WORDS.** A change to the Movement
 * screen would falsify it and the words would still be there — **a presence assertion over a claim
 * about another screen proves the claim was TYPED, never that it is TRUE.** The truth lived in
 * `movements-derivations.ts`, a file the Delays suite never imported, and it was noticed only
 * because both screens happened to belong to one lane. **If they ever split, nothing connects them.**
 *
 * 🔴 **SO THIS ASSERTS THE PROPERTY, FROM THE DELAYS SIDE, AND A CHANGE ON THE MOVEMENT SCREEN
 * REDDENS A DELAYS TEST.**
 *
 * ⚠️ **AND THE CITATION TRAVELS WITH IT, because whoever makes this red needs to know why it is
 * load-bearing rather than be invited to relax it.** The Movement screen keeping closed movements
 * is **an owner ruling, not an oversight**: shown the `WF-008` row rendering as still-waiting with a
 * running clock, the record, and three options, he ruled on **2026-09-05 — "MARK IT, DO NOT FILTER
 * IT"**, because a move having been abandoned is exactly what a board like that is for.
 *
 * 🔴 **If this test is red because the Movement screen now filters, the FIX IS NOT HERE.** Either
 * that ruling has been reversed by the owner — in which case D3's sentence must change on this
 * screen in the same commit — or it has been reverted by accident, which is what this exists to
 * catch. **Do not delete the assertion to make the suite green.**
 */
describe("D3's cross-screen sentence — the property it claims, not the words it uses", () => {
  const BASE: Movement = { ...DANGLING_MOVEMENT, originEdId: "rph-ed", stage: "accepted_awaiting_bed" };
  const STILL_OPEN: Movement = { ...BASE, id: "WF-TEST-OPEN" };
  const CLOSED: Movement = {
    ...BASE,
    id: "WF-TEST-CLOSED",
    closure: { at: NOW - 20, outcome: "did_not_proceed", reason: "Left before transport was arranged" },
  };

  /**
   * The fixture's own preconditions. Without these three, every assertion below can pass for
   * reasons that have nothing to do with either screen — a fixture that is not actually closed,
   * or that carries no stage, tests neither half of the sentence.
   */
  it("has a fixture that can actually distinguish the two screens", () => {
    expect(isOpen(STILL_OPEN), "the open fixture is not open — the inclusion assertions are vacuous").toBe(true);
    expect(isOpen(CLOSED), "the closed fixture is not closed — the exclusion assertions are vacuous").toBe(false);
    expect(CLOSED.stage, "the closed fixture carries no stage, so the stage board could not show it either way").toBe(
      "accepted_awaiting_bed",
    );
  });

  it("half 1 — the Movement screen's stage grouping keeps a closed movement (owner ruling, 2026-09-05)", () => {
    const stages = journeyStages([STILL_OPEN, CLOSED], NOW);
    const group = stages.find((stage) => stage.id === "accepted_awaiting_bed");
    expect(group, "no group for the fixture's stage — the grouping changed shape").toBeDefined();
    expect(
      group?.movements.map((movement) => movement.id),
      'the Movement screen now FILTERS closed movements off its stage board. That reverses "MARK IT, DO NOT ' +
        'FILTER IT" (owner, 2026-09-05) AND falsifies the Delays provenance sentence. Read the comment above.',
    ).toEqual(["WF-TEST-OPEN", "WF-TEST-CLOSED"]);
  });

  it("half 2 — this screen's waiting population excludes it", () => {
    const grouped = delayGroups([STILL_OPEN, CLOSED], allUnits(), NOW).flatMap((group) =>
      group.movements.map((movement) => movement.id),
    );
    expect(
      grouped,
      "the open movement is missing — this assertion could not tell exclusion from an empty result",
    ).toContain("WF-TEST-OPEN");
    expect(
      grouped,
      "a CLOSED movement reached the Delays waiting rows, and the screen's own paragraph says it never does",
    ).not.toContain("WF-TEST-CLOSED");
  });

  it("half 3 — search refuses it", () => {
    const found = searchMovements([STILL_OPEN, CLOSED], allUnits(), { text: "WF-TEST" }).map((movement) => movement.id);
    expect(found, "search found neither fixture — the refusal below would prove nothing").toContain("WF-TEST-OPEN");
    expect(found, "search returned a closed movement, and the screen's paragraph says it refuses them").not.toContain(
      "WF-TEST-CLOSED",
    );
  });
});
