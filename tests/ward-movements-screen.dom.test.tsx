import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { dayOf, splitDuration } from "@/components/ward-management/ward-clock";
import { isOpen, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { causeOf, MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  corridorCounts,
  journeyStages,
  refusedCorridorCounts,
  totalsReconciliation,
  transportCounts,
  transportLegs,
} from "@/components/ward-management/movements/movements-derivations";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById, NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * MERGE 03 — the patient movement board (`MovementsView`) and the coordinator's live transport
 * tracker (`LiveTracker`) become one screen: where has each patient's move got to, and what is
 * carrying them?
 *
 * ⚠️ Every expected value below comes from calling the same derivation functions the screen itself
 * calls (`journeyStages`, `transportLegs`, `transportCounts`), with the SAME ARGUMENTS the screen
 * uses — including scoping `transportLegs` to `isOpen` movements only, the same scope `LiveTracker`
 * (the screen this replaces) used. A test that calls the production function with different
 * arguments from the caller tests a configuration nothing ships — the exact defect the Capacity
 * screen's own test file records having hit once already.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const seededMovements = seedWardFlowState().movements;
const stages = journeyStages(seededMovements, NOW);
const openMovements = seededMovements.filter(isOpen);
const legs = transportLegs(openMovements, NOW);
const counts = transportCounts(legs);

function renderScreen() {
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
  // v6 (7 Oct 2026): the worklist shows the first rows of each group until Show all; these
  // cases read every row, so they open the full list first.
  fireEvent.click(screen.getByRole("button", { name: /^Show all \d+$/u }));
  return view;
}

/**
 * ⚠️ SCOPED TO A CONTAINER, DELIBERATELY. A movement with a booked transport leg renders TWICE —
 * once as a stage row in the Movement worklist, once as a transport row after the Transport
 * summary is selected — because the two views answer two different questions about the same person. An
 * unscoped `getByText` throws on any such movement ("Found multiple elements"), so every caller
 * passes the specific panel it means.
 */
// Owner, 26 Sept 2026: a row shows the patient's name, not the WF number, so rows are found by
// their hidden `data-record-key` instead of their visible text.
function findRecordRow(container: HTMLElement, id: string): HTMLElement {
  const rows = container.querySelectorAll<HTMLElement>(`[data-ward-primitive='record-row'][data-record-key='${id}']`);
  expect(rows.length, `exactly one row for ${id}`).toBe(1);
  return rows[0];
}

function openShapeOfTheDay(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Shape of the day" }));
  return screen.getByRole("region", { name: "Shape of the day" });
}

function openTransportSummary(): HTMLElement {
  const summary = openShapeOfTheDay();
  fireEvent.click(
    within(within(summary).getByRole("group", { name: "Movement summary" })).getByRole("button", {
      name: /Transport/u,
    }),
  );
  return summary;
}

describe("the Movements screen", () => {
  it("has a population in at least one stage and at least one transport leg, or the assertions below are vacuous", () => {
    expect(stages.length).toBe(7);
    expect(stages.some((stage) => stage.movements.length > 0)).toBe(true);
    expect(legs.length).toBeGreaterThan(0);
  });

  it("has the page shell — a rail, a main landmark and an <h1> — like every other Ward Flow screen", () => {
    // ⚠️ `DelaysScreen` shipped without this once and no component test caught it, because a
    // component test cannot see a missing page shell — the shell is exactly what it does not
    // render. This screen's shell is asserted from the start rather than added after the fact.
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Movements" })).toBeInTheDocument();
  });

  /**
   * ⚠️ DESIGN LOCK §5.2 / STRUCTURE ITEM 2: every stage appears, empty ones included. `stages` is
   * built from `MOVEMENT_STAGES.map`, so it is always exactly 7 long regardless of who is where —
   * this walks every one of the 7 and checks BOTH populated and empty stages render, rather than
   * only checking the ones the fixture happens to populate today.
   */
  it("shows every one of the 7 stages, including any that are empty right now", () => {
    renderScreen();
    // Scoped to the board panel: the same stage label is repeated verbatim in the "Every stage, at
    // a glance" panel below, so an unscoped `getByText` would match both and throw.
    const board = screen.getByRole("region", { name: /Movement worklist/u });
    for (const stage of stages) {
      const heading = within(board).getByRole("heading", { level: 3, name: stage.label });
      expect(heading, `stage "${stage.label}" is not on screen at all`).toBeInTheDocument();
      if (stage.movements.length === 0) {
        // An empty stage must say so in words — never a heading followed by nothing (design rule:
        // absence stated, never blank).
        const container = heading.closest("div");
        expect(container, `empty stage "${stage.label}" has no container to check`).not.toBeNull();
        expect(container).toHaveTextContent(/no movements at this stage/iu);
      } else {
        const heading2 = heading.closest("[data-ward-primitive='group-heading']");
        expect(heading2, `populated stage "${stage.label}" did not use the group-heading primitive`).not.toBeNull();
        expect(heading2).toHaveTextContent(
          stage.movements.length === 1 ? "1 person" : `${stage.movements.length} people`,
        );
      }
    }
  });

  /**
   * ⚠️ A MOVEMENT WITH A BOOKED TRANSPORT LEG RENDERS TWICE, DELIBERATELY — once as a stage row and
   * once in the selected Transport summary, because those views answer different questions about
   * the same person. Every open movement must appear in the transport view: as an accepted leg, an
   * unaccepted request or cancellation, or an explicit absence of a transport record.
   */
  it("renders every movement once in the worklist and every open movement once in the Transport summary", () => {
    renderScreen();
    openTransportSummary();
    const ids = Array.from(document.querySelectorAll("[data-ward-primitive='record-row'][data-record-key]")).map(
      (node) => node.getAttribute("data-record-key") ?? "",
    );
    const openIds = new Set(openMovements.map((movement) => movement.id));
    const stageMovementIds = stages.flatMap((stage) => stage.movements.map((movement) => movement.id));
    expect(stageMovementIds.length, "no movement rendered — this guard proved nothing").toBeGreaterThan(0);
    expect(stageMovementIds.length).toBe(seededMovements.length);

    for (const id of stageMovementIds) {
      const expectedCount = openIds.has(id) ? 2 : 1;
      expect(
        ids.filter((rendered) => rendered === id).length,
        `movement ${id} should render ${expectedCount} time(s) (open: ${openIds.has(id)})`,
      ).toBe(expectedCount);
    }
  });

  it("gives every stage row the movement's real urgency tier as its state word", () => {
    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });
    for (const movement of wardMovements) {
      const row = findRecordRow(board, movement.id);
      expect(row, `no row for ${movement.id}`).not.toBeNull();
      expect(row).toHaveTextContent(urgencyTierLabel(movement.urgency));
    }
  });

  /**
   * ⚠️ THIS IS THE PROPERTY BEING ADDED BY THIS TASK. Before it, only `TransportRow` rendered a
   * "Review patient" link — `StageRow` in the Movement worklist had none, so a movement
   * with no transport leg booked had no route into `WardPatientWorkspace` at all. Walked against the
   * real 50-movement fixture, floored below so the loop cannot pass by iterating nothing, and
   * queried by role and accessible name so a rename of the underlying element (not just its text)
   * would be caught.
   */
  it("gives every stage row a route into that movement's own workspace, not only the ones with a transport leg", () => {
    expect(wardMovements.length, "no movements in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });
    for (const movement of wardMovements) {
      const row = findRecordRow(board, movement.id);
      const link = within(row).getByRole("link", { name: /Review patient/u });
      expect(link, `movement ${movement.id} has no "Review patient" link on its stage row`).toBeInTheDocument();
      expect(link, `movement ${movement.id}'s stage-row link does not point at its own workspace`).toHaveAttribute(
        "href",
        `/mockups/ward-flow/movements/${movement.id}`,
      );
    }
  });

  /**
   * ⚠️ **THE FALLBACK WORDING IS IMPORTED FROM PRODUCTION, NOT RE-STATED HERE — and that is a
   * division of labour rather than a shortcut.** This file used to carry its own copy of the
   * formula, `originEd ? originEd.name : `No department matches "..."``. Production moved to the
   * record-blaming sentence Ward Lead ruled for on 2026-09-11 and **this copy did not**, because
   * the branch it guards is unreachable from the seed — 0 of 50 movements carry an unresolvable id
   * — so the stale string was never exercised and nothing went red. 🔴 **A second copy of a rule
   * that cannot be executed is a copy nobody maintains.**
   *
   * 🔴 **AND THE SENTENCE THAT USED TO SIT HERE — "this asserts the screen actually uses it" — WAS
   * AN OVER-CLAIM, found by an adversarial review of its own commit.** On every seeded movement the
   * lookup RESOLVES, so `departmentLabel(id, name)` returns `name` and the expected value is just
   * the department's name. **Revert the screen to the old inline network-blaming ternary and this
   * test still passes**, because both expressions produce the same string on every seeded row.
   *
   * ⚠️ **WHAT THIS ACTUALLY ASSERTS, stated at its real width:** the real department NAME reaches
   * the row. That is worth having and it is not a tautology — but it is NOT coverage of the ruled
   * sentence, and the ruled sentence is **untested at every render site in the application.**
   *
   * 🔴 **AND "the seed cannot reach it, so it must be a unit test" DOES NOT FOLLOW.**
   * `tests/ward-delays-third-edition.dom.test.tsx` hand-builds a movement with a dangling
   * `originEdId`, renders the screen with it, proves the branch was reached, and THEN asserts the
   * wording — because `DelaysScreen` takes a `movements` prop and `MovementsScreen` does not.
   * **The technique needs a seam, not a declaration of impossibility.** Adding one is a change to a
   * production component's shape for testability; routed to Ward Lead rather than taken here.
   */
  it("names every stage row's real origin department, by name and never by a bare id", () => {
    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });
    for (const movement of wardMovements) {
      const row = findRecordRow(board, movement.id);
      const originEd = edById(movement.originEdId);
      const expected = departmentLabel(movement.originEdId, originEd?.name);
      const origin = within(row).getByLabelText(expected, { exact: true });
      expect(origin, `origin department wrong for ${movement.id}`).toHaveAttribute("title", expected);
      expect(origin).toHaveTextContent(originEd ? `${originEd.siteCode} ED` : expected);
    }
  });

  /**
   * ⚠️ DESIGN LOCK §5.4 / STRUCTURE ITEM 4 — `LiveTracker` was the ONLY surface in the app that
   * ever rendered these transport facts. Checked here per leg rather than assumed: provider,
   * origin department, destination unit (or its honest unresolved fallback), and time since
   * booked all had to survive the fold.
   */
  it("carries every transport fact LiveTracker used to show — provider, origin, destination and time since booked", () => {
    expect(legs.length, "no transport leg in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    const transportPanel = openTransportSummary();
    for (const leg of legs) {
      const row = findRecordRow(transportPanel, leg.movement.id);
      expect(row, `no transport row for ${leg.movement.id}`).not.toBeNull();
      expect(row, `provider missing for ${leg.movement.id}`).toHaveTextContent(leg.provider);

      const originEd = edById(leg.movement.originEdId);
      const originLabel = departmentLabel(leg.movement.originEdId, originEd?.name);
      expect(row, `origin missing for ${leg.movement.id}`).toHaveTextContent(originLabel);

      const destinationUnit = leg.movement.acceptedUnitId
        ? units.find((unit) => unit.id === leg.movement.acceptedUnitId)
        : undefined;
      const destinationLabel = leg.movement.acceptedUnitId
        ? wardLabel(leg.movement.acceptedUnitId, destinationUnit?.name)
        : "No accepted destination recorded";
      expect(row, `destination missing for ${leg.movement.id}`).toHaveTextContent(destinationLabel);

      expect(row, `elapsed booking time missing for ${leg.movement.id}`).toHaveTextContent(
        splitDuration(Math.max(leg.minutesSinceBooked, 0)),
      );
      expect(row, `booking-time meaning missing for ${leg.movement.id}`).toHaveTextContent(/since booked/iu);

      expect(within(row).getByRole("link", { name: /Review patient/u })).toBeInTheDocument();
    }
  });

  it("states each transport leg's real state as a word beside its row, never colour alone", () => {
    renderScreen();
    const transportPanel = openTransportSummary();
    // ⚠️ RESTATED HERE ON PURPOSE, NOT IMPORTED FROM THE SCREEN. Reading the screen's own
    // `LEG_STATE_LABEL` would make this a tautology — it would pass whatever the map said. These
    // are the words a coordinator reads, and ward vocabulary is the owner's to change, so they are
    // pinned. `Accepted` reads "Booked" because that is the word this board has always used for a
    // job a provider has accepted; the five-state collapse (Ward Lead, 2026-09-05) was a ruling
    // about the type, and the only word it adds is "Collected", which previously had none.
    const labels: Record<(typeof legs)[number]["state"], string> = {
      Accepted: "Booked",
      "En route": "En route",
      Collected: "Collected",
      Arrived: "Arrived",
      Cancelled: "Cancelled",
    };
    for (const leg of legs) {
      const row = findRecordRow(transportPanel, leg.movement.id);
      expect(row, `state word missing for ${leg.movement.id}`).toHaveTextContent(labels[leg.state]);
    }
  });

  it("keeps a requested but unaccepted transport record visible without inventing a booked time", () => {
    const movement = wardMovements.find((candidate) => isOpen(candidate) && candidate.transport === undefined);
    expect(movement, "no open movement without transport exists for the requested-record regression").toBeDefined();
    const original = movement!.transport;
    movement!.transport = {
      id: "TR-REQUESTED-TEST",
      provider: "Ward escort",
      escortRequired: false,
    };

    try {
      renderScreen();
      const transportPanel = openTransportSummary();
      const row = findRecordRow(transportPanel, movement!.id);
      expect(row).toHaveTextContent("Requested");
      expect(row).toHaveTextContent("Provider: Ward escort");
      expect(row).toHaveTextContent("Not accepted");
      expect(row).toHaveTextContent("No accepted time recorded");
      expect(within(row).getByRole("link", { name: /Review patient/u })).toHaveAttribute(
        "href",
        `/mockups/ward-flow/movements/${movement!.id}`,
      );
      const worklist = screen.getByRole("region", { name: "Movement worklist" });
      fireEvent.click(within(worklist).getByRole("radio", { name: "By transport leg, and what has none" }));
      const requestGroup = within(worklist).getByRole("heading", { name: "Transport not accepted" }).parentElement!
        .parentElement!;
      expect(findRecordRow(requestGroup, movement!.id)).toBeInTheDocument();
    } finally {
      movement!.transport = original;
    }
  });

  /**
   * ⚠️ A COUNT SHOWN MUST BE HONEST ABOUT ITS DENOMINATOR (design lock rule 8). The transport panel
   * says how many of the open population have a leg booked and how many do not — never a bare
   * count with no population to measure it against.
   */
  it("states the compact transport summary against the open movement population", () => {
    renderScreen();
    const transportPanel = openTransportSummary();
    const legCountRow = within(transportPanel).getByText("Transport legs").closest("li");
    expect(legCountRow, "the transport summary does not state the leg count").toHaveTextContent(String(legs.length));

    const withoutBooked = openMovements.length - legs.length;
    const unaccepted = openMovements.filter(
      (movement) => movement.transport !== undefined && movement.transport.acceptedAt === undefined,
    );
    const noRecord = openMovements.filter((movement) => movement.transport === undefined);
    expect(unaccepted.length + noRecord.length).toBe(withoutBooked);
    expect(
      within(transportPanel).getByText("Requested or cancelled before acceptance").closest("li"),
    ).toHaveTextContent(unaccepted.length === 0 ? "none" : String(unaccepted.length));
    expect(
      within(transportPanel)
        .getAllByText("No transport yet", { selector: "span" })
        .map((element) => element.closest("li"))
        .find(Boolean),
    ).toHaveTextContent(noRecord.length === 0 ? "none" : String(noRecord.length));
  });

  /**
   * The transport-counts bar in the secondary column must report the real tally from
   * `transportCounts`, never a recomputed or partial one — `WardBar`'s accessible name states every
   * segment and its count, so a reader (and this test) get the same numbers either way.
   */
  it("reports the real transport-state tally in the 'Transport right now' bar", () => {
    renderScreen();
    expect(
      screen.getByRole("img", {
        name: new RegExp(
          `Booked ${counts.Accepted}\\b.*En route ${counts["En route"]}\\b.*Collected ${counts.Collected}\\b.*Arrived ${counts.Arrived}\\b.*Cancelled ${counts.Cancelled}\\b`,
          "su",
        ),
      }),
    ).toBeInTheDocument();
  });

  it("shows the open-stage summary count for every stage, stating zero in words rather than a bare 0", () => {
    renderScreen();
    const panel = openShapeOfTheDay();
    const openStages = journeyStages(openMovements, NOW);
    for (const stage of openStages) {
      const item = within(panel).getByText(stage.label).closest("li");
      expect(item, `no glance row for "${stage.label}"`).not.toBeNull();
      if (stage.movements.length === 0) {
        expect(item).toHaveTextContent(/none/iu);
      } else {
        expect(item).toHaveTextContent(String(stage.movements.length));
      }
    }
  });

  /**
   * **M2 changed this sentence because the screen stopped having ONE order.** It used to read
   * The worklist now states the operational rule directly: legal deadlines take priority.
   *
   * 🔴 **What survives is the clinical half, and it survives because every order honours it** —
   * `journeyStages` through `byUrgencyThenWait`, and `byLongestWait` explicitly. A precedence
   * sentence covering three orderings is only honest if all three apply it, which is why
   * `byLongestWait` carries the same rule rather than sorting on wait alone.
   */
  it("preserves the legal-priority movement at the front of the waiting order", () => {
    const urgent = wardMovements.find((movement) => isOpen(movement) && movement.legalForm?.dueAt !== undefined)!;
    expect(urgent).toBeDefined();
    const original = urgent.legalForm;
    urgent.legalForm = { ...original!, dueAt: NOW - 1 };
    try {
      renderScreen();
      const board = screen.getByRole("region", { name: "Movement worklist" });
      fireEvent.click(within(board).getByRole("radio", { name: "By how long it has waited" }));
      const rows = board.querySelectorAll("[data-ward-primitive='record-row'][data-record-key]");
      expect(rows[0].getAttribute("data-record-key")).toBe(urgent.id);
    } finally {
      urgent.legalForm = original;
    }
  });

  it("offers the three orders as a radiogroup, not as filter pills that would imply removal", () => {
    renderScreen();
    const group = screen.getByRole("radiogroup", { name: /Order/u });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["By where it stands", "By transport leg, and what has none", "By how long it has waited"]);
  });
});

