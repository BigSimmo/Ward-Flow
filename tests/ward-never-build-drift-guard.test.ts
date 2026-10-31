import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { closerBedOptions } from "@/components/ward-management/out-of-area/out-of-area-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { eligibleCandidatesAmong } from "@/components/ward-management/ward-derivations-shortlist";

/*
 * Never-build drift guard (Josh's standing rule, 19 Oct 2026; sweep of 24 Oct 2026). The rule
 * forbids risk or acuity scores, "best match" ward suggestions, automatic placement, re-sorting the
 * ED queue, computed Mental Health Act times, auto-releasing held beds and patient details in
 * emails. `ward-priority.test.ts` already pins the wait-order queue and the score-free wait factors,
 * and the legal-figure sweeps pin the Act times. This file catches the quieter drift: suggesting
 * words in new copy, a share or mail link, a score attribute, a pull that lapses by time alone, and
 * patient details in the text written for the exec on-call email.
 *
 * Widened 26 Oct 2026 (never-build audit NB-26-02, which got 12 of 12 rule-breaking phrases past
 * the first version): more phrasings, a negation counts only when it comes before the phrase in the
 * same clause, every source folder including the shared kit, `src/lib` and the backend, and checks
 * for timers or effects that raise a placement event, raw clipboard writes and a capped ward list.
 * `ward-never-build-behaviour-guard.test.ts` covers what happens at run time.
 */

const ROOTS = ["src", "backend/ward-flow"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs)$/u.test(name) && !/\.test\.(tsx?|mjs)$|\.test-support\.mjs$/u.test(name) ? [path] : [];
  });
}

/** Code lines only: comment lines explain the rule and may name what is forbidden. */
function codeLines(path: string): { line: number; text: string }[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/u.test(text));
}

const FILES = ROOTS.flatMap(sourceFiles);

const relativePath = (file: string) => relative(process.cwd(), file).replaceAll("\\", "/");

function hits(pattern: RegExp, allow: (text: string, file: string) => boolean = () => false): string[] {
  return FILES.flatMap((file) =>
    codeLines(file)
      .filter(({ text }) => pattern.test(text) && !allow(text, relativePath(file)))
      .map(({ line, text }) => `${relativePath(file)}:${line}: ${text.trim().slice(0, 120)}`),
  );
}

