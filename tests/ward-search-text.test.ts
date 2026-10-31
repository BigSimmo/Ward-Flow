import { describe, expect, it } from "vitest";

import { searchContacts, searchSuburbs } from "@/components/ward-management/search/search-directory";
import {
  fieldsMatchEveryWord,
  fieldsNearlyMatch,
  filterBySearchText,
  queryWords,
} from "@/components/ward-management/search/search-text";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { destinationUnit, isOpen, searchMovements } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();

describe("search text (search and forms review, 31 Oct 2026)", () => {
  it("folds accents and apostrophes and needs every word, in any order", () => {
    expect(queryWords("  O’Quinn  Zoë ")).toEqual(["oquinn", "zoe"]);
    expect(fieldsMatchEveryWord("oquinn", ["Aoife O'Quinn"])).toBe(true);
    expect(fieldsMatchEveryWord("quinn aoife", ["Aoife O'Quinn"])).toBe(true);
    expect(fieldsMatchEveryWord("quinn bede", ["Aoife O'Quinn"])).toBe(false);
  });

  it("reads a number typed with spaces as one number, matched on digits", () => {
    expect(fieldsMatchEveryWord("0000 1001", ["08 0000 1001"])).toBe(true);
    expect(fieldsMatchEveryWord("(08) 0000-1001", ["08 0000 1001"])).toBe(true);
    expect(fieldsMatchEveryWord("UM 100001", ["UM100001"])).toBe(true);
    expect(fieldsMatchEveryWord("0000 1999", ["08 0000 1001"])).toBe(false);
  });

  it("ignores category words, and a query of only category words matches nothing", () => {
    expect(fieldsMatchEveryWord("graylands ward", ["Graylands"], ["ward"])).toBe(true);
    expect(fieldsMatchEveryWord("ward", ["Graylands"], ["ward"])).toBe(false);
  });

  it("forgives a slip in a plain word of four letters or more, never in digits or punctuation", () => {
    expect(fieldsNearlyMatch("handovr", ["Handover"])).toBe(true);
    expect(fieldsNearlyMatch("graylnds", ["Graylands Hospital"])).toBe(true);
    expect(fieldsNearlyMatch("bed", ["Bad"])).toBe(false);
    expect(fieldsNearlyMatch("1002", ["1001"])).toBe(false);
    expect(fieldsNearlyMatch("beta,", ["Beta"])).toBe(false);
  });

  it("uses the near pass only when asked and only when nothing matched exactly", () => {
    const items = ["Handover", "Hand hygiene"];
    expect(filterBySearchText(items, "handovr", (item) => [item])).toEqual([]);
    expect(filterBySearchText(items, "handovr", (item) => [item], { nearly: true })).toEqual(["Handover"]);
    expect(filterBySearchText(items, "hand", (item) => [item], { nearly: true })).toEqual(items);
  });
});

describe("header search matching", () => {
  it("finds an open movement by its destination words in any order", () => {
    const movement = wardMovements.find(
      (item) => isOpen(item) && (destinationUnit(item, units)?.name.split(" ").length ?? 0) > 1,
    );
    if (!movement) throw new Error("fixture drifted: no open movement to a two-word ward");
    const unit = destinationUnit(movement, units);
    if (!unit) throw new Error("fixture drifted: destination unit missing");
    const words = unit.name.split(" ");
    const reversed = [...words].reverse().join(" ");
    const found = searchMovements(wardMovements, units, { text: reversed });
    expect(found.map((item) => item.id)).toContain(movement.id);
  });

  it("forgives a slip in a ward or screen name, but not when a person matched", () => {
    const ward = units[0];
    const slipped = `${ward.name.slice(0, -1)}x`;
    expect(
      searchWardFlow({ query: slipped, patients: [], movements: [], units }).wards.map((w) => w.unit.id),
    ).toContain(ward.id);
    expect(
      searchWardFlow({ query: "handovr", patients: [], movements: [], units }).views.map((v) => v.view.key),
    ).toContain("handover");
  });
});

describe("contacts and suburbs in the header search", () => {
  it("finds an on-call contact by role words or by its number typed with spaces", () => {
    expect(searchContacts("bed flow coordinator", undefined).map((c) => c.entry.id)).toContain("sw-bfc");
    expect(searchContacts("0000 1001", undefined).map((c) => c.entry.id)).toContain("sw-bfc");
    expect(searchContacts("0000 1001", undefined)[0]?.number).toBe("08 0000 1001");
  });

  it("allows a contact's near spelling only when the header search lets it", () => {
    expect(searchContacts("bed flow coordinatr", undefined).map((c) => c.entry.id)).toContain("sw-bfc");
    // The header search passes false once a person, movement or referral matched.
    expect(searchContacts("bed flow coordinatr", undefined, undefined, false)).toEqual([]);
    expect(searchContacts("bed flow coordinator", undefined, undefined, false).map((c) => c.entry.id)).toContain(
      "sw-bfc",
    );
  });

  it("lists no contacts for a bare kind word or a short query", () => {
    expect(searchContacts("contacts", undefined)).toEqual([]);
    expect(searchContacts("on call", undefined)).toEqual([]);
    expect(searchContacts("be", undefined)).toEqual([]);
  });

  it("answers a whole suburb or a postcode, never a part-word", () => {
    expect(searchSuburbs("Morley").map((s) => s.suburb)).toEqual(["Morley"]);
    expect(searchSuburbs("6062").map((s) => s.suburb)).toContain("Morley");
    expect(searchSuburbs("Morl")).toEqual([]);
    expect(searchSuburbs("62")).toEqual([]);
  });

  it("names a contested suburb's status rather than one clinic", () => {
    const [woodbridge] = searchSuburbs("Woodbridge");
    expect(woodbridge?.status).toBe("Contested / split");
  });

  it("returns contacts and suburbs from the engine", () => {
    const result = searchWardFlow({ query: "Morley", patients: [], movements: [], units });
    expect(result.suburbs.map((s) => s.suburb)).toEqual(["Morley"]);
    expect(searchWardFlow({ query: "0000 1001", patients: [], movements: [], units }).contacts.length).toBeGreaterThan(
      0,
    );
  });
});