/*
 * 🔴 **A CLOSED MOVEMENT MUST NOT READ AS A PERSON STILL WAITING. Found live on this screen after
 * the fold, 2026-09-05, with every gate green.**
 *
 * `WF-008` rendered under "Accepted, awaiting bed" showing "2h 30m in journey" and climbing, while
 * its record carried `closure.outcome: "did_not_proceed"` twenty minutes earlier with the reason
 * *"Patient self-discharged from ED before transport was arranged"*. **Nothing on the page said
 * so** — the rendered DOM contained no "closed", no "did not proceed", no "self-discharged". The
 * owner ruled: mark it, do not filter it.
 *
 * ⚠️ **THE DEFECT WAS CREATED BY ADJACENCY, WHICH IS WHY NO EXISTING GUARD SAW IT.**
 * `journeyStages` groups by stage with no `isOpen` filter — faithful to the pre-merge screen — and
 * the open-move count comes from a derivation that DOES filter. Neither half changed. Putting them
 * on one page made the combination state something neither half stated, which is also why the page
 * reads "50 moves" at the top and "8 of 43 open moves" at the bottom. **A guard on either half
 * alone is still green today.**
 *
 * ⚠️ **ASSERTED AS PROPERTIES OVER THE FIXTURE, NEVER AS THE MARKER'S WORDING.** A rewrite of the
 * words must not turn these red — that is the standing rule — so what is checked is that a closed
 * row is DISTINGUISHABLE from an open one beside it, and that its clock stopped.
 */
