import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DELAY_OWNERS, delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { HealthService } from "@/components/ward-management/ward-model";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  movementBelongsToService,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";

/**
 * The Delays redesign (PR 48) opens on the "Action Runway" overview; the owner cards, the duration
 * band and the measured-none sentence these tests read live in the "Summary Cards" view, unchanged.
 */
function showSummaryCards() {
  fireEvent.click(screen.getByRole("button", { name: "Summary Cards" }));
}

/**
 * The `ADVANCE_CLOCK` scaffold `tests/ward-delays-legal-deadline.dom.test.tsx` established: moves
 * `now` forward without re-seeding the world, so a `dueAt` authored relative to `NOW_ANCHOR` stays
 * where it was and the clock genuinely crosses it. Duplicated here rather than imported — that file
 * marks it test-only scaffold, not a shared surface.
 */
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task D1 (item 44 — the service
 * chooser, §2 "Delays: scoped, plus S2."). Proves the Delays screen narrows its whole population —
 * the waiting list, its marks and the scope bar — to one chosen health service's own movements,
 * states S2's own "never hidden" urgent-outside-service line, keeps the three mark sources
 * (`tests/ward-delays-mark-controls.dom.test.tsx`) working over the narrowed population, and renders
 * unchanged while All services is chosen.
 *
 * `movementBelongsToService` and `urgentMovementsOutsideService` are driven straight from
 * `ward-service-scope.ts` (already folded, S1) rather than re-implemented — a test that copies the
 * join it is checking guards nothing, the same reasoning `tests/ward-service-scope.test.ts` itself
 * gives for driving the module directly rather than mirroring it.
 */

const seededMovements = seedWardFlowState().movements;
const OPEN = seededMovements.filter(isOpen);
const UNITS = allUnits();
const SERVICE: HealthService = "South Metro";
const MEMBER_OPEN = OPEN.filter((movement) => movementBelongsToService(movement, SERVICE, UNITS));
const EXCLUDED_OPEN = OPEN.filter((movement) => !movementBelongsToService(movement, SERVICE, UNITS));
const CONFIG = defaultWardConfiguration();
const URGENT_OUTSIDE = urgentMovementsOutsideService(OPEN, SERVICE, UNITS, NOW_ANCHOR, CONFIG);
const GROUPS_UNDER_SERVICE = delayGroups(MEMBER_OPEN, UNITS, NOW_ANCHOR);

function ownerPeopleUnderService(ownerId: string): number {
  return GROUPS_UNDER_SERVICE.filter((group) => ownerOf(group.cause) === ownerId).reduce(
    (sum, group) => sum + group.movements.length,
    0,
  );
}

// Picked dynamically rather than hard-coded, the same reasoning `ward-delays-mark-controls
// .dom.test.tsx`'s own "fixture sanity" case gives: the owner used below must actually have
// somebody under it once the population is narrowed to South Metro, not merely over the whole
// network.
const MARKABLE_OWNER = DELAY_OWNERS.find((owner) => ownerPeopleUnderService(owner.id) > 0);

beforeEach(() => {
  // The provider persists demo state to sessionStorage and the service choice lives there too
  // (`ward-service-store.ts`) — both cleared so no earlier test's choice or dispatch leaks in.
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetServiceScopeForTests();
});

