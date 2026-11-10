// The 5 KB per-screen raise cap on phone script limits (D-82; guard added by D-121 item 5).
//
// A PR may raise a screen's limit in script-budget.json by up to 5 KB in total, added up across the
// whole PR, without asking Josh. Above that it needs Josh's explicit yes, which the PR records in its
// own docs/script-budget-history/ file (HOW-WE-WORK section 6, step 4) with words such as "Josh
// approved". This compares the PR's script-budget.json with the PR base and fails a raise above
// 5 KB unless a history file the PR adds or changes records that approval. It reads local git objects
// only: the full-history checkout already holds the base commit, so it needs no network.
//
//   WARD_BASE_SHA=<pr base> node scripts/ward-ci-public/budget-raise-cap.mjs
//   node scripts/ward-ci-public/budget-raise-cap.mjs --base origin/main   (locally)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RAISE_CAP_KB = 5;
const HISTORY_DIR = "docs/script-budget-history/";
const APPROVAL = /\bJosh\b[^.\n]{0,60}\bapprov(?:ed|al)\b|\bapproved by Josh\b|\bJosh'?s (?:explicit )?yes\b/iu;

/** Routes whose limit rose by more than the cap, as { route, from, to, raise } (KB, one decimal). */
export function raisesOverCap(baseBudgets, headBudgets, cap = RAISE_CAP_KB) {
  const over = [];
  for (const [route, to] of Object.entries(headBudgets ?? {})) {
    const from = baseBudgets?.[route];
    if (typeof from !== "number" || typeof to !== "number") continue; // a new screen has no raise to judge
    const raise = Math.round((to - from) * 10) / 10;
    if (raise > cap) over.push({ route, from, to, raise });
  }
  return over;
}

/** Whether any of the PR's own history entries records Josh's approval. */
export function recordsApproval(historyTexts) {
  return historyTexts.some((text) => APPROVAL.test(text));
}

/** The verdict: { ok, over, approved }. */
export function judgeRaiseCap({ baseBudgets, headBudgets, historyTexts }) {
  const over = raisesOverCap(baseBudgets, headBudgets);
  const approved = over.length > 0 && recordsApproval(historyTexts);
  return { ok: over.length === 0 || approved, over, approved };
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30_000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argBase = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : undefined;
  const base = argBase ?? process.env.WARD_BASE_SHA;
  if (!base) {
    console.log("No PR base (manual or main run): no raise to judge.");
    process.exit(0);
  }
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  let baseBudgets = {};
  try {
    baseBudgets = JSON.parse(git(["show", `${mergeBase}:script-budget.json`])).budgets ?? {};
  } catch {
    console.log("The base has no script-budget.json: no raise to judge.");
    process.exit(0);
  }
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
