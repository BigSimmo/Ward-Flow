import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

/**
 * 🔴 **THE HARNESS WAS CORRECT, COMPLETE AND INVOKED BY NOTHING FOR TWO DAYS.**
 *
 * `scripts/ward-flow/mutation-run.mjs` was written on 2026-09-04, after four sessions each
 * hand-rolled the break-it-and-watch-it-go-red habit differently and one driver died between
 * writing the mutant and restoring it. It was right the whole time. **Nothing imported it, nothing
 * invoked it, and it was not in `package.json`** — so four more sessions hand-rolled the habit
 * again on 2026-09-06, and one of them (mine) destroyed a fixture and lost an uncommitted fix doing
 * it. Both faults are named in the harness's own doc comment as the reasons it exists.
 *
 * ⚠️ **THIS FILE GUARDS THE FAILURE THAT ACTUALLY HAPPENED, WHICH IS NOT THE ONE I FIRST WENT
 * LOOKING FOR.** Ward Lead asked for a guard that fails when a ward mutation is run any OTHER way.
 * That is undecidable and I declined to fake it: a hand-rolled mutation ends by restoring the file,
 * so afterwards there is no trace for any check to find. **Ward Builder One's review made the point
 * that mattered — the undetectable failure is not the one that occurred.** What occurred is a
 * correct tool going unreachable, and that is entirely checkable.
 *
 * ## What this asserts, and why it is one execution rather than two assertions
 *
 * It reads the command string out of `package.json` and **runs exactly that**. One invocation
 * proves three separate things, each of which has its own way of dying:
 *
 *   1. **The `package.json` entry exists.** A one-line script entry is exactly what a merge drops
 *      silently, and it is the only discovery surface anybody actually reads (`npm run`).
 *   2. **What it points at exists and executes.** A guard that only asserted the key would be
 *      satisfied by the key — the unfalsifiable shape this branch removed four of on 2026-09-06.
 *   3. **Every one of the harness's own guards still fires**, including the four INVERSE cases,
 *      which are the half most people skip. *"Its self-tests pass today"* was an observation true
 *      by luck, because nobody was running them. This converts it into something that cannot
 *      quietly stop being true.
 *
 * **Runtime is ~3 seconds** and it makes no network call, touches no provider, and writes only
 *
 * 🔴 CORRECTED 2026-09-11: "~3 seconds" IS FALSE, AND IT IS THE SENTENCE THAT SET THIS FILE'S
 * BUDGET. Measured 22.6 s, 28.1 s and 35.8 s across three runs, and 28.09 s SOLO on an idle
 * machine — wrong by eight to twelve times. ⚠️ A budget justified by an unmeasured number is
 * how a test comes to sit at 94% of its own ceiling without anybody noticing. See the timeout
 * rationale below.
 * inside the harness's own temporary fixtures. That cost was weighed against the alternative of the
 * harness going unreachable a second time.
 *
 * ⚠️ **WHAT IT DOES NOT CLAIM.** It does not prove anybody USES the harness — that remains
 * undecidable for the reason above. It proves the harness cannot go unreachable or rot unnoticed,
 * which is a strictly smaller claim than the one Ward Lead asked for, and it is stated as such
 * rather than allowed to read as the larger one.
 */

const HARNESS = "scripts/ward-flow/mutation-run.mjs";
const SELF_TEST_SCRIPT = "mutate:self-test";
const DRIVER_SCRIPT = "mutate";

type PackageJson = { scripts?: Record<string, string> };

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const scripts = packageJson.scripts ?? {};