describe("fixture sanity: South Metro actually splits the open population both ways", () => {
  it("has members, has exclusions, and its urgent-outside population is D-a's, not the narrow pre-D-a one", () => {
    expect(
      MEMBER_OPEN.length,
      "no open movement belongs to South Metro — this fixture cannot prove scoping",
    ).toBeGreaterThan(0);
    expect(
      EXCLUDED_OPEN.length,
      "every open movement belongs to South Metro — this fixture cannot prove exclusion",
    ).toBeGreaterThan(0);
    expect(MEMBER_OPEN.length + EXCLUDED_OPEN.length).toBe(OPEN.length);

    const wf018 = OPEN.find((movement) => movement.id === "WF-018");
    expect(wf018, "WF-018 missing from the open fixture").toBeDefined();
    expect(wf018!.flaggedUrgent, "WF-018 is no longer the fixture's flagged-urgent movement").toBe(true);
    expect(
      MEMBER_OPEN.some((movement) => movement.id === "WF-018"),
      "WF-018 must be OUTSIDE South Metro, or this file's urgent-outside test proves nothing",
    ).toBe(false);
    // D-a widened `urgentMovementsOutsideService` past the old narrow "flagged or breached" rule
    // (`tests/ward-service-scope.test.ts` proves the widening itself, movement by movement) — this
    // file drives the exported function directly rather than hand-listing who it should name, so a
    // fixture change updates this expectation by re-running the suite, never by guessing by hand.
    // 2026-09-17 sample-data addition: WF-022 (escalation) and WF-030 (flaggedUrgent) both belong
    // to East Metro, so both are outside South Metro; WF-023 (ED wait past access target) belongs
    // to North Metro, also outside South Metro. See ward-service-scope.test.ts for the full
    // per-service derivation.
    expect(URGENT_OUTSIDE.map((movement) => movement.id).sort()).toEqual([
      "WF-018",
      "WF-022",
      "WF-023",
      "WF-030",
      "WF-308",
      "WF-RD11",
      "WF-RD12",
    ]);

    expect(MARKABLE_OWNER, "no owner has any member under South Metro — the marks test below needs one").toBeDefined();
  });
});

describe("the Delays screen narrows to a chosen service (item 44, task D1)", () => {
  it("with a service chosen, the waiting list holds only that service's own movements", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    const region = screen.getByRole("region", { name: "Waiting" });
    const rows = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]'));
    expect(rows.length, "row count must equal South Metro's own open population, not the whole network").toBe(
      MEMBER_OPEN.length,
    );

    const renderedIds = new Set(rows.map((row) => row.getAttribute("data-record-key") ?? ""));
    for (const movement of MEMBER_OPEN) {
      expect(renderedIds.has(movement.id), `${movement.id} belongs to South Metro and must be on the list`).toBe(true);
    }
    for (const movement of EXCLUDED_OPEN) {
      expect(
        renderedIds.has(movement.id),
        `${movement.id} does not belong to South Metro and must not be on the list`,
      ).toBe(false);
    }
  });

  it("shows the scope bar with the exact §3 summary, and S2's urgent-outside line when urgent movements exist outside", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-service-scope-bar")).toBeInTheDocument();
    expect(screen.getByTestId("ward-service-scope-bar-summary").textContent ?? "").toContain(
      `Showing ${MEMBER_OPEN.length} of ${OPEN.length} movements, in South Metro.`,
    );
    // D-a: the sentence states the shared definition, and the count is D-a's widened one.
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      `${URGENT_OUTSIDE.length} movements outside South Metro: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.`,
    );
  });

  it("marks (owner, cause, chip) still work under a service — highlighting the scoped population, never hiding it", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    showSummaryCards();

    const ownerId = MARKABLE_OWNER!.id;
    const ownerCard = screen.getByTestId(`delays-owner-${ownerId}`);
    fireEvent.click(ownerCard);
    expect(ownerCard).toHaveAttribute("aria-pressed", "true");

    const region = screen.getByRole("region", { name: "Waiting" });
    const rows = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]'));
    expect(rows.length, "an owner mark must never hide a row, scoped or not").toBe(MEMBER_OPEN.length);

    const memberIdsForOwner = new Set<string>(
      GROUPS_UNDER_SERVICE.filter((group) => ownerOf(group.cause) === ownerId).flatMap((group) =>
        group.movements.map((movement) => movement.id),
      ),
    );
    let markedRows = 0;
    for (const row of rows) {
      const id = row.getAttribute("data-record-key") ?? "";
      const saysMarked = (row.textContent ?? "").includes(`Marked: ${MARKABLE_OWNER!.name}`);
      expect(saysMarked, `${id}'s marked state disagrees with the scoped owner grouping`).toBe(
        memberIdsForOwner.has(id),
      );
      if (saysMarked) markedRows += 1;
    }
    expect(markedRows).toBe(memberIdsForOwner.size);

    expect(
      region.querySelector("[data-ward-panel-count]")?.textContent,
      "the panel count must read against the SCOPED population, not the whole network",
    ).toBe(`${memberIdsForOwner.size} of ${MEMBER_OPEN.length} marked · ${MARKABLE_OWNER!.name}`);

    // A cause row and the chip bar are the other two mark sources over the same scoped population;
    // this proves neither one hides a row either, over-and-above the owner-card case above.
    const causeButton = screen.getAllByTestId(new RegExp("^delays-cause-"))[0] as HTMLElement | undefined;
    expect(causeButton, "no cause row rendered under South Metro to prove the second mark source").toBeDefined();
    fireEvent.click(causeButton!);
    expect(causeButton).toHaveAttribute("aria-pressed", "true");
    expect(
      Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]')).length,
      "a cause mark must never hide a row, scoped or not",
    ).toBe(MEMBER_OPEN.length);

    const lockedChipLabel = `Needs a locked bed ${MEMBER_OPEN.filter((movement) => movement.security === "Secure").length}`;
    fireEvent.click(screen.getByRole("button", { name: lockedChipLabel }));
    expect(screen.getByRole("button", { name: lockedChipLabel })).toHaveAttribute("aria-pressed", "true");
    expect(
      Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]')).length,
      "a chip mark must never hide a row, scoped or not",
    ).toBe(MEMBER_OPEN.length);
  });

  it("with All services chosen, the screen is unchanged — no scope bar, and every open movement is on the list", () => {
    // resetServiceScopeForTests() in beforeEach already leaves the store at All services (null).
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-service-scope-bar")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Waiting" });
    const rows = Array.from(region.querySelectorAll('[data-ward-primitive="record-row"]'));
    // ⚠️ TEST 7: a bare row COUNT is unfailable against a mutation that renders the right number of
    // WRONG rows (swap two movements of equal group size, say) — it was a length check only until
    // this task. Comparing the full, sorted list of rendered ids is a property that can actually
    // fail on that mutation, not only on a dropped or duplicated row.
    const renderedIds = rows.map((row) => row.getAttribute("data-record-key") ?? "").sort();
    expect(renderedIds).toEqual(OPEN.map((movement) => movement.id).sort());
  });
});

