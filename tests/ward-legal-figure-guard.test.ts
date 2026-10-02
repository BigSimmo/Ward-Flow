import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EVENT_ROLE, type WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { SELECTABLE_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import {
  DECLINE_REASONS,
  MOVEMENT_STAGES,
  type LegalForm,
  type LegalStatus,
} from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { legalFormReadinessLine } from "../src/components/ward-management/movements/movement-workspace-derivations";
import { literalsIn } from "./helpers/ast-string-literals";
import {
  KNOWN_DUE_AT_VALUES,
  AUTHORED_FIXTURE_DUE_AT,
  suppliedDueAt,
  SWEEP_CODES,
  ALL_EVENT_TYPES,
  STRUCTURALLY_IMPOSSIBLE_FOR_CODE,
  offendingFormsIn,
} from "./helpers/ward-legal-figure-sweep";
/**
 * Guard against a fourth fabrication of a Mental Health Act duration in this prototype.
 *
 * Three separate agents have now written three different invented statutory figures into
 * `src/components/ward-management/` and attributed them to the Act: a Form 3B post-examination
 * deadline (deleted in Task 6A), a four-hour figure bolted onto `legalForm.dueAt` (ruling F23),
 * and a Form 1A examination window (deleted 2026-08-23, the correction this file was added
 * alongside). Each was removed only after it had already reached the screen. The product owner's
 * standing instruction is narrower than "get the number right": "please can you leave the legal
 * part and just start a clock once the patient arrives to ED. Keep it simple for now."
 *
 * The guard has three parts, built on different evidence so a reintroduction has to defeat more
 * than one. Every claim below is demonstrated by an assertion in this file; where a part has a
 * limit, the limit is stated rather than glossed.
 *
 * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`)
 * — PART 1 NO LONGER GATES BY CODE.** Struck in place rather than deleted, because the reading
 * that made it true is what a reader will otherwise re-derive. Until this date no form of ANY
 * code could carry a `dueAt` unless its code was on `DEADLINE_BEARING_FORM_PROVENANCE`, a fixed
 * allowlist of exactly `"4A"` and `"4C"`. Owner answer 1, 2026-09-17: the clinician types the
 * expiry written on whichever form they hold, of any code — so a real Form 1A, 3B or 3D carrying
 * a `dueAt` is now the CORRECT and INTENDED state, not the fabrication this file exists to catch.
 * A code allowlist would now have to be deleted anyway to let the feature through, which is
 * exactly the shape of change this file's own closing paragraph forbids ("never be relaxed to
 * make a change green") — so the invariant changed instead of the guard weakening.
 *
 *   **Part 1 now reads REAL RUNTIME VALUES** — every `LegalForm` the fixture authors, every one
 *   the reducer authors, and every one reachable by driving the reducer through EVERY event type
 *   in its union — and requires that every `dueAt` value it finds is a **PROVENANCE MATCH**: a
 *   value this file itself supplied as a sentinel when constructing the event that could have
 *   written it (`KNOWN_DUE_AT_VALUES`, populated by `suppliedDueAt` at every construction site
 *   below), or a value the authored fixture (`ward-movements.ts`) already carries. A `dueAt` that
 *   matches neither — because the reducer computed it from a duration, hard-coded it, or derived
 *   it from anything other than copying what a caller supplied — is an offender, WHATEVER code it
 *   sits on. This is fail-closed on the VALUE, not on the code: every consumer is code-agnostic
 *   (`ward-priority.ts` scores any code carrying a `dueAt` and renders `Form ${code} passed its
 *   deadline …`), so a fabrication on an invented code, or a genuine code carrying an invented
 *   figure, would otherwise render as a legal countdown with nothing in its way.
 *
 *   Because it inspects values rather than text, it is unaffected by how the value got there: a
 *   helper in another file, an intermediate local, a spread, a computed property name, a
 *   post-construction mutation of an existing form, or a constant imported from anywhere at all.
 *   Its limit is REACHABILITY AND SUPPLY. The traversal drives every event type against a
 *   movement carrying EACH examination-timeline code and asserts acceptance per code, so a branch
 *   keyed on one code cannot go unentered — that exact hole let `code === "1A" ? { …, dueAt } :
 *   legalForm` pass the whole suite. What acceptance-per-code still does not give is every guard
 *   condition inside each case; a branch the sweep cannot reach at all is not inspected. And a
 *   mutation that happens to compute the SAME number this file supplied as a sentinel would not be
 *   caught by value alone — an unlikely coincidence given the sentinel offsets chosen, but a
 *   limit worth stating rather than assuming away.
 *
 *   Part 2 is a fail-closed ALLOWLIST over `ward-model.ts`. Every exported declaration there that
 *   WRITES A NUMBER DOWN ANYWHERE in its initializer — a constant, an object property, a function
 *   body, an enum member — must appear in `MODEL_CONSTANT_PROVENANCE` below with a one-line record
 *   of who supplied the figure and when. The trigger is the shape of the declaration, never its
 *   name, so a constant nobody thought to predict is caught because it was never declared. Its
 *   limits are SCOPE (it governs `ward-model.ts` and nothing else) and EXPORT (a module-private
 *   declaration is not inspected).
 *
 *   Part 3 is a token denylist over the whole ward directory, kept as a WIDER BUT INCOMPLETE
 *   second net for the files Part 2 does not govern. It scans identifiers via the TypeScript AST
 *   (never a regular expression, never a hand-rolled string scanner) across every `.ts`/`.tsx`
 *   file under the ward directory, recursively, so a file added in `coordinator/`, `ed/`,
 *   `officer/`, `tracker/` or `ward/` is covered exactly as a top-level one is. It is NOT
 *   complete and a green Part 3 proves nothing on its own.
 *
 * WHY PART 2 IS SHAPE-BASED AND NOT NAME-BASED. Two earlier versions of this guard tried to
 * recognise a fabricated figure by its NAME, and both were defeated by a reviewer:
 *
 *     FORM_1A_REFERRAL_EXPIRY_MINUTES   caught by the token denylist
 *     ASSESSMENT_WINDOW_MINUTES         defeated the denylist  (caught by v2's unit-token rule)
 *     INVOLUNTARY_ORDER_HOURS           defeated the denylist  (caught by v2's unit-token rule)
 *     SECTION_REVIEW_DAYS               defeated the denylist  (caught by v2's unit-token rule)
 *     FORM_1A_REFERRAL_CLOCK            defeated BOTH — no unit token, and it carried the
 *                                       deleted fabrication's exact value, 7 * 24 * 60
 *
 * Each round added vocabulary and each round missed the next name nobody had thought of. Keying
 * on the shape of the declaration instead ends that: an exported number in `ward-model.ts` is
 * caught whatever it is called. All of the names above are pinned as test cases below.
 *
 * WHAT THIS GUARD CANNOT SEE — stated plainly, because a guard that overstates its reach is the
 * failure mode this repository has hit most often:
 *
 *   - Part 2 governs `ward-model.ts` only. A duration constant declared in another ward file
 *     falls through to Part 3's incomplete denylist, and one declared outside the ward directory
 *     entirely is seen by neither.
 *   - Part 3 is incomplete BY CONSTRUCTION, as the table above demonstrates. It is a safety net,
 *     not a proof of absence, and a green Part 3 means nothing on its own.
 *   - Part 2 sees only EXPORTED declarations — `export const`, `export enum`, `export function`.
 *     A module-private `const` in `ward-model.ts`, or a number written inline at its use site, is
 *     not a declaration it inspects. Within an exported declaration it looks for a numeric literal
 *     anywhere, so the object / arrow-function / enum shapes that defeated the narrower rule are
 *     covered; a number arriving by import or computed at runtime is not.
 *   - Part 3 sees only SCREAMING_SNAKE_CASE identifiers. That filter is deliberate: every
 *     fabrication so far was a named constant, whereas the camelCase names in this directory are
 *     locals that merely READ a value (`legalDueAt`, `minutesLegalClock` — both honest readers of
 *     the 4A/4C deadlines that legitimately exist). Flagging those would make the guard cry wolf
 *     and get it disabled.
 *   - Anything that is not an identifier at all. A duration written only inside a string literal,
 *     a template literal, a comment, JSX text, or a CSS module is invisible to Part 3.
 *   - Part 1's limit is reachability AND supply. It inspects the states its traversal reaches; a
 *     branch the traversal cannot get an event accepted into is not inspected. The traversal
 *     asserts every event type was accepted against a movement carrying EACH examination-timeline
 *     code, so a code-keyed branch is entered rather than assumed — but "accepted per code" is
 *     still not "every guard condition inside that case exercised". And it can only recognise a
 *     value as INVENTED by checking it against every value this file itself ever supplied — a
 *     mutation whose invented figure happens to collide with a sentinel this file also used would
 *     not be caught by Part 1 alone.
 *   - The `STRUCTURALLY_IMPOSSIBLE_FOR_CODE` exclusion list gets only a partial check; its exact
 *     limit, and the measurement that established it, are recorded at its declaration.
 *   - A fabricated number parked in a variable nothing reads reaches no user and is caught by
 *     nothing here until something uses it.
 *   - Non-`.ts`/`.tsx` files, including the `.module.css` files in this directory.
 *   - Forms 4A ("Transport order") and 4C ("Transfer between authorised hospitals") carry real
 *     `dueAt` figures about moving a person, unrelated to the Mental Health Act examination
 *     timeline this file's own history is about — but since 2026-09-17 (T2) they are checked by
 *     Part 1 identically to every other code, not exempted from it. Nothing in this file treats
 *     them specially any longer.
 *
 * This file must never be relaxed to make a change green. If a real statutory figure is ever
 * supplied, it arrives with a named source and date from the clinician or the product owner, and
 * this guard is amended in the same change that records that provenance — never before it.
 */

const WARD_DIR = "src/components/ward-management";

/**
 * Word-level token sets. Matching is on exact tokens, never substrings: substring matching would
 * flag `formattedMinutes` (FORM inside FORMATTED) and other innocent names, and a guard that
 * cries wolf gets disabled. Tokenisation splits on `_` and on camelCase boundaries, so both
 * `FORM_1A_EXPIRY_MINUTES` and `form1AExpiryMinutes` decompose the same way.
 */
const LEGAL_TOKENS = new Set([
  "FORM",
  "FORMS",
  "1A",
  "3B",
  "STATUTORY",
  "LEGAL",
  "MHA",
  "ACT",
  "DETENTION",
  "DETAINED",
  "EXAMINATION",
  "REFERRAL",
]);

const DURATION_TOKENS = new Set([
  "MINUTES",
  "MINS",
  "HOURS",
  "DAYS",
  "EXPIRY",
  "EXPIRES",
  "DEADLINE",
  "WINDOW",
  "LIMIT",
  "TIMEOUT",
  "DUE",
]);

/**
 * THE ALLOWLIST (Part 2). Every exported SCREAMING_SNAKE_CASE constant in `ward-model.ts` whose
 * name carries a duration token must appear here, with a one-line record of who supplied the
 * figure and when. Adding an entry is the deliberate act of recording provenance; a figure whose
 * provenance cannot be written down does not belong in this model at all.
 *
 * Never add an entry whose provenance is an assistant's recollection of the Mental Health Act.
 * That is precisely what produced the three deleted fabrications. Provenance means a named human
 * — the clinician or the product owner — and a date.
 */
const MODEL_CONSTANT_PROVENANCE: Record<string, string> = {
  SENDING_TEAM_NAME_LIMIT:
    "Not a Mental Health Act figure. A length cap on the sending team's NAME, chosen by this " +
    "prototype for a text field and carrying no statutory meaning whatever — no timeframe, no " +
    "threshold, no interval. Owner, 2026-09-12: a referral records which team sent it. The " +
    "reducer refuses a longer value rather than shortening it, because a truncated team name " +
    "is a different team's name.",
  // RB7 (build plan item 27, 2026-09-17). Not a Mental Health Act figure — the same shape as
  // SENDING_TEAM_NAME_LIMIT directly above: a character cap on a text field
  // (`Referral.corrections[].note`), carrying no timeframe, threshold or interval. This
  // session's own unmeasured placeholder (same number as REFERRAL_HISTORY_LIMITS.history, for
  // the same "generous enough, still bounded" reasoning — see the constant's own doc comment in
  // ward-model.ts), never the owner's or a clinician's figure. Named `MAX_CHARACTERS` rather than
  // `LIMIT` specifically so it does not ALSO trip Part 3's token denylist below.
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS:
    "this session's own unmeasured placeholder, 2026-09-17 — a character cap on a correction " +
    "note text field, not a Mental Health Act figure; see ward-model.ts's own doc comment",
  // 🔴 DELETED 2026-09-17, T2: `FORM_1A_VALIDITY_HOURS`, `FORM_1A_EXAMINATION_WINDOW_HOURS` and
  // `FORM_3D_DETENTION_WINDOW_HOURS` stood here from Ruling 1 (2026-09-16) until this date. Owner
  // answer 1, 2026-09-17, is narrower than the figure Ruling 1 approved: this prototype works out
  // no legal time limits of its own; the clinician types the expiry written on the form. The three
  // constants were deleted from `ward-model.ts`, so their entries were deleted from here — an
  // allowlist entry for a declaration that no longer exists is dead weight the "allowlist must not
  // rot" check below would itself refuse to leave in place.
  // Product owner (the spec's own author), 2026-08-22: superseded the spec's original four-hour
  // figure and set the emergency department access target to 24 hours for this prototype, in
  // response to a direct clinical question. Counted UP from `openedAt`; never a deadline, never
  // attached to a `LegalForm`. See the constant's own doc comment in ward-model.ts.
  ED_ACCESS_TARGET_MINUTES: "product owner, 2026-08-22 — ED access target, counted up from openedAt",

  // Product owner's own spec, `docs/ward-flow-context.md` (line 205 states the constant; line 287
  // states the rule: "Parallel referrals are supported, capped at three"). An operational
  // courtesy limit between services — explicitly NOT a clinical or statutory quantity, and it
  // measures a count of units, not a duration.
  PARALLEL_REFERRAL_CAP: "product owner's spec, docs/ward-flow-context.md — count of units, not a duration",

  // Task 7-wiring, 2026-09-16: the slider range around PARALLEL_REFERRAL_CAP above. Not an
  // independently sourced figure — its max IS the owner's own cap, so it cannot license a value
  // the owner has not already accepted.
  PARALLEL_REFERRAL_CAP_RANGE: "derived from PARALLEL_REFERRAL_CAP's own provenance — the range's max is that constant",

  // Task 6-wiring, 2026-09-16: the slider range around ED_ACCESS_TARGET_MINUTES above (12h-36h in
  // 2h steps). Not a second sourced figure — this prototype's own adjustment band, chosen so the
  // owner's 24-hour default always falls inside it.
  ED_ACCESS_TARGET_RANGE_MINUTES:
    "this prototype's own adjustment band around ED_ACCESS_TARGET_MINUTES — not independently sourced",

  // Owner answer 35, 17 September 2026 (docs/ward-flow/owner-answers-2026-09-17.md): default 4
  // hours. Replaces the carried-over literal (`event.now + 60`) that predated this constant, with
  // no clinician or owner attribution — see the constant's own doc comment in ward-model.ts.
  PULL_HOLD_MINUTES: "owner answer 35, 17 September 2026 (docs/ward-flow/owner-answers-2026-09-17.md): default 4 hours",

  // Task 5-wiring, 2026-09-16: the slider range around PULL_HOLD_MINUTES above. Not a statutory or
  // clinical range — a coordinator-usable band around the carried-over default.
  PULL_HOLD_RANGE_MINUTES:
    "coordinator-usable slider band around PULL_HOLD_MINUTES — not statutory, not independently sourced",

  // Product owner, 2026-08-30, ruling `FD-19` in `docs/ward-flow-ledger.md`: "a ward→ED-medical
  // trip frees the bed ONLY IF the stay is expected to exceed 48 hours, and that is overridable".
  //
  // ⚠️ THIS IS THE ONE ENTRY IN THIS LIST THAT IS A DURATION IN THE SAME UNITS A STATUTORY PERIOD
  // WOULD BE, so it is the one most likely to be mistaken for one. It is a BED-MANAGEMENT
  // THRESHOLD: it decides whether a bed stays assigned to somebody who is temporarily elsewhere,
  // and nothing else. It is barred from every surface `ED_ACCESS_TARGET_MINUTES` is barred from —
  // no `LegalForm`, no `dueAt`, no breach count, no eligibility gate — and
  // `tests/ward-bed-release-threshold-provenance.test.ts` enforces that separation rather than
  // leaving it to this comment.
  //
  // It is permitted because the OWNER SUPPLIED IT. The standing refusal is against inventing
  // figures from the Mental Health Act; this is his own service figure, quoted from him.
  ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS:
    "product owner, 2026-08-30, ruling FD-19 — bed-management threshold deciding whether a bed " +
    "stays assigned during a general-hospital trip; NOT a statutory period, and pinned apart " +
    "from every legal surface by tests/ward-bed-release-threshold-provenance.test.ts",

  // The runtime mirror of the `urgency: 1 | 2 | 3` union that already existed on both `Movement`
  // and `Referral` before this constant was written; fix round C points both fields at
  // `UrgencyLevel` so widening the array widens the fields. The three tiers are the product
  // owner's own, and `operationalScore`'s doc comment (`ward-priority.ts`) records his
  // 2026-08-24 instruction that priority is urgency and waiting time alone. These are TIER
  // LABELS — three ordered categories a clinician picks between — and neither a duration nor a
  // quantity of anything: nothing in this codebase does arithmetic on them beyond comparing two
  // tiers to order a queue, and no minute, hour, day or bed count is derived from them.
  URGENCY_LEVELS: "product owner's own tiers, recorded at ward-priority.ts 2026-08-24 — tier labels, not a duration",

  // Owner answer, 25 September 2026 (decisions.md D-17): 09:30, adjustable 08:00 to 11:00, is
  // Josh's own ward-practice default for the morning roll-up, NOT a legal time limit. A clock time
  // in minutes from midnight, never attached to a `LegalForm`, a `dueAt` or a breach count.
  MORNING_ROLLUP_TIME_MINUTES:
    "product owner (Josh), 25 September 2026, decisions.md D-17 — his ward-practice default " +
    "morning roll-up time (09:30), not a Mental Health Act or other legal figure",
  MORNING_ROLLUP_TIME_RANGE_MINUTES:
    "product owner (Josh), 25 September 2026, decisions.md D-17 — the 08:00 to 11:00 band he " +
    "confirmed around MORNING_ROLLUP_TIME_MINUTES; not a legal figure",

  // ⚠️ NOBODY MEASURED THIS, AND THE PROVENANCE LINE SAYS SO RATHER THAN DRESSING IT UP.
  //
  // `REFERRAL_HISTORY_LIMITS` was `{ historyWhyNow: 1500, historyBackground: 2000,
  // historyRiskAndSafety: 1000 }` — three assistant-chosen placeholders — until the owner's ruling
  // of 2026-09-05 collapsed the three history boxes to ONE optional `history` field. The single
  // 2000 that remains is NOT a newly authored figure: it is the LARGEST of the three superseded
  // placeholders, kept rather than re-derived, so a value nobody measured stays exactly as
  // generous as the most generous of the three it replaced. No real referral was measured against
  // any of them and no clinician set them. The owner was told they are unmeasured, in those words,
  // and it is his number to set.
  //
  // It is a COUNT OF CHARACTERS IN A TEXT BOX. Not a duration, not a deadline, not a quantity of
  // anything clinical, and nothing is derived from it beyond refusing to send an over-long field
  // — see `Referral.history`, which forbids anything at all being derived from the text. This
  // guard exists because a fabricated statutory figure once reached the model; a character limit
  // is the opposite kind of number, and saying which kind it is, is the whole job of this line.
  REFERRAL_HISTORY_LIMITS:
    "assistant's placeholder, 2026-09-05 — 2000 is the largest of the three superseded per-field " +
    "placeholders (1500/2000/1000), kept rather than re-derived when the owner's same-day ruling " +
    "collapsed three history boxes to one; owner told it is unmeasured — a character count in a " +
    "text box, not a duration",
};

/**
 * True when a subtree contains a numeric literal ANYWHERE. Read structurally from the AST, so the
 * trigger does not depend on the declaration's NAME at all, and not on its shape either.
 *
 * Both narrower rules this replaced were defeated by a reviewer. Keying on the name was defeated
 * by `FORM_1A_REFERRAL_CLOCK = 7 * 24 * 60` — the deleted fabrication's exact value, carrying no
 * duration-unit token. Keying on "the initializer IS a number" was then defeated by three shapes
 * that merely CONTAIN one: an object (`{ minutes: 7 * 24 * 60 }`), an arrow function
 * (`(): number => 7 * 24 * 60`), and an enum member (`Window = 10080`). Containment is the widest
 * honest rule available here, and it is the one in force.
 */
function containsNumericLiteral(node: ts.Node): boolean {
  if (ts.isNumericLiteral(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsNumericLiteral(child)) found = true;
  });
  return found;
}

