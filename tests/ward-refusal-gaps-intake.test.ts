// tests/ward-refusal-gaps-intake.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — BATCH TWO: the front door.
//
// `RECEIVE_REFERRAL` is the widest event in the model and the only one a system outside this
// codebase could plausibly send. It runs a gauntlet of around twenty checks before it writes
// anything, and three of them had never been executed by any test: the destination KIND, the
// patient's recorded GENDER, and whether the free-text history is text at all.
//
// ⚠️ THESE THREE MATTER MORE THAN THE USUAL "the type already stops it" ARGUMENT, because this is
// the one event whose caller is NOT necessarily TypeScript. A referral arriving from a sending
// team's system, a stored event replayed, a fixture — none of those are checked by the compiler,
// and the reducer's own comment on the history loop says why the distinction is worth a refusal
// rather than a shrug: an omitted field and a deliberately blank one "are the same keystroke
// away and the loop below is the only thing that tells a caller which mistake it made".
//
// 🔴 EVERY CASE CARRIES ITS CONTROL, and here the control does more work than elsewhere: the
// gauntlet means a referral can be refused for any of twenty reasons, so a test asserting merely
// "it was refused" would pass while the guard under test never ran. Each case therefore sends the
// SAME referral twice, changing one field, and requires the named refusal in the first and its
// absence in the second.
import { describe, expect, it } from "vitest";

import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type {
  ReferralDestination,
  ReferralGender,
  WardReferralDestination,
} from "../src/components/ward-management/ward-model";
import { HOME_REGIONS, REFERRAL_GENDERS } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

/** As in batch one: the cast IS the test, so it is named rather than inlined. */
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

/**
 * A referral the reducer accepts, so that changing exactly one field is what causes a refusal.
 * Modelled on the fixture `tests/ward-community-hub.test.ts` already relies on.
 */
const wardDestination: WardReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};

function referral(overrides: Record<string, unknown> = {}) {
  return {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [wardDestination] as ReferralDestination[],
    homeRegion: HOME_REGIONS[0],
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
    ...overrides,
  } as never;
}

describe("the front door refuses what it does not recognise", () => {
  it("the base referral this file varies is itself accepted", () => {
    // Without this, every test below could be passing on a referral that was refused for some
    // other reason entirely, and the file would prove nothing about the guards it names.
    const seeded = seedWardFlowState();
    const accepted = wardFlowReducer(seeded, referral());
    expect(added(seeded, accepted), "the base fixture is refused, so no test in this file is meaningful").toEqual([]);
  });

  it("RECEIVE_REFERRAL refuses a destination kind that is not in REFERRAL_DESTINATION_KINDS", () => {
    const seeded = seedWardFlowState();

    const off = wardFlowReducer(seeded, referral({ destinations: [{ kind: OFF_LIST }] }));
    expect(added(seeded, off)).toEqual([
      "RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS",
    ]);

    const on = wardFlowReducer(seeded, referral());
    expect(added(seeded, on)).not.toContain(
      "RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS",
    );
  });

  it("RECEIVE_REFERRAL refuses a gender that is not in REFERRAL_GENDERS", () => {
    const seeded = seedWardFlowState();

    const off = wardFlowReducer(
      seeded,
      referral({ destinations: [{ ...wardDestination, gender: OFF_LIST as ReferralGender }] }),
    );
    expect(added(seeded, off)).toEqual(["RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS"]);

    // Control: a gender the model knows. Note the guard only runs when a gender is SUPPLIED —
    // absent means "not recorded yet", not "the caller forgot" — so the control supplies one.
    const on = wardFlowReducer(
      seeded,
      referral({ destinations: [{ ...wardDestination, gender: REFERRAL_GENDERS[0] }] }),
    );
    expect(added(seeded, on)).not.toContain("RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS");
  });

  it("RECEIVE_REFERRAL refuses a history that is not text, and says which field", () => {
    const seeded = seedWardFlowState();

    // Not a blank string — a value that is not a string at all, which is the mistake the reducer
    // says a caller cannot otherwise tell apart from a deliberate blank.
    const off = wardFlowReducer(seeded, referral({ history: 42 }));
    expect(added(seeded, off)).toEqual(["RECEIVE_REFERRAL history must be text, even when it is empty text"]);

    // Control, and it is the interesting one: an EMPTY history is text and must be accepted, so
    // the refusal is about the type of the value and never about it being unwritten.
    const blank = wardFlowReducer(seeded, referral({ history: "" }));
    expect(added(seeded, blank)).not.toContain("RECEIVE_REFERRAL history must be text, even when it is empty text");
  });
});
