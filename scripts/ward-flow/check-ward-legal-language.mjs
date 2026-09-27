#!/usr/bin/env node
/**
 * Fails if a Ward Flow screen renders wording that claims legal authority the app does not have.
 *
 * WHAT THIS IS FOR, in the owner's own decision (18 September 2026):
 *
 *   "Stop the claim, keep the facts." Remove the wording that makes the app look like an official
 *   register or an enforcement tool. Keep the real form names, keep the ward authorisation check,
 *   and never let the app calculate a legal deadline — it shows only the expiry a clinician typed,
 *   as a warning that does not block.
 *
 * So this is NOT a ban on the vocabulary. It is a ban on the app ASSERTING legal consequence.
 * Those are different things, and conflating them breaks working clinical logic:
 *
 *   ✅ KEPT — `legalFormName()` / `legalFormNameLabelFirst()` in `ward-legal-forms.ts`, whose own
 *      comment records that "the product owner approved adopting the official titles". Form 1A,
 *      Form 3A and Form 3D are approved vocabulary, reaffirmed by the owner on 17 September.
 *   ✅ KEPT — the `authorisation` eligibility gate (`ward-eligibility.ts:113-127`). A non-voluntary
 *      movement can only reach a bed where `unit.authorised` is true, and `ward-model.ts` documents
 *      that field as "the bed's legal-status dimension". Strip the words that explain it and the
 *      screen refuses a bed without being able to say why, which is worse than the wording it fixed.
 *   ✅ KEPT — "Voluntary" / "Involuntary", the transport logging vocabulary the owner ruled on.
 *   🔴 BANNED — "Statutory Breaches", "Legal deadline passed", "Issue MHA 2014 Statutory Form",
 *      "Form 1A Strict Enforcement". Each is the app telling a clinician what the law requires, or
 *      working out a deadline it has no authority to work out.
 *
 * ⚠️ WHY A SCANNER AND NOT A REVIEW. The 17 September audit found this wording across fifteen files
 * and roughly two hundred rendered strings. A sweep that large is finished exactly once and then
 * decays: the next screen built from the next drawing reintroduces one phrase, and nothing goes red.
 *
 * ⚠️ WHAT THIS SCAN WALKS, stated because the last checker in this directory shipped with a blind
 * spot in precisely this field — its ROOTS omitted `docs/`, and it printed "None found" on both
 * sides of a real repair. This one walks `src/components/ward-management/**` and
 * `src/app/mockups/ward-flow/**`, extensions `.ts` and `.tsx` only. It does NOT walk CSS (class
 * names are not rendered prose), tests, scripts, `docs/`, or the mockup drawings. A pass here says
 * nothing about any of those.
 *
 * ⚠️ AND IT DELIBERATELY IGNORES COMMENTS. A rule has to be writable down. If this scanned comments,
 * the paragraph you are reading would fail it, and so would every doc comment explaining why a
 * phrase was removed — which is the explanation a later reader most needs. Comments are blanked
 * before matching, character for character, so reported line numbers stay true.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const ROOTS = ["src/components/ward-management", "src/app/mockups/ward-flow"];
const EXTENSIONS = [".ts", ".tsx"];

/**
 * The single home for the banned list. Adding a phrase here is the whole change; there is no second
 * copy anywhere, which is what stops two screens disagreeing about what is allowed.
 */
