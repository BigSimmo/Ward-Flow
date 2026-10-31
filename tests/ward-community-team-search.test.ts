import { describe, expect, it } from "vitest";

import { communityTeamSearchFields } from "@/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";

/**
 * The community team search ("Team, suburb or postcode") reads each suburb and postcode as its own
 * field, so a typed number matches within one postcode and never across two (A1 finding, 31 Oct
 * 2026). Synthetic suburb names; the postcodes only need to sit side by side.
 */
describe("community team search: a postcode matches within one postcode only", () => {
  const team = COMMUNITY_TEAM_PAGES[0].name;
  const postcodes = new Map([
    ["Testsuburb North", new Set(["6062"])],
    ["Testsuburb South", new Set(["6063"])],
  ]);
  const fields = communityTeamSearchFields(team, ["Testsuburb North", "Testsuburb South"], postcodes);

  it("finds the team by a whole postcode, a suburb, or a suburb and postcode together", () => {
    expect(fieldsMatchEveryWord("6062", fields)).toBe(true);
    expect(fieldsMatchEveryWord("6063", fields)).toBe(true);
    expect(fieldsMatchEveryWord("testsuburb south", fields)).toBe(true);
    expect(fieldsMatchEveryWord("north 6063", fields)).toBe(true);
    expect(fieldsMatchEveryWord(team.toLowerCase(), fields)).toBe(true);
  });

  it("does not match digits that only appear where two postcodes meet", () => {
    // "6062" + "6063" joined read "60626063", which holds "626": the old single string matched.
    expect(fieldsMatchEveryWord("626", [fields.join(" ")])).toBe(true);
    expect(fieldsMatchEveryWord("626", fields)).toBe(false);
    expect(fieldsMatchEveryWord("2606", fields)).toBe(false);
  });
});
