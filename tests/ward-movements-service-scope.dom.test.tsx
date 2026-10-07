import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isOpen } from "@/components/ward-management/ward-derivations";
import { journeyStages } from "@/components/ward-management/movements/movements-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { inServiceSuffix, MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import {
  movementBelongsToService,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { resetWardLiveRegionForTests, WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task D2 (item 44 — the
 * service chooser, Movements lane). §2 "Per screen": *"the list is scoped. Figures and the 48-hour
 * chart are not, and a sentence says so."* §3 "Movements": the exact sentence, plus the shared
 * scope bar (S2: the urgent-outside-service line).
 *
 * ⚠️ **THIS FILE NEVER RE-DERIVES MEMBERSHIP.** Every expected value below comes from calling the
 * same S1 functions (`movementBelongsToService`, `urgentMovementsOutsideService`) the screen itself
 * now calls, over the same real seed (`wardMovements`) — a test that hand-picks which movement ids
 * "should" be inside or outside a service tests a fixture nothing ships, the same trap
 * `ward-movements-screen.dom.test.tsx`'s own header warns against.
 *
 * ⚠️ **`movement-horizon-gantt.tsx`'s OWN LOGIC IS NOT OWNED HERE.** This screen must keep passing
 * it the SAME `horizonLanes`, built from the whole unscoped `movements` array, whether or not a
 * service is chosen — the "identical with and without a service" test below pins that behaviourally
 * (byte-identical rendered text), without touching the gantt component itself.
 */

const NOW = NOW_ANCHOR;
const units = allUnits();
const CONFIG = defaultWardConfiguration();
// The screen renders `seedWardFlowState()` (offset zero via `WardFlowProvider`'s
// `initialNow={NOW}`) — the raw `wardMovements` fixture PLUS the 17 movements
// `applyRulingsDemoOverlay` (ward-rulings-demo.ts) adds, all open. Verified this does not disturb
// the destination_review order pinned below (`journeyStages` sorts by openedAt, not array
// position): all 17 overlay movements have `openedAt` between NOW-40 and NOW-200 and none sets
// `legalForm.dueAt`, so none can sort ahead of WF-009 (NOW-420) or WF-017 (NOW-400), the two
// movements the stage-summary-jump test below pins by id.
const ALL_MOVEMENTS = seedWardFlowState().movements;
const openMovements = ALL_MOVEMENTS.filter(isOpen);

// East Metro (rph-ed's service) has both movements inside and outside it over the real seed.
// `tests/ward-service-scope.test.ts`'s own anti-vacuity describe proves this holds for every
// HealthService, not just this one, so this choice is not a cherry-pick that happens to work.
const CHOSEN_SERVICE = "East Metro" as const;

function renderScreen() {
  const view = render(
    <WardFlowProvider initialNow={NOW}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
  // v6 (7 Oct 2026): the worklist shows the first rows of each group until Show all; these
  // cases read every row, so they open the full list first.
  // A scoped list short enough to show whole has no Show all button.
  const showAll = screen.queryByRole("button", { name: /^Show all \d+$/u });
  if (showAll) fireEvent.click(showAll);
  return view;
}

function worklistPanel(): HTMLElement {
  return screen.getByRole("region", { name: /Movement worklist/u });
}

beforeEach(() => {
  resetServiceScopeForTests();
  resetWardLiveRegionForTests();
});

afterEach(() => {
  resetServiceScopeForTests();
  resetWardLiveRegionForTests();
});

describe("Movements — service scoping (build plan D2, item 44)", () => {
  it("the chosen service has members and non-members over the real seed, or the tests below are vacuous", () => {
    const shown = wardMovements.filter((movement) => movementBelongsToService(movement, CHOSEN_SERVICE, units));
    const outside = wardMovements.filter((movement) => !movementBelongsToService(movement, CHOSEN_SERVICE, units));
    expect(shown.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);
  });

  it("with a service chosen, the movement worklist shows only members", () => {
    setServiceScope(CHOSEN_SERVICE);
    renderScreen();
    const board = worklistPanel();

    const nonMembers = wardMovements.filter((movement) => !movementBelongsToService(movement, CHOSEN_SERVICE, units));
    for (const movement of nonMembers) {
      expect(
        board.querySelector(`[data-ward-primitive='record-row'][data-record-key='${movement.id}']`),
        `non-member ${movement.id} rendered in the scoped worklist`,
      ).toBeNull();
    }

    const members = wardMovements.filter((movement) => movementBelongsToService(movement, CHOSEN_SERVICE, units));
    for (const movement of members) {
      expect(
        board.querySelector(`[data-ward-primitive='record-row'][data-record-key='${movement.id}']`),
        `member ${movement.id} missing from the scoped worklist`,
      ).toBeInTheDocument();
    }
  });

  it("with All services (nothing chosen), the worklist is unchanged and no scope bar or sentence renders", () => {
    renderScreen();
    const board = worklistPanel();
    for (const movement of wardMovements) {
      expect(
        board.querySelector(`[data-ward-primitive='record-row'][data-record-key='${movement.id}']`),
      ).toBeInTheDocument();
    }
    // TEST 7: presence-for-every-id already guards drops, but not an EXTRA or DUPLICATED row (a
    // mutation that renders every real id plus a phantom one would still pass the loop above) — the
    // exact count closes that gap.
    expect(board.querySelectorAll('[data-ward-primitive="record-row"][data-record-key]').length).toBe(
      ALL_MOVEMENTS.length,
    );
    expect(screen.queryByTestId("ward-service-scope-bar")).not.toBeInTheDocument();
    // D-f: the sentence moved out of the worklist and to the top of the page (see below) — it must
    // never render at all while All services is chosen, wherever it would have lived.
    expect(screen.queryByTestId("ward-movements-not-these-figures")).not.toBeInTheDocument();
  });

  it("the headline day figures, the traffic panel and the transport/shape asides are byte-identical with and without a service chosen", () => {
    // D-b: "Worth your attention" (inside The day panel) now legitimately gains an "Outside {S}"
    // marker on out-of-scope pills when a service is chosen — a deliberate content change, not a
    // regression — so this no longer compares The day panel's raw textContent wholesale. It instead
    // isolates the panel's own numeric FIGURES via `movements-day-metric` (added for exactly this),
    // which must still be byte-identical, and separately proves the attention band's own movement
    // ids and order are unaffected (only the marker differs) further down this file.
    const withoutService = renderScreen();
    const dayMetrics = screen.getAllByTestId("movements-day-metric").map((el) => el.textContent);
    const trafficPanel = screen.getByRole("region", { name: /Today.s traffic/u }).textContent;
    const transportPanel = screen.getByRole("region", { name: "Transport right now" }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "Shape of the day" }));
    const shapePanel = screen.getByRole("region", { name: "Shape of the day" }).textContent;
    withoutService.unmount();

    setServiceScope(CHOSEN_SERVICE);
    renderScreen();
    expect(screen.getAllByTestId("movements-day-metric").map((el) => el.textContent)).toEqual(dayMetrics);
    expect(screen.getByRole("region", { name: /Today.s traffic/u }).textContent).toBe(trafficPanel);
    expect(screen.getByRole("region", { name: "Transport right now" }).textContent).toBe(transportPanel);
    fireEvent.click(screen.getByRole("button", { name: "Shape of the day" }));
    expect(screen.getByRole("region", { name: "Shape of the day" }).textContent).toBe(shapePanel);
  });

  it("renders the exact §3 Movements sentence, at the top of the page, and the scope bar's D-a urgent-outside-service line", () => {
    setServiceScope(CHOSEN_SERVICE);
    renderScreen();

    // D-f: the sentence lives above the whole-network panels now, never on the worklist.
    expect(screen.getByTestId("ward-movements-not-these-figures")).toHaveTextContent(
      `The Service selector scopes the list below to ${CHOSEN_SERVICE}, not these figures.`,
    );
    expect(within(worklistPanel()).queryByText(/not these figures/u)).not.toBeInTheDocument();

    const bar = screen.getByTestId("ward-service-scope-bar");
    const shown = ALL_MOVEMENTS.filter((movement) => movementBelongsToService(movement, CHOSEN_SERVICE, units)).length;
    const total = ALL_MOVEMENTS.length;
    expect(within(bar).getByTestId("ward-service-scope-bar-summary")).toHaveTextContent(
      `Showing ${shown} of ${total} movements, in ${CHOSEN_SERVICE}.`,
    );

    // D-a: the sentence states the shared definition, not just the word "urgent".
    const urgentOutside = urgentMovementsOutsideService(openMovements, CHOSEN_SERVICE, units, NOW, CONFIG).length;
    const urgentNode = within(bar).getByTestId("ward-service-scope-bar-urgent");
    if (urgentOutside === 0) {
      expect(urgentNode).toHaveTextContent(
        `Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside ${CHOSEN_SERVICE}.`,
      );
    } else {
      expect(urgentNode).toHaveTextContent(
        `${urgentOutside} ${urgentOutside === 1 ? "movement" : "movements"} outside ${CHOSEN_SERVICE}: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.`,
      );
    }
  });
});