describe("WF-014 scenario — a legal form RUNNING OUT counts as urgent-outside (D-a, R1 P1 fix, TEST 1)", () => {
  const SERVICE: HealthService = "North Metro";

  it("once WF-014's form is running out, it appears in Worth your attention, marked Outside North Metro, and the scope bar counts it", () => {
    const wf014 = seededMovements.find((movement) => movement.id === "WF-014");
    expect(wf014, "WF-014 missing from the seed").toBeDefined();
    expect(
      movementBelongsToService(wf014!, SERVICE, UNITS),
      "WF-014 must be outside North Metro or this scenario proves nothing",
    ).toBe(false);
    // At NOW_ANCHOR, WF-014's `dueAt` is exactly 60 minutes out — `clockState` reads that as "due",
    // not yet "critical" (running out). Five minutes on, 55 remain and it crosses into "critical".
    expect(wf014!.legalForm?.dueAt).toBe(NOW_ANCHOR + 60);

    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock minutes={5} />
        <DelaysScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("test-advance-clock"));

    expect(screen.getByTestId("delays-attention-outside-WF-014")).toHaveTextContent(`Outside ${SERVICE}`);

    const now = NOW_ANCHOR + 5;
    const urgentOutside = urgentMovementsOutsideService(seededMovements.filter(isOpen), SERVICE, UNITS, now, CONFIG);
    expect(
      urgentOutside.some((movement) => movement.id === "WF-014"),
      "WF-014 must count as urgent-outside",
    ).toBe(true);
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      `${urgentOutside.length} ${urgentOutside.length === 1 ? "movement" : "movements"} outside ${SERVICE}: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.`,
    );
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).not.toHaveTextContent(
      `Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside ${SERVICE}.`,
    );
  });
});

