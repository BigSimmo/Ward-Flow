/**
 * Unit coverage for the four `hub-derivations.ts` exports that shipped with no test of their own:
 * `networkBeds`, `unauthorisedWards`, `groupedResults` and `needsAttention`.
 *
 * ⚠️ **FIXTURE FACTS, NOT RE-DERIVED ARITHMETIC.** Every expected number below is either a count
 * read straight off `ward-sites.ts`'s own accessors (`allUnits().length`,
 * `allEmergencyDepartments().length`, `HOME_REGIONS.length`) or a hand-picked pair of wards whose
 * capacity figures are already pinned in `tests/ward-hub-screen.dom.test.tsx` (Mental Health Unit) or
 * read directly off `ward-sites.ts` (RPH Older Adult). Nothing here sums the whole 23-ward network
 * inside the test itself — that would be the exact re-implementation the brief for this file warns
 * against, since a shared mistake between this test and `networkBeds` would agree with itself.
 */

import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

import {
  groupedResults,
  hubEntries,
  needsAttention,
  networkBeds,
  unauthorisedWards,
  type HubEntry,
} from "@/components/ward-management/hub/hub-derivations";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { HOME_REGIONS } from "@/components/ward-management/ward-model";

const ENTRIES = hubEntries({ units: allUnits(), bedReleases: [], now: NOW_ANCHOR });

function entryById(id: string): HubEntry {
  const found = ENTRIES.find((entry) => entry.id === id);
  if (!found) throw new Error(`fixture no longer has an entry with id ${id} — re-point this test`);
  return found;
}

describe("hub-derivations fixture assumptions (floors the discriminating population)", () => {
  it("the network has more than one kind of entry, so a wards-count that secretly counted everything would be caught", () => {
    // If this ever drops to one kind, the networkBeds "counts every kind" mutation below would
    // stop being distinguishable from correct behaviour.
    const kinds = new Set(ENTRIES.map((entry) => entry.kind));
    expect(kinds.has("ed")).toBe(true);
    expect(kinds.has("community")).toBe(true);
    expect(allEmergencyDepartments().length).toBeGreaterThan(0);
    expect(HOME_REGIONS.length).toBeGreaterThan(0);
  });
});

describe("networkBeds — the network's beds in one row, never added together", () => {
  /**
   * Defect this catches: swapping which field feeds `ready` vs `held`, reading the wrong raw
   * field for `blocked` (e.g. the clamped `capacity.blocked` instead of the raw `unit.blocked`
   * `hubEntries` actually carries), or dropping/double-counting a ward when summing `beds`.
   *
   * The two wards are picked because their figures are independently known and asymmetric on
   * every axis (ready, closed, beds all differ between the two), so a mutation that
   * transposes any pair of these fields changes at least one number in a way this test would see.
   */
  it("sums the ruled boxes and beds correctly over a hand-picked two-ward subset with known, asymmetric figures", () => {
    const scghAdultOpen = entryById("scgh-adult-open"); // ready 2, closed 3, beds 24 — same figures tests/ward-hub-screen.dom.test.tsx pins via unitCapacity.
    // ready 1, closed 1, beds 14 — read straight off ward-sites.ts (empty 2, allocatable 1). Owner ruling
    // 2026-09-25: its former blocked bed is an empty bed the ward is not offering (now Closed), and
    // out-of-service beds are not recorded.
    const rphOlderAdult = entryById("rph-older-adult");

    const result = networkBeds([scghAdultOpen, rphOlderAdult]);

    expect(result.ready).toBe(3);
    // The box once mislabelled "Held": empty and not offered. Out-of-service beds fold in here.
    expect(result.closed).toBe(4);
    // ENTRIES was built without admissions, so no pull can be told apart.
    expect(result.pulled).toBe(0);
    expect(result.occupied).toBe(31);
    expect(result.ready + result.pulled + result.closed + result.occupied).toBe(result.beds);
    expect(result.beds).toBe(38);
    expect(result.wards).toBe(2);
  });

  /**
   * Defect this catches: the exact regression the module's own comment warns about — counting an
   * ED or a community entry as a "ward". `allUnits().length` is the real ward population read
   * straight from the fixture; if `networkBeds` ever drops its `entry.kind !== "ward"` guard, this
   * would instead equal `ENTRIES.length` (wards + EDs + community teams), which is provably a
   * larger number by the "more than one kind" floor above.
   */
  it("counts only ward entries toward `wards`, never the whole network", () => {
    const result = networkBeds(ENTRIES);
    expect(result.wards).toBe(allUnits().length);
    expect(result.wards).toBeLessThan(ENTRIES.length);
  });
});

