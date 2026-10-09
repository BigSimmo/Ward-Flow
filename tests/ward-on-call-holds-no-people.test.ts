import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NETWORK_ON_CALL_ROLES,
  SERVICE_ON_CALL_ROLES,
  type OnCallRole,
} from "../src/components/ward-management/on-call/on-call-roster";
import {
  MOCK_NUMBER_PREFIX,
  SHOW_MOCK_CONTACTS,
  buildOnCallDirectory,
} from "../src/components/ward-management/on-call/on-call-directory";
import { HEALTH_SERVICES } from "../src/components/ward-management/ward-model";

/**
 * 🔴 **THE ON-CALL SCREEN MUST NEVER GROW SOMETHING TO RING. THIS IS THE FILE THAT STOPS IT.**
 *
 * ⚠️ **THE HAZARD IS NOT A BUG, IT IS THE SCREEN WORKING AS INTENDED ON WRONG DATA.** Its whole
 * purpose is to be acted on at speed, in the middle of the night, by somebody who needs a person.
 * **A roster that is wrong is worse than no roster, because the reader does not audit it — they ring
 * it.** Every other guard in this repository protects a figure; this one protects a phone call.
 *
 * ## Why a literal search and not only a type
 *
 * The type is the better half and it is asserted first. But **a type cannot stop a number appearing
 * in JSX**, in a heading, in a placeholder, or in an `href`. So this also reads the files.
 *
 * 🔴 **AND THE MATCHER IS PROVEN, NOT ASSUMED.** A guard that searches for something and finds
 * nothing is indistinguishable from a guard whose pattern is wrong — this repository has shipped
 * that exact shape more than once. **The first case below feeds the matcher strings that MUST match
 * and strings that must NOT**, so a zero from it means something.
 *
 * ⚠️ **AND IT WAS MUTATION-TESTED:** a plausible Australian mobile was pasted into the screen by
 * hand, this file went red, and the paste was reverted with `git show HEAD:<path>`.
 *
 * ## 9 October 2026: mock contact records (owner request, design A1)
 *
 * The owner asked for the On-call page to carry contact records and the time each is available
 * until. They are MOCKS, and the last case below is what keeps them so: every number the directory
 * renders is built by one function as `08 0000` plus a serial (an unassigned exchange that cannot
 * reach anyone) and every email by one function on the reserved `.invalid` domain. **No literal
 * number or address is written in the source, so the source scan above is unchanged and still
 * applies in full.** The screen has no tel or mail link, and Call copies and says it is not wired.
 * `OnCallRole` still holds no contact field: the records live in `on-call-directory.ts`.
 */

const ON_CALL_DIR = join(process.cwd(), "src/components/ward-management/on-call");
const ON_CALL_ROUTE = join(process.cwd(), "src/app/mockups/ward-flow/on-call");

/**
 * Anything shaped like a way of reaching a person.
 *
 * ⚠️ **DELIBERATELY BROAD, AND THE FALSE POSITIVE IS THE CHEAP DIRECTION.** A wrongly-flagged string
 * costs somebody one rewrite; a missed one costs a 3am call to a number nobody checked. **If this
 * ever fires on innocent prose, reword the prose — do NOT narrow the pattern to let it through.**
 */
const REACHABLE_SHAPES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "a tel: or callto: link", pattern: /\b(?:tel|callto):/iu },
  { name: "a mailto: link", pattern: /\bmailto:/iu },
  { name: "an extension", pattern: /\bext\.?\s?\d/iu },
  { name: "a pager or bleep number", pattern: /\b(?:pager|bleep)\b[^.\n]{0,20}\d/iu },
  /*
   * ⚠️ **THE ISO-DATE CARVE-OUT IS A REAL NARROWING AND IT IS ARGUED, NOT ASSUMED.** Every comment in
   * this repository is dated, and `2026-09-12` is eight digits with separators — **shape alone cannot
   * tell it from a number**. Without this, the guard reddens on correct work the first time somebody
   * dates a comment in this folder, and **a guard that fires on correct work gets deleted.**
   *
   * 🔴 **IT IS THE ONLY CARVE-OUT, AND IT IS ANCHORED TO THE WHOLE STRING** (`^...$` inside the
   * lookahead), so `tel:2026-09-12` or a number that merely starts date-shaped still matches. **Do
   * not add a second exception to quieten a red — reword the prose instead.**
   */
  {
    name: "a run of digits long enough to be a number",
    pattern: /(?<!\d)(?!\d{4}-\d{2}-\d{2}(?!\d))\d[\d\s-]{7,}\d(?!\d)/u,
  },
  { name: "an email address", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/u },
];