describe("D-f — the scope bar sits at the top of the page, and the sentence sits above the whole-network panels, never on the worklist", () => {
  it("the scope bar and its sentence precede The day panel in document order", () => {
    setServiceScope(CHOSEN_SERVICE);
    renderScreen();

    const bar = screen.getByTestId("ward-service-scope-bar");
    const sentence = screen.getByTestId("ward-movements-not-these-figures");
    const dayPanel = screen.getByRole("region", { name: "The day" });

    // MDN `Node.compareDocumentPosition`: bit 4 (DOCUMENT_POSITION_FOLLOWING) set on the result of
    // `a.compareDocumentPosition(b)` means b comes after a — i.e. a precedes b.
    expect(
      bar.compareDocumentPosition(dayPanel) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the scope bar must come BEFORE The day panel in document order",
    ).toBeTruthy();
    expect(
      sentence.compareDocumentPosition(dayPanel) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the 'not these figures' sentence must come BEFORE The day panel in document order",
    ).toBeTruthy();
  });
});

describe("D-b — Worth your attention stays whole-network and marks rows outside the chosen service", () => {
  it("every attention pill's Outside marker agrees with movementBelongsToService, for members and non-members alike", () => {
    setServiceScope(CHOSEN_SERVICE);
    renderScreen();

    const pills = screen.getAllByRole("button", { name: /^Find /u });
    expect(pills.length, "no attention pill rendered — this scenario proves nothing").toBeGreaterThan(0);
    for (const pill of pills) {
      // Owner, 26 Sept 2026: the pill names the patient; its movement is read from the hidden key.
      const movementId = pill.getAttribute("data-record-key");
      expect(movementId, "every attention pill carries its movement's key").not.toBeNull();
      const movement = ALL_MOVEMENTS.find((candidate) => candidate.id === movementId);
      expect(movement, `${movementId} from an attention pill is not a real seeded movement`).toBeDefined();
      const isMember = movementBelongsToService(movement!, CHOSEN_SERVICE, units);
      const marker = within(pill).queryByTestId(`movements-attention-outside-${movementId}`);
      expect(marker === null, `${movementId}: Outside marker presence disagrees with membership`).toBe(isMember);
    }
  });

  it("the attention band's own CORE (tier 1) movement ids and order are unaffected by scoping — R2 item 3 only ever APPENDS", () => {
    // ⚠️ R2 item 3 changed what this proves. Before it, the scoped and unscoped attention bands
    // were byte-identical lists (only the "Outside {S}" marker differed) because the band read
    // ONLY `tierOneOpen`, which never depends on `service`. R2 item 3 deliberately appends
    // `urgentMovementsOutsideService` movements the tier-1 cut missed (WF-018: tier 3, flagged) —
    // so the scoped list can legitimately be LONGER now. What must still hold is that the tier-1
    // CORE — however many pills render unscoped — is a stable, unreordered PREFIX of the scoped
    // list; the widening must only ever add rows after it, never reorder or drop one.
    const withoutService = renderScreen();
    const idsWithoutService = screen
      .getAllByRole("button", { name: /^Find /u })
      .map((pill) => pill.getAttribute("data-record-key") ?? undefined);
    withoutService.unmount();

    setServiceScope(CHOSEN_SERVICE);
    renderScreen();
    const idsWithService = screen
      .getAllByRole("button", { name: /^Find /u })
      .map((pill) => pill.getAttribute("data-record-key") ?? undefined);

    expect(idsWithService.slice(0, idsWithoutService.length)).toEqual(idsWithoutService);
  });

  it("R2 item 3 catcher: WF-018 (North Metro, flagged, tier 3) is named here too, scoped to East Metro, marked Outside", () => {
    const wf018 = wardMovements.find((movement) => movement.id === "WF-018");
    expect(wf018, "WF-018 missing from the seed").toBeDefined();
    expect(wf018!.flaggedUrgent, "WF-018 must be flagged or this catcher proves nothing").toBe(true);
    expect(wf018!.urgency, "WF-018 must be tier 3 (not tier 1) or this catcher proves nothing new").toBe(3);
    expect(
      movementBelongsToService(wf018!, CHOSEN_SERVICE, units),
      "WF-018 must be outside East Metro or this catcher proves nothing",
    ).toBe(false);

    setServiceScope(CHOSEN_SERVICE);
    renderScreen();

    const pill = document.querySelector("button[data-record-key='WF-018']") as HTMLElement;
    expect(pill).not.toBeNull();
    expect(pill.getAttribute("aria-label")).not.toMatch(/WF-/u);
    expect(within(pill).getByTestId("movements-attention-outside-WF-018")).toHaveTextContent(
      `Outside ${CHOSEN_SERVICE}`,
    );
  });
});

