// Audit M46 (D-83 as changed by D-102): names stay in full on screens, prints and TV, but never
// travel in a web address, a CSV export, the Report-a-problem picture, an alert payload or a log.
// This file holds the web-address channel and a register of the other channels' name-marker
// tests, so a channel that loses its test fails here.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { edReferralSheetHref } from "@/components/ward-management/referrals/open-referral-sheet";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { patientChronologyHref } from "@/components/ward-management/reports/report-routes";
import { dischargeHref, movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const ROOT = path.resolve(__dirname, "..");
const seed = seedWardFlowState();

function nameTokens(): string[] {
  const tokens = new Set<string>();
  for (const patient of seed.patients) {
    for (const part of [patient.givenName, patient.familyName]) {
      for (const word of String(part ?? "").split(/[\s'-]+/)) if (word.length >= 3) tokens.add(word.toLowerCase());
    }
  }
  return [...tokens];
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

/** Code lines only: block-comment and line-comment lines are dropped, so prose about old leaks passes. */
function codeLines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));
}

describe("M46 web addresses carry no names", () => {
  it("every seeded patient, movement, referral and stay link holds no part of any seeded name", () => {
    const tokens = nameTokens();
    expect(tokens.length).toBeGreaterThan(20);
    const hrefs = [
      ...seed.patients.flatMap((p) => [
        patientHref(p.id),
        patientChronologyHref(p.id),
        edReferralSheetHref(p.id, "ED-1"),
      ]),
      ...seed.movements.map((m) => movementHref(m.id)),
      ...seed.referrals.map((r) => referralBoardHref(r.id)),
      ...seed.admissions.map((a) => dischargeHref(a.id)),
    ];
    expect(hrefs.length).toBeGreaterThan(50);
    const leaks = hrefs.filter((href) => {
      const lower = decodeURIComponent(href).toLowerCase();
      return tokens.some((token) => new RegExp(`(^|[^a-z])${token}([^a-z]|$)`).test(lower));
    });
    expect(leaks).toEqual([]);
  });

  it("no source builds a Ward Flow address from a name, initials or note value", () => {
    const nameish =
      /([gG]ivenName|[fF]amilyName|[fF]ullName|[dD]isplayName|[pP]atientName|[iI]nitials|[sS]urname|\.note\b|[nN]oteText)/;
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, "src"))) {
      codeLines(file).forEach((line) => {
        const template = /`[^`]*\/ward-flow[^`]*\$\{([^}]*)\}/.exec(line);
        const param =
          /(?:searchParams|params|URLSearchParams)\b[^;]*\.(?:set|append)\(\s*["'][^"']+["']\s*,([^)]*)\)/.exec(line);
        const literal = /[?&](?:name|surname|initials|search|patientName)=/.test(line);
        if ((template && nameish.test(template[1]!)) || (param && nameish.test(param[1]!)) || literal)
          offenders.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("every dynamic route segment is a reviewed id, never a name", () => {
    const reviewed = new Set([
      "icons/[variant]",
      "mockups/ward-flow-redesign/[screen]",
      "ward-flow/board/[unitId]",
      "ward-flow/community/[teamId]",
      "ward-flow/ed/[edId]",
      "ward-flow/movements/[movementId]",
      "ward-flow/people/[patientId]",
      "ward-flow/statistics/community/[teamId]",
      "ward-flow/statistics/ed/[edId]",
      "ward-flow/statistics/service/[serviceId]",
      "ward-flow/statistics/ward/[unitId]",
      "ward-flow/ward/[unitId]",
    ]);
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        if (entry.startsWith("["))
          found.push(path.relative(path.join(ROOT, "src/app"), full).split(path.sep).join("/"));
        walk(full);
      }
    };
    walk(path.join(ROOT, "src/app"));
    // A new segment fails here until someone confirms it carries an id code, not a name.
    expect(found.sort()).toEqual([...reviewed].sort());
  });
});

describe("M46 the other outbound channels each keep a name-marker test", () => {
  // Each entry: the channel, the test that proves no name leaves through it, and a phrase that
  // test must still contain. CSV exports (D-102) are owned by audit M6 in another thread; the one-
  // person chronology CSV, which audit M46 found carrying the name, is held here (fixed 10 Nov 2026).
  const channels: Array<{ channel: string; file: string; mustContain: RegExp }> = [
    {
      channel: "one-person chronology CSV (M46, D-102)",
      file: "tests/ward-audit-24-7-print-notify.dom.test.tsx",
      mustContain: /the file names the person by UMRN only, never by name/,
    },
    {
      channel: "phone alert payload (M21)",
      file: "backend/ward-flow/push.test.mjs",
      mustContain: /no patient name, UMRN, Ward Flow id, alert text or typed text reaches the payload/,
    },
    {
      channel: "Report-a-problem picture (D-102)",
      file: "tests/ward-help-report-picture.test.ts",
      mustContain: /pixelates the drawing/,
    },
    {
      channel: "Report-a-problem text",
      file: "tests/ward-help-report.dom.test.tsx",
      mustContain: /refuses patient details without repeating them/,
    },
    {
      channel: "server logs and Sentry (M45)",
      file: "tests/ward-audit-m45-log-markers.test.ts",
      mustContain: /Quandtwhistle/,
    },
    {
      channel: "backend logs and error reports (M45)",
      file: "backend/ward-flow/ward-audit-m45-log-markers.test.mjs",
      mustContain: /Quandtwhistle/,
    },
    {
      channel: "typed search text in links (D-11)",
      file: "tests/ward-patient-typed-text-not-in-url.dom.test.tsx",
      mustContain: /href/,
    },
  ];
  it.each(channels)("$channel", ({ file, mustContain }) => {
    const full = path.join(ROOT, file);
    expect(existsSync(full), `${file} is missing`).toBe(true);
    expect(readFileSync(full, "utf8")).toMatch(mustContain);
  });
});
