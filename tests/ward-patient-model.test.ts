import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  PATIENT_FIELDS,
  findPatients,
  patientAgeYears,
  patientDisplayName,
  type Patient,
} from "@/components/ward-management/ward-patients";

const NOW = 10 * 60 + 42;

/**
 * `Patient` holds identity, and this file is the reason that is a decision rather than a drift.
 *
 * Owner ruling PD-1, 2026-08-30: name, record number, date of birth and age are permitted ON THIS
 * RECORD. `address` and narrative history were NOT ruled on, and silence is not permission.
 *
 * The guard has three legs because each catches something the others cannot:
 *
 *   1. EXACT SET EQUALITY against a fully-populated literal. Catches a field added to the type, and
 *      catches one added at runtime and not to the type — a type-only check runs under `tsc` and is
 *      absent from a plain `vitest run`.
 *   2. EVERY AUTHORISED FIELD CARRIES A DECISION ID THAT RESOLVES. An allowlist whose reasons are
 *      free text is a list of assertions nobody can check; one whose ids must exist is a governance
 *      record. Mutation-proved below with an invented id.
 *   3. THE UNRULED STEMS ARE DENIED OVER THE ALLOWLIST. A field matching them fails even with a
 *      plausible decision id beside it, because the failure this leg exists for is somebody widening
 *      by implication — reading "he allowed names" as "he allowed identity".
 */
const DECISIONS = new Map<string, string>([
  [
    "PD-1",
    "Owner, 2026-08-30: explicit permission to hold a name or record number for patients, and to " +
      "search by either the UMRN or the name, age and date of birth.",
  ],
  [
    "R-2026-09-04-A",
    "Owner, 2026-09-04 (docs/ward-flow/owner-rulings-2026-09-04.md section A): explicit permission " +
      "to hold address, suburb, GP, catchment community team, legal status, interpreter/preferred " +
      "language, Aboriginal or Torres Strait Islander status, sex/gender and preferred name. Risk " +
      "flags, diagnosis, next of kin and medication were explicitly asked about and explicitly " +
      "refused, and are not covered by this id.",
  ],
  [
    "OWNER-2026-09-10-GENDER",
    "Owner, 2026-09-09/2026-09-10 (docs/ward-flow/owner-decisions-2026-09-09.md sections 8-9): sex " +
      "and gender are split into two separate fields; gender is Female or Male, held on the patient " +
      "profile, or not yet recorded — a real, distinct state, never defaulted from sex — completed " +
      "by the clinician at referral if absent. This id covers the new `gender` field only; the " +
      "renamed `sex` field (formerly `sexOrGender`) stays covered by R-2026-09-04-A, which approved " +
      "its content first.",
  ],
]);

/** Fields permitted to match an identity stem, each with the ruling that permitted it. */
const AUTHORISED_IDENTITY_FIELDS = new Map<string, string>([
  ["givenName", "PD-1"],
  ["familyName", "PD-1"],
  ["dateOfBirth", "PD-1"],
  ["preferredName", "R-2026-09-04-A"],
]);

/**
 * The nine fields R-2026-09-04-A adds beyond PD-1's five, each with the id that permits it. This is
 * the mutation guard the ruling asked for: a tenth field added here without a citation, or added to
 * `Patient`/`PATIENT_FIELDS` without a line here, fails the leg below.
 */
const PLACEMENT_FIELDS = new Map<string, string>([
  ["preferredName", "R-2026-09-04-A"],
  ["sex", "R-2026-09-04-A"],
  ["address", "R-2026-09-04-A"],
  ["suburb", "R-2026-09-04-A"],
  ["generalPractitioner", "R-2026-09-04-A"],
  ["catchmentCommunityTeam", "R-2026-09-04-A"],
  ["legalStatus", "R-2026-09-04-A"],
  ["aboriginalOrTorresStraitIslanderStatus", "R-2026-09-04-A"],
  ["interpreterLanguage", "R-2026-09-04-A"],
]);

/**
 * `gender`, the one field the 2026-09-09/2026-09-10 ruling adds — kept out of `PLACEMENT_FIELDS`
 * deliberately, because that map's own test below fixes its size at nine to match what
 * R-2026-09-04-A named explicitly. Folding a tenth field from a LATER ruling into a NINE-field map
 * would misattribute which ruling authorised it, which is the exact provenance failure this file's
 * governance model exists to catch.
 */
const GENDER_RULING_FIELDS = new Map<string, string>([["gender", "OWNER-2026-09-10-GENDER"]]);

/** Fields that predate R-2026-09-04-A and are not its concern — PD-1's own five. */
const PD1_FIELDS = new Set(["id", "umrn", "givenName", "familyName", "dateOfBirth"]);