// Refusal copy ("Search never returns a best match") states the rule. A negation clears a phrase only
// when it comes BEFORE the phrase in the same clause: "the first in the list, not a recommendation"
// still names "top of the queue" first, and passes nothing.
const NEGATION = /\b(never|not|no|nor|without|nothing|none|doesn't|isn't|won't|cannot)\b/iu;
const CLAUSE_BREAK = /[.;:!?"`>]|\b(but|then)\b/giu;

function negatedBefore(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
  return matches.every((match) => {
    const before = text.slice(0, match.index);
    const clauseStart = Math.max(0, ...[...before.matchAll(CLAUSE_BREAK)].map((m) => m.index + m[0].length));
    return NEGATION.test(before.slice(clauseStart));
  });
}

/** Wording found by the 26 Oct audits whose agreed fix belongs to the wording, help and forecast
 *  threads. Each entry must still match: once the words are fixed, this test fails and asks for the
 *  entry to be deleted, so the list only shrinks. */
const PENDING_WORDING: { id: string; file: string; text: RegExp }[] = [];

const pending = (text: string, file: string) =>
  PENDING_WORDING.some((entry) => entry.file === file && entry.text.test(text));

/** Lines that name a phrase for a reason other than doing it, each with that reason. */
const PERMANENT: { file: string; text: RegExp; why: string }[] = [
  {
    file: "src/components/ward-flow-sign-in/ward-flow-sign-in-data.ts",
    text: /words: "Read a risk score, an acuity score or a best match"/u,
    why: "the sign-in list of things no role can do",
  },
  {
    file: "src/components/ward-redesign/sign-in/sign-in-data.ts",
    text: /words: "Read a risk score, an acuity score or a best match"/u,
    why:
      "the redesign mock-up's copy of the same sign-in refusal line above (D-89, D-91), word for word; " +
      "it goes when the sign-in page is built",
  },
  {
    file: "src/components/ward-management/out-of-area/out-of-area-side.tsx",
    text: /each nearest ward has confirmed/u,
    why: "names the ward nearest a home region, a fact of the map (D-71 item 6)",
  },
  {
    file: "src/components/ward-management/settings/settings-search-index.ts",
    text: /^\s*keywords: "/u,
    why: "search keywords that find the setting, never shown as copy",
  },
];

const permanent = (text: string, file: string) =>
  PERMANENT.some((entry) => entry.file === file && entry.text.test(text));

/** The copy checks: a hit passes only as a negated refusal, a pending audit item or a named exception. */
function copyHits(pattern: RegExp): string[] {
  return hits(pattern, (text, file) => negatedBefore(text, pattern) || pending(text, file) || permanent(text, file));
}

/** A file's source with comment lines blanked, so line numbers still match. */
function codeSource(file: string): string {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((text) => (/^\s*(\/\/|\*|\/\*|\{\/\*)/u.test(text) ? "" : text))
    .join("\n");
}

/** The body of every `onX: () => { … }` or `onX={() => { … }}` handler removed: it runs on a person's
 *  tap (an Undo toast built in an effect), not when the effect or timer runs. */
function withoutHandlers(body: string): string {
  const handler = /\bon[A-Z]\w*\s*[:=]\s*\{?\s*(async\s*)?(\([^)]*\)|\w+)\s*=>\s*\{/gu;
  let result = body;
  for (let match = handler.exec(result); match; match = handler.exec(result)) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < result.length; end += 1) {
      if (result[end] === "{") depth += 1;
      else if (result[end] === "}" && --depth === 0) break;
    }
    result = result.slice(0, match.index) + result.slice(end + 1);
    handler.lastIndex = match.index;
  }
  return result;
}

/** The text of the call that opens at `opener` (the first "(" after it), brackets balanced. */
function callBody(source: string, start: number): string {
  const open = source.indexOf("(", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")" && --depth === 0) return source.slice(open, index + 1);
  }
  return source.slice(open);
}

describe("never-build drift guard", () => {
  it("finds the source it scans", () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it("no copy suggests, recommends or ranks a ward, bed or patient", () => {
    const patterns = [
      /suggested (destination|ward|bed|placement)|\bwe suggest\b|suggests? (a|the|this) (ward|bed)/iu,
      /best[- ](match|fit|ward|bed|option|placement|choice|site)/iu,
      /recommended (ward|bed|destination|placement|action|option)|Recommendation:\s*(admit|place|send|transfer)/iu,
      /next wards? to ask|most suitable|better fit|good fit|closest match|ideal (ward|bed)|fits first/iu,
      /\btop (\d+|three|five|ten) (wards?|beds?|options|matches|sites|units)\b/iu,
      /\b(nearest|closest) (available )?(ward|bed)s?\b/iu,
      /\b(wards?|beds?|patients?|people|options),? ranked\b|\branked (wards?|beds?|patients?|list)\b/iu,
    ];
    for (const pattern of patterns) expect(copyHits(pattern), String(pattern)).toEqual([]);
  });

  it("no copy says a person moves up the queue or shows first", () => {
    const pattern =
      /\bshows? first on\b|\bjumps? the queue\b|\bmoves? up the (queue|list)\b|\btop of the (priority |waiting )?(queue|list)\b/iu;
    expect(copyHits(pattern)).toEqual([]);
  });

  it("no copy names a risk, acuity, priority or placement score", () => {
    expect(
      copyHits(/\b(risk|acuity|priority|placement|match|suitability|urgency)[- ](score|rating|points)\b/iu),
    ).toEqual([]);
    expect(copyHits(/\baccess risk\b/iu)).toEqual([]);
    expect(hits(/data-score\b/u)).toEqual([]);
  });

  it("no copy says a bed is released, or a patient placed, by itself", () => {
    const patterns = [
      /\breturns? to the ward\b|auto[- ]?releas|releases? (itself|by itself|automatically)|released (automatically|by itself)/iu,
      /\bpull(ed)?\b.*\bexpires\b/iu,
      /auto[- ]?(place|placement|placed|accept|admit|assign)|automatically (placed|accepted|admitted|assigned|moved)/iu,
    ];
    for (const pattern of patterns) expect(copyHits(pattern), String(pattern)).toEqual([]);
  });

  it("each pending wording item still exists; once fixed, its entry is deleted", () => {
    const stale = PENDING_WORDING.filter(
      (entry) => !codeLines(entry.file).some(({ text }) => entry.text.test(text)),
    ).map((entry) => `${entry.id} is fixed in ${entry.file}: delete its PENDING_WORDING entry`);
    expect(stale).toEqual([]);
  });

  it("the negation rule clears a refusal and nothing else", () => {
    const best = /best[- ]match/iu;
    expect(negatedBefore("Search never returns a best match", best)).toBe(true);
    expect(negatedBefore("Best match for this patient, not checked", best)).toBe(false);
    expect(negatedBefore("Not urgent. Best match: Ward 4", best)).toBe(false);
    const top = /top of the (priority )?queue/iu;
    expect(
      negatedBefore("at the top of the priority queue. It is the first in the list, not a recommendation", top),
    ).toBe(false);
  });

  it("no timer or effect raises an engine event, except a ward's own read receipt", () => {
    const READ_RECEIPTS = new Set(["MARK_REFERRAL_OPENED"]);
    const raised = /\b(raise|dispatch)\(\s*(\{\s*type:\s*)?["'`]([A-Z][A-Z_]+)["'`]/gu;
    const found: string[] = [];
    for (const file of FILES.filter((path) => path.startsWith("src"))) {
      const source = codeSource(file);
      for (const opener of /setTimeout\(|setInterval\(|useEffect\(|useLayoutEffect\(|requestAnimationFrame\(|requestIdleCallback\(/gu[
        Symbol.matchAll
      ](source)) {
        for (const [, , , type] of withoutHandlers(callBody(source, opener.index)).matchAll(raised)) {
          if (!READ_RECEIPTS.has(type)) {
            found.push(`${relativePath(file)}:${source.slice(0, opener.index).split("\n").length}: ${type}`);
          }
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("every clipboard write goes through the Ward Flow copy helper", () => {
    const helpers = ["src/components/ward-management/ward-clipboard.ts", "src/lib/copy-to-clipboard.ts"];
    expect(
      hits(/clipboard\.writeText\(|execCommand\(\s*["']copy["']/u, (_text, file) => helpers.includes(file)),
    ).toEqual([]);
    // The plain helper skips the synthetic line and the UMRN strip, so it stays with the error pages.
    expect(
      hits(/@\/lib\/copy-to-clipboard/u, (_text, file) => !file.startsWith("src/components/ward-management/")),
    ).toEqual([]);
  });

  it("the ward list behind the shortlist is never cut short", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => state.units.filter((unit) => unit.cohort === row.cohort).length > 3);
    expect(movement, "the seed must have a cohort with more than three wards").toBeDefined();
    const sameCohort = state.units.filter((unit) => unit.cohort === movement!.cohort);
    const listed = eligibleCandidatesAmong(movement!, state.units, NOW_ANCHOR).map(({ unit }) => unit.id);
    expect(listed).toHaveLength(sameCohort.length);
    // The order is fixed by the wards, not by where they sit in the input.
    const reversed = eligibleCandidatesAmong(movement!, [...state.units].reverse(), NOW_ANCHOR).map(
      ({ unit }) => unit.id,
    );
    expect(reversed).toEqual(listed);
    // No screen passes a cap: every source call hands over the whole list it was given.
    const calls = FILES.filter((path) => path.startsWith("src")).flatMap((file) => {
      const source = codeSource(file);
      return [...source.matchAll(/eligibleCandidatesAmong\(/gu)]
        .map((call) => callBody(source, call.index))
        .filter((body) => !/^\(movement: Movement/u.test(body))
        .filter((body) => !/,\s*(\[\.\.\.)?(\w+)\]?,\s*\w+,\s*\2\.length\s*\)$|^\([^,]+,[^,]+,[^,]+\)$/u.test(body))
        .map((body) => `${relativePath(file)}: ${body.slice(0, 100)}`);
    });
    expect(calls).toEqual([]);
  });

  it("nothing shares or mails from the app except the fixed team mailbox link", () => {
    expect(hits(/navigator\.share\b/u)).toEqual([]);
    // The one live mailto is a community team's own referral mailbox, with no subject or body.
    // The redesign mock-up's copy of that panel (D-89, D-91) shows the same fixed link, and passes
    // only while it is the identical mailbox link with no subject or body.
    const allowedMailto = (text: string, file: string) =>
      (file.endsWith("community/community-screen-panels.tsx") ||
        file === "src/components/ward-redesign/community-team/community-team-contact.tsx") &&
      /mailto:\$\{contact\.referralEmail\}`/u.test(text);
    const mailtoUse = (text: string, file: string) =>
      allowedMailto(text, file) ||
      file.endsWith("use-dirty-state-guard.ts") ||
      // Web push needs a contact for the server operator (the VAPID subject); it names no patient.
      (file === "backend/ward-flow/push.mjs" && /\.test\(subject\)/u.test(text));
    expect(hits(/mailto:/u, mailtoUse)).toEqual([]);
  });

  it("a pulled bed is never released by time passing: a lapsed pull waits for a person", () => {
    const seeded = seedWardFlowState();
    const pulledBefore = seeded.admissions.filter((admission) => admission.state === "pulled").map((a) => a.id);
    const expiries = new Map(seeded.movements.map((movement) => [movement.id, movement.pullExpiresAt]));
    expect(pulledBefore.length, "the seed must hold a pulled bed to test").toBeGreaterThan(0);

    const later = wardFlowReducer(seeded, { type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes: 72 * 60 });

    expect(later.admissions.filter((admission) => admission.state === "pulled").map((a) => a.id)).toEqual(pulledBefore);
    for (const movement of later.movements) expect(movement.pullExpiresAt).toBe(expiries.get(movement.id));
  });

  it("the bed summary written for the exec on-call email carries no patient name or UMRN", () => {
    const state = seedWardFlowState();
    const text = bedSummaryText({
      units: state.units,
      admissions: state.admissions,
      movements: state.movements,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      network: activeWardNetwork(),
    });
    expect(state.patients.length).toBeGreaterThan(0);
    const leaks = state.patients.filter(
      (patient) =>
        text.includes(patient.umrn) ||
        (patient.familyName.length > 3 && new RegExp(`\\b${patient.familyName}\\b`, "u").test(text)),
    );
    expect(leaks.map((patient) => patient.id)).toEqual([]);
  });

  it("closer beds for a patient away from home list wards A to Z within each travel band, never most beds first", () => {
    const units = allUnits();
    const { entries } = outOfAreaLedger(wardAdmissions, units, NOW_ANCHOR);
    let checked = 0;
    for (const entry of entries) {
      const options = closerBedOptions(entry, units, NOW_ANCHOR);
      for (let index = 1; index < options.length; index += 1) {
        const [before, after] = [options[index - 1]!, options[index]!];
        if (before.band !== after.band) continue;
        checked += 1;
        expect(
          before.unit.name.localeCompare(after.unit.name, "en-AU"),
          `${before.unit.name} then ${after.unit.name}`,
        ).toBeLessThanOrEqual(0);
      }
    }
    expect(checked, "the seed must give at least one band with two wards").toBeGreaterThan(0);
  });
});
