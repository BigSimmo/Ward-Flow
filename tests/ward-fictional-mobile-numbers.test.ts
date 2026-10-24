import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit 5 PS-06 (Josh, 20 Oct 2026: every number is fictional): a mobile number in the app's source
// must sit in the ACMA range set aside for fiction (0491 57x xxx), so a tester can never ring a real person.
const MOBILE = /\b04\d{2}[ -]?\d{3}[ -]?\d{3}\b/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

describe("mobile numbers in the app are fictional (audit PS-06)", () => {
  it("finds none outside the 0491 57x range", () => {
    const outside = sources("src").flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(MOBILE)]
        .map((match) => match[0])
        .filter((number) => !number.replace(/[ -]/g, "").startsWith("049157"))
        .map((number) => `${path}: ${number}`),
    );
    expect(outside).toEqual([]);
  });
});