describe("WF-009 scenario — the escalations register stays whole-network (D-b, TEST 2)", () => {
  const SERVICE: HealthService = "East Metro";

  it("WF-009 stays in the escalations register, marked Outside East Metro, and the register never reads empty", () => {
    const wf009 = seededMovements.find((movement) => movement.id === "WF-009");
    expect(wf009, "WF-009 missing from the seed").toBeDefined();
    expect(wf009!.escalation, "WF-009 must carry an escalation or this scenario proves nothing").toBeDefined();
    expect(
      movementBelongsToService(wf009!, SERVICE, UNITS),
      "WF-009 must be outside East Metro or this scenario proves nothing",
    ).toBe(false);

    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    // "Escalations" is the default-selected register tab, so its pane is already in the document.
    expect(screen.getByTestId("delays-escalation-outside-WF-009")).toHaveTextContent(`Outside ${SERVICE}`);
    expect(screen.queryByText("Nobody has been escalated today.")).not.toBeInTheDocument();
  });
});

describe("WF-018 scenario — flagged-urgent-but-not-severe patients outside the service are named, not just counted (R2 item 3, P2)", () => {
  const SERVICE: HealthService = "East Metro";

  it("WF-018 (North Metro, flagged, tier 3) appears in Worth your attention, marked Outside East Metro", () => {
    const wf018 = seededMovements.find((movement) => movement.id === "WF-018");
    expect(wf018, "WF-018 missing from the seed").toBeDefined();
    expect(wf018!.flaggedUrgent, "WF-018 must be flagged or this scenario proves nothing").toBe(true);
    expect(wf018!.urgency, "WF-018 must be tier 3 or this scenario proves nothing").toBe(3);
    expect(
      movementBelongsToService(wf018!, SERVICE, UNITS),
      "WF-018 must be outside East Metro or this scenario proves nothing",
    ).toBe(false);
    // WF-018's cause under `delayGroups` is `patient_or_family` (flagged, nothing else present) —
    // NOT one of `SEVERE_CAUSES` — so before R2 item 3 this panel, built only from severe-cause
    // network groups, never named it at all.
    const groups = delayGroups(OPEN, UNITS, NOW_ANCHOR);
    const wf018Group = groups.find((group) => group.movements.some((movement) => movement.id === "WF-018"));
    expect(wf018Group?.cause, "WF-018's own cause must not already be severe or this scenario proves nothing").toBe(
      "patient_or_family",
    );

    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("delays-attention-outside-WF-018")).toHaveTextContent(`Outside ${SERVICE}`);
  });
});

describe("the zero-case sentence states D-a's definition, and D-c's narrowed absence sentences carry 'in {S}' (TESTS 3 and 4)", () => {
  const SERVICE: HealthService = "South Metro";

  it("with nothing open at all: the exact zero-case line, every narrowed absence sentence named 'in {S}', and the whole-network register unqualified", () => {
    // `DelaysScreen`'s own `movements` override makes every population on this screen — scoped and
    // whole-network alike — deterministically empty, so every sentence below is provable without
    // depending on which real movements happen to be open today.
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={[]} />
      </WardFlowProvider>,
    );
    showSummaryCards();

    // D-a: the exact zero-case sentence, stating the definition.
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      `Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside ${SERVICE}.`,
    );

    // D-c: "Nobody is waiting..." — narrowed, so it names the service.
    expect(screen.getByTestId("ward-delays-nobody-waiting")).toHaveTextContent(
      `Nobody is waiting in any emergency department in ${SERVICE} right now.`,
    );

    // D-b: the escalations register is whole-network and unaffected by narrowing — its own absence
    // sentence stays exactly as it was, per D-c's "whole-network sentences stay as they are." Read
    // before switching tabs below, since only one register pane is ever in the document at once.
    expect(screen.getByText("Nobody has been escalated today.")).toBeInTheDocument();

    // D-c: "Nobody who was on this screen this morning has left it yet" — narrowed (`closedToday`
    // is built off the already-scoped `movements`), so it names the service too. On the "Resolved
    // today" tab, since that sentence only exists in that pane.
    fireEvent.click(screen.getByRole("tab", { name: /Resolved today/ }));
    expect(screen.getByRole("tabpanel", { name: /Resolved today/ }).textContent ?? "").toContain(
      `Nobody who was on this screen this morning has left it yet, in ${SERVICE}.`,
    );
  });
});