describe("D-d — a jump link to a movement outside the worklist opens its drawer and announces why (TEST 5)", () => {
  it("clicking an outside attention pill opens that movement's own drawer and announces the exact D-d sentence", () => {
    setServiceScope(CHOSEN_SERVICE);
    render(
      <WardFlowProvider initialNow={NOW}>
        <WardLiveRegion />
        <MovementsScreen />
      </WardFlowProvider>,
    );

    const outsideMarkers = screen.queryAllByTestId(/^movements-attention-outside-/u);
    expect(
      outsideMarkers.length,
      "no attention movement is outside East Metro — this scenario proves nothing",
    ).toBeGreaterThan(0);
    const marker = outsideMarkers[0];
    const movementId = (marker.getAttribute("data-testid") ?? "").replace("movements-attention-outside-", "");
    expect(
      movementBelongsToService(
        ALL_MOVEMENTS.find((m) => m.id === movementId)!,
        CHOSEN_SERVICE,
        units,
      ),
      `${movementId} must actually be outside ${CHOSEN_SERVICE} or this scenario proves nothing`,
    ).toBe(false);

    fireEvent.click(marker);

    // The drawer opened on THAT movement — `Sheet`'s own `role="dialog"`, named from its title
    // `"{id} — what is recorded"`.
    // Owner, 26 Sept 2026: named by the patient, resolved from the seed register, never the WF number.
    const seed = seedWardFlowState();
    const person = resolveSubjectPatient(
      seed.movements.find((movement) => movement.id === movementId),
      seed,
    );
    expect(screen.getByRole("dialog", { name: new RegExp(`^${person.formalName}`) })).toBeInTheDocument();
    expect(screen.getByTestId("ward-live-region")).toHaveTextContent(
      `This patient is outside ${CHOSEN_SERVICE}. Show all services to see it in the list.`,
    );
    // Privacy review, 27 Sept 2026: the spoken announcement never carries the patient's name.
    expect(screen.getByTestId("ward-live-region")).not.toHaveTextContent(person.displayName);
  });
});

