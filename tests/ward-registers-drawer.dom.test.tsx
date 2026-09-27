import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ExceptionDrawer } from "@/components/ward-management/coordinator/exception-drawer";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { DeclineEntry, InboxItem, OverrideEntry } from "@/components/ward-management/ward-derivations";
import { DECLINE_REASONS, type Rejection } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 5 built the coordinator's bottom bar — one register (Exceptions, refusals folded in) grown
 * into four tabs behind one "Registers" toggle. `tests/ui-ward-coordinator.spec.ts` and
 * `tests/ward-override-register-render.dom.test.tsx` already cover the two moved registers
 * (Exceptions, Overrides) through the full `CoordinatorScreen`; this file covers `ExceptionDrawer`
 * directly, for the four properties the task brief names that neither of those already proves:
 * every tab's own count is really the length of the array its panel renders, the refusals badge
 * survives the phone bar being shut, every tab's `aria-controls` resolves to a real element, and
 * the phone bar opens/closes and moves between tabs from the keyboard alone.
 *
 * ⚠️ Task A (structured-wobbling-globe) moved the registers out of that bottom bar into a panel
 * under the Statewide flow diagram, unconditionally visible from 48rem up — the mockup's own
 * tabsPanel has no collapse control at all. `open`/`onToggle` still exist because the panel keeps
 * its old collapse behaviour BELOW 48rem, where the diagram (and so "under the diagram") is gone;
 * see `exception-drawer.tsx`'s own file comment. That is a CSS-driven distinction
 * (`@media (max-width: 48rem)`), and jsdom loads no CSS Module — every test below runs at every
 * width from jsdom's point of view, so **`open`/`aria-expanded` here only prove the component's
 * OWN state machine is correct, never that a phone reader actually sees it collapsed or a desktop
 * reader actually sees it open; only the browser gate can see that (`npm run ensure` +
 * `ui-ward-coordinator.spec.ts`).** The other structural change worth naming: all four tabpanels
 * are now unconditionally mounted at every value of `open`, not only while `open` is true — so a
 * query for `role="tab"` finds them regardless of `open`/`aria-expanded`, and the two tests below
 * that used to assert "closed means gone from the DOM" now assert the true, weaker claim: closed
 * means `data-open="false"` on the panel wrapper, which is what CSS reads to hide it on a phone.
 */

const NOW = NOW_ANCHOR;
const MOVEMENT_A = wardMovements[0]!;
const MOVEMENT_B = wardMovements[1]!;
const UNIT = allUnits()[0]!;

const DECLINES: DeclineEntry[] = [
  { movement: MOVEMENT_A, decline: { unitId: UNIT.id, at: NOW - 120, reason: DECLINE_REASONS[0] } },
  { movement: MOVEMENT_B, decline: { unitId: UNIT.id, at: NOW - 90, reason: DECLINE_REASONS[1] } },
];

const OVERRIDES: OverrideEntry[] = [
  {
    movement: MOVEMENT_A,
    override: { at: NOW - 60, by: "Flow coordinator", reason: OVERRIDE_REASONS[0], unitIds: [UNIT.id] },
  },
];

const ITEMS: InboxItem[] = [
  {
    id: "inbox-fixture-1",
    tone: "warning",
    icon: CircleAlert,
    title: "Fixture exception one",
    detail: "Detail one",
    owner: "Ward lead",
    movementId: MOVEMENT_A.id,
    kind: "fact",
  },
  {
    id: "inbox-fixture-2",
    tone: "danger",
    icon: CircleAlert,
    title: "Fixture exception two",
    detail: "Detail two",
    owner: "Ward lead",
    movementId: MOVEMENT_B.id,
    kind: "commitment",
  },
];

const REJECTIONS: Rejection[] = [
  {
    id: "rejection-fixture-1",
    at: NOW - 30,
    movementId: MOVEMENT_A.id,
    attempted: "PULL_PATIENT",
    reason: "fixture reason one",
  },
];

