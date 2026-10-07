/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * `CommunityHome` is reached by no route. These 5 cases are skipped, not deleted: the
 * source stays, and every case's own words are recorded in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md` so the cover is recoverable if the
 * screen is ever revived. ⚠️ **A retired test with no record of its subject is a deletion
 * wearing a softer word.**
 *
 * ⚠️ **THE COMPONENT IS NOT DELETED BY THIS RULING, AND THAT IS DELIBERATE.** This repository
 * forbids removing an exported symbol on a "nothing imports it" basis, and three of the defects
 * found on 2026-09-06 were held in place BY unreachability — which is more fragile than a live
 * defect, not less. **An unreachable wrong screen is a fix, not a delete.** What closes here is
 * the false coverage, which was the actual harm.
 *
 * **Do not un-skip these to make a number go up.** `tests/ward-component-reachability.test.ts`
 * reddens if this component becomes reachable again, and that is the signal to restore cover —
 * from the record, deliberately, not by deleting a `.skip`.
 */
/**
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `CommunityHome` — /community renders CommunityIndex instead
 * (measured 2026-09-06, `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`).
 *
 * **These cases passed and always would have. They were not coverage of anything a coordinator
 * could open.** ⚠️ **The line above this one used to say nothing here was skipped or retired.
 * That stopped being true on 2026-09-06 and is corrected rather than left standing.**
 *
 * ⚠️ **THIS COMMENT IS A POINTER, NOT THE GUARANTEE.** A comment saying a screen is
 * unreachable stays exactly as true-looking on the day it becomes reachable again.
 * `tests/ward-component-reachability.test.ts` holds the property: it reddens if this file
 * starts rendering a newly orphaned component, AND it reddens if the component comes back,
 * naming the declaration to delete. **If the two ever disagree, believe the guard.**
 */
// tests/ward-community-scope.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityHome } from "@/components/ward-management/community/community-home";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `CommunityHome` is the COORDINATOR's own view -- the all-teams overview, and drilling into one
 * team. It is a separate component from `community-team-hub.tsx` (the community role's own,
 * restricted landing) since the 2026-09-04 revision of this plan's Decision 1: two entitlements,
 * two components, never one scope prop switching between them. See `community-home.tsx`'s own doc
 * comment for the reasoning this suite assumes rather than re-argues.
 *
 * This suite checks the SWITCH behaviour Task 3 asks for -- default scope, aria-pressed, the select
 * and the table's "Open hub" both landing on the same scope through one code path -- not specific
 * figure values, which depend on live ward-flow state this suite does not control precisely enough
 * to pin a number against.
 */
function renderHome() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityHome />
    </WardFlowProvider>,
  );
}

describe.skip("CommunityHome — the coordinator's scope switch", () => {
  it("defaults to the all-teams scope, with the All teams button pressed", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Community teams" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches scope when a team is chosen from the select", () => {
    renderHome();
    const target = COMMUNITY_TEAM_PAGES[0];
    fireEvent.change(screen.getByLabelText("or open a team"), { target: { value: target.id } });
    expect(screen.getByRole("heading", { level: 1, name: target.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the SAME team through the teams table's Open hub control -- one code path, asserted from both entry points", () => {
    renderHome();
    const target = COMMUNITY_TEAM_PAGES[5];
    const rows = screen.getAllByRole("row").slice(1);
    const targetRowIndex = COMMUNITY_TEAM_PAGES.findIndex((team) => team.id === target.id);
    fireEvent.click(rows[targetRowIndex].querySelector("button")!);
    expect(screen.getByRole("heading", { level: 1, name: target.name })).toBeInTheDocument();
  });

  it("returns to the all-teams scope when the All teams button is pressed again", () => {
    renderHome();
    fireEvent.change(screen.getByLabelText("or open a team"), { target: { value: COMMUNITY_TEAM_PAGES[2].id } });
    fireEvent.click(screen.getByRole("button", { name: "All teams" }));
    expect(screen.getByRole("heading", { level: 1, name: "Community teams" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the all-teams table only in the all-teams scope, never in a single team's scope", () => {
    renderHome();
    expect(screen.getByRole("table")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("or open a team"), { target: { value: COMMUNITY_TEAM_PAGES[0].id } });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
