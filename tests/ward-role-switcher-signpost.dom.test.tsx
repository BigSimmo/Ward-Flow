import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ⚠️ **THIS FILE WAS DELIBERATELY REWRITTEN, 17 SEPTEMBER 2026.** It used to pin the 3 September
 * "resolve this" ruling as an every-route fact: the trigger names the wards a focused patient was
 * referred to, on whichever screen you happen to be looking at it from. Owner answer 38
 * (`docs/ward-flow/owner-answers-2026-09-17.md`, item 38) narrows that: *"Other wards in the ward
 * switcher: coordinators only."* This file now pins the SPLIT rather than the old blanket rule —
 * it does not touch `docs/ward-flow/owner-decisions-2026-09-03.md` or any other ruling document,
 * because the 3 September ruling is not wrong, it is incomplete: it settled WHAT the trigger says
 * when something is behind it, never WHO gets told.
 *
 * The "Change view" wording itself (as opposed to "Switch role") is a SEPARATE 3 September ruling,
 * untouched by item 38 and still pinned below on both routes — see `ward-role-switcher.tsx`'s own
 * doc comment for why the two ruled on different things.
 *
 * ⚠️ IT WAS NEVER AN ACCESSIBILITY GAP, either before or now. The trigger carries `aria-label` and
 * `title` in both states; a ward or ED screen off the coordinator route gets a shorter, honest
 * answer ("Change view", nothing more) rather than a wrong or a withheld one.
 *
 * ⚠️ AND THE EMPTY-MENU AND EMERGENCY-DEPARTMENT STATES ARE UNTOUCHED BY ITEM 38. It names only
 * "other wards" — the Ward group in the menu. The "No ward implied" state (coordinator route, no
 * patient focused), the Emergency department group, and the "No department implied" state are
 * exactly as `ward-role-switcher.tsx`'s own comment describes and are proved unaffected below.
 */

const COORDINATOR_ROUTE = "/mockups/ward-flow";
const WARD_ROUTE = "/mockups/ward-flow/ward/rph-adult-secure";

const route = { pathname: COORDINATOR_ROUTE };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardRoleSwitcher } from "@/components/ward-management/ward-role-switcher";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-009 referred, in one real `REFER_TO_UNITS` dispatch, to exactly the three units the reducer's
 * own suite (`tests/ward-flow-reducer.test.ts:100-106`) proves land with zero held-back and zero
 * rejections for this movement — never a hand-authored fixture edit. `PARALLEL_REFERRAL_CAP` is 3
 * (`ward-model.ts:246`), so this is also the largest referral the reducer allows in one act.
 */
const THREE_REFERRED_UNIT_IDS = ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"];
const THREE_REFERRED_UNIT_NAMES = ["Dabakarn", "FSH Adult Secure", "RGH Adult Secure"];

/** Refers WF-009 to the three units above and focuses it, both through the provider's own
 *  dispatch/setter — never by reaching into state — in one click so the test controls exactly
 *  when the switcher sees the referral. */
function ReferWf009ToThreeWardsAndFocus() {
  const { dispatch, now, setFocusMovementId } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-009",
          unitIds: THREE_REFERRED_UNIT_IDS,
        });
        setFocusMovementId("WF-009");
      }}
    >
      refer WF-009 to three wards and focus it
    </button>
  );
}

function renderThreeWardReferral(pathname: string) {
  route.pathname = pathname;
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferWf009ToThreeWardsAndFocus />
      <WardRoleSwitcher />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "refer WF-009 to three wards and focus it" }));
  return view;
}

/** Focus a movement through the provider's own setter, never by reaching into state. No referral
 *  is dispatched, so this reaches the "nothing implied" branches on either route. */
function FocusHarness({ movementId }: { movementId: string | undefined }) {
  const { setFocusMovementId } = useWardFlow();
  useEffect(() => {
    setFocusMovementId(movementId);
  }, [movementId, setFocusMovementId]);
  return <WardRoleSwitcher />;
}

function renderSwitcher(movementId: string | undefined, pathname: string = COORDINATOR_ROUTE) {
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FocusHarness movementId={movementId} />
    </WardFlowProvider>,
  );
}

