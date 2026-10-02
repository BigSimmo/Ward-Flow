import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * WF-47 — **THE COMPARISON TABLE PRINTS BARE ZEROS WHEN MEMBERSHIP CANNOT BE WORKED OUT.**
 *
 * `statistics-community-screen.tsx`'s "Where this team sits" table rendered
 * `row.lists.currentlyAdmitted.length` (and the two counts beside it) directly, with no gate on
 * whether `communityMembershipResolution` could even resolve that row's team. The SAME team's own
 * four headline figures already carry this gate (`statistics-community-figures.ts`,
 * `ward-statistics-community-figures.test.ts`) — the comparison table paid the false-zero defect a
 * second time, once per row, because it kept computing an ungated count instead of reusing the gate.
 *
 * ⚠️ **THE PROVIDER IS MOCKED, AND IT HAS TO BE — same reasoning as
 * `tests/ward-capacity-freshness-source.dom.test.tsx` and `tests/ward-ed-answered-cap.dom.test.tsx`.**
 * `WardFlowProvider` accepts only `initialNow`; there is no reachable sequence of dispatches that
 * makes an admission's `referralId` resolve to no referral in state (the reducer never writes a
 * dangling one), so the `not-computable` state this test exists to catch is unreachable from a
 * rendered provider without mocking the derivation's inputs directly.
 *
 * The seed carries 267 admissions and only 10 with a non-null `referralId`, all of which join
 * cleanly today (measured below: `admissionsWithUnresolvableReferral` returns zero against the
 * unforced seed) and every one of which belongs to exactly one of two teams — Midland (9) or Inner
 * City Clinic (1, `AD-LEFT-01`). This fixture dangles `AD-LEFT-01` specifically, not an arbitrary
 * one: it is Inner City Clinic's only member, so dangling it leaves Midland's own count completely
 * untouched, which is what lets Midland serve as the positive control below — a real team whose
 * digits must stay exactly what the unforced seed says they are. Repointing `AD-LEFT-01`'s
 * `referralId` at an id no referral in state carries is the exact "set but unresolvable" case
 * `communityMembershipResolution` distinguishes from an honest null. That single dangling record
 * makes `admissionsWithUnresolvableReferral` return one, which flips EVERY team with zero real
 * members from `measured-empty` to `not-computable`, because `communityMembershipResolution` only
 * ever reports `measured-empty` when the unresolvable count is zero system-wide.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext };
});

import {
  admissionBelongsToTeam,
  admissionsWithUnresolvableReferral,
  communityMembershipResolution,
  COMMUNITY_TEAM_PAGES,
} from "@/components/ward-management/community/community-derivations";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();

/** Measured against the real seed: has no members, so once the join breaks system-wide its
 *  comparison row must read as unmeasured rather than a false zero. */
const MEMBERLESS_TEAM = COMMUNITY_TEAM_PAGES.find((team) => team.id === "albany");
/** Measured against the real seed: has real members (`currentlyAdmitted=9`, `expectedBack=8`), and
 *  none of them is the admission this fixture dangles — so its row must keep showing true digits,
 *  the positive control that stops the fix from wording every row, including a genuine nonzero one. */
const MEMBER_TEAM = COMMUNITY_TEAM_PAGES.find((team) => team.id === "midland");
/** Inner City Clinic's only member (`AD-LEFT-01`) is the one admission this fixture dangles —
 *  chosen because it does NOT belong to `MEMBER_TEAM`, which is what keeps that control clean. */
const INNER_CITY_TEAM = COMMUNITY_TEAM_PAGES.find((team) => team.id === "inner-city-clinic");

const DANGLED_INDEX = seeded.admissions.findIndex(
  (admission) => INNER_CITY_TEAM !== undefined && admissionBelongsToTeam(admission, INNER_CITY_TEAM, seeded.referrals),
);

const admissionsWithDanglingReferral = seeded.admissions.map((admission, index) =>
  index === DANGLED_INDEX ? { ...admission, referralId: "RF-DELIBERATELY-DANGLING" } : admission,
);