/**
 * R2 item 5 (P3): "No movements at this stage.", "No movement is in this group right now." and
 * "No movement has resolved today." each name a SCOPED population — narrowed to the chosen
 * service while one is chosen. Unqualified, an empty one reads as "nothing anywhere" rather than
 * "nothing in {S}". `inServiceSuffix` is the one function all three sentences call.
 */
describe("empty-worklist sentences name the chosen service (R2 item 5)", () => {
  it("inServiceSuffix: empty with no service chosen, ' in {S}' once one is", () => {
    expect(inServiceSuffix(null)).toBe("");
    expect(inServiceSuffix("East Metro")).toBe(" in East Metro");
    expect(inServiceSuffix("WACHS")).toBe(" in WACHS");
  });

  it("the stage-tab empty sentence names WACHS when scoped", () => {
    // Was East Metro until the 2026-09-17 sample-data addition (WF-021..WF-031) gave East Metro a
    // member at every one of the seven stages (it was missing handover_ready — WF-021 fills it).
    // WACHS still has a genuinely empty stage over the real seed: no WACHS movement is ever
    // "placement_requested" — WACHS has no emergency department of its own (`ward-movements.ts`'s
    // own top comment: it is reached only by referring or accepting a movement onward from a
    // metropolitan ED), so a movement can only belong to WACHS once it has already been referred or
    // accepted, past the placement_requested stage. Re-measured directly against the real seed
    // (movementBelongsToService over every MOVEMENT_STAGES member), not assumed.
    const WACHS_SERVICE = "WACHS" as const;
    setServiceScope(WACHS_SERVICE);
    renderScreen();
    expect(
      screen.queryByText(`No movements at this stage in ${WACHS_SERVICE}.`),
      "precondition: at least one stage must be empty once scoped to WACHS, or this proves nothing",
    ).not.toBeNull();
    expect(screen.queryByText("No movements at this stage.")).toBeNull();
  });

  it("the transport-group empty sentence names East Metro when scoped, and stays bare when not", () => {
    const withoutService = renderScreen();
    fireEvent.click(screen.getByRole("radio", { name: /transport/i }));
    expect(
      screen.queryByText("No movement is in this group right now."),
      "precondition: at least one transport group is empty over the real seed, unscoped",
    ).not.toBeNull();
    withoutService.unmount();

    setServiceScope(CHOSEN_SERVICE);
    renderScreen();
    fireEvent.click(screen.getByRole("radio", { name: /transport/i }));
    expect(screen.queryByText(`No movement is in this group right now in ${CHOSEN_SERVICE}.`)).not.toBeNull();
    expect(screen.queryByText("No movement is in this group right now.")).toBeNull();
  });
});