describe("the movements board never shows a closed movement as a person still waiting", () => {
  const closedInAStageGroup = wardMovements.filter(
    (movement) => movement.closure !== undefined && movement.stage !== "arrived",
  );

  it("has closed movements sitting in stage groups at all, so the checks below are not vacuous", () => {
    expect(
      closedInAStageGroup.map((movement) => movement.id),
      "no closed movement sits in a stage group in this fixture, so nothing below can discriminate. " +
        "Either the seed changed or the grouping now filters — re-derive before trusting a green here.",
    ).not.toEqual([]);
  });

  it("puts the record's own closure reason on the closed row", () => {
    /*
     * 🔴 **THIS REPLACES A TAUTOLOGY I WROTE AND VERIFIED WAS ONE.** My first version compared a
     * closed row's `textContent` against a DIFFERENT patient's open row in the same group and
     * asserted they differed. **Two different patients' rows always differ** — different id,
     * different attributes, different duration — so it was true by construction. Proved by
     * mutation: deleting the closure marker entirely left it GREEN.
     *
     * ⚠️ **WHAT DISCRIMINATES IS THE RECORD'S OWN SENTENCE.** `closure.reason` is DATA, not copy, so
     * asserting it reaches the row survives any rewording of the marker or restyling of the chip —
     * and it is the fact a reader actually needs, which "these two rows look different" never was.
     */
    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });

    for (const movement of closedInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      expect(
        row.textContent,
        `${movement.id} is closed and its row does not carry the recorded reason — ` +
          `"${movement.closure!.reason}". A reader counting the people waiting is counting somebody ` +
          `who left, and nothing on the row tells them.`,
      ).toContain(movement.closure!.reason);
    }
  });

  it("freezes a closed movement's clock instead of counting on to now", () => {
    /*
     * 🔴 **MY FIRST VERSION READ WHOLE HOURS AND COULD NOT DISCRIMINATE, AND MY OWN ESCAPE CLAUSE
     * THEN SKIPPED THE CHECK.** `WF-008` opened 150 minutes before the anchor and closed 130 minutes
     * into its journey. **Both floor to 2 hours.** So an hours-only comparison passes whichever
     * figure is rendered — and the `if (frozen !== running)` guard I had added to be careful
     * detected the coincidence and quietly skipped, which is worse than not checking at all
     * because it reports a pass.
     *
     * **Read in MINUTES, and floor the fixture instead of escaping it:** the two figures must
     * actually differ for this to mean anything, so that is asserted rather than tiptoed around.
     */
    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });

    for (const movement of closedInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      const frozenMinutes = movement.closure!.at - movement.openedAt;
      const runningMinutes = NOW_ANCHOR - movement.openedAt;

      expect(
        frozenMinutes,
        `${movement.id}'s frozen and running durations are identical, so this assertion cannot tell ` +
          `them apart. Re-seed the fixture or drop this movement from the population — do not leave ` +
          `a check that cannot fail.`,
      ).not.toBe(runningMinutes);

      const shown = /(?:(\d+)h)?\s*(?:(\d+)m)/u.exec(row.textContent ?? "");
      expect(shown, `no duration of the form "2h 10m" found on ${movement.id}'s row`).not.toBeNull();
      const shownMinutes = Number(shown![1] ?? 0) * 60 + Number(shown![2]);

      expect(
        shownMinutes,
        `${movement.id} ended ${NOW_ANCHOR - movement.closure!.at} minutes ago, and its row shows ` +
          `${shownMinutes} minutes in journey rather than the ${frozenMinutes} it had when it ended. A ` +
          `duration that keeps growing after a movement stopped is a second false statement on top of ` +
          `the first.`,
      ).toBe(frozenMinutes);
    }
  });

  /**
   * ⚠️ THE TASK-3 TRAP, ASSERTED DIRECTLY: "A link that reads identically on a live movement and a
   * closed one invites a coordinator to act on somebody who has already gone." Giving every stage
   * row the same "Review patient" link makes that risk real for the first time on this panel — this
   * checks the row's EXISTING distinction (the "Did not proceed" state word and the frozen-clock
   * sub-label) survives once the link is added, on the same closed rows the tests above already
   * proved carry it, and contrasts them against an open row so the property actually discriminates
   * rather than being text present on every row regardless.
   */
  it("keeps a closed row's 'Did not proceed' distinction even once it also carries the review link", () => {
    const openInAStageGroup = wardMovements.filter((movement) => movement.closure === undefined);
    expect(
      openInAStageGroup.length,
      "no open movement in the fixture — nothing to contrast the closed rows against",
    ).toBeGreaterThan(0);

    renderScreen();
    const board = screen.getByRole("region", { name: /Movement worklist/u });

    for (const movement of closedInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      expect(
        within(row).getByRole("link", { name: /Review patient/u }),
        `${movement.id} is closed and should still have a review link`,
      ).toBeInTheDocument();
      expect(row, `${movement.id} lost its "Did not proceed" marker once it gained a review link`).toHaveTextContent(
        /Did not proceed/u,
      );
      expect(row, `${movement.id} lost its frozen-clock label once it gained a review link`).toHaveTextContent(
        /in journey before it ended/u,
      );
    }

    for (const movement of openInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      expect(
        row,
        `${movement.id} is open but wrongly carries the closed movement's "Did not proceed" marker`,
      ).not.toHaveTextContent(/Did not proceed/u);
    }
  });

  it("labels every resolved-today row from its recorded closure outcome", () => {
    const resolvedToday = wardMovements.filter(
      (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(NOW),
    );
    const outcomes = new Set(resolvedToday.map((movement) => movement.closure!.outcome));

    expect(outcomes, "no arrived closure is present, so the false did-not-proceed label cannot be detected").toContain(
      "arrived",
    );
    expect(outcomes, "no did-not-proceed closure is present, so the two labels cannot be contrasted").toContain(
      "did_not_proceed",
    );

    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: /Resolved today/u }));
    const panel = screen.getByRole("tabpanel", { name: /Resolved today/u });

    for (const movement of resolvedToday) {
      const row = findRecordRow(panel, movement.id);
      const expected = movement.closure!.outcome === "arrived" ? "Arrived" : "Did not proceed";
      const rejected = movement.closure!.outcome === "arrived" ? "Did not proceed" : "Arrived";

      expect(
        within(row).getByText(expected, { selector: "[data-ward-primitive='chip']" }),
        `${movement.id} does not show its recorded ${movement.closure!.outcome} outcome`,
      ).toBeInTheDocument();
      expect(
        within(row).queryByText(rejected, { selector: "[data-ward-primitive='chip']" }),
        `${movement.id} shows the opposite closure outcome`,
      ).toBeNull();
    }
  });

  /**
   * **M5 — the reconciliation sentence gets its own section, and this is the test that notices
   * if it goes back.** It used to render inside the "Where each move has got to" panel, where its
   * subject (every movement on the screen) read as the subject of that one panel (the stage list).
   *
   * ⚠️ **The second assertion is the load-bearing one.** A test that only checks the new panel
   * exists stays green if somebody renders the sentence in BOTH places — and two copies of a
   * reconciliation line is worse than the original placement, because the two can disagree.
   *
   * 🔴 **The expected text is COMPUTED from `totalsReconciliation`, never written as a literal.**
   * The seed is due to gain person links and a high-acuity referral (D-45), and any assertion
   * carrying a copied sentence or a copied count would go red on that change while the screen
   * stayed correct.
   */
  it("does not show the reconciliation sentence inside the Movement worklist", () => {
    const expected = totalsReconciliation(wardMovements);
    expect(
      expected,
      "the fixture reconciles to nothing, so neither assertion below could fail — the test would pass without rendering anything",
    ).toBeTruthy();

    renderScreen();

    expect(screen.queryByRole("region", { name: /What reconciles/u })).not.toBeInTheDocument();

    const board = screen.getByRole("region", { name: /Movement worklist/u });
    expect(board, "the reconciliation sentence is rendered inside the stage board").not.toHaveTextContent(
      expected as string,
    );
  });
});

