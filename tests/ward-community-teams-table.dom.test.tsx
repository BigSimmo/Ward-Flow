/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * `CommunityTeamsTable` is reached by no route. These 5 cases are skipped, not deleted: the
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
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `CommunityTeamsTable` — reached only from CommunityHome, which is itself unreachable
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
// tests/ward-community-teams-table.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  CommunityTeamsTable,
  suburbCountForTeam,
  suburbCountsByTeam,
  type CommunityTeamRow,
} from "@/components/ward-management/community/community-teams-table";
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";

/**
 * ⚠️ **THERE IS NO "16 TEAMS" TO PIN.** The build plan's Task 2 (written before this checkout was
 * measured) says "sixteen rows" -- the design prototype's own invented figure. The real, derivable
 * team count is whatever `S2015_CATCHMENT_ROWS` names today (65, confirmed independently by
 * `tests/ward-community-team-count.test.ts` and by running `communityTeamOptions().length` against
 * this checkout). So this suite asserts against `COMMUNITY_TEAM_PAGES.length`, computed fresh, never
 * against a literal -- the same discipline that file's own comment explains: a hardcoded number
 * breaks the day a team is added or removed, and whoever hits that failure "fixes" it by typing in
 * the new number, which is the exact defect class this project exists to root out.
 *
 * A second, independent derivation (not a call to `COMMUNITY_TEAM_PAGES` or `communityTeamOptions`)
 * is used for the floor guard below, following the same pattern
 * `tests/ward-community-team-count.test.ts` establishes for exactly this reason.
 */
function independentTeamCount(): number {
  const normalise = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const keys = new Set<string>();
  for (const row of S2015_CATCHMENT_ROWS) {
    for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
      const key = normalise(clinic);
      if (key !== "") keys.add(key);
    }
  }
  return keys.size;
}

/** Builds one row per real team, with a caller-supplied waiting count so tests can control which
 *  rows are zero without inventing team names or suburb counts. */
function rowsFor(waitingByTeam: ReadonlyMap<string, number>): CommunityTeamRow[] {
  const counts = suburbCountsByTeam();
  return COMMUNITY_TEAM_PAGES.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    suburbCount: suburbCountForTeam(team.name, counts),
    waitingCount: waitingByTeam.get(team.id) ?? 0,
  }));
}

describe.skip("CommunityTeamsTable", () => {
  it("renders exactly one row per team the catchment source names -- comfortably more than a collapse could produce", () => {
    // Floor first, same reasoning as tests/ward-community-team-count.test.ts: without it, a
    // collapsed source (0 or a handful of teams) would make every assertion below pass by both
    // sides shrinking together.
    expect(independentTeamCount()).toBeGreaterThan(30);
    expect(COMMUNITY_TEAM_PAGES.length).toBe(independentTeamCount());

    render(<CommunityTeamsTable rows={rowsFor(new Map())} onOpenTeam={() => {}} />);
    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(COMMUNITY_TEAM_PAGES.length);
  });

  it("names the real teams from the catchment module -- a divergence here fails", () => {
    render(<CommunityTeamsTable rows={rowsFor(new Map())} onOpenTeam={() => {}} />);
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(screen.getByText(team.name)).toBeInTheDocument();
    }
  });

  it("calls onOpenTeam with the row's own team id when its Open hub control is used", () => {
    const onOpenTeam = vi.fn();
    render(<CommunityTeamsTable rows={rowsFor(new Map())} onOpenTeam={onOpenTeam} />);
    const target = COMMUNITY_TEAM_PAGES[3];
    const buttons = screen.getAllByRole("button", { name: "Open hub" });
    fireEvent.click(buttons[3]);
    expect(onOpenTeam).toHaveBeenCalledWith(target.id);
    expect(onOpenTeam).toHaveBeenCalledTimes(1);
  });

  it('renders an idle team as a worded state, "none", not a nought', () => {
    render(<CommunityTeamsTable rows={rowsFor(new Map())} onOpenTeam={() => {}} />);
    expect(screen.getAllByText("none").length).toBe(COMMUNITY_TEAM_PAGES.length);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("still renders a real digit for a team that does have somebody waiting", () => {
    const withOne = new Map([[COMMUNITY_TEAM_PAGES[0].id, 7]]);
    render(<CommunityTeamsTable rows={rowsFor(withOne)} onOpenTeam={() => {}} />);
    // Addressed by header, never by position — the same discipline
    // tests/ward-statistics-compare-two-tables.dom.test.tsx adopted after a column removal there
    // shifted every later index by one and a positional assertion kept passing about whichever
    // column had slid into the slot.
    const headers = screen.getAllByRole("columnheader").map((th) => (th.textContent ?? "").trim());
    const waitingIndex = headers.indexOf("Waiting");
    expect(waitingIndex, `no column headed "Waiting" — headers are: ${headers.join(" | ")}`).toBeGreaterThanOrEqual(0);
    const rows = screen.getAllByRole("row").slice(1);
    const firstRowCells = rows[0].querySelectorAll("td");
    expect(firstRowCells[waitingIndex].textContent).toBe("7");
  });
});