function sourceFiles(directory: string): { path: string; text: string }[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(directory, entry.name))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }));
}

/**
 * 🔴 **EVERY ROLE, WITH A FLOOR ON EACH SOURCE — NOT ON THE SUM.**
 *
 * ⚠️ **Both defects this fixes were found by a survey of 63 ward guards, in a file written the same
 * night the survey's motivating defect was caught.** Writing a guard while thinking about this exact
 * failure did not prevent it.
 *
 * 1. **The second case below recomputed this list and had NO floor at all** — empty arrays meant the
 *    loops never ran and it passed, indistinguishable from "every value is clean".
 * 2. 🔴 **And the floor the first case DID have was on the SUM.** `NETWORK_ON_CALL_ROLES` alone keeps
 *    `everyRole.length > 0` true while **every per-service role silently disappears** — so the half of
 *    the population that actually varies could empty with nothing red. **A floor on a total is not a
 *    floor on its parts.**
 *
 * ✅ Floored per source, and called by both cases so neither can drift from the other.
 */
function everyRoleFloored(): OnCallRole[] {
  expect(
    NETWORK_ON_CALL_ROLES.length,
    "no network-wide on-call roles at all — every assertion over role values below would walk an " +
      "empty list and pass without looking at anything",
  ).toBeGreaterThan(0);

  const perService = HEALTH_SERVICES.flatMap((service) => SERVICE_ON_CALL_ROLES[service]);
  expect(
    perService.length,
    "no per-service on-call role anywhere — this is the half of the population that changes, and a " +
      "floor on the combined total would not have noticed it going",
  ).toBeGreaterThan(0);

  return [...NETWORK_ON_CALL_ROLES, ...perService];
}

