import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * EVERY EVENT THE REDUCER HANDLES MUST BE REACHABLE FROM A SCREEN, OR BE LISTED HERE WITH A REASON.
 *
 * A reducer case with no dispatcher is a feature that is complete, tested, documented — and that
 * nobody can use. It is invisible to every other guard in this repository: it typechecks, its own
 * reducer tests pass, and no screen looks wrong, because the screen simply does not offer it.
 *
 * ⚠️ **THE CLINICAL SHAPE THIS EXISTS FOR, IN THE OWNER'S OWN WORDS, RULING R-B-08:** _"Half-built,
 * 'override is possible but always recorded' had become 'override is impossible', which is a
 * different clinical policy."_ That was found by hand. So was the urgent flag, on 2026-09-01 —
 * `ward-management-console.tsx` records that it "was complete and unreachable" until somebody
 * noticed. **Both were found by a person reading; nothing failed either time.** This file is the
 * check that would have.
 *
 * ⚠️ **THE ALLOWLIST IS A REGISTER OF KNOWN GAPS, NEVER A WAY TO PASS.** It must be EXACT: an entry
 * for an event that HAS a dispatcher fails just as loudly as an unreachable event with no entry, so
 * building the missing screen forces the entry out and the register cannot rot into a list of
 * things that were once true.
 */

const WARD_ROOT = "src/components/ward-management";
const REDUCER = `${WARD_ROOT}/ward-flow-reducer.ts`;

/**
 * These DEFINE the vocabulary rather than using it — the reducer's `case` labels are the source
 * set, and the event union names every type in a non-comment position — so a scan that included
 * them would find every event "dispatched" and this file could never fail.
 */
const DEFINITION_FILES = new Set([
  REDUCER,
  `${WARD_ROOT}/ward-flow-events.ts`,
  // Holds a classification list of every event name (which carry typed text vs. not), not dispatches.
  `${WARD_ROOT}/ward-flow-persistence-classification.ts`,
]);

/**
 * Reducer events no screen can dispatch today, each with the reason it is outstanding rather than
 * wrong. **Adding a name here is recording a gap, not closing one.**
 */
