import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit 5 PS-06 (Josh, 20 Oct 2026: every number is fictional): a mobile number in the app's source
// must be one ACMA sets aside for fiction, so a tester can never ring a real person.
const MOBILE = /\b04\d{2}[ -]?\d{3}[ -]?\d{3}\b/g;
// The exact ACMA list (acma.gov.au, "Phone numbers for use in TV shows, films and creative works").
const FICTIONAL = new Set([
  "0491570006",
  "0491570156",
  "0491570157",
  "0491570158",
  "0491570159",
  "0491570110",
  "0491570313",
  "0491570737",
  "0491571266",
  "0491571491",
  "0491571804",
  "0491572549",
  "0491572665",
  "0491572983",
  "0491573770",
  "0491573087",
  "0491574118",
  "0491574632",
  "0491575254",
  "0491575789",
  "0491576398",
  "0491576801",
  "0491577426",
  "0491577644",
  "0491578957",
  "0491578148",
  "0491578888",
  "0491579212",
  "0491579760",
  "0491579455",
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

describe("mobile numbers in the app are fictional (audit PS-06)", () => {
  it("finds none that is not on the ACMA fictional list", () => {
    const outside = sources("src").flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(MOBILE)]
        .map((match) => match[0])
        .filter((number) => !FICTIONAL.has(number.replace(/[ -]/g, "")))
        .map((number) => `${path}: ${number}`),
    );
    expect(outside).toEqual([]);
  });
});
