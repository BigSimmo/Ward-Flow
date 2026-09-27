#!/usr/bin/env node
/**
 * Re-measures every factual claim in `docs/ward-flow/plans/2026-09-10-master-plan-errata.md`
 * against the CURRENT tree, and says which are still true.
 *
 * WHY THIS EXISTS. The errata sheet expired once within an hour of being written: §B told every
 * lane to split a guard that had, in the meantime, been fixed — so a lane obeying the errata would
 * have damaged a working check and cited Ward Lead while doing it. An errata sheet that has itself
 * expired is a guard that fires on correct work, which is the exact class §B was written to prevent.
 *
 * A document cannot promise not to go stale. So each claim carries the command that re-measures it,
 * and the READER finds out rather than the writer.
 *
 * ⚠️ An EXPIRED line is NOT a fault in whoever found it. Every claim here was true when measured.
 * The tree moves; the claim does not. Expired means "go and look", never "somebody was careless".
 *
 * ⚠️ AND A `STILL TRUE` LINE IS NOT A GUARANTEE THE ENTRY IS RIGHT. It says the specific thing this
 * script measures still holds. A claim whose check is weaker than the claim can pass here and be
 * wrong — which is why each check prints what it actually measured.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const p = (rel) => join(repo, rel);
const read = (rel) => (existsSync(p(rel)) ? readFileSync(p(rel), "utf8") : null);

/** Count files under a directory matching a predicate on their contents. */
function filesContaining(dir, pattern, filter = () => true) {
  if (!existsSync(p(dir))) return [];
  return readdirSync(p(dir))
    .filter(filter)
    .filter((f) => {
      const body = read(join(dir, f));
      return body !== null && pattern.test(body);
    });
}

const isDrawing = (f) => f.endsWith("-third-edition.html");
const MOCKUPS = "docs/ward-flow/mockups";

/**
 * Each entry: what the errata claims, and a check that RE-DERIVES it.
 * `status` is "live" (must still hold) or "closed" (recorded as already resolved — we verify it
 * has STAYED resolved, because a closed entry that silently reopens is the worse surprise).
 */