const KNOWN_UNREACHABLE: Readonly<Record<string, string>> = {
  // The 8 October lint cleanup removed private handlers that no rendered control called.
  // These gaps already existed; a dead dispatch must not count as a usable control.
  RECORD_WARD_INTAKE_CONSTRAINTS:
    "The current Ward screen displays intake constraints, but has no rendered control to save " +
    "them. Its unused submission handler was removed on 8 October 2026. Remove this entry when " +
    "a ward-scoped intake-constraints control dispatches RECORD_WARD_INTAKE_CONSTRAINTS.",
  /*
   * ✅ **`STEP_BACK_STAGE` AND `WITHDRAW_ACCEPTANCE` LEFT THIS REGISTER ON 2026-09-06**, when the
   * two controls were built on the movement workspace (`ward-management-console.tsx`, "What you
   * can do here"). Their entries are removed rather than annotated — a register of gaps that keeps
   * closed ones is a list of things that used to be true, which is this file's own rule.
   *
   * ⚠️ **THIS TEST IS WHAT REPORTED THE CLOSURE, AND IT IS WORTH SAYING WHY THAT MATTERED.** The
   * deferral's recorded expiry condition was "another session held ward-management-console.tsx for
   * review" — **a trigger nothing watches.** Both events had a complete model half, a complete
   * reducer half, a role gate, a closed reason list and passing tests for days; the only thing
   * missing was a screen, and a reducer case with no caller is invisible to every other gate in
   * the repository. This register is the single thing that could say so.
   */
  // RECORD_NO_REFERRAL left this register when the ED outbox gained a No referral raised button.
  // REOPEN_INBOX_ITEM was listed here for about four hours on 2026-09-18, and this note is what is
  // left of it. It was recorded as an unclosed gap — no screen dispatched it, so a coordinator
  // could mark an inbox item done and never put it back — with the explicit reasoning that closing
  // it needed "a control beside the one that completes an item", and that this was not that
  // branch's to decide. A peer session was already building exactly that control while the entry
  // was being written.
  //
  // ⚠️ THE TWO HALVES COULD NOT SEE EACH OTHER, AND THE MERGE WOULD NOT HAVE TOLD ANYONE. The entry
  // lives in this file; the control lives in `ward-tasks-drawer.tsx`. Different files, so the merge
  // was textually clean — and this register is exact in BOTH directions, so an entry excusing an
  // event that now HAS a dispatcher fails just as loudly as an unrecorded unreachable one. The
  // entry was deleted inside the merge commit that brought the control, which is the only ordering
  // where the tree is never briefly wrong.
  // RECORD_TRANSPORT_NEED was here until 2026-09-18. The ED board now carries a "No transport
  // needed" button (owner ruling, 17 Sept, second round item 10), so the engine behaviour that was
  // built, tested and unreachable can finally be reached by a person.
  /*
   * ✅ **`RECORD_REFERRER_WITHDRAWAL` AND `STOP_TRANSPORT` LEFT THIS REGISTER 17 SEPT 2026 (round 2).**
   * `RECORD_REFERRER_WITHDRAWAL` is dispatched from the coordinator's referral surface
   * (`referrals/referral-match.tsx`). `STOP_TRANSPORT` is dispatched from the ward management
   * console (`ward-management-console.tsx`), alongside its release counterpart `RELEASE_HELD_BED`
   * (owner answer 8, second round) — the bed stays held after a stop until that control releases it.
   * Both entries are removed rather than annotated, per this file's own rule.
   */
  /*
   * 🔴 THE THREE INBOX WORK-STATE EVENTS. Landed 2026-09-06 at `686a40613` WITHOUT these entries,
   * which left this guard red — and it was right to be. Recorded now with the reason, not silenced.
   *
   * ⚠️ THIS IS A GAP WITH A DATE, NOT A DESIGN. The drawer that will dispatch them
   * (`coordinator/exception-drawer.tsx` becoming the shared right-hand panel) is the next package.
   * Until it exists, all three have a complete model half, a complete reducer half, a role gate and
   * passing tests — the exact shape this register's own comment says is invisible to every other
   * gate in the repository.
   *
   * 🔴 AND THE EXPIRY CONDITION IS NAMED, because this file records that the last deferral here
   * expired on "another session held the file for review" — a trigger nothing watches. This one
   * expires when the drawer renders a control that dispatches them, and THIS TEST is what will say
   * so: it fails in the other direction the moment a screen dispatches one, forcing the entry out.
   */
  /*
   * ⚠️ **THREE INBOX EVENTS LEFT THIS REGISTER ON 2026-09-07, AND THIS TEST IS WHAT FORCED THEM
   * OUT** — exactly as the entry above predicted: *"it fails in the other direction the moment a
   * screen dispatches one."* The gap closed when `ward-tasks-drawer.tsx` mounted on every route.
   * The reasons are recorded here rather than deleted, because two of them are still true and one
   * of them is an owner ruling.
   *
   * `ACKNOWLEDGE_INBOX_ITEM` — genuinely reachable now. Four acknowledge controls, measured live.
   *
   * 🔴 `COMPLETE_INBOX_ITEM` and `REOPEN_INBOX_ITEM` — reachable IN SOURCE only. The drawer's
   * "Mark done" branch is gated on `item.kind === "commitment"`, and **every one of the five
   * `INBOX_CATEGORIES` entries is `kind: "fact"` by OWNER RULING 2026-09-06 — the panel is
   * acknowledge-only.** So no row a coordinator can see today can enter that branch.
   *
   * ⚠️ **THE RULING IS NOT ENFORCED BY THIS FILE OR BY THAT BRANCH. It is enforced by the
   * reducer**, which refuses `COMPLETE_INBOX_ITEM` on anything it has not classified as a
   * commitment, structurally, regardless of what any screen renders — and which treats an
   * unclassified id as "not a commitment", so a sixth category added without being classified is
   * never tickable either. **Do not close a future gap here by reclassifying a category.**
   *
   * ⚠️ **AND NOTE WHAT THIS REGISTER CAN AND CANNOT SEE.** It measures whether a screen's SOURCE
   * dispatches an event. It cannot see whether any data can reach that dispatch. Those are
   * different questions, and an entry removed for source-level reachability is not evidence that a
   * user can do the thing.
   */
};

/** A walk that reaches too few files would make every assertion below pass over nothing. */
const MINIMUM_WARD_FILES = 20;
const MINIMUM_REDUCER_CASES = 40;

function wardSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path) && !DEFINITION_FILES.has(path)) found.push(path);
    }
  };
  walk(WARD_ROOT);
  return found;
}

/**
 * Comments become spaces. ⚠️ **This is the load-bearing half.** Every one of these event names also
 * appears in prose — `ward-model.ts` explains `WITHDRAW_ACCEPTANCE` in four doc comments, and
 * `ward-management-console.tsx` names `FLAG_MOVEMENT_URGENT` in a comment ABOVE the control that
 * dispatches it. A scan that counted those would call an unreachable event reachable, which is the
 * one direction this file must never fail in.
 */