/**
 * R2 item 7 (P3): the Shape-of-the-day "Stage" tab is deliberately whole-network (`openStages`,
 * unscoped — the byte-identical-with-and-without-a-service test above depends on that staying
 * true), so its stage-summary jump link can name a stage whose FIRST member (by `journeyStages`'
 * own array order) sits outside the chosen service even when another member of that same stage
 * does not. Before this fix the link always jumped to `stage.movements[0]` regardless, so a click
 * that COULD have scrolled to a real, visible row instead fell through to `jumpToMovement`'s own
 * D-d "outside" handling (open the drawer, announce why) for no reason — a working jump skipped
 * when a working target existed.
 */
describe("the stage-summary jump prefers an in-scope member over the stage's raw first entry (R2 item 7)", () => {
  it("Destination review: first=WF-009 (outside East Metro) but WF-017 (inside) is jumped to instead", () => {
    const stages = journeyStages(openMovements, NOW);
    const destinationReview = stages.find((stage) => stage.id === "destination_review");
    expect(destinationReview, "destination_review stage missing from the real seed").toBeDefined();
    const [rawFirst] = destinationReview!.movements;
    expect(rawFirst?.id, "the stage's own first member must still be WF-009 or this scenario proves nothing").toBe(
      "WF-009",
    );
    expect(
      movementBelongsToService(rawFirst!, CHOSEN_SERVICE, units),
      "WF-009 must be outside East Metro or this scenario proves nothing",
    ).toBe(false);
    const firstInScope = destinationReview!.movements.find((movement) =>
      movementBelongsToService(movement, CHOSEN_SERVICE, units),
    );
    expect(firstInScope?.id, "an in-scope member must exist in this stage or this scenario proves nothing").toBe(
      "WF-017",
    );

    setServiceScope(CHOSEN_SERVICE);
    render(
      <WardFlowProvider initialNow={NOW}>
        <WardLiveRegion />
        <MovementsScreen />
      </WardFlowProvider>,
    );

    // Shape of the day shares the side panel and starts hidden behind Transport right now.
    // Its Stage sub-tab is still the default once that view is open.
    fireEvent.click(screen.getByRole("button", { name: "Shape of the day" }));
    const stageLink = screen.getByRole("button", { name: /^Destination review:/u });
    fireEvent.click(stageLink);

    // The jump must have landed on WF-017 (in scope) via the ordinary reveal path, never on
    // WF-009's D-d "outside" fallback — no drawer opened, no "is outside" announcement.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-live-region")).not.toHaveTextContent(/is outside/u);
  });
});