/**
 * Exported constant names declared in one file, read from the AST — never from a regular
 * expression, and never from a substring search that a quote or a comment could fool. Only
 * `export const NAME = …` declarations are collected, which is exactly the shape a written-down
 * figure takes. `numericOnly` narrows to declarations whose initializer is a number written into
 * the source, which is the allowlist's trigger.
 */
function exportedDeclarationNames(source: ts.SourceFile, numericOnly = false): string[] {
  const names: string[] = [];
  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);

  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        if (numericOnly && !(declaration.initializer && containsNumericLiteral(declaration.initializer))) continue;
        names.push(declaration.name.text);
      }
    }
    // An exported enum is a declaration of numbers by another name, and was one of the three
    // shapes that defeated the previous rule.
    if (ts.isEnumDeclaration(node) && isExported(node)) {
      if (!numericOnly || containsNumericLiteral(node)) names.push(node.name.text);
    }
    // An exported function whose body writes a number down is the same thing wearing a hat.
    if (ts.isFunctionDeclaration(node) && isExported(node) && node.name) {
      if (!numericOnly || containsNumericLiteral(node)) names.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function exportedNamesInFile(path: string, numericOnly = false): string[] {
  return exportedDeclarationNames(
    ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    numericOnly,
  );
}

/**
 * SCREAMING_SNAKE_CASE — the shape a written-down figure takes in this codebase. See the header
 * for why camelCase readers are deliberately excluded and what that costs.
 */
function isConstantName(identifier: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(identifier);
}

function tokenise(identifier: string): string[] {
  return identifier
    .split("_")
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" "))
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase());
}

