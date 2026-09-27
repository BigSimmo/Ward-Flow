// tests/ward-referral-history-honesty.test.ts
/**
 * K2 (build plan `2026-09-17-build-plan-screens.md` §4, item 56 rewrite).
 *
 * The catcher for rewriting `history:` strings in `ward-movements.ts`. It is written FIRST, before
 * any rewrite, so the rewrite is proved against a red test rather than a green one written to match
 * whatever was already there.
 *
 * Five checks, over every seeded referral's `history` (the 15 hand-authored `RF-` rows plus the nine
 * Midland demonstration rows — `referrals` already carries both, spread together in
 * `ward-movements.ts`):
 *
 * 1. At most 2000 characters (the field's own documented cap, `ward-model.ts`).
 * 2. Names no other record's id — a history is a narrative, not a cross-reference, and an id
 *    inside it would go stale the moment that other record's own id ever changed.
 * 3. Contains no URL.
 * 4. Contains no literal "section" — this is a plain-language narrative field, never a citation to
 *    a numbered section of an Act or policy (see AGENTS.md "No Mental Health Act section numbers").
 * 5. For a referral that names a `patientId`, its pronoun matches that patient's OWN recorded
 *    `gender` (`ward-patients-seed.ts`) — "he" only for Male, "she" only for Female, and no gendered
 *    pronoun at all for a patient left `gender: undefined` ("not yet recorded") or "Non-binary",
 *    who takes "they/them" if a pronoun is used at all.
 * 6. Names no suburb other than the referral's own, checked against the closed set of every named
 *    suburb any seeded referral (RF- or Midland) actually carries — so a history cannot borrow
 *    another patient's location by accident.
 *
 * K1 (`tests/ward-seed-referral-census.test.ts`) is the sibling catcher: it pins WHO is referred,
 * WHAT for and WHOM to, so this file can safely own the prose alone. Neither file duplicates the
 * other's assertions.
 */
import { describe, expect, it } from "vitest";

import { referrals } from "../src/components/ward-management/ward-movements";
import { wardPatients } from "../src/components/ward-management/ward-patients-seed";

const MAX_HISTORY_LENGTH = 2000;

// RF-123, WF-45, AD-6, PT-7 — never a bare "RF" or a code that happens to contain letters, only an
// id shape: two-to-three uppercase letters, a hyphen, then digits.
const RECORD_ID_PATTERN = /\b(RF|WF|AD|PT)-\d+\b/;

const URL_PATTERN = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|gov|edu|au)\b/i;

const SECTION_PATTERN = /\bsection\b/i;

const FEMALE_PRONOUNS = /\b(she|her|hers|herself)\b/i;
const MALE_PRONOUNS = /\b(he|him|his|himself)\b/i;

function patientById(id: string) {
  const patient = wardPatients.find((candidate) => candidate.id === id);
  if (!patient) {
    throw new Error(`referral names patientId "${id}" with no matching wardPatients record`);
  }
  return patient;
}

// The closed universe of named suburbs any seeded referral carries — built from the fixture
// itself, never a separately maintained list that could drift from it.
const ALL_SEEDED_SUBURBS = [
  ...new Set(
    referrals
      .map((referral) => (referral.suburb.kind === "named" ? referral.suburb.name : null))
      .filter((name): name is string => name !== null),
  ),
];

describe("K2 — referral history honesty (2026-09-17 pin)", () => {
  it("anti-vacuity: the seed carries referrals to check", () => {
    expect(referrals.length).toBeGreaterThan(0);
  });

  it("anti-vacuity: at least one referral names a patientId, so the pronoun check below is exercised", () => {
    expect(referrals.some((referral) => referral.patientId !== undefined)).toBe(true);
  });

  it("anti-vacuity: the suburb universe is non-empty, so check 6 below is exercised", () => {
    expect(ALL_SEEDED_SUBURBS.length).toBeGreaterThan(1);
  });

  for (const referral of referrals) {
    describe(referral.id, () => {
      it("history is at most 2000 characters", () => {
        expect(referral.history.length).toBeLessThanOrEqual(MAX_HISTORY_LENGTH);
      });

      it("history names no other record's id", () => {
        expect(referral.history).not.toMatch(RECORD_ID_PATTERN);
      });

      it("history contains no URL", () => {
        expect(referral.history).not.toMatch(URL_PATTERN);
      });

      it('history contains no literal "section"', () => {
        expect(referral.history).not.toMatch(SECTION_PATTERN);
      });

      it("history names no suburb other than its own", () => {
        const ownSuburb = referral.suburb.kind === "named" ? referral.suburb.name : null;
        const other = ALL_SEEDED_SUBURBS.filter((suburb) => suburb !== ownSuburb);
        for (const suburb of other) {
          const pattern = new RegExp(`\\b${suburb}\\b`, "i");
          expect(referral.history).not.toMatch(pattern);
        }
      });

      if (referral.patientId !== undefined) {
        it(`pronoun matches ${referral.patientId}'s recorded gender`, () => {
          const patient = patientById(referral.patientId as string);
          if (patient.gender === "Female") {
            expect(referral.history).not.toMatch(MALE_PRONOUNS);
          } else if (patient.gender === "Male") {
            expect(referral.history).not.toMatch(FEMALE_PRONOUNS);
          } else {
            // "Non-binary", or gender left undefined ("not yet recorded"): they/them only.
            expect(referral.history).not.toMatch(FEMALE_PRONOUNS);
            expect(referral.history).not.toMatch(MALE_PRONOUNS);
          }
        });
      }
    });
  }
});
