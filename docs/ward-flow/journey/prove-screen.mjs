/* Proves the "no screen can trigger this" check can fail. Marks an action the ED screen really
   dispatches as unreachable, runs the real build, and asserts it refuses and names both the action
   and the file that dispatches it. Restores the file either way. The list of unreachable actions
   goes to the owner to rule on, so a check on it that has never been seen to fail is not a check. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { guardClean, restore, writeStubbornly } from "./probe-io.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const file = path.join(here, "actions.json");
const MARKER = "PROBE — nothing can trigger this";
const TARGET = "RECORD_NO_REFERRAL";
// Refuses rather than adopting a file an interrupted run left broken — see probe-io.mjs.
const original = guardClean(file, [MARKER]);

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
  const target = actions.find((a) => a.event === TARGET);
  if (!target) throw new Error(`${TARGET} is not in actions.json — this proof needs a new target`);
  target.screen = { screen: "NONE", control: MARKER };
  writeStubbornly(file, JSON.stringify(actions, null, 1));

  const after = run();
  const line = after.output.split("\n").find((l) => l.includes(TARGET)) || "";
  verdict = {
    cleanBuildSucceeds: !before.failed,
    brokenBuildRefuses: after.failed,
    namedTheAction: line.includes(TARGET),
    namedTheDispatchingFile: line.includes("ed-screen.tsx"),
    message: line.trim(),
  };
} finally {
  restore(file, original);
  execFileSync("node", [path.join(here, "build-explorer.mjs")], { stdio: "pipe" }); // rebuild clean
}

const ok =
  verdict.cleanBuildSucceeds && verdict.brokenBuildRefuses && verdict.namedTheAction && verdict.namedTheDispatchingFile;
console.log(JSON.stringify(verdict, null, 1));
console.log(
  ok
    ? "PROVEN: the check refuses a false 'no screen' claim, and names the screen that dispatches it."
    : "NOT PROVEN — the check did not behave as claimed.",
);
process.exit(ok ? 0 : 1);