/**
 * True when an identifier names a legal concept AND a duration — the shape every one of the
 * three fabrications took (`FORM_1A_REFERRAL_EXPIRY_MINUTES` and its predecessors).
 */
function namesALegalDuration(identifier: string): boolean {
  const tokens = tokenise(identifier);
  return tokens.some((token) => LEGAL_TOKENS.has(token)) && tokens.some((token) => DURATION_TOKENS.has(token));
}

/**
 * The unconditional shapes the brief names for `ward-model.ts`: any `*_EXPIRY_MINUTES` or
 * `*_DEADLINE_*` identifier is banned there whether or not it also names a legal concept,
 * because that file is the model's own vocabulary and a bare `EXPIRY_MINUTES` there would be
 * read as statutory by the next author regardless of what it is called.
 */
function namesABannedModelShape(identifier: string): boolean {
  const upper = identifier.toUpperCase();
  return upper.endsWith("_EXPIRY_MINUTES") || upper.includes("_DEADLINE_") || upper.endsWith("_DEADLINE");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

type ScannedFile = { path: string; identifiers: string[] };

/**
 * Every identifier the TypeScript parser sees in a file — declarations, references and imports
 * alike, so importing a banned name from elsewhere is caught as well as declaring one here.
 * Identifiers are collected into an array of the matched names themselves; nothing in this file
 * counts loop iterations and calls that a result.
 */
function scanWardFiles(): ScannedFile[] {
  return walk(WARD_DIR)
    .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
    .map((path) => {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const identifiers: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node)) identifiers.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      return { path, identifiers };
    });
}

/**
 * Every name DECLARED as a `const`/`let`/`var` binding or an `enum` member in one file — never a
 * reference, an object property key, or a type discriminant. T2r fix round, finding 9 (2026-09-17):
 * what the ward-model/Part-3 token denylist's `ALL_EVENT_TYPES` exemption relies on being empty of
 * overlap — see that exemption's own comment for why a declaration sharing an event type's name
 * would be the exact shape of fabrication the exemption must not hide.
 *
 * Only plain `Identifier` binding names are collected — a destructuring pattern
 * (`const { a, b } = x`) binds names that are not the shape a fabricated numeric constant takes
 * here, and this repository's own fabrications have always been `export const NAME = <number>`.
 */
function declaredValueNamesIn(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) names.push(node.name.text);
    if (ts.isEnumMember(node) && ts.isIdentifier(node.name)) names.push(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** Every `LegalForm` reachable at runtime, tagged with where it came from. */
function collectLegalForms(): { source: string; movementId: string; form: LegalForm }[] {
  const collected: { source: string; movementId: string; form: LegalForm }[] = [];

  for (const movement of wardMovements) {
    if (movement.legalForm) collected.push({ source: "fixture", movementId: movement.id, form: movement.legalForm });
  }

  const seeded = seedWardFlowState();
  for (const movement of seeded.movements) {
    if (movement.legalForm)
      collected.push({ source: "seeded state", movementId: movement.id, form: movement.legalForm });
  }

  // RAISE_REFERRAL is now the ONLY reducer path that authors a legal form, and it authors
  // whichever code the clinician chose — so every selectable code is driven through it here,
  // not just the two the deleted status derivation used to produce. A fabricated `dueAt` would
  // have to be applied either in the list itself or in this branch.
  const legalStatus: LegalStatus = "Referred for psychiatric examination";
  for (const selectable of SELECTABLE_LEGAL_FORMS) {
    const referred = wardFlowReducer(seeded, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus,
        urgency: 2,
        legalFormCode: selectable.code,
      },
    });
    const raised = referred.movements.at(-1)!;
    if (raised.legalForm) collected.push({ source: "RAISE_REFERRAL", movementId: raised.id, form: raised.legalForm });

    // RECORD_EXAMINATION no longer AUTHORS a form — since 2026-08-24 it leaves the form exactly
    // as the clinician set it, in every outcome. So this is no longer a fourth authoring site;
    // it is collected as the form a movement still carries AFTER being examined, which is the
    // surface a post-examination `dueAt` would now have to appear on. `after RECORD_EXAMINATION`
    // is named that way rather than left as `RECORD_EXAMINATION` so no later reader mistakes it
    // for an authoring path.
    const examined = wardFlowReducer(referred, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: raised.id,
      outcome: "inpatient_order",
    });
    const afterExamination = examined.movements.find((movement) => movement.id === raised.id);
    if (afterExamination?.legalForm)
      collected.push({
        source: "after RECORD_EXAMINATION",
        movementId: raised.id,
        form: afterExamination.legalForm,
      });
  }

  return collected;
}