const mockContext = {
  ...seeded,
  admissions: admissionsWithDanglingReferral,
  now: NOW_ANCHOR,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

function renderScreen(teamId: string) {
  render(<StatisticsCommunityScreen teamId={teamId} />);
}

function compareRow(teamId: string) {
  const table = screen.getByTestId("ward-statistics-community-comparison-table");
  return within(table).getByTestId(`ward-statistics-community-compare-row-${teamId}`);
}

describe("the comparison table, when the join cannot run for some admissions", () => {
  it("has a real dangling record, a real memberless team and a real member team — or every assertion below is vacuous", () => {
    expect(MEMBERLESS_TEAM, 'no community team with id "albany" exists in this build').toBeDefined();
    expect(MEMBER_TEAM, 'no community team with id "midland" exists in this build').toBeDefined();
    expect(INNER_CITY_TEAM, 'no community team with id "inner-city-clinic" exists in this build').toBeDefined();
    expect(DANGLED_INDEX, "no admission in the seed belongs to Inner City Clinic to dangle").toBeGreaterThanOrEqual(0);

    // The chosen record must NOT be one of the positive control's own members, or dangling it would
    // corrupt the very count the positive control is supposed to prove untouched.
    expect(
      admissionBelongsToTeam(seeded.admissions[DANGLED_INDEX]!, MEMBER_TEAM!, seeded.referrals),
      "the dangled admission must not belong to the positive-control team",
    ).toBe(false);

    expect(admissionsWithUnresolvableReferral(seeded.admissions, seeded.referrals)).toHaveLength(0);
    expect(admissionsWithUnresolvableReferral(admissionsWithDanglingReferral, seeded.referrals)).toHaveLength(1);

    // Baseline, before the dangle: the memberless team is a MEASURED absence, not a broken join —
    // proves the not-computable state below is caused by the dangle and is not already true anyway.
    expect(communityMembershipResolution(seeded.admissions, MEMBERLESS_TEAM!, seeded.referrals).state).toBe(
      "measured-empty",
    );

    expect(
      communityMembershipResolution(admissionsWithDanglingReferral, MEMBERLESS_TEAM!, seeded.referrals).state,
    ).toBe("not-computable");
    expect(communityMembershipResolution(admissionsWithDanglingReferral, MEMBER_TEAM!, seeded.referrals).state).toBe(
      "members",
    );
  });

  it("does not print a bare zero for a memberless team's row once the join cannot run for it", () => {
    renderScreen(MEMBERLESS_TEAM!.id);

    const row = compareRow(MEMBERLESS_TEAM!.id);
    const cells = within(row).getAllByRole("cell");
    expect(cells.length, "the comparison row rendered no data cells").toBeGreaterThan(0);

    for (const cell of cells) {
      expect(
        cell.textContent?.trim(),
        `${MEMBERLESS_TEAM!.id}'s membership cannot be resolved once a referral dangles; a bare "0" ` +
          "here would be a confident answer over a question that was never asked, the same defect " +
          "the team's own headline figures were fixed against.",
      ).not.toBe("0");
      expect(cell, `${MEMBERLESS_TEAM!.id}'s comparison cells must be marked unmeasured`).toHaveAttribute(
        "data-unmeasured",
        "true",
      );
    }
  });

  it("positive control: a real team with members still shows true digits, not a wording of every row", () => {
    renderScreen(MEMBERLESS_TEAM!.id);

    const row = compareRow(MEMBER_TEAM!.id);
    const cells = within(row).getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);

    // The seed's own numbers for this team (currentlyAdmitted=9, expectedBack=8), so this is not
    // merely "not zero" but the actual measured count, read straight from the render.
    expect(cells[0]?.textContent?.trim()).toBe("9");
    expect(cells[1]?.textContent?.trim()).toBe("8");
    for (const cell of cells) {
      expect(cell).not.toHaveAttribute("data-unmeasured");
    }
  });
});
