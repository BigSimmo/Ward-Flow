import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEMO_LANDLINE_EXCHANGE,
  DEMO_NUMBER_BLOCKS,
  demoLandline,
  demoLandlineSerial,
  demoNumberBlockOf,
} from "@/components/ward-management/demo-phone-numbers";
import { buildOnCallDirectory, MOCK_NUMBER_PREFIX } from "@/components/ward-management/on-call/on-call-directory";
import { PROVIDER_DIRECTORY_IDS } from "@/components/ward-management/officer/officer-booking-contacts";
import { REFERENCE_TEAM_NAMES, referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { completeSyntheticReferralIntakes } from "@/components/ward-management/ward-referral-intake-seed";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";

/**
 * Audit 15 (Josh, 13 Nov 2026): A15-14 (landlines and dial links), A15-18 (email domains) and
 * A15-19 (one allocator for invented numbers). Every check reads the whole of `src/`, so a number,
 * address or dial link typed in a new file fails here too.
 */

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

const FILES = sources("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));
const WARD_DIR = join("src", "components", "ward-management");

/** Code without its comments, so an example in a comment is not read as handed-out data. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:"'`\\])\/\/.*$/gmu, "$1");
}

// The landline half of the synthetic-data guard's phone pattern (src/lib/synthetic-data-guard.ts).
const LANDLINE = /(?:\+?61\s*\(?[2378]\)?\s*\d{4}[ -]?\d{4}|\(?\b0[2378]\)?\s*\d{4}[ -]?\d{4})\b/gu;
const FICTIONAL_LANDLINE = /^(?:61|0)?[2378](?:5550|7010)\d{4}$/u;

describe("A15-14 landlines in the app are fictional", () => {
  it("finds no landline outside the ACMA fiction ranges (5550 and 7010) anywhere in src", () => {
    const outside = FILES.flatMap(({ path, text }) =>
      [...text.matchAll(LANDLINE)]
        .map((match) => match[0])
        .filter((number) => !FICTIONAL_LANDLINE.test(number.replace(/\D/gu, "")))
        .map((number) => `${path}: ${number}`),
    );
    expect(outside).toEqual([]);
  });

  it("builds the On-call directory's numbers in the 08 5550 range, not the old 08 0000 exchange", () => {
    expect(MOCK_NUMBER_PREFIX).toBe("08 5550");
    const numbers = buildOnCallDirectory().flatMap((entry) => entry.lines.map((line) => line.number));
    expect(numbers.length).toBeGreaterThan(50);
    for (const number of numbers) expect(number).toMatch(/^08 5550 1\d{3}$/u);
  });

  it("types no dial link anywhere: demo numbers go through the shared copy-only control", () => {
    const dialLinks = FILES.flatMap(({ path, text }) =>
      /href=\{?\s*["'`]tel:|`tel:\$\{|["'`]tel:["'`]\s*\+/u.test(withoutComments(text)) ? [path] : [],
    );
    expect(dialLinks).toEqual([]);
  });
});

const EMAIL = /[A-Za-z0-9._%+{}$-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/gu;

describe("A15-18 email addresses in the app use reserved example domains", () => {
  it("finds no address outside example.invalid or example.org anywhere in src", () => {
    const outside = FILES.flatMap(({ path, text }) =>
      [...text.matchAll(EMAIL)]
        .filter((match) => !/(?:^|\.)example\.(?:invalid|org)$/u.test(match[1]!))
        .map((match) => `${path}: ${match[0]}`),
    );
    expect(outside).toEqual([]);
  });

  it("suggests an example.invalid address in the sign-in box", () => {
    const parts = readFileSync(join(WARD_DIR, "front-door", "front-door-parts.tsx"), "utf8");
    expect(parts).toContain('placeholder="name@example.invalid"');
  });
});

describe("A15-19 one allocator hands out invented numbers", () => {
  it("gives each seed file its own block, and no two blocks overlap", () => {
    const blocks = Object.entries(DEMO_NUMBER_BLOCKS).sort(([, a], [, b]) => a.first - b.first);
    for (let index = 1; index < blocks.length; index += 1)
      expect(blocks[index]![1].first, blocks[index]![0]).toBeGreaterThan(blocks[index - 1]![1].last);
    const owners = blocks.flatMap(([, block]) => block.files);
    expect(new Set(owners).size, "a file is named under two blocks").toBe(owners.length);
    expect(demoLandline("onCallDirectory", 1)).toBe(`${DEMO_LANDLINE_EXCHANGE} 1001`);
    expect(() => demoLandline("referralIntake", 100)).toThrow();
  });

  it("finds every invented number in src inside the block of the file that types it", () => {
    const misplaced = FILES.flatMap(({ path, text }) => {
      const file = relative(WARD_DIR, path).split("\\").join("/");
      return [...withoutComments(text).matchAll(LANDLINE)].flatMap((match) => {
        const serial = demoLandlineSerial(match[0]);
        if (serial === null) return [];
        const block = demoNumberBlockOf(serial);
        const files: readonly string[] = block ? DEMO_NUMBER_BLOCKS[block].files : [];
        return files.includes(file) ? [] : [`${path}: ${match[0]} (block ${block ?? "none"})`];
      });
    });
    expect(misplaced).toEqual([]);
  });

  it("puts no number under two names across the directory, the reference teams and the seeded referrers", () => {
    const namesByNumber = new Map<string, Set<string>>();
    const add = (number: string | null | undefined, name: string) => {
      if (!number) return;
      const key = number.replace(/\D/gu, "").replace(/^61/u, "0");
      namesByNumber.set(key, (namesByNumber.get(key) ?? new Set()).add(name));
    };
    for (const entry of buildOnCallDirectory()) for (const line of entry.lines) add(line.number, `on-call ${entry.id}`);
    for (const name of REFERENCE_TEAM_NAMES) add(referenceTeamDetail(name)?.publishedPhone, `team ${name}`);
    for (const scenario of WARD_SCENARIOS) {
      const state = seedWardFlowState(scenario);
      for (const referral of completeSyntheticReferralIntakes(state.referrals, { movements: state.movements }))
        add(referral.intake?.referrer.phone, `referrer ${referral.intake?.referrer.name}`);
    }
    const shared = [...namesByNumber].filter(([, names]) => names.size > 1).map(([n, names]) => `${n}: ${[...names]}`);
    expect(shared).toEqual([]);
  });

  it("reads the officer's booking numbers from On-call directory rows that exist (A15-29)", () => {
    const ids = new Set(buildOnCallDirectory().map((entry) => entry.id));
    for (const { provider, id } of PROVIDER_DIRECTORY_IDS) expect(ids.has(id), provider).toBe(true);
    const booking = readFileSync(join(WARD_DIR, "officer", "officer-booking-contacts.tsx"), "utf8");
    expect(withoutComments(booking)).not.toMatch(/5550/u);
  });
});