describe("unauthorisedWards — names, not a count", () => {
  /**
   * Defect this catches: inverting the predicate (returning authorised wards instead of
   * unauthorised ones) or dropping the `kind === "ward"` guard. St John of God Subiaco's two units
   * are the only `authorised: false` wards in the fixture (`ward-sites.ts`'s own "Private and not
   * authorised under the Mental Health Act" comment); every other ward is `authorised: true`.
   */
  it("returns exactly the two unauthorised wards, by id, in fixture order", () => {
    const result = unauthorisedWards(ENTRIES);
    expect(result.map((entry) => entry.id)).toEqual(["sjgs-adult-open", "sjgs-adult-secure"]);
  });

  it("excludes an authorised ward — the floor that tells 'unauthorised only' from 'every ward'", () => {
    const result = unauthorisedWards(ENTRIES);
    expect(result.some((entry) => entry.id === "rph-adult-secure")).toBe(false);
  });
});

describe("groupedResults — sections cut from the given results, never the whole list", () => {
  it("splits the FULL fixture into ward/ed/community sections with correct per-section counts and ward subgroups ordered by wardServiceOrder", () => {
    const sections = groupedResults(ENTRIES);

    expect(sections.map((section) => section.key)).toEqual(["ward", "ed", "community"]);

    const wardSection = sections.find((section) => section.key === "ward")!;
    const edSection = sections.find((section) => section.key === "ed")!;
    const communitySection = sections.find((section) => section.key === "community")!;

    expect(wardSection.entries).toHaveLength(allUnits().length);
    expect(edSection.entries).toHaveLength(allEmergencyDepartments().length);
    // The sixty-odd real WA teams, not the ten region placeholders retired on 2026-09-18.
    // Derived from the list itself rather than a literal, for the reason
    // ward-community-team-count.test.ts gives: the owner will add and remove teams.
    expect(communitySection.entries).toHaveLength(COMMUNITY_TEAM_PAGES.length);

    // Every ward in this fixture sits in one of the canonical services, so there is no "Other"
    // bucket here — this is the case the next test (hand-authored) exists to cover. The Child and
    // Adolescent Health Service (added 2026-09-25, owner ruling 2A) holds Perth Children's, which has
    // no mental health ward in the sample network, so it has no ward subgroup.
    expect(wardSection.subgroups.map((group) => group.label)).toEqual(
      wardServiceOrder.filter((service) => service !== "CAHS"),
    );
    // Counts per service, summing to allUnits().length by construction of the fixture itself
    // (North Metro 4, East Metro 7, South Metro 5, WACHS 4, Private 2; WACHS lost Kununurra, which has no
    // mental health ward, confirmed ward facts 26 Sept 2026) — pinned as a shape, not
    // re-derived: a ward moving between services would change exactly one of these numbers.
    expect(wardSection.subgroups.map((group) => group.entries.length)).toEqual([4, 7, 5, 4, 2]);
  });

  /**
   * ⚠️ THE EXACT DEFECT THIS MODULE'S OWN COMMENT NAMES: a section built from the unfiltered
   * population instead of the results actually passed in ("Wards 23" over two visible rows).
   * `mixedResults` below is a hand-picked FOUR-entry subset (two wards, one ED, one community
   * team) built by filtering `ENTRIES` on id/kind — never by re-deriving groupedResults' own
   * counting logic. If `groupedResults` ever used the full network instead of `results`, the ward
   * section here would read `allUnits().length` (23) instead of 2, and the ed/community sections
   * would similarly balloon.
   */
  it("scopes every section to a small hand-picked subset of results, not the whole network", () => {
    const rphAdultSecure = entryById("rph-adult-secure"); // East Metro
    const scghAdultOpen = entryById("scgh-adult-open"); // North Metro
    const peelEd = ENTRIES.find((entry) => entry.kind === "ed" && entry.id === "peel-ed")!;
    // A community entry is no longer keyed by home region -- that association is exactly the one
    // the owner ruled against on 17 September -- so pick one by its real team id instead.
    const someCommunityTeam = ENTRIES.find(
      (entry) => entry.kind === "community" && entry.id === COMMUNITY_TEAM_PAGES[0].id,
    )!;
    expect(peelEd, "fixture no longer has the peel-ed emergency department").toBeDefined();
    expect(someCommunityTeam, "fixture no longer has any community team entry").toBeDefined();

    const mixedResults = [rphAdultSecure, scghAdultOpen, peelEd, someCommunityTeam];
    const sections = groupedResults(mixedResults);

    const wardSection = sections.find((section) => section.key === "ward")!;
    const edSection = sections.find((section) => section.key === "ed")!;
    const communitySection = sections.find((section) => section.key === "community")!;

    expect(wardSection.entries).toHaveLength(2);
    expect(edSection.entries).toHaveLength(1);
    expect(communitySection.entries).toHaveLength(1);
    // Two different services in the two-ward subset — proves the subgroup split is also scoped
    // to `mixedResults`, not the full 23-ward population re-grouped underneath it.
    expect(wardSection.subgroups.map((group) => group.label)).toEqual(["North Metro", "East Metro"]);
    expect(wardSection.subgroups.map((group) => group.entries.length)).toEqual([1, 1]);
  });

  it("drops an empty section rather than rendering a heading over nothing", () => {
    const wardOnly = [entryById("rph-adult-secure")];
    const sections = groupedResults(wardOnly);
    expect(sections.map((section) => section.key)).toEqual(["ward"]);
  });

  it("places a ward whose service is not one of the five canonical ones into an 'Other' bucket, never dropping it", () => {
    // Hand-written literal, not fixture data: every real ward in ward-sites.ts sits in one of
    // wardServiceOrder's five services, so there is no fixture row that exercises the "Other"
    // fallback. This is the one case the brief allows a literal for.
    const unplacedWard: HubEntry = {
      id: "test-unplaced-ward",
      kind: "ward",
      name: "Test Unplaced Ward",
      href: "/mockups/ward-flow/ward/test-unplaced-ward",
      service: "Nonexistent Region",
    };

    const sections = groupedResults([unplacedWard]);
    const wardSection = sections.find((section) => section.key === "ward")!;

    expect(wardSection.subgroups).toEqual([{ label: "Other", entries: [unplacedWard] }]);
  });
});

