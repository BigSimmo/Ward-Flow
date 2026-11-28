import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The movement drawer reads the router for its Open on Home and Find a bed steps (r10).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { homeChipFigures } from "@/components/ward-management/ward-shared-figures";
import { replaceSearchParams } from "@/components/ward-management/ward-url-state";
import { journeyStages } from "@/components/ward-management/movements/movements-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";

// Home flow (Q340, Q341, Q345, 3 Nov 2026): the "My List | Open | Planned" switch became the
// "Home list" switch, Needs you and Flow. Flow is the stage-grouped queue (was Open), and referrals
// are listed only under Needs you.
// r10 item 1 folded Flow into Waiting: Home is Needs you only on a laptop, with no list switch.

/** Opens every stage's "Show all N" so the Flow card lists every row (each stage shows 5 at rest). */
function showEveryFlowRow(queue: HTMLElement): void {
  for (const more of within(queue).queryAllByRole("button", { name: /^Show all \d+$/u })) {
    if (more.getAttribute("aria-expanded") !== "true") fireEvent.click(more);
  }
}

function renderMovements() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

function DomainStateProbe() {
  const { movements, referrals } = useWardFlow();
  return <output data-testid="ward-refinement-domain-state">{JSON.stringify({ movements, referrals })}</output>;
}

function renderCoordinator() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
      <DomainStateProbe />
    </WardFlowProvider>,
  );
}

// Movements redesign (1 Nov 2026, Q102): the Tier 1 attention pills went; the jump links are now
// the "Where they wait" rows in Shape of the day, each revealing its stage's first movement.
function firstAttentionTarget(): { button: HTMLElement; movementId: string } {
  const open = seedWardFlowState().movements.filter(isOpen);
  const stage = journeyStages(open, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).find(
    (candidate) => candidate.id !== "arrived" && candidate.movements.length > 0,
  );
  expect(stage, "the real fixture must have an open stage with a journey").toBeDefined();
  fireEvent.click(
    within(screen.getByRole("group", { name: "Movement side view" })).getByRole("button", { name: "Shape of the day" }),
  );
  const heat = screen.getByRole("tabpanel", { name: "Where they wait" });
  return { button: within(heat).getByRole("button", { name: stage!.label }), movementId: stage!.movements[0].id };
}

/** The worklist record for a movement, found by its hidden key (rows show the patient's name). */
function recordFor(movementId: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`li[data-record-key='${movementId}']`);
  expect(row, `no worklist record for ${movementId}`).not.toBeNull();
  return row!;
}

