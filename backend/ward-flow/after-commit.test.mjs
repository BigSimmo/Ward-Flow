// @ts-check
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { archiveAfterCommit, commandTimer } from "./after-commit.mjs";

test("P011: a failure in the post-commit archive is logged and never thrown, so the save stands", async () => {
  const logged = [];
  const saved = { revision: 20, committed: true };
  const outcome = await archiveAfterCommit({
    due: { revision: 20 },
    run: async () => {
      throw Object.assign(new Error("archive table missing for Jane Citizen U1234567"), { code: "42P01" });
    },
    log: (fields) => logged.push(fields),
    errorFields: (error) => ({
      errorName: /** @type {Error} */ (error).name,
      errorCode: /** @type {any} */ (error).code,
    }),
  });
  assert.equal(outcome, "failed");
  assert.deepEqual(saved, { revision: 20, committed: true }, "the committed save is untouched");
  assert.deepEqual(logged, [
    { event: "ward_backend_archive_after_commit_failure", errorName: "Error", errorCode: "42P01" },
  ]);
  assert.doesNotMatch(JSON.stringify(logged), /Jane|U1234567/u);
});

test("P011: the post-commit archive runs for the committed revision, and reports a skip when another save landed", async () => {
  const seen = [];
  const run = async (revision) => (seen.push(revision), revision === 20);
  const quiet = { log: () => assert.fail("no log"), errorFields: () => ({}) };
  assert.equal(await archiveAfterCommit({ due: { revision: 20 }, run, ...quiet }), "archived");
  assert.equal(await archiveAfterCommit({ due: { revision: 21 }, run, ...quiet }), "skipped");
  assert.equal(await archiveAfterCommit({ due: null, run, ...quiet }), "none");
  assert.deepEqual(seen, [20, 21]);
});

test("P011: command timings carry step milliseconds, the action name and status only", () => {
  let clock = 0;
  const timer = commandTimer(() => clock);
  clock = 3;
  timer.lap("lock");
  clock = 10;
  timer.lap("save");
  timer.lap("patientName");
  clock = 12;
  const fields = timer.fields("CONFIRM_CAPACITY", 200);
  assert.deepEqual(fields, {
    event: "ward_backend_command_timing",
    action: "CONFIRM_CAPACITY",
    status: 200,
    totalMs: 12,
    lockMs: 3,
    saveMs: 7,
  });
  assert.equal(timer.fields("Jane Citizen PT-0042", 200).action, "unknown", "free text is never logged");
});

test("P011: the store archives after the commit, logs timings, and keeps the push check inside the save", async () => {
  const source = await readFile(new URL("./postgres.mjs", import.meta.url), "utf8");
  const command = source.slice(source.indexOf("async command(actorId"));
  const commit = command.indexOf("const response = await transaction(");
  const after = command.indexOf("await archiveAfterCommit(");
  const pushCheck = command.indexOf("SAVEPOINT push_evaluation");
  assert.ok(commit > 0 && after > commit, "the routine archive runs after the save's transaction");
  assert.ok(pushCheck > commit && pushCheck < after, "the phone-push check stays inside the save (Josh, 10:12 PM)");
  assert.match(command, /commandTiming\.fields\(event\.type, response\.status\)/u);
  assert.match(command, /if \(timing\.totalMs >= slowCommandMs\) log\(timing\)/u);
});
