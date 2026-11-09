import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";

/**
 * D-106 (Josh, 9 Nov 2026): the default access grant lives in the register (`accessGrantDefault`),
 * and the Settings button reads it. Help, how-to and tour text keeps the words typed, so the help
 * bundles stay small; this test makes every "Give for N days" in that text follow the register.
 */
const roots = [
  join(__dirname, "../src/components/ward-management/help"),
  join(__dirname, "../src/components/ward-redesign/pop-tour"),
];

describe("help text quotes the register's default access grant", () => {
  const days = CLINICAL_VALUES.accessGrantDefault.value;
  const quotes = roots.flatMap((root) =>
    readdirSync(root)
      .filter((name) => /\.tsx?$/u.test(name))
      .flatMap((name) =>
        [...readFileSync(join(root, name), "utf8").matchAll(/Give for (\d+) days/gu)].map((match) => ({
          file: name,
          days: Number(match[1]),
        })),
      ),
  );

  it("finds the help text it guards", () => {
    expect(quotes.length).toBeGreaterThan(0);
  });

  it("every quote matches the register", () => {
    expect(quotes.filter((quote) => quote.days !== days)).toEqual([]);
  });
});