const CLAIMS = [
  {
    id: "A1",
    status: "live",
    claim: "legalDeadlineMinutes HAS a reader (the plan said it had none)",
    check: () => {
      const body = read("src/components/ward-management/delays/delays-screen.tsx");
      return {
        ok: !!body && body.includes("legalDeadlineMinutes"),
        saw: body ? "referenced in delays-screen.tsx" : "delays-screen.tsx not found",
      };
    },
  },
  {
    id: "A2",
    status: "live",
    claim: "totalsReconciliation() exists (the plan said nothing reconciled the two figures)",
    check: () => {
      const body = read("src/components/ward-management/movements/movements-derivations.ts");
      return {
        ok: !!body && /export function totalsReconciliation/.test(body),
        saw: body ? "export present" : "file not found",
      };
    },
  },
  {
    id: "A3",
    status: "live",
    // 2026-09-12: this entry EXPIRED, and the repair is NOT "the plan was right after all".
    // The errata existed because a plan asserted fifteen when the tree held fourteen. The tree now
    // holds fifteen again for an unrelated reason: the owner's D9 ruling added
    // tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx that day. The original correction
    // stays true of the moment it was made; only the arithmetic coincidence is new. Raising the
    // number without this note would read as a vindication of the figure it was written to correct.
    //
    // 2026-09-17: seventeen, again for an unrelated reason — the WF-27 audit fix added
    // tests/ward-capacity-controls.dom.test.tsx on 2026-09-16 and C1 added
    // tests/ward-capacity-service-scope.dom.test.tsx on 2026-09-17. Same rule: the count must match AND
    // each named addition must be the reason for it.
    claim:
      "tests/ward-capacity-* was FOURTEEN files when the plan claimed fifteen; seventeen now for unrelated " +
      "reasons (D9 added one on 2026-09-12, the WF-27 controls test one on 2026-09-16, C1 service-scope on 2026-09-17), which does not make the plan's figure right",
    check: () => {
      const n = existsSync(p("tests"))
        ? readdirSync(p("tests")).filter((f) => f.startsWith("ward-capacity")).length
        : -1;
      const absorbed = existsSync(p("tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx"));
      const controls = existsSync(p("tests/ward-capacity-controls.dom.test.tsx"));
      const serviceScope = existsSync(p("tests/ward-capacity-service-scope.dom.test.tsx"));
      // Every half, so this cannot pass by a DIFFERENT file arriving or a named one being renamed.
      return {
        ok: n === 17 && absorbed && controls && serviceScope,
        saw: `${n} files, D9 addition ${absorbed ? "present" : "ABSENT"}, WF-27 addition ${controls ? "present" : "ABSENT"}, C1 addition ${serviceScope ? "present" : "ABSENT"}`,
      };
    },
  },
  {
    id: "A4",
    status: "live",
    claim: "eligibility() and candidateReason() are standalone exports — no facade export needed",
    check: () => {
      const body = read("src/components/ward-management/ward-eligibility.ts");
      const ok = !!body && /export function eligibility/.test(body) && /export function candidateReason/.test(body);
      return { ok, saw: body ? "both exports present" : "ward-eligibility.ts not found" };
    },
  },
  {
    id: "A5",
    status: "live",
    claim: "acceptedUnitId exists (a ward's identity attaches on ACCEPTANCE, not at addressing)",
    check: () => {
      const body = read("src/components/ward-management/ward-model.ts");
      return {
        ok: !!body && /acceptedUnitId\?:/.test(body),
        saw: body ? "acceptedUnitId declared" : "ward-model.ts not found",
      };
    },
  },
  {
    id: "A6",
    status: "closed",
    claim:
      "CLOSED by the facade fold 8f1fb1af8c: both href builders now live in the facade and are exported. personHref became patientHref there, matching D-1's ruling that the screen is called Patient. Neither remains in its old home.",
    check: () => {
      // A CLOSED entry still has to prove its resolution HOLDS. If somebody moves a builder back
      // out of the facade, or un-exports one, this goes red again rather than staying quiet -
      // which is the whole reason a closed entry keeps a check instead of being deleted.
      const facade = read("src/components/ward-management/shell/ward-facade.ts");
      if (!facade) return { ok: false, saw: "ward-facade.ts not found - the facade may have moved" };
      const patientExported = /export function patientHref\s*\(/.test(facade);
      const communityExported = /export function communityTeamHref\s*\(/.test(facade);
      const search = read("src/components/ward-management/ward-global-search.tsx") || "";
      const community = read("src/components/ward-management/community/community-screen.tsx") || "";
      // The old homes must be clear. A builder declared in BOTH places is two sources of truth
      // for one route, which is the defect the extraction existed to close.
      const leftBehind = /function (?:personHref|patientHref)\s*\(/.test(search) || /function communityTeamHref\s*\(/.test(community);
      return {
        ok: patientExported && communityExported && !leftBehind,
        saw:
          `facade exports patientHref ${patientExported ? "yes" : "NO"}, communityTeamHref ${communityExported ? "yes" : "NO"}` +
          (leftBehind ? "; A BUILDER IS STILL DECLARED IN ITS OLD HOME - two sources of truth" : "; old homes clear"),
      };
    },
  },
  {
    id: "B",
    status: "closed",
    claim: "CLOSED: the drawings' migration is complete and the kit checker enforces the CURRENT sentence",
    check: () => {
      const checker = read(join(MOCKUPS, "third-edition-kit/check-shell.mjs"));
      const old = filesContaining(MOCKUPS, /Synthetic snapshot/, isDrawing).length;
      const now = filesContaining(MOCKUPS, /Invented figures/, isDrawing).length;
      const guardOk =
        !!checker && /Invented figures, reconciled with each other/.test(checker) && /\!\/\^Live\//.test(checker);
      return {
        ok: old === 0 && now > 0 && guardOk,
        saw: `old sentence in ${old} drawings, new in ${now}, kit guard ${guardOk ? "enforces the current sentence" : "does NOT enforce it"}`,
      };
    },
  },
  {
    id: "C",
    status: "live",
    claim: "TWO fields named arrivedAt, absent in two different ways (| null vs | undefined)",
    check: () => {
      const adm = read("src/components/ward-management/ward-admissions.ts");
      const mod = read("src/components/ward-management/ward-model.ts");
      const nullable = !!adm && /arrivedAt:\s*Instant \| null/.test(adm);
      const optional = !!mod && /arrivedAt\?:\s*Instant/.test(mod);
      return {
        ok: nullable && optional,
        saw: `Admission ${nullable ? "| null" : "NOT | null"}, TransportJob ${optional ? "optional" : "NOT optional"}`,
      };
    },
  },
  {
    id: "I",
    status: "live",
    claim: "Drawings use &rsquo; in headings — a literal grep cannot prove absence",
    check: () => {
      const n = filesContaining(MOCKUPS, /&rsquo;/, isDrawing).length;
      return { ok: n > 0, saw: `${n} drawings use the entity` };
    },
  },
  {
    id: "H1",
    status: "live",
    claim: "The community screen reads ONLY the 65-team catchment list — no Q-5 migration to do",
    check: () => {
      const a = read("src/components/ward-management/community/community-screen.tsx") || "";
      const b = read("src/components/ward-management/community/community-derivations.ts") || "";
      const uses65 = /COMMUNITY_TEAM_PAGES/.test(a + b);
      const importsTen = /import[^;]*COMMUNITY_TEAMS[^;]*from/.test(a + b);
      return {
        ok: uses65 && !importsTen,
        saw: `65-list ${uses65 ? "used" : "absent"}, 10-list ${importsTen ? "IMPORTED" : "not imported"}`,
      };
    },
  },
  {
    id: "H4",
    status: "live",
    claim: "The four routes §1.5 names do not exist (real ones are under /mockups/ward-flow/)",
    check: () => {
      const bad = ["src/app/ward", "src/app/board", "src/app/ed", "src/app/community"].filter((d) => existsSync(p(d)));
      return { ok: bad.length === 0, saw: bad.length ? `now EXIST: ${bad.join(", ")}` : "all four still absent" };
    },
  },
  {
    id: "H5",
    status: "live",
    claim: "The two ward gate scripts are in scripts/, not scripts/ward-flow/",
    check: () => {
      const inScripts =
        existsSync(p("scripts/run-ward-tests.mjs")) && existsSync(p("scripts/check-ward-expected-reds.mjs"));
      const inSub = existsSync(p("scripts/ward-flow/run-ward-tests.mjs"));
      return {
        ok: inScripts && !inSub,
        saw: `scripts/ ${inScripts ? "yes" : "no"}, scripts/ward-flow/ ${inSub ? "ALSO present" : "absent"}`,
      };
    },
  },
];

let expired = 0;
console.log("Errata freshness — re-measured against the current tree\n");
console.log(`  repo   ${repo}`);
console.log(`  head   ${execFileSync("git", ["rev-parse", "--short=10", "HEAD"], { encoding: "utf8" }).trim()}\n`);

for (const c of CLAIMS) {
  let ok, saw;
  try {
    ({ ok, saw } = c.check());
  } catch (error) {
    ok = false;
    saw = `check threw: ${error.message}`;
  }
  const verdict = ok ? (c.status === "closed" ? "CLOSED, still resolved" : "STILL TRUE") : "🔴 EXPIRED";
  if (!ok) expired += 1;
  console.log(`  ${verdict.padEnd(24)} ${c.id}  ${c.claim}`);
  console.log(`  ${"".padEnd(24)}     measured: ${saw}\n`);
}

if (expired > 0) {
  console.log(
    `🔴 ${expired} entr${expired === 1 ? "y has" : "ies have"} EXPIRED. Go and look before acting on ${expired === 1 ? "it" : "them"}.`,
  );
  console.log("   An expired entry is not a fault in whoever found it — every one was true when measured.");
  console.log("   The tree moves; the claim does not.\n");
  process.exit(1);
}

console.log("All entries still hold as measured.\n");
console.log("⚠️  This does NOT mean the errata is right — only that what these checks measure still");
console.log("    holds. A claim whose check is weaker than the claim passes here and is still wrong.\n");
