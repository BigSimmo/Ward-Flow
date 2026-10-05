import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  COMMUNITY_TEAM_PAGES,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
import {
  hubFigures,
  teamFigures,
  teamHasPeople,
} from "@/components/ward-management/community/proposal/community-proposal-figures";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("community redesign proposal figures", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;

  it("counts every team exactly as the shared hub derivation does", () => {
    for (const team of COMMUNITY_TEAM_PAGES) {
      const figures = teamFigures(team, state.admissions, state.referrals, now);
      const lists = communityHubLists(state.admissions, team, state.referrals);
      expect(figures.inBed).toEqual(lists.currentlyAdmitted);
      expect(figures.expectedBack).toEqual(lists.expectedBack);
      expect(figures.dischargedToArea).toEqual(lists.dischargedIntoTheArea);
      expect(figures.pastExpected.length).toBeLessThanOrEqual(figures.expectedBack.length);
    }
  });

  it("makes hub totals the sum of the team figures, and unmatched the shared derivation", () => {
    const hub = hubFigures(COMMUNITY_TEAM_PAGES, state.admissions, state.referrals, now);
    expect(hub.inBed).toBe(hub.teams.reduce((sum, figures) => sum + figures.inBed.length, 0));
    expect(hub.waiting).toBe(hub.teams.reduce((sum, figures) => sum + figures.waiting.length, 0));
    expect(hub.unmatched).toBe(admissionsWithNoCommunityTeam(state.admissions, state.referrals).length);
    expect(hub.active.every(teamHasPeople)).toBe(true);
    expect(hub.teams.filter(teamHasPeople)).toHaveLength(hub.active.length);
  });

  it("shows the seeded Midland team as the current screen's engine figures do", () => {
    const midland = communityTeamById("midland");
    expect(midland).not.toBeNull();
    const figures = teamFigures(midland!, state.admissions, state.referrals, now);
    const lists = communityHubLists(state.admissions, midland!, state.referrals);
    expect(figures.inBed.length).toBe(lists.currentlyAdmitted.length);
    expect(figures.expectedBack.length).toBe(lists.expectedBack.length);
  });

  it("never reads the demonstration cohort or invents a legal status", () => {
    const dir = join(process.cwd(), "src/components/ward-management/community/proposal");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source, file).not.toMatch(/community-demo-cohort|Form 5A Invol|K\. Vance/);
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
