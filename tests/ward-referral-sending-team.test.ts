/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { referralReferrerName } from "@/components/ward-management/referrals/referral-referrer";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { SENDING_TEAM_NAME_LIMIT } from "@/components/ward-management/ward-model";

/**
 * WHICH TEAM OR SERVICE SENT A REFERRAL — the field, and the one thing it must never become.
 *
 * The owner was asked directly, 2026-09-12: *"Should a referral record which team or service sent
 * it, not just which hospital?"* — **"Yes it should."**
 *
 * 🔴 **THE DANGEROUS VERSION OF THIS FEATURE IS THE HELPFUL ONE.** A sending team's name is the
 * most plausible thing in the model to reach for when a screen has a field labelled *"Referred
 * by"* and nothing to put in it. **D-12 forbids exactly that**: an organisation standing in a
 * field labelled as a person is a fabricated attribution on a clinical record, not a formatting
 * choice. A service is not a human being, and a record saying a named person referred this
 * patient is a different clinical claim from one saying a service did.
 *
 * ⚠️ **So the load-bearing case here is a NEGATIVE, and it is written with its floor first.** A
 * negative alone passes loudest over a field that was renamed or never set — it would be perfectly
 * green over a referral carrying no team at all. Every case below therefore proves the team name
 * REACHED the record before asking what does not carry it.
 */

/** A real site code, as `RECEIVE_REFERRAL` requires — an ED id is a different identifier and
 *  the reducer refuses it, which is the check working rather than a fixture quirk. */
const ORIGIN_SITE = "RPH";
const NOW = 9 * 60;
const TEAM = "Armadale Community Mental Health Service";

/** Raises one referral through the real reducer and returns the referral it created — by
 *  difference, so nothing here can accidentally read a seeded row. */
function receive(overrides: Record<string, unknown> = {}) {
  const before: WardFlowState = seedWardFlowState();
  const after = wardFlowReducer(before, {
    type: "RECEIVE_REFERRAL",
    // The reducer REFUSES this event from role `ed` — a referral arriving at the front door is an
    // act by the sending service, not by the department receiving it.
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [{ kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: true }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: ORIGIN_SITE,
    transportNeeded: false,
    history: "",
    ...overrides,
  } as Parameters<typeof wardFlowReducer>[1]);
  const created = after.referrals.filter((referral) => !before.referrals.some((old) => old.id === referral.id));
  return { after, created };
}

describe("a referral records the team or service that sent it", () => {
  it("carries the name the front door supplied, through the real reducer", () => {
    const { after, created } = receive({ sendingTeamName: TEAM });

    // Anti-vacuity in this order deliberately: a rejected event creates nothing, and an assertion
    // about `created[0]` would then throw an undefined rather than say what went wrong.
    expect(after.rejections, "the referral must be accepted, or nothing below is exercised").toEqual([]);
    expect(created, "exactly one referral must have been created by this dispatch").toHaveLength(1);
    expect(created[0]!.sendingTeamName, "the sending team's name did not reach the record").toBe(TEAM);
  });

  /**
   * ⚠️ THE ABSENCE IS A REAL ANSWER AND MUST SURVIVE AS ONE. Police, ambulance and an emergency
   * department's own medical staff are legitimate sources with no sending team. A default here —
   * an empty string, a source label, "Unknown" — would make "nobody recorded a team" and "this
   * team" indistinguishable afterwards.
   */
  it("leaves the field absent when no team was supplied, rather than defaulting it", () => {
    const { after, created } = receive({ source: "police" });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);
    expect(created[0]!.sendingTeamName, "an absent sending team was filled in with a substitute").toBeUndefined();
  });

  it("refuses a present-but-blank name rather than quietly treating it as absent", () => {
    const { after, created } = receive({ sendingTeamName: "   " });
    expect(created, "a blank team name must create no referral at all").toHaveLength(0);
    expect(after.rejections.length, "it must be rejected rather than normalised away").toBeGreaterThan(0);
  });

  /**
   * 🔴 REFUSED, NEVER SHORTENED — the same rule `history` follows. **A truncated team name is a
   * DIFFERENT team's name**, and it renders as a clean, plausible row that nothing anywhere
   * contradicts.
   *
   * ⚠️ The limit itself must be ACCEPTED. Without that half, narrowing the field by one character
   * would pass every assertion above it.
   */
  it("refuses an over-length name rather than shortening it, and accepts the limit itself", () => {
    const tooLong = "A".repeat(SENDING_TEAM_NAME_LIMIT + 1);
    const { after, created } = receive({ sendingTeamName: tooLong });
    expect(created, "an over-length team name must create no referral").toHaveLength(0);
    expect(after.rejections.length, "it must be rejected").toBeGreaterThan(0);

    const atLimit = "A".repeat(SENDING_TEAM_NAME_LIMIT);
    const accepted = receive({ sendingTeamName: atLimit });
    expect(
      accepted.created,
      "the limit itself was refused — an off-by-one here silently narrows the field",
    ).toHaveLength(1);
    expect(accepted.created[0]!.sendingTeamName).toBe(atLimit);
  });
});

describe("the sending team is never rendered as the referrer", () => {
  /**
   * 🔴 THE CASE THIS FILE EXISTS FOR.
   *
   * `referralReferrerName` answers WHO — a person — and returns a stated absence where the record
   * holds none. **This proves it does not start answering with an organisation the moment one is
   * available**, which is the single most likely future edit to this area: a screen with an empty
   * "Referred by" field and a team name sitting one property away.
   *
   * ⚠️ **The floor comes first.** Without it this case would pass over a referral carrying no team
   * at all — green, and proving nothing whatsoever.
   */
  it("does not return the sending team's name, even when the referral carries one", () => {
    const { after, created } = receive({ sendingTeamName: TEAM });
    expect(after.rejections).toEqual([]);
    expect(created).toHaveLength(1);

    const referral = created[0]!;
    expect(referral.sendingTeamName, "the floor failed: no team on the record, so the case below proves nothing").toBe(
      TEAM,
    );

    const shown = referralReferrerName(referral);
    expect(
      shown,
      "the referrer field is showing the SENDING TEAM. D-12: an organisation must never stand in a " +
        "field labelled as a person — a service is not a human being, and a record saying a named " +
        "person referred this patient is a different clinical claim from one saying a service did. " +
        `Shown was: "${shown}"`,
    ).not.toContain(TEAM);
    expect(shown, "the referrer field leaked part of the team's name").not.toMatch(/Armadale|Mental Health Service/i);
  });

  /**
   * ⚠️ AND THE ANSWER IS THE SAME WITH AND WITHOUT A TEAM. If these two ever differ, the referrer
   * has begun deriving something from the sender — which is the fabrication, whatever string it
   * happens to produce.
   */
  it("answers identically whether or not a sending team is recorded", () => {
    const withTeam = receive({ sendingTeamName: TEAM });
    const withoutTeam = receive({ source: "police" });
    expect(withTeam.created).toHaveLength(1);
    expect(withoutTeam.created).toHaveLength(1);
    expect(withTeam.created[0]!.sendingTeamName, "the floor failed: the two cases are not different").toBe(TEAM);
    expect(
      withoutTeam.created[0]!.sendingTeamName,
      "the floor failed: the two cases are not different",
    ).toBeUndefined();

    expect(
      referralReferrerName(withTeam.created[0]!),
      "the referrer answer CHANGED when a sending team was present — it is deriving a person from an organisation",
    ).toBe(referralReferrerName(withoutTeam.created[0]!));
  });
});
