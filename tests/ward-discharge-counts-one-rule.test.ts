import { describe, expect, it } from "vitest";

import { groupDischarges } from "@/components/ward-management/discharges/discharge-board-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WT-17 (walk-through, 26 Oct 2026; Josh approved one rule): Discharges said 1 held up where the
 * ward said 2, because a held up release more than two days away dropped off the board. On the
 * ward and Discharges screens held up now counts every blocked release whatever its date, and
 * open counts every release not yet gone, by tomorrow and later. The bed meeting and its TV keep
 * today and tomorrow (NA3-02), as their label says. Synthetic seed only.
 */
const DAY = 24 * 60;

function releasesWithOneHeldUpLater(): { releases: BedRelease[]; later: BedRelease } {
  const releases = seedWardFlowState().bedReleases.filter((release) => release.state !== "discharged");
  const template = releases[0]!;
  const later: BedRelease = {
    ...template,
    id: "WT17-later-held-up",
    state: "expected",
    expectedAt: NOW_ANCHOR + 4 * DAY,
    blocker: "Awaiting accommodation",
  };
  return { releases: [...releases, later], later };
}

describe("one discharge count rule (WT-17)", () => {
  it("counts a held up release four days away as held up on the Discharges board", () => {
    const { releases, later } = releasesWithOneHeldUpLater();
    const groups = groupDischarges(releases, NOW_ANCHOR, { heldUpAnyDate: true });
    expect(groups.blocked.map(({ id }) => id)).toContain(later.id);
    // Held up matches the ward's own count: every open release with a blocker.
    expect(groups.blocked).toHaveLength(releases.filter((release) => release.blocker !== null).length);
    // Open is every release not yet gone, and later includes the held up one.
    const open = groups.blocked.length + groups.confirmed.length + groups.expected.length + groups.excludedBeyondToday;
    expect(open).toBe(releases.length);
    expect(groups.openLater).toBeGreaterThanOrEqual(1);
    expect(groups.blocked.at(-1)?.id).toBe(later.id);
  });

  it("keeps the bed meeting and TV figure to today and tomorrow", () => {
    const { releases, later } = releasesWithOneHeldUpLater();
    const groups = groupDischarges(releases, NOW_ANCHOR);
    expect(groups.blocked.map(({ id }) => id)).not.toContain(later.id);
  });
});