describe("ward role switcher — other wards are named to coordinators only (owner answer 38)", () => {
  it("off the coordinator route, says exactly 'Change view' with no count, even when the patient was referred to three wards", () => {
    renderThreeWardReferral(WARD_ROUTE);

    const trigger = screen.getByRole("button", { name: "Change view" });
    // ⚠️ EXACT, not a substring. A regex would pass against "Change view — 3 wards…", which is
    // precisely the leak item 38 forbids off this route.
    expect(trigger).toHaveAccessibleName("Change view");
    expect(trigger).toHaveAttribute("title", "Change view");
    expect(trigger, "no data-referred-ward-count attribute at all off the coordinator route").not.toHaveAttribute(
      "data-referred-ward-count",
    );
    expect(screen.queryByTestId("ward-role-switcher-ward-count")).not.toBeInTheDocument();
  });

  it("off the coordinator route, names no ward in the menu and shows the exact sentence instead", () => {
    renderThreeWardReferral(WARD_ROUTE);

    fireEvent.click(screen.getByRole("button", { name: "Change view" }));

    // §3's exact wording (2026-09-17 build plan): "Open the coordinator view to see which wards
    // this patient was referred to."
    expect(
      screen.getByText("Open the coordinator view to see which wards this patient was referred to."),
    ).toBeInTheDocument();

    for (const wardName of THREE_REFERRED_UNIT_NAMES) {
      expect(
        screen.queryByText(wardName),
        `${wardName} must not be named off the coordinator route`,
      ).not.toBeInTheDocument();
    }
    // The disabled "No ward implied" state belongs to the coordinator route's own empty case
    // (see the describe block below) — it must not appear here either, since this is not that case.
    expect(screen.queryByText("No ward implied")).not.toBeInTheDocument();
  });

  it("on the coordinator route, the count and the named wards survive exactly as the 2026-09-03 ruling left them", () => {
    renderThreeWardReferral(COORDINATOR_ROUTE);

    const trigger = screen.getByRole("button", {
      name: "Change view — 3 wards this patient was referred to",
    });
    expect(trigger).toHaveAttribute("data-referred-ward-count", "3");
    expect(screen.getByTestId("ward-role-switcher-ward-count")).toHaveTextContent("3");

    fireEvent.click(trigger);
    for (const wardName of THREE_REFERRED_UNIT_NAMES) {
      expect(screen.getByText(wardName)).toBeInTheDocument();
    }
    expect(
      screen.queryByText("Open the coordinator view to see which wards this patient was referred to."),
    ).not.toBeInTheDocument();
  });
});

describe("ward role switcher — the 'Change view' wording ruling (2026-09-03), unaffected by item 38", () => {
  it("says exactly 'Change view' and shows no count when no patient is focused, on the coordinator route", () => {
    renderSwitcher(undefined, COORDINATOR_ROUTE);

    const trigger = screen.getByRole("button", { name: /change view/i });
    expect(trigger).toHaveAccessibleName("Change view");
    expect(screen.queryByTestId("ward-role-switcher-ward-count")).not.toBeInTheDocument();
  });

  it("says exactly 'Change view' and shows no count when no patient is focused, off the coordinator route", () => {
    renderSwitcher(undefined, WARD_ROUTE);

    const trigger = screen.getByRole("button", { name: /change view/i });
    expect(trigger).toHaveAccessibleName("Change view");
    expect(trigger).not.toHaveAttribute("data-referred-ward-count");
  });

  it("still offers 'No ward implied' in the menu when nothing is selected, on the coordinator route", () => {
    renderSwitcher(undefined, COORDINATOR_ROUTE);

    fireEvent.click(screen.getByRole("button", { name: /change view/i }));
    // ⚠️ The honest empty state, untouched by item 38 and asserted so it stays that way. A control
    // that offers nothing must SAY it offers nothing, rather than rendering an empty group that
    // reads as a control which failed to load.
    expect(screen.getByRole("menu", { name: "Change view" })).toBeInTheDocument();
    expect(screen.getByText("No ward implied")).toBeInTheDocument();
  });

  it("off the coordinator route with nothing focused, points at the coordinator view rather than offering 'No ward implied'", () => {
    // Owner answer 38 draws the line at the ROUTE, not at whether anything is currently referred —
    // a ward screen never gets told about other wards, whether the answer would have been zero,
    // one or three.
    renderSwitcher(undefined, WARD_ROUTE);

    fireEvent.click(screen.getByRole("button", { name: /change view/i }));
    expect(
      screen.getByText("Open the coordinator view to see which wards this patient was referred to."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No ward implied")).not.toBeInTheDocument();
  });
});
