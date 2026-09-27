import { describe, expect, it } from "vitest";

import {
  COMMUNITY_TEAM_PAGES,
  communityTeamById,
} from "../src/components/ward-management/community/community-derivations";
import { hubEntries } from "../src/components/ward-management/hub/hub-derivations";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { bedReleases } from "../src/components/ward-management/ward-movements";

/**
 * The search hub lists the REAL community teams, and its links now arrive somewhere.
 *
 * ⚠️ WHAT WAS WRONG, AND IT WAS TWO THINGS WEARING ONE COAT. Ward Flow carried two community-team
 * vocabularies at once. `community-derivations.ts` derives SIXTY-FIVE teams from the 537 real WA
 * catchment rows in `ward-catchment.ts`, and the community screen, the referral picker and the
 * `/community/[teamId]` route all use those. The hub instead listed TEN hand-written
 * `"… (placeholder)"` names keyed by home region, from `ward-teams.ts`.
 *
 * 🔴 SO THE HUB'S LINKS COULD NOT ARRIVE. `/community/[teamId]` resolves against the sixty-five. A
 * href built from a region placeholder resolves to nothing, and `hub-derivations.ts` said so in its
 * own comment — it deliberately pointed every community row at the bare index instead, because an
 * href that lands on "No community team matches…" is an href that is not an arrival. Listing the
 * real teams removes the cause rather than the symptom: the ids now come from the same list the
 * route resolves against, so each row can point at its own page.
 *
 * ⚠️ AND IT IS THE OWNER'S RULING, NOT A TIDY-UP. `tests/ward-community-team-list-source.test.ts`
 * records Q-5 (owner, 2026-09-10): the sixty-five are what screens show, and "the ten region
 * placeholders are retired when a real list arrives."
 *
 * ⚠️ THE COUNT IS DELIBERATELY NOT HARD-CODED. `ward-community-team-count.test.ts` explains why —
 * the owner is likely to add or remove teams, and a literal 65 turns that into a confusing red.
 * This compares against the list itself.
 */
function communityEntries() {
  return hubEntries({ units: allUnits(), bedReleases, now: NOW_ANCHOR }).filter((entry) => entry.kind === "community");
}

describe("the search hub lists real community teams", () => {
  it("lists every team the rest of the app knows about, and only those", () => {
    const listed = communityEntries()
      .map((entry) => entry.name)
      .sort();
    const real = COMMUNITY_TEAM_PAGES.map((team) => team.name).sort();
    expect(listed).toEqual(real);
  });

  it("names no placeholder", () => {
    for (const entry of communityEntries()) {
      expect(entry.name, entry.id).not.toMatch(/placeholder/i);
    }
  });

  it("every row's link arrives at a team page that resolves", () => {
    // The failure this replaces was an href that rendered "No community team matches...". A link
    // that reaches the right screen and drops the thing it was pointing at is not an arrival.
    for (const entry of communityEntries()) {
      const match = entry.href.match(/\/community\/([^/?#]+)$/);
      expect(match, `${entry.name} does not link to a team page: ${entry.href}`).not.toBeNull();
      expect(communityTeamById(match![1]), `${entry.href} resolves to no team`).not.toBeNull();
    }
  });

  it("gives each row a distinct id, so the hub cannot collapse two teams into one", () => {
    const ids = communityEntries().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
