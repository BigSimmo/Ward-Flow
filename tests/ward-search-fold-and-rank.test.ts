import { describe, expect, it } from "vitest";
import { foldPatientSearchHaystack, foldPatientSearchText } from "@/components/ward-management/ward-patients";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { rankByNameStart } from "@/components/ward-management/referrals/referral-patient-rank";
import { originIsEdOrCrisis } from "@/components/ward-management/community/community-screen-helpers";
import { compareFormalNames } from "@/components/ward-management/ward-name-collation";

/* Content and locale audit CL-5 and functional F6 (5 Nov 2026). Every name is invented. */
const finds = (typed: string, name: string) => foldPatientSearchHaystack(name).includes(foldPatientSearchText(typed));

describe("patient search fold (CL-5)", () => {
  it.each([
    ["o brien", "Cleo O'Brien"],
    ["obrien", "Cleo O'Brien"],
    ["o'brien", "Cleo O'Brien"],
    ["smith jones", "Ava Smith-Jones"],
    ["smithjones", "Ava Smith-Jones"],
    ["smith-jo", "Ava Smith-Jones"],
    ["ostergaard", "Freja Østergaard"],
    ["lukasz", "Łukasz Nowak"],
    ["jose", "José Rivera"],
    ["nguyen", "Nguyễn Thị Lan"],
    ["dang", "Đặng Minh"],
    ["aeron", "Æron Tull"],
  ])("%s finds %s", (typed, name) => {
    expect(finds(typed, name)).toBe(true);
  });

  it("keeps one plain form for equality and the word search", () => {
    expect(foldPatientSearchText("O'Brien")).toBe(foldPatientSearchText("OBrien"));
    expect(fieldsMatchEveryWord("o brien", ["Cleo O'Brien"])).toBe(true);
    expect(fieldsMatchEveryWord("ostergaard", ["Freja Østergaard"])).toBe(true);
  });
});

describe("New referral patient search ranks names that start with the query (F6)", () => {
  it("lists family-name starts, then given-name starts, then the rest", () => {
    const rows = ["Slateridge, Ada", "Ridgewell, Tom", "Underbridge, Ridge", "Ridgeholt, Lee"].map((name) => ({
      name,
    }));
    expect(rankByNameStart(rows, "Ridge").map((row) => row.name)).toEqual([
      "Ridgewell, Tom",
      "Ridgeholt, Lee",
      "Underbridge, Ridge",
      "Slateridge, Ada",
    ]);
  });
});

describe("community ED filter matches ED as a whole word", () => {
  it("does not read King Edward or Medical as an ED", () => {
    expect(originIsEdOrCrisis("Inpatient ward · King Edward Memorial Hospital")).toBe(false);
    expect(originIsEdOrCrisis("GP · Swan Medical Centre")).toBe(false);
    expect(originIsEdOrCrisis("SCGH ED psychiatric liaison")).toBe(true);
    expect(originIsEdOrCrisis("Crisis team")).toBe(true);
    expect(originIsEdOrCrisis("Resus bay", true)).toBe(true);
  });
});

describe("people sort by family name, then given name (CL-8)", () => {
  it("puts Smith before Smith-Jones and reads accents as their letters", () => {
    const names = ["Smith-Jones, Ava", "Smith, Zoe", "Älvsjö, Tess", "Ostby, Kim", "smith, Amy"];
    expect([...names].sort(compareFormalNames)).toEqual([
      "Älvsjö, Tess",
      "Ostby, Kim",
      "smith, Amy",
      "Smith, Zoe",
      "Smith-Jones, Ava",
    ]);
  });
});
