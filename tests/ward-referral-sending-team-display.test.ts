/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildReferralSummary } from "@/components/ward-management/search/record-preview";
import { sendingTeamFragment, withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { referralReferrerName } from "@/components/ward-management/referrals/referral-referrer";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * THE SENDING TEAM ON SCREEN — the owner asked for it shown wherever a referral's origin already
 * appears, 2026-09-12.
 *
 * 🔴 **THE WORD "SENT BY" IS THE LOAD-BEARING PART, NOT THE NAME.** Every origin line in this
 * prototype already says *from* about a PLACE — a hospital, a site code, a channel. **The sending
 * team is a different fact about the same referral**, and two facts sharing one preposition read
 * as one fact: *"Referral from RPH · from Armadale…"* invites a coordinator to take the team as
 * being at that hospital, which is exactly the join the record does not make.
 *
 * ⚠️ **AND THE ABSENCE RENDERS AS NOTHING, NEVER AS A PLACEHOLDER.** Police, ambulance and an
 * emergency department's own medical staff have no sending team. A "Not recorded" on every one of
 * those rows would promote an absence to a headline on rows where nothing is missing.
 */

const BASE: Referral = seedWardFlowState().referrals[0]!;
const TEAM = "Armadale Community Mental Health Service";

function withTeam(name: string | undefined): Referral {
  return { ...BASE, sendingTeamName: name };
}

describe("the sending team as a display fragment", () => {
  it("has a real referral to build on, or every case below is vacuous", () => {
    expect(BASE, "the seed carries no referrals").toBeDefined();
    expect(typeof BASE.originSiteCode, "the base referral has no origin to append to").toBe("string");
  });

  it("says SENT BY, never FROM — the origin line already owns that word for the site", () => {
    const fragment = sendingTeamFragment(withTeam(TEAM));
    expect(fragment, "no fragment produced for a referral that names a team").toBeDefined();
    expect(fragment).toBe(`sent by ${TEAM}`);
    expect(
      fragment,
      "the fragment says FROM. Every origin line already says 'from' about a SITE, so a team " +
        "sharing that word reads as the place rather than as the sender",
    ).not.toMatch(/\bfrom\b/);
  });

  it("produces nothing at all when no team is recorded", () => {
    expect(sendingTeamFragment(withTeam(undefined)), "an absent team produced a fragment").toBeUndefined();
  });

  /**
   * ⚠️ A blank cannot reach a stored `Referral` — `RECEIVE_REFERRAL` refuses one rather than
   * normalising it. This is the belt to that braces: a display helper that renders a dangling
   * separator for a value it did not expect is worse than one that renders nothing.
   */
  it("treats a whitespace-only name as absent rather than rendering a dangling separator", () => {
    expect(sendingTeamFragment(withTeam("   "))).toBeUndefined();
    expect(withSendingTeam("Referral from RPH", withTeam("   "))).toBe("Referral from RPH");
  });

  it("appends to a line only when there is something to append", () => {
    expect(withSendingTeam("Referral from RPH", withTeam(TEAM))).toBe(`Referral from RPH · sent by ${TEAM}`);
    expect(withSendingTeam("Referral from RPH", withTeam(undefined))).toBe("Referral from RPH");
  });

  it("uses the caller's own separator, so a line with different punctuation is not forced to ours", () => {
    expect(withSendingTeam("Referral from RPH", withTeam(TEAM), " — ")).toBe(`Referral from RPH — sent by ${TEAM}`);
  });
});

describe("the rendered origin lines carry it", () => {
  /**
   * 🔴 THE FLOOR AND THE CASE IN ONE, DELIBERATELY. The first assertion proves the line changed at
   * all; without it the second would pass over a summary that never mentions the team, and over a
   * helper that was never called.
   */
  it("the search record preview shows the team after the origin, not inside it", () => {
    const withName = buildReferralSummary(withTeam(TEAM));
    const withoutName = buildReferralSummary(withTeam(undefined));

    expect(withName.originLine, "the preview line never mentions the sending team").toContain(TEAM);
    expect(withoutName.originLine, "a referral with no team had one rendered anyway").not.toContain(TEAM);
    expect(
      withName.originLine.indexOf(TEAM),
      "the team appears BEFORE the origin site, where it reads as part of the place",
    ).toBeGreaterThan(withName.originLine.indexOf(withName.originLine.split(" · ")[0]!));
    expect(withName.originLine, "the team is introduced with the site's own preposition").toContain(`sent by ${TEAM}`);
  });

  /**
   * ⚠️ THE ABSENT CASE MUST LOOK EXACTLY AS IT DID BEFORE THIS FEATURE. A trailing separator, a
   * doubled space or a stray "sent by" on a police referral would be a visible regression on rows
   * where nothing is wrong.
   */
  it("leaves a referral with no sending team rendering exactly as before", () => {
    const line = buildReferralSummary(withTeam(undefined)).originLine;
    expect(line, "a dangling separator was left on a referral with no team").not.toMatch(/[·—-]\s*$/);
    expect(line, "an empty 'sent by' reached a referral with no team").not.toContain("sent by");
    expect(line.trimEnd(), "trailing whitespace was left behind").toBe(line);
  });
});

describe("the sending team and the referrer stay separate on screen", () => {
  /**
   * 🔴 THE SAME PROPERTY THE MODEL-LEVEL SUITE PINS, RE-ASSERTED AT THE DISPLAY LAYER, AND IT IS
   * NOT A DUPLICATE.
   *
   * `tests/ward-referral-sending-team.test.ts` proves the DERIVATION does not leak the team into
   * the referrer. This proves a future edit cannot achieve the same thing by routing the display
   * helper's output into a person-labelled field instead — the two helpers are siblings in one
   * directory with near-identical call sites, which is exactly what makes merging them tempting.
   */
  it("the referrer answer is unchanged by the presence of a sending team", () => {
    const shown = referralReferrerName(withTeam(TEAM));
    expect(shown, "the referrer field leaked the sending team").not.toContain(TEAM);
    expect(shown, "the referrer answer changed when a sending team was present").toBe(
      referralReferrerName(withTeam(undefined)),
    );
  });
});
