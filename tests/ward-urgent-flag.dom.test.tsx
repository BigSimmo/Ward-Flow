import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { MovementDrawer } from "@/components/ward-management/movements/movement-drawer";
import { URGENT_MARK_REASONS } from "@/components/ward-management/ward-change-reasons";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ED_ACCESS_TARGET_MINUTES, type Movement } from "@/components/ward-management/ward-model";

/**
 * The owner asked the urgent flag to do TWO things: sort to the top, and be VISIBLE.
 *
 * `tests/ward-priority.test.ts` proves the first. This proves the second, and it is not a
 * formality: the flag moves a tier-3 patient with the shortest wait on the board above every
 * tier-1 patient who has waited hours. A coordinator looking at that row with nothing on it to
 * explain the position is being shown a queue that appears to be wrong. The ordering without the
 * label is the worse half of the feature, not half of it.
 */
describe("the urgent flag is visible on the row it moved", () => {
  function renderQueue() {
    render(
      <PriorityQueue
        movements={wardMovements}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
  }

  it("labels the flagged row, in the queue, where the ordering is read", () => {
    renderQueue();
    const flag = screen.getByTestId("ward-queue-flag-WF-018");
    expect(flag).toBeInTheDocument();
    expect(flag, "the label must say what it means, not just colour the row").toHaveTextContent(/flagged urgent/i);
  });

  it("labels ONLY the flagged rows, so the mark still means something", () => {
    renderQueue();
    const flagged = wardMovements.filter((movement) => movement.flaggedUrgent).map((movement) => movement.id);
    expect(flagged.length, "the fixture must carry a flagged movement for this to test anything").toBeGreaterThan(0);

    const unflagged = queueOrder(wardMovements, NOW_ANCHOR).filter((movement) => !movement.flaggedUrgent);
    expect(unflagged.length).toBeGreaterThan(1);
    for (const movement of unflagged) {
      expect(
        screen.queryByTestId(`ward-queue-flag-${movement.id}`),
        `${movement.id} is not flagged but carries the flag label — a mark on everybody marks nobody`,
      ).not.toBeInTheDocument();
    }
  });

  // Audit 1, Josh 20 Oct (CS-04): the queue is wait order; the flag marks its row wherever it sits.
  it("shows the flag on the flagged row, which keeps its place in wait order", () => {
    renderQueue();
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    expect(ordered[0].flaggedUrgent, "the longest wait leads, not the flag").toBe(false);
    const flagged = ordered.find((movement) => movement.flaggedUrgent)!;
    const row = screen.getByTestId(`ward-queue-row-${flagged.id}`);
    expect(row).toHaveTextContent(/flagged urgent/i);
    expect(row, "and the row still says its tier").toHaveTextContent(/tier 3/i);
  });

  /**
   * Item 37 (2026-09-17), widened by the review fix-forward (item 5) to name the reason too:
   * "Flag details not recorded." A flag saved before `Movement.urgentFlag`
   * existed still says so honestly rather than inventing an author, instant or reason. The
   * synthetic fixture's own flags now carry provenance (overall review, 20 Oct 2026), so this
   * builds a flagged movement without it.
   */
  it("reads 'Flag details not recorded' for a flag that carries no provenance", () => {
    const wf018 = wardMovements.find((movement) => movement.id === "WF-018");
    if (!wf018) throw new Error("fixture lost WF-018");
    const legacy: Movement = { ...wf018, urgentFlag: undefined, urgentFlagHistory: undefined };
    render(
      <PriorityQueue
        movements={[legacy]}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    const detail = screen.getByTestId("ward-queue-flag-detail-WF-018");
    expect(detail).toHaveTextContent("Flag details not recorded.");
  });

  it("names who flagged each seeded urgent row, so the first rows of Home explain themselves", () => {
    renderQueue();
    for (const movement of wardMovements.filter((candidate) => candidate.flaggedUrgent && !candidate.closure)) {
      expect(movement.urgentFlag, `${movement.id} is flagged without provenance`).toBeDefined();
      const detail = screen.getByTestId(`ward-queue-flag-detail-${movement.id}`);
      expect(detail).toHaveTextContent(/^Flagged urgent by .+ at .+: .+\.$/u);
      expect(detail).not.toHaveTextContent("was not recorded");
    }
  });

  /**
   * The other half of the same wording: a flag raised THROUGH the event carries provenance and
   * must say so, now including the reason label and the role LABEL (never the bare role string —
   * fix-forward item 5). WF-018 cannot prove this half — it predates the field — so this
   * constructs a movement with `urgentFlag` set, the same shape `FLAG_MOVEMENT_URGENT` writes.
   */
  it("reads 'Flagged urgent by {role label} at {time}: {reason label}' for a flag that carries provenance", () => {
    const base = wardMovements.find((movement) => !movement.flaggedUrgent && !movement.closure);
    if (!base) throw new Error("fixture has no open unflagged movement to build from");
    const withProvenance: Movement = {
      ...base,
      id: "WF-PROVENANCE-TEST",
      flaggedUrgent: true,
      urgentFlag: { at: NOW_ANCHOR - 30, by: "coordinator", reason: "cannot_safely_prevent_leaving" },
    };
    render(
      <PriorityQueue
        movements={[withProvenance]}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    const detail = screen.getByTestId(`ward-queue-flag-detail-${withProvenance.id}`);
    // "Bed coordinator" (the LABEL), never the bare "coordinator" role string.
    expect(detail).toHaveTextContent(/^Flagged urgent by Bed coordinator at/);
    expect(detail, "the reason label must be named too, not just who and when").toHaveTextContent(
      "Cannot safely prevent leaving",
    );
  });
});

/**
 * THE REASON PICKER ON SCREEN — item 37's own failing-test list names this: "the reasons are
 * offered on screen." `MovementDrawer` is the simplest of the two controls to render standalone
 * (it takes `dispatch` as a plain prop), so it carries this proof; `ward-console-controls.dom.test.tsx`
 * covers the same control shape on the movements-workspace page.
 */
describe("the urgent-flag reason picker in the movement drawer", () => {
  function anOpenUnflagged(): Movement {
    const found = wardMovements.find((movement) => !movement.flaggedUrgent && !movement.closure);
    if (!found) throw new Error("fixture has no open unflagged movement");
    return found;
  }

  function renderDrawer(movement: Movement, dispatch: (event: unknown) => void) {
    render(
      <MovementDrawer
        movement={movement}
        now={NOW_ANCHOR}
        units={[]}
        referrals={[]}
        patients={[]}
        edAccessTargetMinutes={ED_ACCESS_TARGET_MINUTES}
        dispatch={dispatch as never}
        onClose={() => {}}
      />,
    );
    // Movements redesign (1 Nov 2026): the reason picker opens from "Flag urgent" in the foot band.
    fireEvent.click(screen.getByRole("button", { name: "Flag urgent" }));
  }

  it("offers every URGENT_MARK_REASONS member as an option", () => {
    renderDrawer(anOpenUnflagged(), vi.fn());
    const select = screen.getByTestId("ward-movement-drawer-urgent-reason") as HTMLSelectElement;
    expect(select, "opening the picker moves focus into it").toHaveFocus();
    const optionValues = Array.from(select.options)
      .map((option) => option.value)
      .filter((value) => value.length > 0);
    expect(optionValues).toEqual([...URGENT_MARK_REASONS]);
  });

  /**
   * Review fix-forward item 10 (2026-09-17): the same accessible-reason discipline
   * `ward-management-console.tsx`'s own `URGENT_FLAG_UNCHOSEN` control already holds to (an
   * `aria-disabled` button that keeps its tab stop but stated nothing about WHY it would not
   * respond, until a `title` and an `aria-describedby`-linked `sr-only` span gave it a reason a
   * keyboard or screen-reader user can actually reach). The drawer's own toggle had the disabled
   * state but neither the reachable reason nor the link to it.
   */
  it("states why the flag button is unavailable, reachably, until a reason is chosen", () => {
    renderDrawer(anOpenUnflagged(), vi.fn());
    const button = screen.getByTestId("ward-movement-drawer-urgent-toggle");
    expect(button).toHaveAttribute("aria-disabled", "true");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy, "the disabled toggle must link to a reachable reason").toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Choose why this patient is being flagged urgent first.",
    );

    const select = screen.getByTestId("ward-movement-drawer-urgent-reason");
    fireEvent.change(select, { target: { value: "safety_of_others_in_this_setting" } });
    expect(
      button.getAttribute("aria-describedby"),
      "once a reason is chosen the button is no longer disabled, so nothing explains an absent block",
    ).toBeNull();
  });

  it("keeps the flag button disabled until a reason is chosen, and dispatches the chosen reason", () => {
    const dispatch = vi.fn();
    const target = anOpenUnflagged();
    renderDrawer(target, dispatch);

    const button = screen.getByTestId("ward-movement-drawer-urgent-toggle");
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
    expect(dispatch, "clicking while no reason is chosen must not dispatch anything").not.toHaveBeenCalled();

    const select = screen.getByTestId("ward-movement-drawer-urgent-reason");
    fireEvent.change(select, { target: { value: "safety_of_others_in_this_setting" } });
    expect(button).not.toHaveAttribute("aria-disabled");

    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "FLAG_MOVEMENT_URGENT",
        role: "coordinator",
        movementId: target.id,
        reason: "safety_of_others_in_this_setting",
      }),
    );
  });
});

describe("the queue footer states the order of the tab on show", () => {
  // Audit 1, Josh 20 Oct (CS-04): both tabs are longest wait first.
  it("says longest wait first for patients and for referrals", () => {
    render(
      <PriorityQueue
        movements={wardMovements}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    expect(screen.getByText("Longest wait first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Referrals/ }));
    expect(screen.getByText("Longest wait first")).toBeInTheDocument();
    expect(screen.queryByText(/Flagged and act now first/u)).toBeNull();
  });
});
