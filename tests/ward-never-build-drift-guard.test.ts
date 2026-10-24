import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";

/*
 * Never-build drift guard (Josh's standing rule, 19 Oct 2026; sweep of 24 Oct 2026). The rule
 * forbids risk or acuity scores, "best match" ward suggestions, automatic placement, re-sorting the
 * ED queue, computed Mental Health Act times, auto-releasing held beds and patient details in
 * emails. `ward-priority.test.ts` already pins the wait-order queue and the score-free wait factors,
 * and the legal-figure sweeps pin the Act times. This file catches the quieter drift: suggesting
 * words in new copy, a share or mail link, a score attribute, a pull that lapses by time alone, and
 * patient details in the text written for the exec on-call email.
 */

const ROOTS = ["src/components/ward-management", "src/app"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
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

function hits(pattern: RegExp, allow: (text: string, file: string) => boolean = () => false): string[] {
  return FILES.flatMap((file) =>
    codeLines(file)
      .filter(({ text }) => pattern.test(text) && !allow(text, file))
      .map(({ line, text }) => `${relative(process.cwd(), file)}:${line}: ${text.trim().slice(0, 120)}`),
  );
}

// Refusal copy ("Search never returns a best match") states the rule, so a negated line passes.
const NEGATED = /\b(never|not|no|nor|without)\b/iu;

describe("never-build drift guard", () => {
  it("finds the source it scans", () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it("no copy suggests, recommends or ranks a ward, bed or patient", () => {
    const pattern =
      /suggested (destination|ward|bed|placement)|best[- ](match|fit|ward|bed)|recommended (ward|bed|destination|placement)|Recommendation:\s*(admit|place|send|transfer)|next wards? to ask|most suitable|wards?, ranked/iu;
    expect(hits(pattern, (text) => NEGATED.test(text))).toEqual([]);
  });

  it("no copy names a risk, acuity, priority or placement score", () => {
    expect(hits(/\b(risk|acuity|priority|placement|match) score/iu, (text) => NEGATED.test(text))).toEqual([]);
    expect(hits(/data-score\b/u)).toEqual([]);
  });

  it("nothing shares or mails from the app except the fixed team mailbox link", () => {
    expect(hits(/navigator\.share\b/u)).toEqual([]);
    // The one live mailto is a community team's own referral mailbox, with no subject or body.
    const allowedMailto = (text: string, file: string) =>
      file.endsWith("community/community-screen-panels.tsx") && /mailto:\$\{contact\.referralEmail\}`/u.test(text);
    const mailtoUse = (text: string, file: string) =>
      allowedMailto(text, file) || file.endsWith("use-dirty-state-guard.ts");
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
});
