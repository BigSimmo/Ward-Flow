import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

/**
 * THE COMMUNITY SCREEN READS THE CATCHMENT LIST, AND MUST NEVER READ THE REGION LIST.
 *
 * ⚠️ **THIS TASK EXISTS BECAUSE THE PLAN SAID THE OPPOSITE.** The third-edition master plan §4.8
 * instructs lane B to render "one team list (Q-5)", and its issue I-7 says that until the owner
 * answers, "lane B renders the one the current Community screen renders" — both of which read as a
 * migration this lane still has to perform. **Measured 2026-09-11: there is nothing to migrate.**
 * `community-screen.tsx` and `community-derivations.ts` already import only `COMMUNITY_TEAM_PAGES`,
 * the sixty-five catchment teams, and `community-derivations.ts` says in its own words that the
 * region-keyed list "is deliberately NOT read here".
 *
 * ⚠️ **AND THE GREP THAT LOOKS LIKE EVIDENCE AGAINST THAT IS PROSE.** Searching those two files for
 * `COMMUNITY_TEAMS` returns four hits and **every one is a comment explaining why it is not used**.
 * A grep for a name finds its discussion; only an import check finds its use. That is why the
 * assertion below reads the import statements rather than counting occurrences of the name.
 *
 * 🔴 **WHAT THIS PINS IS THE OWNER'S RULING, NOT TODAY'S CODE.** Q-5, 2026-09-10: the community
 * screen shows **the sixty-five**, every one marked as invented; the ten region placeholders are
 * retired when a real list arrives. This file is what goes red if a later change quietly swaps the
 * source back — which is a clinical wrong answer, not a cosmetic one: the ten are named
 * "(placeholder)" and cover a whole region each, so a coordinator reading them would be told a
 * patient's team is "Perth Metropolitan Community Mental Health Team (placeholder)" instead of the
 * actual catchment clinic.
 *
 * ⚠️ **POPULATION — what a green here walks, and what it is silent about.** It reads exactly two
 * source files and the two exported lists. It says **nothing** about what any screen renders, about
 * the other fourteen ward screens, or about whether the sixty-five names are correct — only about
 * which list these two modules are wired to. `tests/ward-community-team-count.test.ts` is what pins
 * the count itself, and it re-derives it from the catchment table rather than hard-coding it.
 *
 * ⚠️ **`readFileSync` means `npm run test:focused` CANNOT SELECT THIS FILE** (I-13: focused runs
 * select by import graph). Name it directly, or run the ward suite.
 */

const COMMUNITY_DIR = resolve(process.cwd(), "src/components/ward-management/community");

/** The two modules the Community team screen is built from. */
const WIRED_FILES = ["community-screen.tsx", "community-derivations.ts"] as const;

/**
 * Import statements only, with comments stripped first.
 *
 * ⚠️ Stripping comments is the whole point: the four mentions of the region list in these files are
 * comments, and a check that counted raw occurrences would fail on correct code — a guard reddening
 * on the very prose that explains why it is satisfied.
 */
function importedModules(source: string): string[] {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gmu, "");
  return [...withoutLineComments.matchAll(/^\s*import\s[\s\S]*?from\s+"([^"]+)"/gmu)].map((match) => match[1]);
}

describe("the community team screen's list source", () => {
  it("has both lists available to tell apart, so the assertions below are not vacuous", () => {
    expect(
      COMMUNITY_TEAM_PAGES.length,
      "the catchment list is empty — nothing below would discriminate",
    ).toBeGreaterThan(40);
    expect(Object.keys(COMMUNITY_TEAMS).length, "the region list is empty — the wrong answer is unreachable").toBe(10);
    expect(
      COMMUNITY_TEAM_PAGES.length,
      "the two lists are the same size, so no assertion here could tell them apart",
    ).not.toBe(Object.keys(COMMUNITY_TEAMS).length);
  });

  for (const file of WIRED_FILES) {
    it(`${file} imports the catchment list and never the region list`, () => {
      const imports = importedModules(readFileSync(resolve(COMMUNITY_DIR, file), "utf8"));

      expect(
        imports.filter((specifier) => specifier.endsWith("/ward-teams")),
        `${file} imports ward-teams — the region list is ten "(placeholder)" names covering a whole region each, ` +
          "and Q-5 rules the screen shows the sixty-five catchment teams",
      ).toEqual([]);
    });
  }

  it("the catchment list is the one the screen's own team switcher walks", () => {
    const source = readFileSync(resolve(COMMUNITY_DIR, "community-screen.tsx"), "utf8");
    const imports = importedModules(source);

    expect(
      imports.some((specifier) => specifier.endsWith("/community/community-derivations")),
      "community-screen.tsx no longer imports community-derivations, so it cannot be reading COMMUNITY_TEAM_PAGES",
    ).toBe(true);
  });
});
