import { describe, expect, it } from "vitest";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { smartSearchGroups } from "@/components/ward-management/ward-global-search-groups";
import { findPatients, formatDateOfBirth, type Patient } from "@/components/ward-management/ward-patients";
import { EXACT_ALEX_MORGAN_IDS, LOOKALIKES } from "./fixtures/patient-search-lookalikes";

/*
 * Audit 3 (issue #1566): partial-name, initials and same-surname searches must never open the
 * wrong record. The fold rules themselves are pinned in `ward-search-fold-and-rank.test.ts`; this
 * file pins the ORDER the shared search gives a look-alike set, and the identifiers on each row.
 */
const people = (query: string) =>
  searchWardFlow({ query, patients: LOOKALIKES, movements: [], units: [], referrals: [] }).people;

const ids = (list: readonly Patient[]) => list.map((patient) => patient.id);

/** An oracle independent of the search: every typed word starts a word of the person's name. */
function nameWordsStartWith(patient: Patient, query: string): boolean {
  const fold = (value: string) => value.toLowerCase().replace(/['’.]/g, "");
  const words = fold(`${patient.givenName} ${patient.familyName}`).split(/[\s-]+/);
  const joined = fold(`${patient.givenName} ${patient.familyName}`).replace(/-/g, "").split(/\s+/);
  return fold(query)
    .split(/[\s-]+/)
    .filter(Boolean)
    .every((typed) => [...words, ...joined].some((word) => word.startsWith(typed)));
}

describe("an exact full name leads the People group (Audit 3)", () => {
  it.each(["Alex Morgan", "alex morgan", "Morgan, Alex", "  ALEX   MORGAN "])(
    "%s puts both Alex Morgans first",
    (query) => {
      const found = ids(people(query));
      expect(found.slice(0, 2)).toEqual(EXACT_ALEX_MORGAN_IDS);
    },
  );

  it("keeps an exact name even when more than a group's worth of longer names also match", () => {
    expect(findPatients(LOOKALIKES, "alex morgan").length).toBeGreaterThan(6);
    expect(ids(people("alex morgan"))).toEqual(expect.arrayContaining(EXACT_ALEX_MORGAN_IDS));
  });

  it("puts an exact record number first", () => {
    expect(ids(people("UM900013"))[0]).toBe("PT-LA-13");
  });
});

describe("a partial or initials query never puts a non-matching name above a matching one", () => {
  it.each([
    "morg",
    "alex",
    "alex mor",
    "a. morgan",
    "morgan a",
    "o'morgan",
    "omorgan",
    "morgan-hale",
    "morgan hale",
    "lex",
  ])("%s lists word-start matches before anything else", (query) => {
    const found = people(query);
    expect(found.length).toBeGreaterThan(0);
    const firstOther = found.findIndex((patient) => !nameWordsStartWith(patient, query));
    if (firstOther === -1) return;
    expect(found.slice(firstOther).every((patient) => !nameWordsStartWith(patient, query))).toBe(true);
  });

  it("finds only people whose names hold every typed word", () => {
    expect(ids(people("alana morgan"))).toEqual(["PT-LA-08"]);
    expect(ids(people("alexandra"))).toEqual(["PT-LA-07"]);
    expect(ids(people("a. morgan"))).toEqual(["PT-LA-09"]);
  });

  // D-113 item 3: typed initials without full stops ("AM") do not match a patient by initials, so a
  // loose initials match cannot open the wrong person. "AM" is read as letters inside a name only.
  it.each(["AM", "am"])("%s does not find anyone by initials (D-113)", (query) => {
    const found = people(query);
    const byInitialsOnly = LOOKALIKES.filter(
      (patient) =>
        patient.givenName.toLowerCase().startsWith("a") &&
        patient.familyName.toLowerCase().startsWith("m") &&
        !`${patient.givenName} ${patient.familyName}`.toLowerCase().includes("am"),
    );
    expect(byInitialsOnly.length).toBeGreaterThan(0);
    for (const id of ids(byInitialsOnly)) expect(ids(found)).not.toContain(id);
    // Not vacuous: the one look-alike whose name holds "am" as letters (Sam Alexander) is still found.
    expect(ids(found)).toContain("PT-LA-11");
    for (const patient of found) {
      expect(`${patient.givenName} ${patient.familyName}`.toLowerCase()).toContain("am");
    }
  });
});

describe("every People row carries a second identifier and opens its own record", () => {
  it("shows the UMRN and date of birth on each row and links to that row's id", () => {
    const results = searchWardFlow({
      query: "alex morgan",
      patients: LOOKALIKES,
      movements: [],
      units: [],
      referrals: [],
    });
    const group = smartSearchGroups(results, "alex morgan", [], {
      patients: LOOKALIKES,
      movements: [],
      referrals: [],
    }).find((entry) => entry.key === "people");
    expect(group?.items.length).toBe(results.people.length);
    for (const [index, item] of (group?.items ?? []).entries()) {
      const patient = results.people[index];
      expect(item.meta).toContain(patient.umrn);
      expect(item.meta).toContain(`born ${formatDateOfBirth(patient.dateOfBirth)}`);
      expect(item.href).toBe(patientHref(patient.id));
    }
    const sameName = (group?.items ?? []).filter((item) => item.title === "Morgan, Alex");
    expect(sameName).toHaveLength(2);
    expect(new Set(sameName.map((item) => item.meta)).size).toBe(2);
    expect(new Set(sameName.map((item) => item.href)).size).toBe(2);
  });
});