/**
 * **TASK M4 — the Corridors strip, and it renders ONE of the drawing's three kinds.**
 *
 * 🔴 **The absent two are absent for different reasons and the screen must not read as if it simply
 * has fewer.** `Unused` is closed by D-41 — the drawing hand-declares two corridors, its own stated
 * rule yields 110 on this data. `Refused` is deferred to D-45 because **`Decline` carries no
 * `stage`**, so a refused corridor has no honest stage to report, and the only workaround borrows
 * the movement's CURRENT stage — safe on today's two specimens for a reason nothing enforces.
 *
 * ⚠️ **The second test is the one that matters clinically.** A coordinator looking at a corridor
 * list and not finding a ward that refused someone would reasonably conclude no ward refused. **The
 * screen has to say the refusals are not shown, and why** — an absence that is not stated reads as
 * a measured none.
 */
describe("the Corridors strip", () => {
  it("lists corridors derived from the state, never typed, ranked by how many they carry", () => {
    const expected = [...corridorCounts(seededMovements)].sort((a, b) => b.count - a.count);
    expect(
      expected.length,
      "no corridor in the fixture — every assertion below would pass over an empty list",
    ).toBeGreaterThan(0);

    renderScreen();
    const strip = screen.getByRole("region", { name: "Today’s traffic" });

    expect(strip, "the panel count is not the number of active corridors the derivation produces").toHaveTextContent(
      `${new Set(expected.map((row) => JSON.stringify([row.originEdId, row.acceptedUnitId]))).size} active corridors`,
    );
    const pairCount = new Set(expected.map((row) => JSON.stringify([row.originEdId, row.acceptedUnitId]))).size;
    expect(pairCount).toBeLessThan(expected.length);
    expect(within(strip).getByRole("button", { name: `Accepted ${pairCount}` })).toBeInTheDocument();
    expect(
      within(within(strip).getByRole("complementary", { name: "Ranked corridors" })).getAllByRole("listitem"),
    ).toHaveLength(pairCount);

    const busiest = expected[0];
    const ed = edById(busiest.originEdId);
    expect(ed, "the busiest corridor names an unresolvable department — pick a different assertion").toBeDefined();
    expect(strip).toHaveTextContent(String(ed?.name));
  });

  it("shows only actual same-day declined corridors and does not assign them a journey stage", () => {
    const expected = refusedCorridorCounts(seededMovements, NOW);
    renderScreen();
    const strip = screen.getByRole("region", { name: "Today’s traffic" });
    fireEvent.click(within(strip).getByRole("button", { name: new RegExp(`Declined ${expected.length}`, "u") }));
    expect(strip).toHaveTextContent(/declines have no journey stage of their own/iu);
    for (const corridor of expected) {
      expect(strip).toHaveTextContent(String(corridor.count));
      for (const reason of corridor.reasons) expect(strip).toHaveTextContent(reason.replaceAll("_", " "));
    }
  });
});

