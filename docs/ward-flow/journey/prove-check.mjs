/* Proves the coverage check can fail. Injects an action nobody has mapped, runs the real
   build, and asserts it refuses. Restores the file either way. A check that has never been
   seen to fail is indistinguishable from one that cannot. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { guardClean, restore, writeStubbornly } from "./probe-io.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const file = path.join(here, "actions.json");
// Refuses rather than adopting a file an interrupted run left broken — see probe-io.mjs.
const original = guardClean(file, ["A_FAKE_UNMAPPED_ACTION"]);

const run = () => {
  try {
    execFileSync("node", [path.join(here, "build-explorer.mjs")], { encoding: "utf8", stdio: "pipe" });
    return { failed: false, output: "" };
  } catch (e) {
    return { failed: true, output: String(e.stderr || e.stdout || e.message) };
  }
};

let verdict = {};
try {
  const before = run();
  if (before.failed) throw new Error("the build is already failing — cannot run this proof");

  const actions = JSON.parse(original);
  actions.push({
    event: "A_FAKE_UNMAPPED_ACTION",
    name: "An action nobody mapped",
    group: "Test",
    lane: "record",
    nodes: [],
    roles: [],
    does: "",
    needs: "",
    changes: "",
    reasons: [],
    refuses: [],
  });
  writeStubbornly(file, JSON.stringify(actions, null, 1));

  const after = run();
  verdict = {
    cleanBuildSucceeds: !before.failed,
    brokenBuildRefuses: after.failed,
    namedTheRightAction: after.output.includes("A_FAKE_UNMAPPED_ACTION"),
    message: after.output
      .split("\n")
      .filter((l) => l.includes("UNMODELLED"))
      .join(" ")
      .trim(),
  };
} finally {
  restore(file, original);
  execFileSync("node", [path.join(here, "build-explorer.mjs")], { stdio: "pipe" }); // rebuild clean
}

const ok = verdict.cleanBuildSucceeds && verdict.brokenBuildRefuses && verdict.namedTheRightAction;
console.log(JSON.stringify(verdict, null, 1));
console.log(
  ok
    ? "PROVEN: the check fails on an unmapped action, and names it."
    : "NOT PROVEN — the check did not behave as claimed.",
);
process.exit(ok ? 0 : 1);