/**
 * `open`/`onToggle` are controlled props — `ExceptionDrawer` itself holds no opinion on whether
 * it is open, only which tab is active. A harness with real `useState` is what lets the keyboard
 * tests below actually toggle it, the same shape `CoordinatorScreen` itself uses.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <ExceptionDrawer
      items={ITEMS}
      rejections={REJECTIONS}
      overrides={OVERRIDES}
      declines={DECLINES}
      units={allUnits()}
      now={NOW}
      open={open}
      onToggle={() => setOpen((current) => !current)}
      onSelectMovement={() => {}}
    />
  );
}

function toggle() {
  return screen.getByRole("button", { name: /Registers/ });
}

describe("the coordinator's registers drawer", () => {
  it("gives every tab a count equal to the rows its own panel renders — never a number computed apart from them", () => {
    render(<Harness />);
    fireEvent.click(toggle());

    const declinesTab = screen.getByRole("tab", { name: /Declines/ });
    const overridesTab = screen.getByRole("tab", { name: /Overrides/ });
    const exceptionsTab = screen.getByRole("tab", { name: /Exceptions/ });
    const refusedTab = screen.getByRole("tab", { name: /Refused actions/ });

    // Ruling 3, checked directly rather than trusted: each tab's own displayed number and the
    // rows actually mounted in its panel must agree, the same "48 open movements" defect the
    // existing exceptions-count comment already guards against — now widened to four registers.
    //
    // Queried by `data-testid`, not by role: every tabpanel but the active one carries the
    // `hidden` attribute (see this file's own header comment on why all four stay mounted), and
    // `getByRole` correctly excludes a hidden element from the accessibility tree — a testid
    // query does not, which is exactly what is wanted here: the count must match what is really
    // in the DOM, whether or not that tab happens to be the one currently showing.
    expect(declinesTab).toHaveTextContent(String(DECLINES.length));
    expect(
      within(screen.getByTestId("ward-coordinator-decline-register")).getByTestId("ward-decline-register").children,
    ).toHaveLength(DECLINES.length);

    expect(overridesTab).toHaveTextContent(String(OVERRIDES.length));
    expect(
      within(screen.getByTestId("ward-coordinator-override-register")).getByTestId("ward-override-register").children,
    ).toHaveLength(OVERRIDES.length);

    expect(exceptionsTab).toHaveTextContent(String(ITEMS.length));
    expect(screen.getAllByTestId(/^ward-exception-inbox-/)).toHaveLength(ITEMS.length);

    expect(refusedTab).toHaveTextContent(String(REJECTIONS.length));
    expect(within(screen.getByTestId("ward-refusals")).getAllByTestId(/^ward-refusal-/)).toHaveLength(
      REJECTIONS.length,
    );
  });

  it("shows all four counts on the collapsed bar, each matching the rows its own tab renders", () => {
    render(<Harness />);
    // The bar starts closed — Owner ruling 2026-09-07 is that a coordinator sees all four counts
    // WITHOUT opening anything, so every assertion up to the `fireEvent.click` below happens
    // while `aria-expanded` is still "false".
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    // Each collapsed-bar badge is checked against the fixture array's own `.length` — never by
    // calling `ExceptionDrawer`'s internal `countFor` map or any derivation function, so a bug in
    // how a count is computed cannot hide behind an assertion built from the same computation.
    // ⚠️ ALL FOUR RENDER AT EVERY VALUE, INCLUDING ZERO. Refused was conditional on
    // `rejections.length > 0` until 2026-09-07 — correct while it was a lone alarm badge beside a
    // single exceptions count, wrong the moment the bar carried four peer counts. The owner asked
    // for four, opened the screen and saw THREE: the seeded fixture has no refusals, so that badge
    // was absent while "0 overrides" sat directly beside it. This fixture's counts are all
    // non-zero, so THIS assertion would pass either way — the all-zero case at the end of this
    // file is the one that actually guards it.
    expect(screen.getByTestId("ward-exceptions-toggle-decline-count")).toHaveTextContent(`${DECLINES.length} declines`);
    expect(screen.getByTestId("ward-exceptions-toggle-override-count")).toHaveTextContent(
      `${OVERRIDES.length} override`,
    );
    expect(screen.getByTestId("ward-exceptions-toggle-count")).toHaveTextContent(`${ITEMS.length} exceptions`);
    expect(screen.getByTestId("ward-exceptions-toggle-refusal-count")).toHaveTextContent(
      `${REJECTIONS.length} refused`,
    );

    // Cross-checked against the rows each tab actually renders, once opened — hand-built from the
    // rendered DOM, the same second, independent source of truth the "gives every tab a count..."
    // test above uses, so a badge that silently drifted from its own tab's real row count would
    // fail here even if nothing else caught it.
    fireEvent.click(toggle());
    expect(
      within(screen.getByTestId("ward-coordinator-decline-register")).getByTestId("ward-decline-register").children,
    ).toHaveLength(DECLINES.length);
    expect(
      within(screen.getByTestId("ward-coordinator-override-register")).getByTestId("ward-override-register").children,
    ).toHaveLength(OVERRIDES.length);
    expect(screen.getAllByTestId(/^ward-exception-inbox-/)).toHaveLength(ITEMS.length);
    expect(within(screen.getByTestId("ward-refusals")).getAllByTestId(/^ward-refusal-/)).toHaveLength(
      REJECTIONS.length,
    );
  });

  it("keeps the refusals badge visible while the phone bar itself is shut", () => {
    render(<Harness />);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    // Whole-branch review I4's own guarantee, re-checked after the bar grew to four registers:
    // a refusal must not need the phone bar opened to be seen at all.
    expect(screen.getByTestId("ward-exceptions-toggle-refusal-count")).toHaveTextContent("1 refused");
    // Task A: the four tabpanels are unconditionally mounted now, at every value of `open` — see
    // this file's own header comment — so "shut" is proven by `data-open="false"` on the panel
    // wrapper (what CSS reads to hide it on a phone), never by absence from the DOM. `.closest`
    // reaches the wrapper from a tab, rather than a new query, so this stays tied to the same
    // element CSS actually keys off.
    const tab = screen.getByRole("tab", { name: /Exceptions/ });
    expect(tab.closest("[data-open]")).toHaveAttribute("data-open", "false");
  });

  it("gives every tab an aria-controls that resolves to a real tabpanel already in the document", () => {
    render(<Harness />);
    fireEvent.click(toggle());

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      const controlsId = tab.getAttribute("aria-controls");
      expect(controlsId, `${tab.textContent} has no aria-controls`).toBeTruthy();
      const panel = document.getElementById(controlsId!);
      expect(panel, `${tab.textContent}'s aria-controls (${controlsId}) resolves to nothing`).not.toBeNull();
      expect(panel).toHaveAttribute("role", "tabpanel");
    }
  });

  it("opens and closes from the keyboard, and arrow keys move between tabs without a mouse", async () => {
    render(<Harness />);
    const bar = toggle();
    bar.focus();

    // Enter activates a native <button> exactly the way a click does — this is real browser
    // default behaviour `userEvent` reproduces, not custom key handling this component wrote.
    await userEvent.keyboard("{Enter}");
    expect(bar).toHaveAttribute("aria-expanded", "true");

    const declinesTab = screen.getByRole("tab", { name: /Declines/ });
    expect(declinesTab).toHaveAttribute("aria-selected", "false");

    // The tab strip's own arrow-key handling: Declines is first, so Right from Exceptions (the
    // default active tab) moves through Refused actions and wraps back to Declines.
    const exceptionsTab = screen.getByRole("tab", { name: /Exceptions/ });
    expect(exceptionsTab).toHaveAttribute("aria-selected", "true");
    exceptionsTab.focus();
    fireEvent.keyDown(exceptionsTab.parentElement as HTMLElement, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Refused actions/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(exceptionsTab.parentElement as HTMLElement, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Declines/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    // The last key press landed on the Declines tab (focus follows selection), so this second
    // Enter activates THAT control rather than reopening the bar — close it explicitly instead.
    expect(bar).toHaveAttribute("aria-expanded", "true");
    bar.focus();
    await userEvent.keyboard("{Enter}");
    expect(bar).toHaveAttribute("aria-expanded", "false");
    // Task A: closed no longer unmounts the tabs (see this file's own header comment) — the tree
    // stays, only `data-open` (what CSS reads on a phone) flips to "false".
    expect(declinesTab.closest("[data-open]")).toHaveAttribute("data-open", "false");
  });

  /*
   * 🔴 THE ALL-ZERO CASE IS THE ONLY ONE THAT GUARDS THIS. Every other assertion in this file runs
   * against a fixture whose four counts are all non-zero, so a badge that renders only when its
   * count is above nought passes all of them — which is exactly what happened. Refused was
   * conditional, the seeded screen had no refusals, and the owner asked for four counts and saw
   * three while "0 overrides" sat beside the gap.
   *
   * ⚠️ A count that disappears at nought is not the same as a register with nothing in it. "0
   * refused" answers "have any been refused today"; an absent badge cannot be told apart from one
   * that was never computed. That reasoning was already written in this component for Declines,
   * Overrides and Exceptions — it just had not been carried across to the fourth.
   */
  it("shows all four counts at nought, because an absent badge cannot be told from an uncounted one", () => {
    render(
      <ExceptionDrawer
        items={[]}
        rejections={[]}
        overrides={[]}
        declines={[]}
        units={allUnits()}
        now={NOW}
        open={false}
        onToggle={() => {}}
        onSelectMovement={() => {}}
      />,
    );

    expect(screen.getByTestId("ward-exceptions-toggle-decline-count")).toHaveTextContent("0 declines");
    expect(screen.getByTestId("ward-exceptions-toggle-override-count")).toHaveTextContent("0 overrides");
    expect(screen.getByTestId("ward-exceptions-toggle-count")).toHaveTextContent("0 exceptions");
    expect(screen.getByTestId("ward-exceptions-toggle-refusal-count")).toHaveTextContent("0 refused");

    // And still shut: all four are readable without opening anything, which is the whole request.
    expect(screen.getByRole("button", { name: /Registers/ })).toHaveAttribute("aria-expanded", "false");
  });
});
