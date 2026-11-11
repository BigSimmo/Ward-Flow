// The 5 KB per-screen raise cap on phone script limits (D-82; guard added by D-121 item 5).
//
// A PR may raise a screen's limit in script-budget.json by up to 5 KB in total, added up across the
// whole PR, without asking Josh. Above that it needs Josh's explicit yes, which the PR records in its
// own docs/script-budget-history/ file (HOW-WE-WORK section 6, step 4) with words such as "Josh
// approved" or "approved by Josh". This compares the PR's script-budget.json with current main (the test merge's first parent; see
// pickJudgeBase) and fails a raise above
// 5 KB unless a history file the PR adds or changes records that approval. It reads local git objects
// only: the full-history checkout already holds the base commit, so it needs no network.
//
//   WARD_BASE_SHA=<pr base> node scripts/ward-ci-public/budget-raise-cap.mjs
//   node scripts/ward-ci-public/budget-raise-cap.mjs --base origin/main   (locally)
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RAISE_CAP_KB = 5;
const HISTORY_DIR = "docs/script-budget-history/";
// Only an explicit affirmative counts: "Josh approved", "Josh has approved", "approved by Josh",
// "Josh's yes" or "Josh's explicit yes". A nearby negation or pending word ("Josh has not approved",
// "awaiting Josh's yes", "approved by Josh is pending") voids that mention.
const APPROVAL =
  /\bJosh (?:has |had )?(?:explicitly )?approved\b|\bapproved by Josh\b|\bJosh[’']s (?:explicit )?yes\b/giu;
const NEGATION_BEFORE =
  /\b(?:not|never|no|without|awaiting|await|pending|needs?|needed|requires?|required|until|before|asks?|asking|if|once|when|unless)\b[^.\n]{0,24}$/iu;
const NEGATION_AFTER = /^[^.\n]{0,24}\b(?:pending|awaited|needed|required|outstanding|not yet|to come)\b/iu;

function affirmsApproval(text) {
  for (const match of text.matchAll(APPROVAL)) {
    const before = text.slice(Math.max(0, match.index - 40), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
    if (!NEGATION_BEFORE.test(before) && !NEGATION_AFTER.test(after)) return true;
  }
  return false;
}

/**
 * Routes whose limit rose by more than the cap, as { route, from, to, raise }. The comparison uses
 * the exact delta (with a tiny float tolerance), so 5.04 KB fails; only the reported raise is rounded.
 */
export function raisesOverCap(baseBudgets, headBudgets, cap = RAISE_CAP_KB) {
  const over = [];
  for (const [route, to] of Object.entries(headBudgets ?? {})) {
    const from = baseBudgets?.[route];
    if (typeof from !== "number" || typeof to !== "number") continue; // a new screen has no raise to judge
    const delta = to - from;
    if (delta > cap + 1e-9) over.push({ route, from, to, raise: Math.round(delta * 100) / 100 });
  }
  return over;
}

/** Whether any of the PR's own history entries records Josh's approval. */
export function recordsApproval(historyTexts) {
  return historyTexts.some((text) => affirmsApproval(text));
}

/** The verdict: { ok, over, approved }. */
export function judgeRaiseCap({ baseBudgets, headBudgets, historyTexts }) {
  const over = raisesOverCap(baseBudgets, headBudgets);
  const approved = over.length > 0 && recordsApproval(historyTexts);
  return { ok: over.length === 0 || approved, over, approved };
}

/**
 * The commit to judge against (A5-02). A pull_request run checks out GitHub's test merge of the PR
 * into the current main, so that merge's first parent is main as it is now, which can be newer than
 * the event's base SHA. Judging against it means a raise another PR already merged is not counted
 * again, and two PRs that each raise from the same old base cannot both slip past the cap: the
 * second is measured against main after the first. Elsewhere it is the merge base, as before.
 */
export function pickJudgeBase({ base, parents, isAncestor, mergeBase }) {
  if (parents.length === 2 && isAncestor(base, parents[0])) return parents[0];
  return mergeBase(base);
}

function judgeBase(base) {
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"]).trim().split(/\s+/u).slice(1);
  return pickJudgeBase({
    base,
    parents,
    isAncestor: (ancestor, commit) => {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", ancestor, commit], { cwd: root, timeout: 30_000 });
        return true;
      } catch {
        return false;
      }
    },
    mergeBase: (from) => git(["merge-base", from, "HEAD"]).trim(),
  });
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const argBase = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : undefined;
  const base = argBase ?? process.env.WARD_BASE_SHA;
  if (!base) {
    console.log("No PR base (manual or main run): no raise to judge.");
    process.exit(0);
  }
  const mergeBase = judgeBase(base);
  let baseBudgets = {};
  try {
    baseBudgets = JSON.parse(git(["show", `${mergeBase}:script-budget.json`])).budgets ?? {};
  } catch {
    console.log("The base has no script-budget.json: no raise to judge.");
    process.exit(0);
  }
  // On a merge_group run the base is the queue base, so this diff holds every queued PR's history
  // files and one PR's approval could cover another's raise. Ward Flow uses no merge queue (AGENTS.md
  // rule 6), so the workflow's merge_group trigger is dormant here; revisit this before enabling one.
  const headBudgets = JSON.parse(readFileSync(path.join(root, "script-budget.json"), "utf8")).budgets ?? {};
  const historyTexts = git(["diff", "--name-only", "--diff-filter=AM", `${mergeBase}...HEAD`, "--", HISTORY_DIR])
    .split(/\r?\n/u)
    .filter((file) => file.endsWith(".md") && !file.endsWith("README.md"))
    .map((file) => readFileSync(path.join(root, file), "utf8"));
  const verdict = judgeRaiseCap({ baseBudgets, headBudgets, historyTexts });
  for (const { route, from, to, raise } of verdict.over)
    console.log(`${route}: ${from} to ${to} KB, a ${raise} KB raise (cap ${RAISE_CAP_KB} KB without asking)`);
  if (!verdict.ok) {
    console.error(
      `A phone size limit rose by more than ${RAISE_CAP_KB} KB in this PR (D-82). Trim first, or ask Josh and record ` +
        `his yes ("Josh approved ...") in this PR's own file in ${HISTORY_DIR}.`,
    );
    process.exit(1);
  }
  console.log(
    verdict.over.length > 0
      ? "Raises above the cap are recorded as approved by Josh in this PR's budget history file."
      : `No phone size limit rose by more than ${RAISE_CAP_KB} KB.`,
  );
}