/*
 * ⚠️ THE PER-TEST BUDGET IS RAISED BECAUSE OF LOAD, NOT BECAUSE THE WORK IS SLOW — and the
 * shape of the evidence is what justifies it, not the number.
 *
 * Four consecutive full-suite runs over ONE unchanged population, 2026-09-11:
 *
 *     run   red file                            ms       ceiling
 *     A     ward-override-register-render    30,149      30,000
 *     B     ward-mutation-harness-reachable  35,830      30,000
 *     C     ward-override-register-render    34,987      30,000
 *     D     none — 4545 passed, 0 failed          —           —
 *
 * 🔴 THE FAILING TEST MOVED BETWEEN FILES AND NOTHING IN EITHER FILE CHANGED. All three reds
 * were `STACK_TRACE_ERROR` with no assertion, no expected and no received — vitest losing the
 * cause at registration time, which is what a starved timer looks like from the outside.
 *
 * MEASURED SOLO, on an otherwise idle machine:
 *
 *     ward-mutation-harness-reachable   28.09 s of a 30,000 ms ceiling   94%
 *     ward-override-register-render     21.5–28.6 s of the same ceiling   ~72–95%
 *
 * So neither file ever had headroom. A test at 94% of its budget with the machine to itself
 * reddens on any contention at all, and this machine runs 90–107 node processes at rest.
 *
 * 🔴 THAT FAILURE MODE IS WHY THIS IS RAISED RATHER THAN THE ASSERTIONS WEAKENED, and the
 * precedent is `tests/ward-flow-chat-control.test.ts:278–299`, which met the identical signature on
 * 2026-09-04 and wrote it down: "A gate that is red when the machine is busy and green when it is
 * quiet teaches everyone to re-run it, and A PASSING RE-RUN IS INDISTINGUISHABLE FROM A REAL PASS."
 * ⚠️ Nobody consulted that comment for SEVEN DAYS; the same diagnosis was re-derived from
 * scratch tonight. Run D above is exactly the green re-run it warns against being read as an answer.
 *
 * 🔴 CORRECTED 2026-09-11. This sentence originally named an interval FIVE TIMES TOO LONG - a
 * count of weeks where the true figure is the seven days above. The comment it cites states its
 * own date in its second line, "quiet machine, 2026-09-04", and today is 2026-09-11; the
 * subtraction was never done. Committed, and caught by a second reader who checked the arithmetic
 * rather than the point - inside the sentence complaining that nobody read the neighbouring
 * comment carefully.
 *
 * The point survives: seven days is still long enough for a written diagnosis to go unread while
 * somebody re-derives it from scratch, which is the whole reason it is cited here. What the
 * inflated figure did was make ordinary forgetting sound like neglect, and the next reader would
 * have taken it as measured, because every other number in this block is.
 *
 * ⚠️ The wrong figure is DELIBERATELY NOT SPELLED above. A correction that quotes the string it
 * removes puts that string back in the file, so a search asking "is the wrong number gone?"
 * answers no - the repair documenting itself out of its own verification. Do not helpfully restore
 * the original wording here for clarity; describing it is the point.
 *
 * 120_000 is ~4x the measured solo time: ample headroom for load, while a genuinely hung test still
 * fails in two minutes rather than never. ✅ Do not raise it further without measuring again —
 * the measurement above is the justification, not the value.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
describe("the mutation harness is reachable, and its own guards still fire", () => {
  it("is wired into package.json, which is the only surface anybody browses", () => {
    expect(
      Object.keys(scripts),
      `package.json no longer declares "${DRIVER_SCRIPT}". A tool reachable only by somebody who ` +
        "already knows the file path is not reachable — this harness sat unused for two days for " +
        "exactly that reason, while four sessions hand-rolled what it does.",
    ).toContain(DRIVER_SCRIPT);
    expect(Object.keys(scripts)).toContain(SELF_TEST_SCRIPT);
    expect(existsSync(HARNESS), `${HARNESS} is gone, but package.json still points at it`).toBe(true);
  });

  it("runs the command package.json actually declares, and every harness guard fires", () => {
    const command = scripts[SELF_TEST_SCRIPT];
    /*
     * ⚠️ RUN THE DECLARED STRING, NOT AN EQUIVALENT ONE. Re-typing `node scripts/...` here would
     * test the harness while leaving the wiring unguarded — the two would drift the moment somebody
     * renamed the script, and the test would stay green over a `npm run` entry that no longer
     * worked. Reading the command out of package.json is what ties the two together.
     */
    const run = spawnSync(command, { shell: true, encoding: "utf8", timeout: 120_000 });
    const stdout = run.stdout ?? "";
    const stderr = run.stderr ?? "";
    const output = `${stdout}${stderr}`;
    const missingSummaryDiagnostic = output.includes("self-test: all guards fire")
      ? ""
      : `\nchild status: ${run.status}\nchild stdout:\n${stdout}\nchild stderr:\n${stderr}`;

    expect(
      run.error,
      `could not execute the declared command "${command}" — the wiring points at something that ` + "does not run",
    ).toBeUndefined();
    expect(
      output,
      "the harness self-test did not report that all its guards fire. Its refusals — untracked " +
        "target, an ambiguous --find, a restore that does not verify — are the only thing standing " +
        "between a mutation control and a green from a mutant that never applied." +
        missingSummaryDiagnostic,
    ).toContain("self-test: all guards fire");
    expect(run.status, `${command} exited ${run.status}`).toBe(0);
  });
});
