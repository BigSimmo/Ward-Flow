// tests/ward-referral-referrer.test.ts
//
// D-12 (`docs/ward-flow/owner-decisions-2026-09-1x.md`) — the referrer is the recorded source, and
// a person only if the record carries one. Never a source type standing in for a person.
//
// 🔴 FINDING, REPORTED RATHER THAN WORKED AROUND: no fixture in this repository has a named
// referrer, because `Referral` holds no field that can carry one — checked directly against the
// type (see `referral-referrer.ts`'s own doc comment) and confirmed empty by grep across
// `ward-model.ts` for any `referrerName`/`contactName`/similar. Every case below is therefore the
// "no named person" branch; there is no real source to draw a "shows a name" fixture from, and one
// is not invented here to make that branch exist — see the brief this test implements.
import { describe, expect, it } from "vitest";

import {
  referralReferrerName,
  REFERRER_NOT_RECORDED,
} from "../src/components/ward-management/referrals/referral-referrer";
import { REFERRAL_SOURCES, type Referral, type ReferralSource } from "../src/components/ward-management/ward-model";

/**
 * Display labels a REAL implementation might be tempted to fall back on — copied from
 * the retired intake form's own `SOURCE_LABELS` and `community-screen.tsx`'s own
 * `REFERRAL_SOURCE_LABELS` (both read-only lookups this test does not import, because importing an
 * unexported map is not possible and re-typing it here is exactly what proves the point: this is
 * the vocabulary a caller would reach for if it inferred a person from a source type, and the
 * catcher below asserts none of it ever reaches `referralReferrerName`'s output).
 */
const SOURCE_TYPE_WORDS = [
  "Community",
  "Crisis service",
  "Police",
  "Ambulance",
  "Inter-hospital",
  "ED medical staff",
  "General practitioner (GP)",
  "community",
  "crisis_service",
  "police",
  "ambulance",
  "inter_hospital",
  "ed_medical",
  "gp",
];

/** A minimal, fully-typed `Referral` naming the given source and nothing identifying — every
 *  other field is a non-identifying structured fact, exactly as `Referral`'s own doc comment
 *  requires or an optional field left unset. */
function fixtureReferral(source: ReferralSource): Referral {
  return {
    id: `test-referral-${source}`,
    destinations: [],
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source,
    raisedAt: 0,
    urgency: 2,
    originSiteCode: "TEST",
    transportNeeded: false,
    history: "",
  };
}

describe("referralReferrerName (D-12 — the referrer is the recorded source, never a source type)", () => {
  it.each(REFERRAL_SOURCES)("source %s: the person field reads 'Not recorded', never the source type", (source) => {
    const referral = fixtureReferral(source);
    expect(referralReferrerName(referral)).toBe(REFERRER_NOT_RECORDED);
  });

  it("REFERRAL_SOURCES is exactly the eight kinds this catcher must cover — a ninth is not silently skipped", () => {
    expect(REFERRAL_SOURCES).toEqual([
      "community",
      "crisis_service",
      "police",
      "ambulance",
      "inter_hospital",
      "ed_medical",
      "gp",
      // psychiatric_ward — the rulings demo overlay's RF-RD06 (`ward-rulings-demo.ts`) is the seed's
      // one referral carrying this source; `it.each(REFERRAL_SOURCES)` above already covers it.
      "psychiatric_ward",
    ]);
  });

  /**
   * 🔴 THE RULING'S ACTUAL SUBJECT. Every source kind's own case above already proves the output is
   * the flat "Not recorded" and nothing else; this asserts the SAME fact the other way round —
   * that no rendering of any source, in any of the vocabularies this repository already uses for
   * one (the picker's labels, the community screen's channel labels, or the raw model value), ever
   * reaches a field a screen would label as a person. A future implementation that reads
   * `SOURCE_LABELS[referral.source]` — a real, easy-to-write regression, because that map exists
   * and resolves for every case — is exactly what this fails on.
   */
  it.each(REFERRAL_SOURCES)("source %s: no source-type word reaches the person field", (source) => {
    const referral = fixtureReferral(source);
    const rendered = referralReferrerName(referral);
    for (const word of SOURCE_TYPE_WORDS) {
      expect(rendered).not.toBe(word);
      expect(rendered.toLowerCase().includes(word.toLowerCase())).toBe(false);
    }
  });

  it("never 'Not yet recorded' — D-6's flat form, because nobody is obliged to supply a referrer", () => {
    for (const source of REFERRAL_SOURCES) {
      expect(referralReferrerName(fixtureReferral(source))).not.toBe("Not yet recorded");
    }
  });
});