describe("the on-call screen holds no people and nothing to ring", () => {
  /**
   * 🔴 **THE MATCHER IS TESTED BEFORE IT IS TRUSTED.** Without this case, every assertion below
   * passes just as happily on a pattern that can never match anything.
   */
  it("🔴 the reachable-shape patterns actually match reachable things, and spare innocent ones", () => {
    const mustMatch = [
      'href="tel:+61400000000"',
      'href="mailto:oncall@example.invalid"',
      "ext 4471",
      "Ext. 22",
      "pager 1234",
      "+61 400 000 000",
      "9224 2244",
      // 🔴 The carve-out must not swallow these: date-SHAPED is not date.
      "tel:2026-09-12",
      "2026-09-123456",
      "oncall@health.wa.gov.au",
    ];
    for (const specimen of mustMatch) {
      expect(
        REACHABLE_SHAPES.some(({ pattern }) => pattern.test(specimen)),
        `nothing in REACHABLE_SHAPES matches ${JSON.stringify(specimen)} — the guard below would ` +
          "have let this onto a screen somebody rings at three in the morning",
      ).toBe(true);
    }

    /*
     * ⚠️ The other half. A matcher that flags everything is not a guard either — it would be
     * silenced within a week, and a silenced guard is worse than none because it reads as present.
     */
    const mustNotMatch = [
      "Overnight, 20:00 to 08:00",
      "Bed coordinator",
      "8 of 12 roles recorded in this prototype",
      "No coordinator on call and no duty consultant is recorded for WACHS in this prototype.",
      "2026-09-12",
      "Dated 2026-09-12 in a comment, as every comment here is.",
    ];
    for (const specimen of mustNotMatch) {
      const fired = REACHABLE_SHAPES.filter(({ pattern }) => pattern.test(specimen)).map(({ name }) => name);
      expect(
        fired,
        `the guard flags ${JSON.stringify(specimen)} as ${fired.join(", ")} — reword the screen if ` +
          "this is real prose, but do NOT narrow the pattern to let a number through",
      ).toEqual([]);
    }
  });

  /**
   * 🔴 **THE KEY SET, PINNED THE WAY `ALLOWED_REFERRAL_FIELDS` PINS `Referral`.**
   *
   * `Required<OnCallRole>` is a COMPILE-time half: adding `name` or `phone` to the type breaks this
   * literal. The runtime key check is the other half: it catches a field that exists on the objects
   * but not on the type. ⚠️ **Neither alone is enough, which is why both are here.**
   */
  it("🔴 an on-call role has exactly three fields, and none of them can reach anybody", () => {
    const canonical: Required<OnCallRole> = {
      id: "specimen",
      role: "Bed coordinator",
      shift: "Overnight, 20:00 to 08:00",
    };
    expect(
      Object.keys(canonical).sort(),
      "the shape of an on-call role changed. If a field was ADDED, stop: this type is the reason " +
        "this screen cannot show anybody a way of contacting a person, and a staff record is a " +
        "growth the owner approves individually — not a field added to a fixture array",
    ).toEqual(["id", "role", "shift"]);

    const everyRole = everyRoleFloored();
    for (const role of everyRole) {
      expect(
        Object.keys(role).sort(),
        `role ${role.id} carries keys the type does not declare — a value can outlive its type ` +
          "through a cast, and this is the half that catches it",
      ).toEqual(["id", "role", "shift"]);
    }
  });

  it("🔴 no role value is itself shaped like a way of reaching somebody", () => {
    const everyRole = everyRoleFloored();
    for (const role of everyRole) {
      for (const value of [role.id, role.role, role.shift]) {
        for (const { name, pattern } of REACHABLE_SHAPES) {
          expect(
            pattern.test(value),
            `role ${role.id} carries ${name} in ${JSON.stringify(value)} — the type forbids a ` +
              "contact FIELD, and this forbids one smuggled into a field that is allowed",
          ).toBe(false);
        }
      }
    }
  });

  it("🔴 nothing in the on-call source or its route is shaped like a way of reaching somebody", () => {
    const files = [...sourceFiles(ON_CALL_DIR), ...sourceFiles(ON_CALL_ROUTE)];
    expect(
      files.length,
      "no on-call source files were read at all, so every assertion here walked nothing — the " +
        "folder moved, and this guard must follow it rather than stay green over an empty list",
    ).toBeGreaterThan(2);

    for (const file of files) {
      for (const { name, pattern } of REACHABLE_SHAPES) {
        const found = pattern.exec(file.text);
        expect(
          found,
          `${file.path} contains ${name}: ${JSON.stringify(found?.[0] ?? "")}. This screen is rung ` +
            "at three in the morning. A real one is wrong the moment a roster changes and an " +
            "invented one gets dialled — neither belongs here, and a disclosure beside it does not " +
            "make it safe.",
        ).toBeNull();
      }
    }
  });

  /**
   * ⚠️ **THE MISSING SERVICE IS DERIVED, AND THIS IS WHY THAT MATTERS.** A hard-coded sentence naming
   * WA Country stays on the screen after somebody gives WACHS a role — a screen telling a coordinator
   * nobody is on call for a service that now has somebody. **This pins the derivation, not the
   * sentence.**
   */
  it("🔴 a service that gains a role stops being named as having none", () => {
    const withNone = HEALTH_SERVICES.filter((service) => SERVICE_ON_CALL_ROLES[service].length === 0);
    const withSome = HEALTH_SERVICES.filter((service) => SERVICE_ON_CALL_ROLES[service].length > 0);
    expect(
      withNone.length,
      "no service has an empty role list, so the screen's 'none recorded' wording renders nowhere " +
        "and its own test walks nothing — seed one rather than deleting this case",
    ).toBeGreaterThan(0);
    expect(
      withSome.length,
      "every service is empty, so 'named as having none' cannot discriminate — it would be true of all",
    ).toBeGreaterThan(0);
  });

  /**
   * 🔴 **EVERY RECORDED LINE IS A MOCK THAT CANNOT REACH A PERSON.** If a real or plausible number
   * ever enters the directory, it fails the pattern here, whatever source file it came from.
   */
  it("🔴 every directory number is an unassigned mock and every email is undeliverable", () => {
    const entries = buildOnCallDirectory();
    const numbers = entries.flatMap((entry) => entry.lines.map((line) => line.number));
    const emails = entries.flatMap((entry) => (entry.email ? [entry.email] : []));
    expect(numbers.length, "the directory holds no lines, so this case checks nothing").toBeGreaterThan(50);
    expect(MOCK_NUMBER_PREFIX).toBe(["08", "0000"].join(" "));
    for (const number of numbers) {
      if (!SHOW_MOCK_CONTACTS) {
        expect(number).toBeNull();
        continue;
      }
      expect(number, `${String(number)} is not in the unassigned mock range`).toMatch(/^08 0000 \d{4}$/u);
    }
    // With SHOW_MOCK_CONTACTS off every slot is null, so only held numbers must be unique.
    const held = numbers.filter((number) => number !== null);
    expect(new Set(held).size, "two lines share a number, so one row would ring another's line").toBe(held.length);
    for (const email of emails) expect(email).toMatch(/^[a-z0-9.]+@example\.invalid$/u);
    for (const entry of entries) {
      for (const { pattern } of REACHABLE_SHAPES.slice(0, 4)) {
        expect(pattern.test(`${entry.name} ${entry.place} ${entry.note}`), `${entry.id} carries contact wording`).toBe(
          false,
        );
      }
    }
  });
});
