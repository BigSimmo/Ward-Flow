import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task A (structured-wobbling-globe) moved the four registers out of `.main`'s own pinned third
 * grid row and into a panel under the Statewide flow diagram, inside `.body`'s ordinary page
 * scroll — "a panel below the diagram is only visible once scrolled to" is the task brief's own
 * description. The one property that had to survive that move: a refused action must stay
 * visible without scrolling, because the old bar's whole reason for existing was a measured
 * defect (whole-branch review I4) where a `PULL_PATIENT` refused on a ward with no allocatable
 * bed changed NOTHING else on screen. This file covers the replacement — a persistent marker in
 * `coordinator-screen.tsx`'s governance banner — for the two properties the brief names that
 * nothing else proves: it is structurally OUTSIDE the scrollable region the registers panel now
 * lives inside, and its number is never a second, independently computed count.
 *
 * Built from the rendered DOM throughout, never by calling `rejections.length` a second time in
 * the test the way the component itself does — a bug in how the component counts would then be
 * invisible to this file, the exact trap the task brief's own verification section names.
 */

const NOW = NOW_ANCHOR;

/**
 * Raises a REAL refusal through the reducer, the same recipe
 * `tests/ward-pull-vocabulary.dom.test.tsx` uses: WF-001's seeded stage refuses both a
 * `PULL_PATIENT` and the `RELEASE_PULL` that follows it, so one click reliably produces two
 * rejections without hand-building a `Rejection` the reducer never actually raised.
 */
function RefusalHarness({ children }: { children: React.ReactNode }) {
  const { dispatch } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid="raise-refusals"
        onClick={() => {
          dispatch({ type: "PULL_PATIENT", role: "ward", now: NOW, movementId: "WF-001", unitId: "rph-adult-secure" });
          dispatch({
            type: "RELEASE_PULL",
            role: "coordinator",
            now: NOW,
            movementId: "WF-001",
            reason: "pull_made_in_error",
          });
        }}
      >
        Raise two refusals
      </button>
      {children}
    </>
  );
}

/** Opens the registers panel and switches to Refused actions — same helper shape as
 *  `ward-override-register-render.dom.test.tsx`'s own `openOverridesTab`. */
function openRefusedTab() {
  fireEvent.click(screen.getByRole("button", { name: /Today’s answers/ }));
  fireEvent.click(screen.getByRole("tab", { name: /Refused/ }));
}

describe("the persistent refusal marker", () => {
  it("reads '0 refused' before anything has been refused, rather than staying absent", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const marker = screen.getByTestId("ward-coordinator-refusal-marker");
    expect(marker).toHaveTextContent("0 refused");
  });

  it("is structurally OUTSIDE the scrollable body the registers panel now lives inside", () => {
    // The whole reason this marker exists: `.body` (`ward-coordinator-body`) is the element that
    // scrolls in this layout, and the registers panel is a descendant of it now (`.regionGrid` >
    // `.midCol` > the registers panel). A marker that were ALSO inside `.body` would inherit the
    // exact "only visible once scrolled to" problem the task brief describes — this proves it is
    // not, by walking the real DOM tree rather than trusting a class name.
    render(
      <WardFlowProvider initialNow={NOW}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const marker = screen.getByTestId("ward-coordinator-refusal-marker");
    const body = screen.getByTestId("ward-coordinator-body");
    expect(
      body.contains(marker),
      "the refusal marker is inside the scrollable body — it can be scrolled out of view",
    ).toBe(false);
    // And the registers panel really is inside `.body`, or the assertion above proves nothing —
    // a non-vacuity check on the population itself, not just the marker.
    const registers = screen.getByTestId("ward-coordinator-registers");
    expect(
      body.contains(registers),
      "the registers panel is not inside the scrollable body — this test's premise is wrong",
    ).toBe(true);
  });

  it("never disagrees with the Refused actions tabpanel's own row count — same render, same array", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <RefusalHarness>
          <CoordinatorScreen />
        </RefusalHarness>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("raise-refusals"));

    const marker = screen.getByTestId("ward-coordinator-refusal-marker");
    expect(marker).toHaveTextContent("2 refused");

    // Cross-checked against rows actually mounted in the Refused actions tabpanel — hand-counted
    // from the DOM, never by reading `rejections.length` a second time, so a bug in the count
    // itself (not merely a display bug) would still be caught here.
    openRefusedTab();
    const refusedRows = within(screen.getByTestId("ward-refusals")).getAllByTestId(/^ward-refusal-/);
    expect(refusedRows).toHaveLength(2);

    // And the tab strip's own count badge, the third place this same number is shown (Ruling 3,
    // carried across three render sites — see `exception-drawer.tsx`'s own file comment).
    const refusedTab = screen.getByRole("tab", { name: /Refused/ });
    expect(refusedTab).toHaveTextContent("2");
  });

  it("carries the word 'refused', never a bare number or colour alone", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <RefusalHarness>
          <CoordinatorScreen />
        </RefusalHarness>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("raise-refusals"));
    const marker = screen.getByTestId("ward-coordinator-refusal-marker");
    // A number alone ("2") would read as any of this screen's other counts — the word is what a
    // reader who cannot use colour (forced-colors, greyscale print) relies on to tell this pill
    // apart from a record count sitting right beside it.
    expect(marker.textContent).toMatch(/refused/i);
  });
});