export function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "block" | "line" = "code";
  while (index < source.length) {
    const here = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (here === "/" && next === "*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "/" && next === "/") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      out += here;
      index += 1;
      continue;
    }
    if (state === "block") {
      if (here === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 2;
        continue;
      }
      out += here === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (here === "\n") {
      state = "code";
      out += "\n";
      index += 1;
      continue;
    }
    out += " ";
    index += 1;
  }
  return out;
}

function reducerCases(): string[] {
  const code = stripComments(readFileSync(REDUCER, "utf8"));
  const found = new Set<string>();
  for (const match of code.matchAll(/case\s+"([A-Z][A-Z0-9_]*)"\s*:/g)) found.add(match[1]);
  return [...found].sort();
}

/**
 * Every event name appearing in non-comment code anywhere outside the two definition files.
 *
 * ⚠️ **Deliberately a NAME search and not `type: "X"`.** This was motivated by the urgent flag,
 * which used to dispatch `type: movement.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" :
 * "FLAG_MOVEMENT_URGENT"` — no `type: "…"` pattern matched that computed ternary, and a narrower
 * search reported both events as unreachable before this file existed. Item 37 (2026-09-17) split
 * that call into two plain-literal branches, so this specific case no longer needs the wider
 * search — but the general reason still holds: `morning-tour.tsx` dispatches `pending.event` and
 * `events[0]`, both indirected through a variable rather than a literal, and a `type: "…"` pattern
 * would report those unreachable too. The NAME search stays for cases like that one.
 */
function dispatchedNames(files: string[]): Set<string> {
  const found = new Set<string>();
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf8"));
    for (const match of code.matchAll(/"([A-Z][A-Z0-9_]*)"/g)) found.add(match[1]);
  }
  return found;
}

describe("every reducer event is reachable from a screen, or recorded as a known gap", () => {
  it("walks the reducer and the ward source tree", () => {
    expect(
      reducerCases().length,
      "the reducer's case labels could not be parsed — every assertion below would pass over nothing",
    ).toBeGreaterThan(MINIMUM_REDUCER_CASES);
    expect(wardSourceFiles().length, "the ward source walk reached too few files to mean anything").toBeGreaterThan(
      MINIMUM_WARD_FILES,
    );
  });

  it("counts a ternary dispatch as reachable and a comment as not", () => {
    /*
     * Both directions, on the two mistakes this scan can actually make, run on every pass rather
     * than in a scratch script. The first is the one that produces a FALSE FINDING — reporting a
     * built control as missing — and it is the mistake that was made before this file existed.
     */
    const ternary = `dispatch({ type: x ? "AAA_EVENT" : "BBB_EVENT", now });`;
    const namesInTernary = [...stripComments(ternary).matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]);
    expect(namesInTernary, "a ternary dispatch is no longer seen, so built controls would read as missing").toEqual([
      "AAA_EVENT",
      "BBB_EVENT",
    ]);

    /*
     * ⚠️ THE QUOTES INSIDE THESE COMMENTS ARE THE POINT, AND AN EARLIER VERSION OF THIS CONTROL
     * OMITTED THEM. `dispatchedNames` matches a name only when it is DOUBLE-QUOTED, and today's
     * ward comments write event names in backticks — so a control using unquoted prose exercised a
     * different predicate from the scan and would have passed while the scan was broken. A control
     * must run the same test the scan runs.
     */
    const commentOnly = ['/* "CCC_EVENT" is explained here and dispatched nowhere. */', '// "DDD_EVENT" too.'].join(
      "\n",
    );
    const namesInComments = [...stripComments(commentOnly).matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]);
    expect(
      namesInComments,
      "comment text survived stripping, so prose about an event would count as a dispatcher",
    ).toEqual([]);
  });

  it("has no unreachable event that is not recorded, and no record for an event that is reachable", () => {
    const cases = reducerCases();
    const dispatched = dispatchedNames(wardSourceFiles());
    const unreachable = cases.filter((name) => !dispatched.has(name));
    const recorded = Object.keys(KNOWN_UNREACHABLE).sort();

    expect(
      unreachable.filter((name) => !(name in KNOWN_UNREACHABLE)),
      "the reducer handles these events and no ward screen dispatches them, so they are complete, " +
        "tested and unusable. Build the control, or add the name to KNOWN_UNREACHABLE with the " +
        "reason it is outstanding — never without one.",
    ).toEqual([]);

    expect(
      recorded.filter((name) => !unreachable.includes(name)),
      "these are recorded as unreachable but a screen now dispatches them. Remove the entry: a " +
        "register of gaps that keeps closed ones is a list of things that used to be true.",
    ).toEqual([]);

    expect(
      recorded.filter((name) => !cases.includes(name)),
      "these are recorded as unreachable but the reducer no longer handles them at all",
    ).toEqual([]);
  });
});