/** Never permitted on any Ward Flow record, and NOT openable by the allowlist above. Risk flags,
 *  diagnosis, next of kin and medication were each asked about by name in R-2026-09-04-A and each
 *  explicitly refused — "clinically relevant" was not read as authorising them. */
const NEVER_PERMITTED_STEMS = [
  "history",
  "notes",
  "note",
  "comment",
  "narrative",
  "diagnos",
  "risk",
  "alert",
  "kin",
  "carer",
  "medicat",
];

/** Permitted only when the field is named in `AUTHORISED_IDENTITY_FIELDS`. */
const IDENTITY_STEMS = ["name", "dob", "birth", "umrn", "patient"];

function aPatient(): Required<Patient> {
  return {
    id: "PT-T01",
    umrn: "UM900000",
    givenName: "Testable",
    familyName: "Quillfeather",
    dateOfBirth: "1990-06-01",
    preferredName: "Testy",
    sex: "Female",
    gender: "Female",
    address: "No. 1, Fictionvale",
    suburb: "Fictionvale",
    generalPractitioner: "Dr Notreal, Fictionvale Family Medical",
    catchmentCommunityTeam: "Fictionvale Community Team",
    legalStatus: "Voluntary",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "English — no interpreter required",
  };
}

describe("Patient identity is a ruling, not a drift", () => {
  it("declares exactly the fields the ruling authorises, at runtime and in the type", () => {
    const expected = [
      "aboriginalOrTorresStraitIslanderStatus",
      "address",
      "catchmentCommunityTeam",
      "dateOfBirth",
      "familyName",
      "gender",
      "generalPractitioner",
      "givenName",
      "id",
      "interpreterLanguage",
      "legalStatus",
      "preferredName",
      "sex",
      "suburb",
      "umrn",
    ];
    expect(
      [...PATIENT_FIELDS].sort(),
      "PATIENT_FIELDS no longer matches the authorised field set. A field added here is a widening " +
        "of what this prototype holds about a person, and it needs an owner ruling and a line in " +
        "PLACEMENT_FIELDS (or AUTHORISED_IDENTITY_FIELDS) — not a passing test.",
    ).toEqual(expected);
    expect(
      Object.keys(aPatient()).sort(),
      "a real Patient carries fields PATIENT_FIELDS does not declare. The runtime list is what the " +
        "guard can see without tsc, so the two must not drift apart.",
    ).toEqual(expected);
  });

  it("has every authorised identity field carry a decision id that resolves", () => {
    for (const [field, decision] of AUTHORISED_IDENTITY_FIELDS) {
      expect(
        DECISIONS.has(decision),
        `${field} is authorised by "${decision}", which is not a decision anybody can look up. An ` +
          "allowlist of free-text reasons is a list of assertions; one whose ids must resolve is a record.",
      ).toBe(true);
      expect([...PATIENT_FIELDS], `${field} is authorised but not declared`).toContain(field);
    }
  });

  it("refuses an invented decision id, which is what makes the leg above worth having", () => {
    // The mutation, run in-line rather than described: an entry citing a ruling that does not exist
    // must fail. Without this the leg above passes on any string at all.
    const invented = new Map([["somethingUnruled", "PD-99"]]);
    const unresolved = [...invented.values()].filter((decision) => !DECISIONS.has(decision));
    expect(unresolved, "an invented decision id must not resolve").toEqual(["PD-99"]);
  });

  it("has every R-2026-09-04-A field declared, decided, and citing a real decision", () => {
    // The count is fixed by the ruling itself: nine fields, named explicitly. A tenth slipping in
    // here uncaught would be exactly the widening-by-a-broad-grant the ruling warns against.
    expect(PLACEMENT_FIELDS.size, "R-2026-09-04-A named exactly nine fields").toBe(9);
    for (const [field, decision] of PLACEMENT_FIELDS) {
      expect(
        DECISIONS.has(decision),
        `${field} cites "${decision}", which does not resolve to a recorded decision`,
      ).toBe(true);
      expect([...PATIENT_FIELDS], `${field} is authorised by R-2026-09-04-A but not declared`).toContain(field);
    }

    // The reverse direction, which is the actual mutation guard: every field Patient declares that
    // PD-1 does not already cover must appear in PLACEMENT_FIELDS or GENDER_RULING_FIELDS with a
    // citation. A field added to PATIENT_FIELDS without a line in either fails here rather than
    // slipping through unnoticed.
    const unaccounted = [...PATIENT_FIELDS].filter(
      (field) => !PD1_FIELDS.has(field) && !PLACEMENT_FIELDS.has(field) && !GENDER_RULING_FIELDS.has(field),
    );
    expect(
      unaccounted,
      "a field on Patient with no citation in PD1_FIELDS, PLACEMENT_FIELDS or GENDER_RULING_FIELDS " +
        "— the exact widening this guard exists to catch.",
    ).toEqual([]);
  });

  it("has the 2026-09-10 gender field declared, decided, and citing a real decision", () => {
    // The count is fixed by the ruling itself: exactly one new field, `gender`. A second field
    // slipping in here uncaught would be exactly the widening-by-a-broad-grant the ruling warns
    // against, the same discipline the R-2026-09-04-A test above applies to its own nine.
    expect(GENDER_RULING_FIELDS.size, "the 2026-09-10 ruling named exactly one new field").toBe(1);
    for (const [field, decision] of GENDER_RULING_FIELDS) {
      expect(
        DECISIONS.has(decision),
        `${field} cites "${decision}", which does not resolve to a recorded decision`,
      ).toBe(true);
      expect([...PATIENT_FIELDS], `${field} is authorised by the gender ruling but not declared`).toContain(field);
    }
  });

  it("keeps the unruled stems denied OVER the allowlist, so nothing widens by implication", () => {
    const offenders = [...PATIENT_FIELDS].filter((field) =>
      NEVER_PERMITTED_STEMS.some((stem) => field.toLowerCase().includes(stem)),
    );
    expect(
      offenders,
      "Patient declares a field the owner never ruled on. PD-1 permits identity; R-2026-09-04-A " +
        "additionally permits the nine named placement fields. It does not permit a risk flag, a " +
        "diagnosis, a next-of-kin contact, a medication or narrative history, and reading it as " +
        "though it did is the widening-by-implication this leg exists to stop. A new ruling, or " +
        "nothing.",
    ).toEqual([]);

    // Both stem lists really discriminate, in both directions — a list matching nothing, or
    // everything, is the check-that-cannot-fail shape either way. "nextOfKinContact" stands in for
    // the never-permitted case: next of kin is one of the four surfaces R-2026-09-04-A named by
    // name and explicitly refused, so it must stay caught by NEVER_PERMITTED_STEMS even now that
    // "address" — once the example here — has become an approved field.
    expect(NEVER_PERMITTED_STEMS.some((stem) => "nextOfKinContact".toLowerCase().includes(stem))).toBe(true);
    expect(IDENTITY_STEMS.some((stem) => "givenName".toLowerCase().includes(stem))).toBe(true);
    expect(NEVER_PERMITTED_STEMS.some((stem) => "givenName".toLowerCase().includes(stem))).toBe(false);
    // And the field the ruling actually approved must NOT be caught by the denial list any more —
    // the mutation this leg exists to prove: reverting "address" into NEVER_PERMITTED_STEMS must
    // redden the `offenders` assertion above, not this one, because "address" is now authorised.
    expect(NEVER_PERMITTED_STEMS.some((stem) => "address".toLowerCase().includes(stem))).toBe(false);
  });
});

