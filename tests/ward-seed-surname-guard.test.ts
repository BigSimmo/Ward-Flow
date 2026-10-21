import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Cultural safety charter item 2 (#431): seeded fictional patients must not carry a common WA
 * surname, so a synthetic list is less likely to be read as, or to name, a real person.
 *
 * The list holds common Australian surnames, which are also the common surnames in WA. It is a
 * floor, not proof: a fictional surname can still belong to somebody, and passing this test does
 * not show otherwise. Matching is on the whole surname and on each hyphen or space separated part,
 * ignoring case and punctuation, so "O'Brien", "OBrien" and "Smith-Jones" are all caught.
 */
const COMMON_WA_SURNAMES = [
  "Smith",
  "Jones",
  "Williams",
  "Brown",
  "Wilson",
  "Taylor",
  "Johnson",
  "White",
  "Martin",
  "Anderson",
  "Thompson",
  "Nguyen",
  "Thomas",
  "Walker",
  "Harris",
  "Lee",
  "Ryan",
  "Robinson",
  "Kelly",
  "King",
  "Davis",
  "Wright",
  "Evans",
  "Roberts",
  "Green",
  "Hall",
  "Wood",
  "Jackson",
  "Clarke",
  "Clark",
  "Patel",
  "Khan",
  "Lewis",
  "James",
  "Phillips",
  "Mitchell",
  "Turner",
  "Scott",
  "Moore",
  "Young",
  "Hill",
  "Campbell",
  "Murphy",
  "Cooper",
  "Hughes",
  "Edwards",
  "Baker",
  "Ward",
  "Morris",
  "Parker",
  "Bell",
  "Collins",
  "Stewart",
  "Cook",
  "Allen",
  "Morgan",
  "Bennett",
  "Cox",
  "Murray",
  "Kennedy",
  "Wang",
  "Zhang",
  "Li",
  "Chen",
  "Liu",
  "Tran",
  "Le",
  "Pham",
  "Singh",
  "Kaur",
  "Graham",
  "Russell",
  "Watson",
  "Gray",
  "Hunt",
  "Price",
  "Reid",
  "Ross",
  "Shaw",
  "Simpson",
  "Webb",
  "Wallace",
  "Stevens",
  "Mills",
  "Marshall",
  "Matthews",
  "Hayes",
  "Fraser",
  "Hamilton",
  "Richardson",
  "Robertson",
  "Johnston",
  "Kerr",
  "Hart",
  "Elliott",
  "Ellis",
  "Dawson",
  "Chapman",
  "Carter",
  "Butler",
  "Brooks",
  "Barnes",
  "Adams",
  "Armstrong",
  "Bailey",
  "Carroll",
  "Doyle",
  "Duncan",
  "Ferguson",
  "Fisher",
  "Ford",
  "Foster",
  "Gibson",
  "Gordon",
  "Grant",
  "Harrison",
  "Henderson",
  "Holmes",
  "Howard",
  "Hudson",
  "Hunter",
  "Jenkins",
  "Knight",
  "Lawrence",
  "Lloyd",
  "Marsh",
  "McDonald",
  "Miller",
  "Mason",
  "OBrien",
  "OConnor",
  "Palmer",
  "Payne",
  "Pearce",
  "Perry",
  "Porter",
  "Powell",
  "Rees",
  "Reynolds",
  "Rogers",
  "Saunders",
  "Sullivan",
  "Sutherland",
  "Thomson",
  "Walsh",
  "Watts",
  "Wells",
  "West",
  "Wheeler",
  "Williamson",
  "Woods",
  "Davies",
  "Lynch",
  "Byrne",
  "Quinn",
  "McKenzie",
  "Mackenzie",
  "Burns",
  "Dunn",
  "Burke",
  "Fitzgerald",
  "Hogan",
  "Higgins",
  "Jamieson",
  "Lowe",
  "Craig",
  "Cameron",
  "Black",
  "Bird",
  "Fox",
  "Nelson",
  "Morrison",
  "Harvey",
  "Spencer",
  "Dixon",
  "Gill",
  "Ali",
  "Ahmed",
  "Hussain",
  "Wu",
  "Huang",
  "Lin",
  "Zhou",
  "Yang",
  "Ho",
  "Ng",
  "Lim",
  "Tan",
  "Wong",
  "Chan",
] as const;

function normalised(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

const BANNED = new Set(COMMON_WA_SURNAMES.map(normalised));

/** Surname collisions, whole name or any part, against the common list. */
function collisions(familyName: string): string[] {
  const parts = [familyName, ...familyName.split(/[\s-]+/)].map(normalised).filter((part) => part.length > 0);
  return [...new Set(parts.filter((part) => BANNED.has(part)))];
}

/** Every `familyName: "..."` literal under the ward management source, so seeds outside the
 *  patient registry (demo network, cohorts) are checked too. */
function sourceFamilyNames(): { file: string; familyName: string }[] {
  const root = join(process.cwd(), "src", "components", "ward-management");
  const found: { file: string; familyName: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) {
        for (const match of readFileSync(path, "utf8").matchAll(/familyName:\s*"([^"]+)"/g)) {
          found.push({ file: path, familyName: match[1]! });
        }
      }
    }
  };
  walk(root);
  return found;
}

describe("seeded patient surnames avoid common WA surnames", () => {
  it("catches a common surname, its parts and its punctuation variants", () => {
    expect(collisions("Smith")).toEqual(["smith"]);
    expect(collisions("O'Brien")).toEqual(["obrien"]);
    expect(collisions("Halloway-Nguyen")).toEqual(["nguyen"]);
    expect(collisions("Marrowby")).toEqual([]);
  });

  it("no patient in the seeded state carries one", () => {
    const { patients } = seedWardFlowState();
    expect(patients.length, "the seed must hold patients, or nothing here is checked").toBeGreaterThan(100);
    const hits = patients
      .filter((patient) => collisions(patient.familyName).length > 0)
      .map((patient) => `${patient.id}: ${patient.familyName}`);
    expect(hits).toEqual([]);
  });

  it("no family name written in the ward management source carries one", () => {
    const names = sourceFamilyNames();
    expect(names.length, "the scan must find the seeded family names").toBeGreaterThan(50);
    const hits = names
      .filter(({ familyName }) => collisions(familyName).length > 0)
      .map(({ file, familyName }) => `${file}: ${familyName}`);
    expect(hits).toEqual([]);
  });
});
