// tests/ward-referral-alternatives.test.ts
import { describe, expect, it } from "vitest";

import {
  ADMISSION_ALTERNATIVE_LABELS,
  ADMISSION_ALTERNATIVE_OPTIONS,
  alternativesConsideredError,
  alternativesLines,
  alternativesSummary,
  orderedAlternatives,
  type AlternativeConsidered,
} from "../src/components/ward-management/referrals/referral-alternatives";
import { wardReferralInboxEntries } from "../src/components/ward-management/referrals/referral-inbox";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { typedTextOf } from "../src/components/ward-management/ward-flow-typed-text-ledger";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Feature 26 (Josh, 9 Nov 2026): alternatives to admission. An unranked, optional list of five
 * placeholders, each marked Not suitable, Tried or Declined by patient. Carried on
 * `RECEIVE_REFERRAL` as fixed-list choices; it never blocks or recommends a bed request.
 */

const NOW = 9 * 60;
const UNIT_ID = "fre-older-adult";
const MARKED: AlternativeConsidered[] = [
  { option: "crisis_team_home_visit", outcome: "tried" },
  { option: "short_stay_unit", outcome: "not_suitable" },
];

type Receive = Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>;

function receive(overrides: Partial<Receive> = {}): Receive {
  return {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Older adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: UNIT_ID,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    sendingTeamName: "Armadale Community Mental Health",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
    ...overrides,
  } as Receive;
}

function run(event: Receive) {
  const before = seedWardFlowState();
  const after = wardFlowReducer(before, event);
  const created = after.referrals.filter((referral) => !before.referrals.some((old) => old.id === referral.id));
  return { after, created, refused: after.rejections.length > before.rejections.length };
}

describe("alternatives to admission: model", () => {
  it("keeps the five options in the signed-off order, unranked", () => {
    expect(ADMISSION_ALTERNATIVE_OPTIONS.map((option) => ADMISSION_ALTERNATIVE_LABELS[option])).toEqual([
      "Crisis team home visit",
      "Mental Health Hospital in the Home",
      "Step-up/step-down unit",
      "Short-stay unit",
      "Next-day community follow-up",
    ]);
  });

  it("orders marks by the fixed list, never by when or how they were marked", () => {
    expect(
      orderedAlternatives({ short_stay_unit: "not_suitable", crisis_team_home_visit: "tried" }).map((e) => e.option),
    ).toEqual(["crisis_team_home_visit", "short_stay_unit"]);
    expect(alternativesSummary(MARKED)).toBe("2 of 5 considered");
    expect(alternativesSummary(undefined)).toBe("None marked");
    expect(alternativesLines(MARKED)).toEqual(["Crisis team home visit: Tried", "Short-stay unit: Not suitable"]);
  });

  it("refuses an empty list, an unlisted value, an extra key and a repeated option", () => {
    expect(alternativesConsideredError(MARKED)).toBeNull();
    expect(alternativesConsideredError([])).not.toBeNull();
    expect(alternativesConsideredError([{ option: "respite", outcome: "tried" }])).not.toBeNull();
    expect(alternativesConsideredError([{ option: "short_stay_unit", outcome: "best" }])).not.toBeNull();
    expect(alternativesConsideredError([{ option: "short_stay_unit", outcome: "tried", note: "x" }])).not.toBeNull();
    expect(
      alternativesConsideredError([
        { option: "short_stay_unit", outcome: "tried" },
        { option: "short_stay_unit", outcome: "declined" },
      ]),
    ).not.toBeNull();
  });
});

describe("alternatives to admission: RECEIVE_REFERRAL", () => {
  it("stores the marks on a community bed request and shows them in the ward's own inbox", () => {
    const { after, created, refused } = run(receive({ alternativesConsidered: MARKED }));
    expect(refused).toBe(false);
    expect(created).toHaveLength(1);
    expect(created[0]!.alternativesConsidered).toEqual(MARKED);
    const entry = wardReferralInboxEntries(after.referrals, UNIT_ID).find((e) => e.id === created[0]!.id);
    expect(entry?.alternativesConsidered).toEqual(MARKED);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(after)))).toBe(true);
  });

  it("is optional: a bed request with nothing marked is accepted and stores no field", () => {
    const { created, refused } = run(receive());
    expect(refused).toBe(false);
    expect(created).toHaveLength(1);
    expect(created[0]).not.toHaveProperty("alternativesConsidered");
  });

  it("refuses a malformed list, a ward sender and a request that asks for no bed", () => {
    expect(run(receive({ alternativesConsidered: [] })).refused).toBe(true);
    expect(run(receive({ alternativesConsidered: [{ option: "respite", outcome: "tried" }] as never })).refused).toBe(
      true,
    );
    // A valid ward-to-ward send, so only the alternatives guard can refuse it.
    const wardSend = run(
      receive({
        role: "ward",
        source: "psychiatric_ward",
        originUnitId: "bty-adult-secure",
        actingUnitId: "bty-adult-secure",
        originSiteCode: "BTY",
        sendingTeamName: undefined,
        alternativesConsidered: MARKED,
      }),
    );
    expect(wardSend.refused).toBe(true);
    expect(wardSend.after.rejections.at(-1)?.reason).toMatch(
      /alternatives to admission are recorded by ED or community/,
    );
    // The same send with nothing marked is accepted, so the refusal above is the guard's.
    expect(
      run(
        receive({
          role: "ward",
          source: "psychiatric_ward",
          originUnitId: "bty-adult-secure",
          actingUnitId: "bty-adult-secure",
          originSiteCode: "BTY",
          sendingTeamName: undefined,
        }),
      ).refused,
    ).toBe(false);
    expect(
      run(
        receive({
          destinations: [{ kind: "community_team", teamName: "Armadale Community Mental Health" }] as never,
          alternativesConsidered: MARKED,
        }),
      ).refused,
    ).toBe(true);
  });

  it("is never read as typed text", () => {
    const typed = typedTextOf(receive({ alternativesConsidered: MARKED, history: "" }));
    expect(typed).not.toBeNull();
    expect(typed).not.toContain("tried");
    expect(typed).not.toContain("crisis_team_home_visit");
  });

  it("restore refuses a stored referral carrying an unlisted alternative", () => {
    const { after, created } = run(receive({ alternativesConsidered: MARKED }));
    const tampered = {
      ...after,
      referrals: after.referrals.map((referral) =>
        referral.id === created[0]!.id
          ? { ...referral, alternativesConsidered: [{ option: "short_stay_unit", outcome: "recommended" }] }
          : referral,
      ),
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(tampered)))).toBe(false);
  });
});