/**
 * **TASK M6 — the detail drawer.**
 *
 * 🔴 **THE SECOND TEST IS THE ONE THAT MATTERS AND IT IS ABOUT A REFUSAL, NOT A FEATURE.** The
 * drawing's Person section opens with a name. The data to fill it exists — a two-hop join reaches a
 * person — and `tests/ward-patient-link-default-deny.test.ts` refuses this file the read, by design
 * (D-14). ⚠️ **A section that simply omitted the name would read as a movement nobody has
 * identified, which is a different and false statement**, so the screen says what is withheld and
 * that the link exists.
 *
 * ⚠️ **And the third test pins the two UNBUILT sections being named.** Five of seven ship. A reader
 * comparing this against the drawing would otherwise have to guess whether the other two were
 * dropped, forgotten, or refused — three states that look identical in an absence.
 */
describe("the movement detail drawer", () => {
  function openFirstDrawer() {
    renderScreen();
    const triggers = screen.getAllByRole("button", { name: /What is recorded/u });
    expect(triggers.length, "no row offers the drawer — every assertion below would prove nothing").toBeGreaterThan(0);
    fireEvent.click(triggers[0]);
    return screen.getByRole("dialog");
  }

  it("opens from a row and carries the five sections that are built", () => {
    const dialog = openFirstDrawer();
    for (const section of ["Person", "Journey", "Which wards were asked", "Escalation", "Transport leg"]) {
      expect(within(dialog).getByRole("heading", { name: section })).toBeInTheDocument();
    }
  });

  /**
   * 🔴 **RED ON THE OLD BEHAVIOUR, NOT THE NEW ONE.** This test used to assert that the name was
   * WITHHELD and that a guard refused the link. **Owner ruling O-16.3, 2026-09-11 — *"Yes show the
   * patient name."* — reversed that**, so the assertion is inverted rather than deleted: a drawer
   * that goes back to hiding the name now fails.
   *
   * ⚠️ **The seed reaches the NAMED branch 0 of 50 times**, so this DOM test can only reach the
   * unnamed one. The named branch is unit-tested against `personLine` directly, with a hand-built
   * fixture — a DOM test over the seed would assert only the empty branch and pass however the
   * named one is written.
   */
  it("no longer claims a name is withheld — the owner ruled the drawer may name the person", () => {
    const dialog = openFirstDrawer();
    expect(
      dialog,
      "the drawer is back to withholding the name, which O-16.3 reversed on 2026-09-11",
    ).not.toHaveTextContent(/No name is shown here/u);
    expect(
      dialog,
      "the drawer names people without saying they are invented — on a screen a coordinator reads",
    ).toHaveTextContent(/invented/u);
  });

  it("names the section the drawing has and this does not", () => {
    const dialog = openFirstDrawer();
    expect(dialog).toHaveTextContent(/Watch and flag/u);
    expect(
      dialog,
      "the unbuilt section is not declared, so its absence is indistinguishable from a drop",
    ).toHaveTextContent(/not built/u);
    expect(
      dialog,
      "the drawer names the unbuilt section without saying WHY, so a reader cannot tell a missing " +
        "feature from a missing fact",
    ).toHaveTextContent(/records that somebody is watching/u);
  });
});