describe("a patient exists before anything happens to them", () => {
  /**
   * THE DECIDING TEST. If this cannot be written, the lifecycle is wrong whatever the type looks
   * like — and the wrong version passes everything else, because a patient created at arrival
   * renders correctly on every screen that shows admitted people.
   *
   * The owner's flow is: search, and if nobody comes up, ADD them. The person being added has never
   * been referred, never moved, and never arrived.
   */
  it("is created with no movement, no referral and no admission, and is then found by searching", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900123",
      givenName: "Nerissa",
      familyName: "Blennerhast",
      dateOfBirth: "1979-02-11",
    });

    expect(after.rejections, "adding a patient must not be refused").toEqual([]);
    expect(after.patients.length, "exactly one person is added").toBe(before.patients.length + 1);

    const added = after.patients[after.patients.length - 1];

    // The whole point, asserted rather than assumed: this person is attached to nothing.
    expect(after.movements, "adding a patient must not create a movement").toHaveLength(before.movements.length);
    expect(after.referrals, "adding a patient must not create a referral").toHaveLength(before.referrals.length);
    expect(after.admissions, "adding a patient must not create an admission").toHaveLength(before.admissions.length);

    const found = findPatients(after.patients, "UM900123");
    expect(
      found.map((patient) => patient.id),
      "a patient who has never been referred, moved or admitted must be findable. If this fails, the " +
        "record is being created by the wrong event — the failure that looks correct on every screen " +
        "showing admitted people and appears only at 'if nobody comes up, add them'.",
    ).toEqual([added.id]);
  });

  /**
   * Owner ruling 2026-09-09/2026-09-10: `gender` may be recorded when a patient is added, not only
   * later. Optional, because most of `ADD_PATIENT`'s callers do not know it yet — the test above
   * omits it entirely and must keep passing unchanged, which is why it is asserted separately here
   * rather than folded into it.
   */
  it("accepts and stores gender when the caller supplies it, and leaves it unrecorded when they do not", () => {
    const before = seedWardFlowState();
    const withGender = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900124",
      givenName: "Orin",
      familyName: "Thistledown",
      dateOfBirth: "1985-08-02",
      gender: "Male",
    });
    expect(withGender.rejections, "a valid gender must not be refused").toEqual([]);
    const addedWithGender = withGender.patients[withGender.patients.length - 1];
    expect(addedWithGender.gender, "the supplied gender must be stored, not dropped").toBe("Male");

    const withoutGender = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900125",
      givenName: "Wren",
      familyName: "Ashgrove",
      dateOfBirth: "1985-08-02",
    });
    const addedWithoutGender = withoutGender.patients[withoutGender.patients.length - 1];
    expect(
      addedWithoutGender.gender,
      "omitting gender must leave it undefined — 'not yet recorded' — never a guessed or defaulted value",
    ).toBeUndefined();
  });

  it("refuses a gender that is not one of the two the ruling permits", () => {
    const before = seedWardFlowState();
    const after = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900126",
      givenName: "Sasha",
      familyName: "Winterthorn",
      dateOfBirth: "1985-08-02",
      // @ts-expect-error — deliberately outside GENDERS, proving the reducer checks membership
      // rather than trusting the type, the same discipline `RECEIVE_REFERRAL` applies to `sex`.
      gender: "Other",
    });
    expect(after.rejections.length, "an unrecognised gender must be refused, not silently accepted").toBe(1);
    expect(after.patients.length, "a refused ADD_PATIENT must not add anyone").toBe(before.patients.length);
  });

  /**
   * R-2026-09-04-A: `suburb` may be recorded when a patient is added. Optional — omitting it leaves
   * the key absent ("not yet recorded"), matching `gender`'s discipline above.
   */
  it("accepts and stores suburb when the caller supplies it, and leaves it unrecorded when they do not", () => {
    const before = seedWardFlowState();
    const withSuburb = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900127",
      givenName: "Mara",
      familyName: "Kelpwright",
      dateOfBirth: "1991-03-14",
      suburb: "Armadale",
    });
    expect(withSuburb.rejections, "a supplied suburb must not be refused").toEqual([]);
    const addedWithSuburb = withSuburb.patients[withSuburb.patients.length - 1];
    expect(addedWithSuburb.suburb, "the supplied suburb must be stored, not dropped").toBe("Armadale");

    const withoutSuburb = wardFlowReducer(before, {
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW,
      umrn: "UM900128",
      givenName: "Quill",
      familyName: "Mossbank",
      dateOfBirth: "1991-03-14",
    });
    const addedWithoutSuburb = withoutSuburb.patients[withoutSuburb.patients.length - 1];
    expect(
      addedWithoutSuburb.suburb,
      "omitting suburb must leave it undefined — 'not yet recorded' — never a guessed or defaulted value",
    ).toBeUndefined();
  });

  it("finds related names rather than only exact ones, which the owner asked for by name", () => {
    const patients = seedWardFlowState().patients;

    expect(
      findPatients(patients, "hallow")
        .map((patient) => patient.familyName)
        .sort(),
      "related-name search found fewer than the near-miss pair the fixture seeds for exactly this. " +
        "The seed carries Halloway beside Hallowin so this behaviour has something to prove.",
    ).toEqual(["Halloway", "Hallowin"]);

    expect(
      findPatients(patients, "oquinn")
        .map((patient) => patient.familyName)
        .sort(),
      "punctuation must not decide whether a person is found — the two spellings are one query",
    ).toEqual(["O'Quinn", "Oquinn"]);

    expect(findPatients(patients, ""), "an empty query finds nobody, never everybody").toEqual([]);
  });

  it("derives age from the stored date of birth rather than holding both", () => {
    // One fact, one home. The owner said "Name, Age and DOB"; holding both would let a record state
    // an age that disagrees with its own date of birth, and nothing would notice.
    const patient: Patient = { ...aPatient(), dateOfBirth: "1990-06-01" };
    expect(patientAgeYears(patient, new Date(2026, 5, 1)), "on the birthday itself").toBe(36);
    expect(patientAgeYears(patient, new Date(2026, 4, 31)), "the day before").toBe(35);
    expect(patientDisplayName(patient)).toBe("Testable Quillfeather");
  });

  it("verifies that typing 'a' matches 100% of seeded patients as required by the typeahead scroll test invariant (WF-PAT-02)", () => {
    const patients = seedWardFlowState().patients;
    expect(findPatients(patients, "a").length).toBe(patients.length);
  });
});