describe("Mental Health Act figures cannot return to the ward model", () => {
  /**
   * 🔴 **CORRECTED 2026-09-17, T2 — THIS CASE'S TITLE AND RULE USED TO BE "no Form 1A and no Form
   * 3B a dueAt", CHECKED AGAINST A CODE ALLOWLIST.** Owner answer 1, 2026-09-17, makes a real
   * typed `dueAt` on a 1A or 3B correct rather than forbidden — `collectLegalForms()` below never
   * supplies one, on purpose, precisely so this case can still ask its real question: does ANY
   * reducer path invent a `dueAt` out of nothing? None of the four sources this function drives
   * ever types an expiry, so a `dueAt` appearing on ANY of them, of ANY code, is a fabrication —
   * the same conclusion the old code-keyed rule reached for 1A/3B specifically, now reached
   * uniformly and for the right reason.
   */
  it("invents no dueAt on any form, of any code, when no caller ever supplied one", () => {
    const collected = collectLegalForms();

    // Non-vacuity, per source and per code: this test must fail if it ever inspects nothing,
    // or if one of the four sources silently stopped producing a form. Asserting only a total
    // would let a reducer path that returned `undefined` forever pass unnoticed.
    expect(collected.length).toBeGreaterThan(0);
    for (const source of ["fixture", "seeded state", "RAISE_REFERRAL", "after RECORD_EXAMINATION"]) {
      expect(
        collected.filter((entry) => entry.source === source).length,
        `no legal form was collected from ${source}`,
      ).toBeGreaterThan(0);
    }
    for (const code of SWEEP_CODES) {
      expect(
        collected.filter((entry) => entry.form.code === code).length,
        `no Form ${code} was inspected — this guard would pass vacuously`,
      ).toBeGreaterThan(0);
    }

    // "fixture" and "seeded state" legitimately carry authored `dueAt` values (the four seeded
    // 4A/4C deadlines) — a fabrication check has to exclude the population that is SUPPOSED to
    // carry one. "RAISE_REFERRAL" and "after RECORD_EXAMINATION" never supply a `legalFormDueAt`
    // here (see `collectLegalForms`'s own construction above), so a `dueAt` on either of those two
    // sources, of ANY code, is exactly the fabrication this file exists to catch.
    const offenders = collected
      .filter(
        (entry) =>
          (entry.source === "RAISE_REFERRAL" || entry.source === "after RECORD_EXAMINATION") &&
          entry.form.dueAt !== undefined,
      )
      .map((entry) => `${entry.source}:${entry.movementId} (Form ${entry.form.code}, dueAt ${entry.form.dueAt})`);
    expect(offenders).toEqual([]);
  });

  /*
   * The dueAt provenance sweep ("every dueAt the sweep produces, of any code, through any event,
   * traces to a value this file supplied") now lives in `helpers/ward-legal-figure-sweep.ts` and
   * runs from `ward-legal-figure-guard-sweep-1..4.test.ts`, split by form code so the same checks
   * run in parallel. Nothing it checks was removed.
   */

  /**
   * 🔴 **REPLACED 2026-09-17, T2 — THIS CASE USED TO PIN `DEADLINE_BEARING_FORM_PROVENANCE`, THE
   * CODE ALLOWLIST DELETED BY THIS TASK.** Its purpose survives: proving the gate `offendingFormsIn`
   * applies is a real discriminator in both directions, so it cannot be silently inert (recognising
   * every value) or absurd (recognising none). What discriminates is now VALUE PROVENANCE, never
   * the form's code — proven here on TWO forms sharing the SAME code, one carrying a value this
   * file supplied and one carrying a value it never asked for, so a reader cannot mistake this for
   * a code check in disguise.
   */
  it("flags a dueAt VALUE this file never supplied, and passes one it did — on the same code, either way", () => {
    // `suppliedDueAt` really registers what it is given, so a value nothing ever called it with is
    // a genuine negative below rather than an accident of an already-populated set.
    const freshlySupplied = suppliedDueAt(NOW_ANCHOR + 777_000);
    expect(KNOWN_DUE_AT_VALUES.has(freshlySupplied)).toBe(true);

    // A value this file has definitely never supplied or authored — chosen far outside every
    // sentinel offset this file uses (700_000+) and every plausible fixture instant.
    const neverSupplied = NOW_ANCHOR - 999_999_999;
    expect(KNOWN_DUE_AT_VALUES.has(neverSupplied), "the probe value collided with a real one").toBe(false);

    const seeded = seedWardFlowState();
    const withForms: WardFlowState = {
      ...seeded,
      movements: [
        {
          ...seeded.movements[0],
          id: "WF-PROBE-KNOWN",
          legalForm: { code: "1A", kind: "examination", dueAt: freshlySupplied },
        },
        {
          ...seeded.movements[0],
          id: "WF-PROBE-UNKNOWN",
          // Same code as the movement above — proves the gate reads the VALUE, not the code.
          legalForm: { code: "1A", kind: "examination", dueAt: neverSupplied },
        },
      ],
    };
    const flagged = offendingFormsIn(withForms, "probe");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toContain("WF-PROBE-UNKNOWN");
    expect(flagged[0]).not.toContain("WF-PROBE-KNOWN");
  });

  /**
   * T2r fix round, finding 5 (2026-09-17). `AUTHORED_FIXTURE_DUE_AT` replaced a fixture-WIDE
   * allowance (any seeded `dueAt`, on any movement) with a per-MOVEMENT one, precisely because the
   * wide version could not tell a genuine authored value from one "laundered" onto a different
   * movement. This proves that gap is closed: `WF-004`'s own authored value passes on `WF-004`, and
   * the SAME value, moved onto a movement that does not own it, is flagged.
   */
  it("recognises an authored fixture dueAt only on the movement id that owns it — finding 5", () => {
    const own = AUTHORED_FIXTURE_DUE_AT["WF-004"];
    expect(own, "precondition: WF-004 must have a pinned authored value").toBeDefined();

    const seeded = seedWardFlowState();
    const wf004 = seeded.movements.find((movement) => movement.id === "WF-004");
    expect(wf004?.legalForm?.dueAt, "precondition: the real WF-004 must carry its pinned value").toBe(own);
    expect(offendingFormsIn(seeded, "seeded"), "the real WF-004 must not be flagged").toEqual([]);

    const withLaunderedValue: WardFlowState = {
      ...seeded,
      movements: [
        {
          ...seeded.movements[0],
          id: "WF-PROBE-LAUNDERED",
          // WF-004's own authored figure, on a movement that is not WF-004.
          legalForm: { code: "4C", kind: "transfer", dueAt: own! },
        },
      ],
    };
    const flagged = offendingFormsIn(withLaunderedValue, "laundered");
    expect(flagged, "a movement wearing a DIFFERENT movement's authored value must be flagged").toHaveLength(1);
    expect(flagged[0]).toContain("WF-PROBE-LAUNDERED");
  });

  /**
   * T2r fix round, finding 2 (2026-09-17). `offendingFormsIn` also flags a movement whose
   * `legalForm.dueAt` disagrees with the LAST entry of its own `legalFormExpiryHistory`, once that
   * history exists — the check that closed the gap where `RAISE_REFERRAL`'s own capture could set
   * `dueAt` without writing a matching history entry at all.
   */
  it("flags a movement whose dueAt disagrees with the last history entry — finding 2", () => {
    const seeded = seedWardFlowState();
    const consistent: WardFlowState = {
      ...seeded,
      movements: [
        {
          ...seeded.movements[0],
          id: "WF-PROBE-CONSISTENT",
          legalForm: { code: "4A", kind: "transport", dueAt: suppliedDueAt(NOW_ANCHOR + 778_000) },
          legalFormExpiryHistory: [
            { at: NOW_ANCHOR, by: "ed", dueAt: suppliedDueAt(NOW_ANCHOR + 778_000), basis: "written_on_form" },
          ],
        },
      ],
    };
    expect(offendingFormsIn(consistent, "consistent"), "dueAt equals the last history entry — no offence").toEqual([]);

    const mismatched: WardFlowState = {
      ...seeded,
      movements: [
        {
          ...seeded.movements[0],
          id: "WF-PROBE-MISMATCHED",
          legalForm: { code: "4A", kind: "transport", dueAt: suppliedDueAt(NOW_ANCHOR + 779_000) },
          // The history's last entry does NOT match legalForm.dueAt — exactly the shape a capture
          // path that sets `dueAt` without appending a matching history entry would produce.
          legalFormExpiryHistory: [
            { at: NOW_ANCHOR, by: "ed", dueAt: suppliedDueAt(NOW_ANCHOR + 778_000), basis: "written_on_form" },
          ],
        },
      ],
    };
    const flagged = offendingFormsIn(mismatched, "mismatched");
    expect(flagged, "dueAt disagreeing with the last history entry must be flagged").toHaveLength(1);
    expect(flagged[0]).toContain("WF-PROBE-MISMATCHED");
  });

  it("records provenance for every exported declaration in the model files that writes a number down", () => {
    const modelPath = `${WARD_DIR}/ward-model.ts`;
    const formsPath = `${WARD_DIR}/ward-legal-forms.ts`;
    const registerPath = "src/lib/form-register.ts";

    /**
     * Every module that may hold Mental Health Act content reachable from the ward surfaces. The
     * rule follows the DECLARATIONS, not a filename, and it has had to move twice:
     *
     *  - `ward-legal-forms.ts` was added when the selectable-form list left `ward-model.ts` (the
     *    ED-access-target quarantine in tests/ward-flow-single-source.test.ts fired, correctly);
     *  - `src/lib/form-register.ts` was added when the official-title register was split out of
     *    `form-catalog.ts` so a client bundle could read a title without its JSON. That split put
     *    a ward-reachable module holding Act content OUTSIDE `WARD_DIR`, where nothing scanned
     *    it: `export const FORM_1A_REFERRAL_EXPIRY_MINUTES = 7 * 24 * 60;` appended there left
     *    this file and ward-flow-single-source green at 18 passed.
     *
     * Titles are what the register legitimately holds. A numeric duration constant is not, and
     * this is the check that says so. A new module of this kind belongs on this list on the day
     * it is created.
     */
    const PROVENANCE_SCANNED_FILES = [modelPath, formsPath, registerPath];

    const numericExported = PROVENANCE_SCANNED_FILES.flatMap((path) => exportedNamesInFile(path, true));

    // Non-vacuity per file: each one is really being read, not silently skipped — a mistyped path
    // would otherwise contribute nothing and this whole scan would narrow without failing.
    for (const [path, sentinel] of [
      [modelPath, "MOVEMENT_STAGES"],
      [formsPath, "SELECTABLE_LEGAL_FORMS"],
      [registerPath, "formTitleForCode"],
    ] as const) {
      expect(exportedNamesInFile(path), `exportedNamesInFile read nothing from ${path}`).toContain(sentinel);
    }

    // …and neither of the two non-numeric sentinels is itself flagged, so they are not merely
    // allowlisted into silence.
    expect(exportedNamesInFile(formsPath, true), "SELECTABLE_LEGAL_FORMS writes a number down").not.toContain(
      "SELECTABLE_LEGAL_FORMS",
    );
    expect(exportedNamesInFile(registerPath, true), "formTitleForCode writes a number down").not.toContain(
      "formTitleForCode",
    );

    // Non-vacuity 1: the AST really read the file, and really distinguishes declarations that
    // write a number from those that do not. `MOVEMENT_STAGES` and `DECLINE_REASONS` are exported
    // string arrays and must be excluded; the two numeric constants must be included. If the
    // containment rule ever matched nothing, the offender list below would be empty for the wrong
    // reason, and these assertions are what catch that.
    expect(numericExported, "MOVEMENT_STAGES is an array of strings").not.toContain("MOVEMENT_STAGES");
    expect(numericExported, "DECLINE_REASONS is an array of strings").not.toContain("DECLINE_REASONS");
    expect(numericExported).toContain("ED_ACCESS_TARGET_MINUTES");
    expect(numericExported).toContain("PARALLEL_REFERRAL_CAP");
    expect(numericExported).toContain("PULL_HOLD_MINUTES");

    /** Names the rule would demand provenance for, in a snippet of source. */
    const flaggedIn = (source: string): string[] =>
      exportedDeclarationNames(ts.createSourceFile("probe.ts", source, ts.ScriptTarget.Latest, true), true);

    // Non-vacuity 2: every shape that has defeated a previous version of this rule is caught.
    // The first five defeated the NAME-based rules; the last three defeated the "initializer IS a
    // number" rule by merely CONTAINING one. All eight are real reviewer bypasses, not inventions.
    for (const [label, snippet] of [
      ["denylist bypass: expiry-minutes", "export const FORM_1A_REFERRAL_EXPIRY_MINUTES = 7 * 24 * 60;"],
      ["denylist bypass: assessment window", "export const ASSESSMENT_WINDOW_MINUTES = 24 * 60;"],
      ["denylist bypass: involuntary order", "export const INVOLUNTARY_ORDER_HOURS = 72;"],
      ["denylist bypass: section review", "export const SECTION_REVIEW_DAYS = 7;"],
      ["name-rule bypass: no unit token", "export const FORM_1A_REFERRAL_CLOCK = 7 * 24 * 60;"],
      ["shape bypass: object", "export const REFERRAL_CLOCK_SPEC = { minutes: 7 * 24 * 60 };"],
      ["shape bypass: arrow function", "export const referralClockMinutes = (): number => 7 * 24 * 60;"],
      ["shape bypass: enum", "export enum ReferralClock { Window = 10080 }"],
    ] as const) {
      expect(flaggedIn(snippet), `${label} would not be flagged`).toHaveLength(1);
    }

    // Non-vacuity 3: the rule is not simply "flag every export". A declaration that writes no
    // number down is not flagged, in each of the same shapes — otherwise the rule would be
    // useless noise and would be disabled on its first false positive.
    expect(flaggedIn('export const DECLINE_REASONS = ["no_bed"] as const;')).toEqual([]);
    expect(flaggedIn('export const SHAPE = { label: "text" };')).toEqual([]);
    expect(flaggedIn("export const describeForm = (code: string): string => `Form ${code}`;")).toEqual([]);
    expect(flaggedIn('export enum Kind { Examination = "examination" }')).toEqual([]);
    // A non-exported declaration is out of scope, and the limits section says so.
    expect(flaggedIn("const PRIVATE_CLOCK = 7 * 24 * 60;")).toEqual([]);

    // Every allowlist entry carries a non-trivial provenance line, so an entry cannot be added as
    // a bare name to silence the guard.
    for (const [name, provenance] of Object.entries(MODEL_CONSTANT_PROVENANCE)) {
      expect(provenance.length, `${name}'s provenance line is too short to be a real record`).toBeGreaterThan(20);
    }

    // The allowlist must not rot: an entry for a declaration that no longer exists is dead weight
    // that would silently re-admit the name later.
    for (const name of Object.keys(MODEL_CONSTANT_PROVENANCE)) {
      expect(numericExported, `${name} is allowlisted but no longer writes a number down`).toContain(name);
    }

    const offenders = numericExported.filter((name) => !(name in MODEL_CONSTANT_PROVENANCE));
    expect(offenders).toEqual([]);
  });

  // Fix wave 1, finding 5, re-pointed 2026-08-24. Part 1 is complete only while it exercises
  // every place a legal form is authored. That set MOVED: the reducer used to build a 1A in
  // RAISE_REFERRAL and a 3B in RECORD_EXAMINATION, and now builds neither — it attaches whatever
  // the clinician chose from `SELECTABLE_LEGAL_FORMS`. So this pins two things at once, and the
  // first is strictly stronger than what it replaced:
  //
  //   1. the reducer authors NO legal-form literal of its own any more, so it cannot stamp a
  //      fabricated code or `dueAt` on a movement at all; and
  //   2. the declared list Part 1 drives is exactly these codes, in this order, so adding a code
  //      to the picker fails here until Part 1 is driving it too.
  it("pins where legal forms are authored, so Part 1 cannot silently miss one", () => {
    const reducerPath = `${WARD_DIR}/ward-flow-reducer.ts`;
    const source = ts.createSourceFile(
      reducerPath,
      readFileSync(reducerPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // An authored legal form is an object literal carrying a `code:` string. Read from the AST,
    // so a `code` mentioned in a comment or a string cannot inflate or hide the count.
    const authoredCodesIn = (file: ts.SourceFile): string[] => {
      const codes: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isObjectLiteralExpression(node)) {
          for (const property of node.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "code" &&
              ts.isStringLiteral(property.initializer)
            ) {
              codes.push(property.initializer.text);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      return codes;
    };

    const formsPath = `${WARD_DIR}/ward-legal-forms.ts`;
    const formsSource = ts.createSourceFile(
      formsPath,
      readFileSync(formsPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // Non-vacuity: the walk really reads `code:` literals rather than returning an empty list for
    // any file handed to it. Proven on the file that HAS them, so the reducer's empty result
    // below is a fact about the reducer and not a broken walk.
    expect(
      authoredCodesIn(formsSource).length,
      "no legal-form literal was found in ward-legal-forms.ts",
    ).toBeGreaterThan(0);

    // 1. The reducer authors none. A single `code:` literal reappearing here means a branch has
    //    started deciding a patient's form again, which is the whole thing 2026-08-24 removed.
    expect(authoredCodesIn(source), "the reducer authors a legal form again").toEqual([]);

    // 2. The declared list, in source order. Adding a code fails here until Part 1 drives it.
    expect(authoredCodesIn(formsSource)).toEqual(["1A", "3A", "3B", "3D", "4A", "4C", "5A", "6A"]);
    expect(SELECTABLE_LEGAL_FORMS.map((form) => form.code)).toEqual(["1A", "3A", "3B", "3D", "4A", "4C", "5A", "6A"]);

    // 3. NO entry carries a title. Since 2026-08-24 titles come from the Chief Psychiatrist's
    //    register at render time, and a stored one is exactly how "Inpatient treatment order" —
    //    the title of a Form 6A — came to be printed on every Form 3B. `label` is gone from the
    //    type, so this reads the runtime object: any key beyond `code`/`kind`/`dueAt` fails.
    for (const form of SELECTABLE_LEGAL_FORMS) {
      expect(
        Object.keys(form).filter((key) => !["code", "kind", "dueAt"].includes(key)),
        `Form ${form.code} carries a field this model may not hold`,
      ).toEqual([]);
    }

    // 4. Form 3D carries no classification. This model holds none for a 3D, and the register's
    //    categories were explicitly not adopted, so inventing one here is barred.
    const form3D = SELECTABLE_LEGAL_FORMS.find((form) => form.code === "3D");
    expect(form3D, "Form 3D is no longer offered").toBeDefined();
    expect(form3D!.kind, "a classification was invented for Form 3D").toBeUndefined();

    // 5. Non-vacuity for 4: the absence above is a property of 3D, not of every entry.
    expect(SELECTABLE_LEGAL_FORMS.filter((form) => form.kind !== undefined).map((form) => form.code)).toEqual([
      "1A",
      "3A",
      "3B",
      "4A",
      "4C",
    ]);

    // 5. No offered form carries a deadline. Forms record that they exist, never when they lapse.
    expect(SELECTABLE_LEGAL_FORMS.filter((form) => form.dueAt !== undefined)).toEqual([]);
  });

  /**
   * Fix wave 1, findings 6 and 7 — the rendered legal wording.
   *
   * Both renderers are `"use client"` components whose helpers are not exported, so a unit test
   * cannot call them; the only behavioural coverage is Playwright, which this task may not run.
   * This reads the STRING LITERALS from the AST instead — which is strictly better than a text
   * search for this job, because comments are not string literals, so the paragraphs in those two
   * files that *discuss* the rejected wording cannot satisfy or trip the check.
   *
   * WHAT THIS CANNOT SEE: it proves the literal exists in the module, not that any code path
   * reaches it or that a user sees it. It would not catch the branch being made unreachable. That
   * is a real limit and Playwright remains the only thing that closes it.
   */
  it("renders absence as 'no deadline recorded', never as a claim about the Act", () => {
    const renderers = [
      `${WARD_DIR}/movements/movement-workspace-derivations.ts`,
      `${WARD_DIR}/coordinator/shortlist-panel.tsx`,
    ];
    const cockpit = readFileSync(`${WARD_DIR}/movements/movement-workspace-cockpit.tsx`, "utf8");
    expect(cockpit).toContain('from "@/components/ward-management/movements/movement-workspace-derivations"');
    expect(cockpit).toContain("legalFormReadinessLine(patient.legalForm, now)");
    const recordedWithoutDeadline = wardMovements
      .flatMap((movement) => (movement.legalForm ? [movement.legalForm] : []))
      .find((form) => form.dueAt === undefined);
    expect(recordedWithoutDeadline, "the legal absence fixture must exist").toBeDefined();
    if (!recordedWithoutDeadline) throw new Error("No legal absence fixture");
    expect(legalFormReadinessLine(recordedWithoutDeadline, NOW_ANCHOR)).toContain("no deadline recorded");
    expect(legalFormReadinessLine(recordedWithoutDeadline, NOW_ANCHOR)).not.toContain("no statutory deadline");

    for (const path of renderers) {
      const literals = literalsIn(path);

      // Non-vacuity: the parse really produced literals for this file.
      expect(literals.length, `no string literal was read from ${path}`).toBeGreaterThan(0);

      // The wording states what the record holds, not what the legislation requires. Asserting an
      // absence in the Act is the same overreach as asserting the deleted seven-day figure.
      expect(
        literals.some((literal) => literal.includes("no deadline recorded")),
        `${path} no longer renders "no deadline recorded"`,
      ).toBe(true);
      expect(
        literals.filter((literal) => literal.includes("no statutory deadline")),
        `${path} renders a claim about what the Mental Health Act requires`,
      ).toEqual([]);
    }

    // Fix wave 1, item 2 — the same overreach in a second place, and this one was on the DEFAULT
    // path once the picker started defaulting to no form: renderers printed "No legal form
    // required", which asserts what the Mental Health Act REQUIRES of this patient. "Recorded"
    // reports what the record holds, which is all this prototype can verify. Scanned across every
    // ward file, not just the renderers above, because the wording was duplicated across several.
    //
    // **BROADENED 2026-08-24, and the narrowness was itself the defect.** This matched the exact
    // string `legal form required`: case-sensitive, and requiring the word "legal". Two surfaces
    // stood while it read green — `ward-management-console.tsx`'s "No Mental Health Act transport
    // form required" (28 lines below a line this same change had already fixed, on the production
    // patient route, and the DEFAULT rendering for every referral raised with the picker left
    // alone) and `officer-screen.tsx`'s `<dt>Legal form required</dt>`, whose value had been
    // corrected to "No transport form recorded" while its own label still said "required".
    // Lower-casing and dropping the "legal" requirement is what sees both.
    //
    // STATED LIMIT: unlike the two literal checks above, this is a RAW TEXT scan, so a comment
    // that quotes the rejected wording trips it exactly as a live string would. That is the
    // fail-safe direction — a false positive costs a rewording, a false negative shipped the
    // claim — and it is why the comments at both fixed sites describe the old wording rather
    // than quoting it. Do not "fix" this by matching AST string literals only: a JSX text node
    // and a `<dt>` label are both claims, and the sibling deadline check above already shows how
    // easily a literal-only scan misses one.
    const wardFilesScanned = scanWardFiles();
    expect(wardFilesScanned.length, "no ward file was scanned").toBeGreaterThan(0);
    const requiredOffenders = wardFilesScanned
      .filter((file) => readFileSync(file.path, "utf8").toLowerCase().includes("form required"))
      .map((file) => file.path);
    expect(requiredOffenders, "a ward surface claims a form is or is not REQUIRED").toEqual([]);

    // Non-vacuity: the replacement wording really is present, so the check above cannot pass by
    // the whole phrase having been deleted rather than corrected.
    const recordedCarriers = wardFilesScanned
      .filter((file) => readFileSync(file.path, "utf8").includes("No legal form recorded"))
      .map((file) => file.path.replaceAll("\\", "/"));
    // ⚠️ `ward-management-modes.tsx` LEFT THIS LIST ON 2026-09-06, AND IT IS AN ANCHOR LIST RATHER
    // THAN A PER-FILE REQUIREMENT. Its purpose is stated above: prove the replacement wording is
    // really present, so the "form required" absence check cannot pass by the whole phrase having
    // been deleted. The file no longer says "No legal form recorded" because the five views that
    // said it — QueueView, CapacityView, MovementsView, ExceptionsView, TransportView — were
    // deleted, having been folded into CapacityScreen/MovementsScreen/DelaysScreen by MERGE 01-03
    // and rendered by no route since. **The clinical property is not lost: four carriers remain,
    // measured on the day, and they are the surfaces a coordinator actually reads.** Four anchors
    // hold the non-vacuity argument as well as five did.
    for (const expected of [
      `${WARD_DIR}/movements/movement-workspace-cockpit.tsx`,
      `${WARD_DIR}/ward-management-network.tsx`,
      `${WARD_DIR}/coordinator/shortlist-panel.tsx`,
      `${WARD_DIR}/ed/ed-screen.tsx`,
    ]) {
      expect(recordedCarriers, `${expected} no longer says "No legal form recorded"`).toContain(expected);
    }

    // Finding 7: the breach line must still exist in the shortlist renderer. Before this, the only
    // test mentioning the string was a whole-page ABSENCE assertion, which deleting the string
    // makes MORE likely to pass. (Its counterpart in ward-priority.ts is pinned behaviourally in
    // tests/ward-priority.test.ts, which is the stronger proof of the two.)
    expect(
      literalsIn(`${WARD_DIR}/coordinator/shortlist-panel.tsx`).some((literal) =>
        literal.includes("passed its deadline"),
      ),
      "the shortlist breach line was deleted or renamed",
    ).toBe(true);
  });

  // PART 3 — the wider but INCOMPLETE token denylist. Green here proves nothing on its own; see
  // the file header's bypass table. Part 2 above is the fail-closed check.
  it("trips the wider token denylist on no identifier under the ward directory (incomplete net)", () => {
    const files = scanWardFiles();

    // Non-vacuity 1 — the walk is recursive and really reached the subdirectories. Naming the
    // files rather than counting them is what stops a walk that silently stopped at the top
    // level from passing: a guard that "walked only one directory" is a defect this repository
    // has already shipped once.
    const scannedPaths = files.map((file) => file.path.replaceAll("\\", "/"));
    for (const expected of [
      `${WARD_DIR}/ward-model.ts`,
      `${WARD_DIR}/ward-movements.ts`,
      `${WARD_DIR}/ward-flow-reducer.ts`,
      `${WARD_DIR}/coordinator/priority-queue.tsx`,
      `${WARD_DIR}/coordinator/shortlist-panel.tsx`,
      `${WARD_DIR}/ed/ed-screen.tsx`,
      `${WARD_DIR}/officer/officer-screen.tsx`,
      `${WARD_DIR}/tracker/live-tracker.tsx`,
      `${WARD_DIR}/ward/ward-screen.tsx`,
    ]) {
      expect(scannedPaths, `${expected} was never scanned`).toContain(expected);
    }

    // Non-vacuity 2 — parsing actually produced identifiers. If `ts.createSourceFile` ever
    // returned an empty tree (a changed API, a parse failure swallowed, a wrong ScriptKind),
    // every rule below would pass on nothing. These two sentinels are real constants in this
    // directory, so their absence means the scan itself is broken, not that the code is clean.
    const allIdentifiers = new Set(files.flatMap((file) => file.identifiers));
    expect(allIdentifiers, "the AST scan produced no identifiers").toContain("ED_ACCESS_TARGET_MINUTES");
    expect(allIdentifiers, "the AST scan produced no identifiers").toContain("PARALLEL_REFERRAL_CAP");

    // Non-vacuity 3 — the predicates themselves discriminate. A rule that can never match is
    // the "check that cannot fail" shape; a rule that matches everything would be disabled on
    // its first false positive. Both directions are pinned here against real names.
    expect(namesALegalDuration("FORM_1A_REFERRAL_EXPIRY_MINUTES")).toBe(true);
    expect(namesALegalDuration("FORM_1A_SOMETHING_MINUTES")).toBe(true);
    expect(namesALegalDuration("STATUTORY_EXAMINATION_WINDOW_HOURS")).toBe(true);
    expect(namesALegalDuration("ED_ACCESS_TARGET_MINUTES")).toBe(false);
    expect(namesALegalDuration("PARALLEL_REFERRAL_CAP")).toBe(false);
    expect(namesALegalDuration("MINUTES_PER_DAY")).toBe(false);
    // Tokenisation is word-level, not substring: FORM inside FORMATTED must not match.
    expect(namesALegalDuration("formattedMinutes")).toBe(false);
    // The header calls this net INCOMPLETE. That is not a hedge, it is a measured fact, and this
    // is the assertion that keeps it honest: `FORM_1A_REFERRAL_CLOCK` names a form and a clock,
    // carried the deleted fabrication's exact value, and this predicate does not flag it. Part 2
    // is what catches it — in `ward-model.ts`, which is where it was declared. If someone ever
    // "fixes" this by adding CLOCK to the token list, this assertion fails and the header's claim
    // must be re-measured rather than quietly outgrown.
    expect(namesALegalDuration("FORM_1A_REFERRAL_CLOCK")).toBe(false);
    // The constant-name filter is what excludes the honest camelCase readers of the 4A/4C
    // deadlines; if it ever started matching them the guard would be disabled on its first
    // false positive, and if it stopped matching real constants the guard would be inert.
    expect(isConstantName("FORM_1A_REFERRAL_EXPIRY_MINUTES")).toBe(true);
    expect(isConstantName("ED_ACCESS_TARGET_MINUTES")).toBe(true);
    expect(isConstantName("legalDueAt")).toBe(false);
    expect(isConstantName("minutesLegalClock")).toBe(false);
    expect(namesABannedModelShape("SOME_EXPIRY_MINUTES")).toBe(true);
    expect(namesABannedModelShape("A_DEADLINE_B")).toBe(true);
    expect(namesABannedModelShape("ED_ACCESS_TARGET_MINUTES")).toBe(false);

    // 🔴 DELETED 2026-09-17, T2: `ALLOWED_STATUTORY_CONSTANTS` stood here from Ruling 1
    // (2026-09-16) — `{"FORM_1A_VALIDITY_HOURS", "FORM_1A_EXAMINATION_WINDOW_HOURS",
    // "FORM_3D_DETENTION_WINDOW_HOURS"}`, so this token denylist would not trip on the three
    // names Part 2's own allowlist separately recorded provenance for. All three constants are
    // now DELETED from `ward-model.ts` (owner answer 1, 2026-09-17), so no allowlist entry is
    // needed to admit them: an identifier that does not exist cannot appear in `file.identifiers`
    // for this denylist to flag in the first place. Left as a struck record rather than removed
    // silently, so a reader who has seen this name cited elsewhere finds why it is gone.
    //
    // 🔴 **ADDED 2026-09-17, T2 — a narrow, SHAPE-derived exemption, not a hand-picked name list.**
    // `RECORD_LEGAL_FORM_EXPIRY` (`ward-flow-events.ts`, as an `EVENT_ROLE` object key) tokenises
    // to `LEGAL`, `FORM` (both `LEGAL_TOKENS`) and `EXPIRY` (`DURATION_TOKENS`), so it trips
    // `namesALegalDuration` exactly as a fabricated constant would — measured directly: this test
    // failed on that one identifier the moment the event was added, which is this comment's own
    // proof the check still bites. It is a false positive, not a bypass: an event-type NAME never
    // writes a number down; its value is a string discriminant, and as an `EVENT_ROLE` key its
    // value is an array of role strings. Excluded by checking membership in `ALL_EVENT_TYPES` —
    // the REAL declared union of `WardFlowEvent["type"]` values, derived from the same
    // `EVENT_ROLE` this test already imports, never a second hand-maintained list.
    //
    // 🔴 **T2r fix round, finding 9 (2026-09-17) — WHY THE EXEMPTION CANNOT HIDE A FABRICATION,
    // PROVEN RATHER THAN ARGUED.** The exemption admits an identifier by NAME alone, so the
    // argument above ("a future fabricated constant sharing that exact spelling would still have
    // to pass Part 2 or this check on every other file") is only as good as the fact that
    // `ALL_EVENT_TYPES` names are never themselves DECLARATIONS carrying a value — only reads
    // (object keys, discriminant tags). The assertion immediately below checks that directly: no
    // `ALL_EVENT_TYPES` name is ever the name of a `const`/`let`/`var` declaration or an `enum`
    // member anywhere this scan reaches. If one ever were, THAT declaration is exactly the shape a
    // real fabrication takes, and this assertion goes red rather than silently trusting the name.
    for (const file of files) {
      const declared = declaredValueNamesIn(file.path);
      const clash = declared.filter((name) => (ALL_EVENT_TYPES as readonly string[]).includes(name));
      expect(
        clash,
        `${file.path.replaceAll("\\", "/")} declares a variable or enum member named identically to an ` +
          "event type — the finding 9 exemption below would then also exempt THIS declaration, which is " +
          "exactly the hole it must not open",
      ).toEqual([]);
    }

    const offenders = files.flatMap((file) =>
      [...new Set(file.identifiers)]
        .filter(isConstantName)
        .filter((identifier) => !(ALL_EVENT_TYPES as readonly string[]).includes(identifier))
        .filter(
          (identifier) =>
            namesALegalDuration(identifier) ||
            (file.path.replaceAll("\\", "/") === `${WARD_DIR}/ward-model.ts` && namesABannedModelShape(identifier)),
        )
        .map((identifier) => `${file.path.replaceAll("\\", "/")}: ${identifier}`),
    );
    expect(offenders).toEqual([]);
  });
});

/**
 * 2026-09-14 — the SCREEN TEXT beside a legal form, which every guard above missed.
 *
 * The Patient search screen shipped "Form 1A (ED 24h)" and "Form 5A (Involuntary)" as a chip and as
 * dropdown options. Nothing above could see it: Part 3 collects identifiers, not string contents, and
 * the literal scans are pointed at named renderer files. This scans every string literal AND every
 * piece of JSX text in the scanned screens, because a dropdown option's words are JSX text, not a
 * string literal.
 *
 * The rule is narrow on purpose: a piece of screen text that names a form code carries no duration.
 * A duration beside a form code reads as a statutory clock, and this prototype invents none — the
 * 24-hour figure is the departmental ED access target (`ward-model.ts`), never a Mental Health Act
 * deadline. Typed 4A/4C due times are rendered from data elsewhere and are not in these files.
 *
 * 🔴 **WIDENED 2026-09-17, T2 — FROM `search/` ALONE TO `search/`, `ed/`, `alerts/`, `settings/`
 * AND (T2r fix round, finding 6) `legal-forms/`.** Item 1's target puts a typed expiry, and a
 * warning tint against it, on the ED screen for the first time; `alerts/` and `settings/` are the
 * other two surfaces item 1 names. `legal-forms/` was left out by T2's own first pass — see the
 * struck note immediately below — and added by the T2r fix round once finding 6's fix removed the
 * false positive that was the reason for leaving it out.
 *
 * ⚠️ **STRUCK 2026-09-17, T2r FIX ROUND, FINDING 6 — `legal-forms/` NOW SCANNED.** T2's own pass
 * measured `legal-forms-screen.tsx` tripping this scan on `"Form 3B/3D (Inpatient)"`, because
 * `"3D"` read as `FORM_CODE` AND, separately, as `DURATION` ("3" plus the day-unit token "d") —
 * a coincidental collision between a form-code SUFFIX and the duration pattern, not a real
 * duration claim. T2 left `legal-forms/` off this list rather than fix a file outside its
 * ownership. Finding 6 fixed the actual defect instead of working around it: `offends` now strips
 * every `\b\d[A-Z]\b` form-code-shaped token (`"3B"`, `"3D"`, …) out of the text BEFORE running
 * the duration check, so a form code's own digit-letter suffix can no longer be misread as a
 * duration figure. `"Form 3B/3D (Inpatient)"` now correctly reads as `false` — it names forms and
 * states nothing about how long either lasts — while `"Form 3D 72h detention:"` still correctly
 * reads as `true`, because `"72h"` survives the strip (it is not a `\d[A-Z]` pair) and is a real
 * duration. `legal-forms-screen.tsx`'s wording is still item 2's own problem for T5 to fix; this
 * change only stops it being a FALSE positive here.
 */
describe("screen text beside a legal form carries no duration", () => {
  const SEARCH_DIR = `${WARD_DIR}/search`;
  const SCANNED_DIRS = [
    SEARCH_DIR,
    `${WARD_DIR}/ed`,
    `${WARD_DIR}/alerts`,
    `${WARD_DIR}/settings`,
    `${WARD_DIR}/legal-forms`,
  ];
  const FORM_CODE = /\bForm\s+\d[A-Z]\b/;
  const DURATION = /\b\d+(?:\.\d+)?\s*(?:h|hrs?|hours?|m|mins?|minutes?|d|days?)\b/i;
  // T2r fix round, finding 6 (2026-09-17): a form code's own digit-letter suffix ("3B", "3D", …)
  // must never be misread as a duration figure by the check below — see the header note above for
  // the real collision this stripping fixes ("Form 3B/3D (Inpatient)"). `FORM_CODE` still tests the
  // ORIGINAL, unstripped text, because the form-code MENTION is exactly what the stripped tokens
  // were.
  const FORM_CODE_TOKEN = /\b\d[A-Z]\b/g;
  const offends = (text: string) => FORM_CODE.test(text) && DURATION.test(text.replace(FORM_CODE_TOKEN, " "));

  /**
   * `formCode` (T2r fix round, finding 4, 2026-09-17): whether an expression names a live legal
   * form's code or rendered title — a call to `legalFormName`/`legalFormNameLabelFirst`, a
   * property read of `legalForm.code`/`legalForm?.code`, or any identifier spelled `formCode`.
   * Matched by SOURCE TEXT, deliberately: this scan already reads every file as text-shaped data
   * (string literals, JSX text), and a expression-shape check would need a type checker this file
   * does not carry. A false positive here costs an extra placeholder substitution; a false
   * negative costs the exact gap this finding exists to close.
   */
  const DYNAMIC_FORM_EXPRESSION = /legalFormName|legalFormNameLabelFirst|legalForm\??\.code|formCode/;

  /**
   * A template literal's or JSX element's mixed static text AND dynamic form-code expression,
   * reconstructed into ONE string with `"Form 9Z"` standing in for every matching dynamic piece —
   * so `` `${legalFormName(legalForm)}: expires 72 hours after it was placed.` `` reads as
   * `"Form 9Z: expires 72 hours after it was placed."` and the duration check above can see the
   * form-code mention and the duration TOGETHER, exactly as a reader of the rendered screen would.
   *
   * 🔴 **THE GAP THIS CLOSES, MEASURED RATHER THAN THEORISED (T2r fix round, finding 4).** Before
   * this, `screenTextIn` collected `literalsIn`'s isolated template-literal FRAGMENTS — for the
   * template above, an empty head and the tail `": expires 72 hours after it was placed."` — and
   * neither fragment alone names a form code, so `FORM_CODE.test(...)` never matched either piece
   * and the whole line was invisible to this scan. The form code only exists once the dynamic
   * expression and the surrounding text are read TOGETHER.
   */
  const reconstructedWithPlaceholder = (parts: { text: string; isDynamic: boolean }[]): string =>
    parts
      .map((part) => (part.isDynamic ? (DYNAMIC_FORM_EXPRESSION.test(part.text) ? "Form 9Z" : "") : part.text))
      .join("");

  const screenTextIn = (path: string): string[] => {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const pieces: string[] = [...literalsIn(path)];
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node) && node.text.trim() !== "") pieces.push(node.text);
      // A template literal WITH substitutions (`` `a${x}b` ``, ts.TemplateExpression) — its own
      // static fragments are already collected above via `literalsIn`; this ADDS the
      // fully-reconstructed string so a dynamic form-code expression is seen beside its
      // surrounding text rather than only in isolation.
      if (ts.isTemplateExpression(node)) {
        const parts: { text: string; isDynamic: boolean }[] = [{ text: node.head.text, isDynamic: false }];
        for (const span of node.templateSpans) {
          parts.push({ text: span.expression.getText(source), isDynamic: true });
          parts.push({ text: span.literal.text, isDynamic: false });
        }
        pieces.push(reconstructedWithPlaceholder(parts));
      }
      // A JSX element or fragment mixing text children with expression-container children
      // (`<span>{legalFormName(legalForm)}: expires 72 hours after it was placed.</span>`) — same
      // reasoning as the template case: reconstruct the FLAT sequence of this node's direct
      // children so a dynamic form-code expression is read beside its sibling text.
      if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && node.children.length > 0) {
        const parts: { text: string; isDynamic: boolean }[] = node.children.map((child) => {
          if (ts.isJsxText(child)) return { text: child.text, isDynamic: false };
          if (ts.isJsxExpression(child) && child.expression) {
            return { text: child.expression.getText(source), isDynamic: true };
          }
          // A nested element/fragment contributes nothing to THIS flat reconstruction — it is
          // visited independently by the walk, and its own children are handled there.
          return { text: "", isDynamic: false };
        });
        pieces.push(reconstructedWithPlaceholder(parts));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return pieces;
  };

  it("flags the exact wording that shipped, so the rule is known to bite", () => {
    expect(offends("Form 1A (ED 24h)")).toBe(true);
    expect(offends("Form 4A due in 2 hours")).toBe(true);
    expect(offends("Form 1A (Referral for examination by a psychiatrist)")).toBe(false);
    expect(offends("Waiting > 24h")).toBe(false);
  });

  /** T2r fix round, finding 6 (2026-09-17) — pinned exactly as the review specified. */
  it("strips a form code's own digit-letter suffix before checking for a duration", () => {
    expect(offends("Form 3B/3D (Inpatient)"), "a form-code suffix must not read as a duration").toBe(false);
    expect(offends("Form 3D detention:"), "no duration figure anywhere in this text").toBe(false);
    expect(offends("Form 3D 72h detention:"), "a REAL duration must still be caught").toBe(true);
    expect(offends("Form 3D for 3 days"), "a real duration spelled out must still be caught").toBe(true);
  });

  it("finds no scanned-screen text that puts a duration beside a form code", () => {
    const files = SCANNED_DIRS.flatMap((dir) =>
      readdirSync(dir)
        .filter((name) => /\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`),
    );
    expect(files.length, "no scanned-screen files were found to scan").toBeGreaterThan(0);
    // Non-vacuity per directory: every widened directory really contributed files, so a clean
    // result cannot be a mistyped path silently scanning nothing.
    for (const dir of SCANNED_DIRS) {
      expect(
        files.some((file) => file.startsWith(`${dir}/`)),
        `no files were found under ${dir}`,
      ).toBe(true);
    }

    const pieces = files.flatMap((file) => screenTextIn(file).map((text) => ({ file, text })));
    // Non-vacuity: the scan really reached text that names a form, so a clean result means something.
    expect(
      pieces.some(({ text }) => FORM_CODE.test(text)),
      "no scanned text names a form code",
    ).toBe(true);

    expect(pieces.filter(({ text }) => offends(text)).map(({ file, text }) => `${file}: ${text}`)).toEqual([]);
    expect(
      pieces
        .filter(({ text }) => /Form\s+5A/.test(text) && /involuntary/i.test(text))
        .map(({ file, text }) => `${file}: ${text}`),
      "Form 5A is a Community Treatment Order in the register, never an involuntary inpatient status",
    ).toEqual([]);
  });
});