/**
 * **TASK M7 — *What you can do*, and it is ONE action rather than the drawing's four.**
 *
 * 🔴 **THE ASSERTIONS THAT MATTER GO THROUGH THE REDUCER, NOT THROUGH THE BUTTON.** A test that
 * clicks the control and re-reads the control proves the label toggled; it says nothing about
 * whether anything was recorded. **Every case below reads the drawer's own SENTENCE afterwards —
 * the one a coordinator actually acts on — and that sentence is rendered from `flaggedUrgent` in
 * provider state, so it can only change if the dispatch landed.**
 *
 * ⚠️ **THE THREE POPULATIONS ARE DERIVED FROM THE FIXTURE AND FLOORED, NEVER TYPED.** An id written
 * by hand here goes stale the day the seed is re-cut, and a stale id fails as "cannot find the row",
 * which reads as a broken test rather than a missing case.
 */
describe("the movement drawer's one action — the urgent flag", () => {
  const openUnflagged = wardMovements.filter((movement) => isOpen(movement) && !movement.flaggedUrgent);
  const flagged = wardMovements.filter((movement) => movement.flaggedUrgent);
  const closedUnflagged = wardMovements.filter((movement) => !isOpen(movement) && !movement.flaggedUrgent);

  /** Opens the drawer for ONE named movement — the stage board renders every movement, closed included. */
  function openDrawerFor(id: string): HTMLElement {
    renderScreen();
    const rowNodes = document.querySelectorAll(`[data-ward-primitive='record-row'][data-record-key='${id}']`);
    for (const node of rowNodes) {
      const row = node;
      if (!row) continue;
      const trigger = within(row as HTMLElement).queryByRole("button", { name: /What is recorded/u });
      if (trigger) {
        fireEvent.click(trigger);
        return screen.getByRole("dialog");
      }
    }
    throw new Error(`no row for ${id} offers the drawer, so this case could not be reached at all`);
  }

  it("has all three states in the fixture, or the cases below are vacuous", () => {
    expect(openUnflagged.length, "no open unflagged movement — the flagging case cannot be reached").toBeGreaterThan(0);
    expect(
      flagged.length,
      "no flagged movement in the seed — the CLEARING half is untested, and a flag that cannot be " +
        "removed is the permanent state the reducer's pair exists to prevent",
    ).toBeGreaterThan(0);
    expect(closedUnflagged.length, "no closed unflagged movement — the refusal case cannot be reached").toBeGreaterThan(
      0,
    );
  });

  it("flags an open movement, and the drawer then says the patient leads the queue", () => {
    const dialog = openDrawerFor(openUnflagged[0].id);
    expect(dialog).toHaveTextContent(/Not flagged\. This patient is ordered by urgency tier/u);

    // Item 37 (2026-09-17): a reason must be chosen before the button does anything.
    fireEvent.change(within(dialog).getByTestId("ward-movement-drawer-urgent-reason"), {
      target: { value: "cannot_safely_prevent_leaving" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Flag this patient as urgent" }));

    expect(
      screen.getByRole("dialog"),
      "the button toggled but the drawer still reads as unflagged — the click changed the label and " +
        "not the record",
    ).toHaveTextContent(/Flagged urgent\. This patient leads the queue ahead of every urgency tier/u);
  });

  /**
   * 🔴 **THE CLEARING HALF, AND IT IS THE ONE WORTH HAVING.** `Movement.flaggedUrgent` sat in this
   * model for a day with one seeded `true` and no way to clear it: a flag that outranks every tier
   * for the rest of the demonstration on a patient whose situation has resolved.
   */
  it("clears a flag that was already set, so the seeded one is not permanent", () => {
    const dialog = openDrawerFor(flagged[0].id);
    expect(dialog).toHaveTextContent(/Flagged urgent/u);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove the urgent flag" }));

    expect(screen.getByRole("dialog"), "the flag survived its own remove button").toHaveTextContent(/Not flagged/u);
  });

  /**
   * ⚠️ **A CLOSED MOVEMENT IS OFF THE QUEUE, so the reducer refuses to flag one.** The drawer does
   * not hide that behind a missing button and leave it to be discovered by pressing: it says the
   * flag would order nothing. **The button is withheld only where it could do nothing at all.**
   */
  it("says why a closed movement cannot be flagged, rather than just omitting the control", () => {
    const dialog = openDrawerFor(closedUnflagged[0].id);
    expect(
      dialog,
      "the control is simply absent on a closed movement, so a coordinator cannot tell a refusal " +
        "from a screen that forgot the section",
    ).toHaveTextContent(/no longer running, so it is not in the queue at all/u);
    expect(within(dialog).queryByRole("button", { name: /urgent/iu })).toBeNull();
  });
});

/**
 * P2 item 4, from the 2026-09-17 review. `MovementDrawer` holds its own `urgentFlagReason` draft
 * in local state, and nothing previously forced that state to reset when the drawer opened for a
 * DIFFERENT patient — a coordinator could pick a reason for WF-001, close the drawer without
 * flagging, open WF-002, and find WF-001's reason still selected in a drawer now talking about a
 * different patient. The fix is a `key={detailId ?? "none"}` on the `<MovementDrawer>` mount in
 * `movements-screen.tsx`, forcing React to unmount and remount the whole subtree — and every
 * local hook inside it — on every patient change.
 *
 * This is a single continuous render (one `renderScreen()` call), because the defect is about
 * state surviving ACROSS mounts of the same tree — `openDrawerFor`'s own re-render per call
 * (used by the describe block above) would not have exercised the `key` prop at all.
 */
describe("the movement drawer resets its urgent-flag reason between patients (P2 item 4)", () => {
  function openDrawerInPlace(id: string): HTMLElement {
    const rowNodes = document.querySelectorAll(`[data-ward-primitive='record-row'][data-record-key='${id}']`);
    for (const node of rowNodes) {
      const row = node;
      if (!row) continue;
      const trigger = within(row as HTMLElement).queryByRole("button", { name: /What is recorded/u });
      if (trigger) {
        fireEvent.click(trigger);
        return screen.getByRole("dialog");
      }
    }
    throw new Error(`no row for ${id} offers the drawer, so this case could not be reached at all`);
  }

  it("choosing a reason on WF-001, closing, and opening WF-002 leaves WF-002's reason empty and its flag button unavailable", () => {
    renderScreen();

    const wf001Dialog = openDrawerInPlace("WF-001");
    const wf001Select = within(wf001Dialog).getByTestId("ward-movement-drawer-urgent-reason") as HTMLSelectElement;
    fireEvent.change(wf001Select, { target: { value: "cannot_safely_prevent_leaving" } });
    expect(wf001Select.value, "precondition: the reason was actually chosen on WF-001").toBe(
      "cannot_safely_prevent_leaving",
    );
    const wf001Button = within(wf001Dialog).getByTestId("ward-movement-drawer-urgent-toggle");
    expect(wf001Button, "precondition: choosing a reason enables the button").not.toHaveAttribute("aria-disabled");

    fireEvent.click(within(wf001Dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog"), "the drawer did not actually close").toBeNull();

    const wf002Dialog = openDrawerInPlace("WF-002");
    const wf002Select = within(wf002Dialog).getByTestId("ward-movement-drawer-urgent-reason") as HTMLSelectElement;
    expect(
      wf002Select.value,
      "WF-002's reason picker carried WF-001's choice across — the drawer did not remount",
    ).toBe("");
    expect(
      within(wf002Dialog).getByTestId("ward-movement-drawer-urgent-toggle"),
      "WF-002's flag button must be unavailable again until its own reason is chosen",
    ).toHaveAttribute("aria-disabled", "true");
  });
});

/**
 * R2 item 2 (Ward Lead's decisions, 2026-09-17): this screen's own `causeOf` used to compute
 * "legal_breached"/"legal_expiring"/"no_eligible_bed" from a hand-rolled check that disagreed with
 * Delays' own `delayGroups` classifier on both ends — see `causeOf`'s own doc comment
 * (movements-screen.tsx) for the full reasoning. `causeOf` now takes a `severeCauseById` lookup the
 * caller builds from `delayGroups` directly, so these tests drive that same real function rather
 * than re-implementing the join it is checking.
 */
describe("causeOf reads its severe causes from the shared delayGroups classifier (R2 item 2)", () => {
  const units = allUnits();
  const openMovements = wardMovements.filter(isOpen);

  function severeCauseMap(movements: Movement[]) {
    const map = new Map<string, ReturnType<typeof delayGroups>[number]["cause"]>();
    for (const group of delayGroups(movements, units, NOW_ANCHOR)) {
      if (!SEVERE_CAUSES.includes(group.cause)) continue;
      for (const movement of group.movements) map.set(movement.id, group.cause);
    }
    return map;
  }

  /** A complete, minimal open movement — every required field, nothing optional set unless a test
   *  needs it. Mirrors `tests/ward-service-scope.test.ts`'s own `baseMovement`. */
  function baseMovement(overrides: Partial<Movement> & { id: string; originEdId: string }): Movement {
    return {
      openedAt: NOW_ANCHOR - 40,
      flaggedUrgent: false,
      urgency: 3,
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
      blocker: "Test fixture",
      withdrawnReferrals: [],
      unwinds: [],
      stageChanges: [],
      ...overrides,
    };
  }

  it("catcher: WF-308 lands in the same no_eligible_bed cause as Delays, not movements-screen's old declines-based guess", () => {
    const wf308 = wardMovements.find((movement) => movement.id === "WF-308");
    expect(wf308, "WF-308 missing from the seed").toBeDefined();
    // Precondition: WF-308 carries no recorded decline at all — the OLD local `causeOf` required
    // `declines.length > 0` to ever read "no_eligible_bed", so it could never have classified this
    // movement that way. `delayGroups` reaches "no_eligible_bed" a different way (no ELIGIBLE
    // candidate anywhere in the shortlist), which is why the two disagreed.
    expect(wf308!.declines.length, "WF-308 must carry no decline or this catcher proves nothing new").toBe(0);
    const map = severeCauseMap(openMovements);
    expect(map.get("WF-308"), "Delays' own classifier must call WF-308 no_eligible_bed").toBe("no_eligible_bed");
    expect(causeOf(wf308!, NOW_ANCHOR, map)).toBe("no_eligible_bed");
  });

  it("a movement declined by every ward it asked, while a DIFFERENT eligible ward was never asked, must NOT read no_eligible_bed", () => {
    // Build a plain, unrestricted movement (Adult/Open/Female, nothing special) and find two REAL
    // wards that are actually eligible for it today, straight from `shortlistCandidates` — never
    // hand-guessed — so this fixture's claim about the network is checked, not assumed.
    const probe = baseMovement({ id: "WF-TEST-DECLINED-ELSEWHERE-ELIGIBLE", originEdId: "rph-ed" });
    const eligibleUnitIds = shortlistCandidates(probe, units, NOW_ANCHOR)
      .filter((candidate) => candidate.availability === "eligible")
      .map((candidate) => candidate.unit.id);
    expect(
      eligibleUnitIds.length,
      "need at least two eligible wards for this scenario to prove anything",
    ).toBeGreaterThanOrEqual(2);

    const [declinedUnitId] = eligibleUnitIds;
    const movement = baseMovement({
      id: "WF-TEST-DECLINED-ELSEWHERE-ELIGIBLE",
      originEdId: "rph-ed",
      referredUnitIds: [],
      declines: [{ unitId: declinedUnitId, at: NOW_ANCHOR - 10, reason: "no_bed" }],
    });
    // Still genuinely eligible somewhere else — the OTHER real ward this probe found was never
    // referred to or declined by, so the network has not actually run out.
    const stillEligible = shortlistCandidates(movement, units, NOW_ANCHOR).some(
      (candidate) => candidate.availability === "eligible",
    );
    expect(stillEligible, "precondition: another real ward must still be eligible").toBe(true);

    const map = severeCauseMap([...openMovements, movement]);
    expect(
      map.get(movement.id),
      "delayGroups must not call this no_eligible_bed while another ward is eligible",
    ).toBeUndefined();
    expect(causeOf(movement, NOW_ANCHOR, map)).not.toBe("no_eligible_bed");
  });
});