export const BANNED = [
  // The app presenting itself as an official register or enforcement tool.
  "Statutory Forms Registry",
  "Statutory Breaches",
  "Statutory Compliance Alert",
  "Statutory Facts",
  "Statutory Worklists",
  "Statutory Legal Framework",
  "Statutory Timeline Invariants",
  "Statutory Custody Handover Breach",
  "Issue MHA 2014 Statutory Form",
  "Issue Statutory Form",
  "MHA 2014 Authorities",
  "Comprehensive Statutory Ledger",
  // The app asserting an enforcement posture it has no authority for.
  "Form 1A Strict Enforcement",
  "Strict Enforcement",
  "Mental Health Act 2014 Parameters",
  // The app CALCULATING a legal deadline. The owner ruled it works out no limits itself: the
  // clinician types the expiry written on the form, and it shows as a warning that never blocks.
  "Legal deadline passed",
  "Legal deadline in",
  "Legal deadline approaching",
  "Legal deadline",
  // 🔴 A DURATION WELDED TO A FORM NAME, added 2026-09-18 after a peer session's full `npm run test`
  // found three of these in `referrals/ward-referral-drawer.tsx` — a file that did not exist when
  // this scanner was written. "Form 1A (Referral for Examination · 24h Strict Limit)" states a
  // legal time limit as a property of the form, which is precisely what the owner ruled the app
  // must never do: the clinician types the expiry written on the form and nothing is computed.
  //
  // ⚠️ THE LESSON IS THE SHAPE, NOT THE THREE STRINGS. They arrived in the five commits AFTER the
  // audit was written, which means statutory chrome is being RE-INTRODUCED by the current build
  // line faster than any one-pass sweep can hold. The sweep was never going to be what holds this;
  // this list is. Add to it rather than re-sweeping.
  "Strict Limit",
  "Strict limit",
  "24h Limit",
  "24 hour limit",
  "72h Limit",
  "Statutory Limit",
  "Statutory limit",
  // Added 2026-09-20 — Ward Safety Copy P0 strip residual / regression guards.
  "Statutory Forms (MHA 2014)",
  "not authorised under the Mental Health Act",
  "Not authorised under the Mental Health Act",
  "Transport order (4A):",
  "Transfer order (4C):",
  "statutory grounds",
  "Statutory Forms",
  "Statutory Authority",
  "Statutory Deadline",
  "Statutory Instrument",
  "Statutory Profile",
  "Statutory Legal Status",
  "Statutory Certificate",
  "Re-Authorise Statutory Order",
  "Register Statutory Form",
  "under the Mental Health Act",
  "Mental Health Act authorisation",
  "Mental Health Act 2014",
  "MHA-authorised",
  "not MHA-authorised",
  "Not MHA-authorised",
  "MHA 2014",
  "Authorised Statutory Form",
  // Added 2026-09-21 — Safety P1 strip residuals (Settings custody/Issue theatre + alerts title).
  "Form 4A Custody Stamp",
  "Form 1A Issue & Track",
  "Mobile Custody / Secure Vehicle",
  "Custody Only",
  "Form 4A Expiry Warning Window",
  "Form 4A Mandatory Escort Classification",
  "Destination no longer lawful",
  "Clinical Governance & Statutory Policy",
  // Colon-clock variants beyond the existing "Transport order (4A):" / "Transfer order (4C):" bans.
  // Owner-approved form *titles* such as "Transport order (4A) - recorded expiry in …" remain allowed
  // (documented by tests/ward-legal-language.test.ts). Ban order-clock without recorded-expiry framing:
  "Transport order (4A) remaining",
  "Transfer order (4C) remaining",
];

/**
 * Phrases that neutralise a hit on the same line. A screen saying it is NOT a statutory record is
 * making exactly the disclaimer this check exists to produce, so it must not be what the check
 * forbids. Kept deliberately short: every entry is a hole, and a long list here is how a guard
 * stops meaning anything.
 */
export const ALLOWED_CONTEXTS = ["not a statutory", "no statutory", "not a legal", "never a legal"];

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

/** Replace a matched run with the same number of characters so line numbers survive. */
function blank(match) {
  return match.replace(/[^\n]/g, " ");
}

/**
 * Returns every banned phrase rendered in `source`, as `{ file, line, phrase }`.
 * Comments are blanked first; see the note at the top of this file for why.
 */
export function findBannedLegalLanguage(file, source) {
  const stripped = source
    .replace(BLOCK_COMMENT, blank)
    .replace(LINE_COMMENT, (match, lead) => lead + blank(match.slice(lead.length)));

  const lines = stripped.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (ALLOWED_CONTEXTS.some((context) => lower.includes(context))) continue;
    // Longest first, then skip any shorter phrase that is merely part of one already reported on
    // this line. Otherwise "Legal deadline passed" is counted twice — once for itself and once for
    // "Legal deadline" inside it — and the total stops being a count of anything.
    const matched = [];
    for (const phrase of [...BANNED].sort((a, b) => b.length - a.length)) {
      if (!line.includes(phrase)) continue;
      if (matched.some((longer) => longer.includes(phrase))) continue;
      matched.push(phrase);
      hits.push({ file, line: i + 1, phrase });
    }
  }
  return hits;
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

function main() {
  const files = ROOTS.flatMap((root) => walk(join(PROJECT_ROOT, root), []));
  const offences = [];
  for (const file of files) {
    const rel = relative(PROJECT_ROOT, file).split(sep).join("/");
    offences.push(...findBannedLegalLanguage(rel, readFileSync(file, "utf8")));
  }

  console.log(`Scanned ${files.length} file(s) under ${ROOTS.join(", ")}.\n`);

  if (offences.length === 0) {
    console.log("No screen claims legal authority the app does not have.\n");
    console.log("⚠️  This walks rendered .ts/.tsx under the two roots above and nothing else — not");
    console.log("    CSS, not tests, not docs, not the drawings. A pass is about those files only.\n");
    return 0;
  }

  console.log("🔴 Wording that claims legal authority the app does not have:\n");
  const byFile = new Map();
  for (const offence of offences) {
    if (!byFile.has(offence.file)) byFile.set(offence.file, []);
    byFile.get(offence.file).push(offence);
  }
  for (const [file, list] of [...byFile].sort()) {
    console.log(`  ${file}`);
    for (const offence of list) console.log(`    :${offence.line}  ${offence.phrase}`);
    console.log("");
  }
  console.log(`${offences.length} occurrence(s) across ${byFile.size} file(s).`);
  console.log("");
  console.log("The fix is never to delete the fact. Keep the form name, keep the ward authorisation");
  console.log("check, and say what a person recorded — not what the app worked out. See the owner's");
  console.log("decision at the top of this file.");
  console.log("");
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