describe("Q004 refinement interaction regressions", () => {
  it("consumes an attention reveal once, preserves grouping-control focus, and permits a fresh repeated reveal", () => {
    renderMovements();
    const { button, movementId } = firstAttentionTarget();

    fireEvent.click(button);
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();

    // Simplification 26 Nov 2026: Sort is one kit menu on the list head, not an Arrange radio row.
    const sort = screen.getByTestId("ward-movements-sort");
    sort.focus();
    fireEvent.click(sort);
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Transport/u }));
    expect(screen.getByTestId("ward-movements-sort")).toHaveTextContent("Sort: Transport");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Choosing a sort leaves focus on the sort control, not on a reset page or the worklist top.
    expect(screen.getByTestId("ward-movements-sort")).toHaveFocus();

    fireEvent.click(button);
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns from Resolved today to Open and focuses the requested attention record", async () => {
    renderMovements();
    const { button, movementId } = firstAttentionTarget();
    const resolvedTab = screen.getByRole("tab", { name: /Resolved today/u });

    fireEvent.click(resolvedTab);
    // The tab lives in the address (usability review, 24 Oct 2026), announced a microtask later.
    await act(async () => {});
    expect(resolvedTab).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector(`li[data-record-key='${movementId}']`)).toBeNull();

    fireEvent.click(button);
    await act(async () => {});
    expect(screen.getByRole("tab", { name: /^Open\b/u })).toHaveAttribute("aria-selected", "true");
    expect(recordFor(movementId)).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts Command with the shortlist closed, opens it only on selection, and Close clears view state only", () => {
    renderCoordinator();
    const row = screen.getAllByRole("button", { name: /^Open referral for /u })[0]!;
    const before = screen.getByTestId("ward-refinement-domain-state").textContent;

    // Home v7 (Josh, 22 Oct 2026): nobody is pre-selected. At rest Placement is a prompt with
    // nothing to act on, and no row is pressed until a coordinator picks one.
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull(); // notes 4: no at-rest prompt
    expect(document.querySelector('aside[aria-label="Placement"]')).toBeNull();
    expect(screen.queryByLabelText("Referral placement")).toBeNull();

    fireEvent.click(row);
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull();
    const shortlist = screen.getByTestId("home-placement-drawer");
    expect(shortlist).toBeInTheDocument();
    fireEvent.click(within(shortlist).getByRole("button", { name: "Close placement and clear selection" }));

    expect(screen.queryByTestId("home-placement-prompt")).toBeNull(); // notes 4: no at-rest prompt
    expect(screen.queryByTestId("home-placement-drawer")).toBeNull();
    expect(screen.getByTestId("ward-refinement-domain-state").textContent).toBe(before);
  });

  it("offers nothing to act on before a patient is chosen, on Home", () => {
    // Home v7 replaced the WP-06 preview (Audit 1, Josh 20 Oct): with no preview there is no
    // first tap to intercept, so Home's one list (Needs you) offers a Placement action at rest.
    renderCoordinator();
    const before = screen.getByTestId("ward-refinement-domain-state").textContent;
    expect(screen.queryByRole("button", { name: /^Offer /u })).toBeNull();
    expect(screen.queryByTestId("ward-placement-top-of-queue")).toBeNull();
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull(); // notes 4: no at-rest prompt
    expect(screen.getByTestId("ward-refinement-domain-state").textContent).toBe(before);
  });

  // r10 item 1: the "clears the chosen patient when the coordinator switches lists" case went with the Flow list.

  // Sticky header redesign (Josh, 9 Nov 2026): Home's hero no longer has a Past target chip; the
  // overdue highlight comes from the next step ("N past target in the flow", Show past target), whose
  // figure is Home's own shared count (homeChipFigures). That step shows only when nothing is queued to
  // act on or decide, so it is hidden on the seed (which has queued referrals); this test drives the
  // queue directly against the figure Home would show.
  it("highlights exactly as many queue rows as the shared past-target count says", () => {
    const queue = queueOrder(seedWardFlowState().movements.filter(isOpen), NOW_ANCHOR);
    const count = homeChipFigures(queue, NOW_ANCHOR, undefined).overdueInQueue;
    expect(count, "the seed has no overdue movement, so this test proves nothing").toBeGreaterThan(0);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PriorityQueue
          movements={queue}
          now={NOW_ANCHOR}
          selectedId={undefined}
          onSelect={() => {}}
          filterEdId={undefined}
          onClearFilter={() => {}}
          highlight="overdue"
          onClearHighlight={() => {}}
        />
      </WardFlowProvider>,
    );
    const flow = screen.getByRole("region", { name: "Flow" });
    showEveryFlowRow(flow);
    const rows = within(flow).getAllByTestId(/^ward-queue-row-/u);
    expect(rows, "every Flow row is listed while a highlight is on").toHaveLength(queue.length);
    expect(rows.filter((row) => row.getAttribute("data-dim") !== "true")).toHaveLength(count);
    expect(flow).toHaveTextContent(`${count} overdue highlighted, all rows stay`);
  });

  it("retains an explicitly selected referral as the shortlist subject across Needs you focus switches", () => {
    // Home flow (Q340, 3 Nov 2026): the Patients/Referrals queue tabs went; referrals are listed
    // only under Needs you. Its nearest equivalent is the "To decide" focus, which narrows Needs you
    // to referrals and back without leaving the list, so the selection must survive it. Sticky header
    // redesign (Josh, 9 Nov 2026): the hero's To decide chip went; the focus is the page address's
    // `focus=decide` (the next step sets it when referrals lead), and the list's Show all clears it.
    renderCoordinator();

    // Accepted pulls carry a referral id too; the referral to decide is the row that opens one.
    const openReferral = screen.getAllByRole("button", { name: /^Open referral for /u })[0];
    expect(openReferral, "the real fixture must expose at least one queued referral").toBeDefined();
    const referralId = openReferral!.closest("li")!.getAttribute("data-referral-id")!;
    fireEvent.click(openReferral!);

    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
    act(() => replaceSearchParams({ focus: "decide" }));
    const showAll = screen.getByTestId("home-list-show-all");
    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
    fireEvent.click(showAll);
    expect(screen.queryByTestId("home-list-show-all")).toBeNull();
    expect(screen.getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
  });
});