describe("needsAttention — worst first, and only the two stated reasons", () => {
  /**
   * Fixture facts (all computed from `unitCapacity` inputs and `isStale`'s own formula, read
   * directly off ward-sites.ts, never re-summed here):
   *   - fsh-older-adult: allocatable 0 (so ready 0), confirmed 30 min ago against a 120-minute
   *     staleness window — not stale. Severity 1, "no ready beds" only.
   *   - gry-older-adult: allocatable 0 (ready 0) AND confirmed 300 min ago against a 180-minute
   *     window — stale. Severity 2, both reasons. Ward-sites.ts's own comment: "the freshness
   *     gate should catch this one."
   *   - (kun-adult-open, the second severity-2 case, left the fixture on 26 Sept 2026: Kununurra has no
   *     mental health ward. The severity-2 stability case is now proved by the hand-built test below.)
   *   - brm-adult-secure: allocatable 0 (ready 0) since the owner's ruling of 2026-09-25 that Broome
   *     is not forensic (it confirms no ready bed; its empty bed is held), confirmed 45 min ago
   *     against a 150-minute window — not stale. Severity 1, "no ready beds" only.
   * Every other ward has at least one allocatable bed, or a confirmation within its own staleness
   * window, so none of them qualifies. This is the exact discriminating population: the fixture
   * now contains one severity-2 case and two severity-1-only cases (since 26 Sept 2026 the Kununurra
   * ward, the second severity-2 case, is gone), which a comparator mutated to sort ascending, or a
   * stability-losing sort, would visibly reorder; severity-2 stability is proved by the hand-built
   * case below.
   */
  it("flags exactly the three qualifying wards, worst-first, with each severity keeping its fixture order", () => {
    const result = needsAttention(ENTRIES);

    expect(result).toHaveLength(3);
    expect(result.map((row) => row.entry.id)).toEqual(["gry-older-adult", "fsh-older-adult", "brm-adult-secure"]);
    expect(result.map((row) => row.severity)).toEqual([2, 1, 1]);
  });

  it("keeps two severity-2 wards in the order it was given them (hand-built, since the fixture has one)", () => {
    const worst = ENTRIES.find((entry) => entry.id === "gry-older-adult")!;
    const mild = ENTRIES.find((entry) => entry.id === "fsh-older-adult")!;
    const first = { ...worst, id: "severity-2-first" };
    const second = { ...worst, id: "severity-2-second" };

    expect(needsAttention([mild, first, second]).map((row) => row.entry.id)).toEqual([
      "severity-2-first",
      "severity-2-second",
      "fsh-older-adult",
    ]);
    // Reversed input, reversed output: the order comes from the input, not from the ids.
    expect(needsAttention([mild, second, first]).map((row) => row.entry.id)).toEqual([
      "severity-2-second",
      "severity-2-first",
      "fsh-older-adult",
    ]);
  });

  it("states the both-reasons sentence for a severity-2 row and the no-ready-beds-only sentence for the severity-1 row", () => {
    const result = needsAttention(ENTRIES);
    const bySeverity2 = result.find((row) => row.entry.id === "gry-older-adult")!;
    const bySeverity1 = result.find((row) => row.entry.id === "fsh-older-adult")!;

    expect(bySeverity2.reason).toBe("No ready beds, and the last bed confirmation is stale — check with the ward.");
    expect(bySeverity1.reason).toBe("No ready beds right now.");
  });

  it("does not flag a ward with a ready bed and a fresh confirmation — the floor that tells 'needs attention' from 'every ward'", () => {
    const result = needsAttention(ENTRIES);
    expect(result.some((row) => row.entry.id === "rph-adult-secure")).toBe(false);
  });
});
