import { describe, expect, it } from "vitest";

import { isTransient, roleColumn, statusOf } from "../scripts/ward-flow/whois.mjs";

/**
 * 🔴 **THE ROLE REGISTER, PINNED — BECAUSE OWNER RULING D-5 NOW ROUTES AN IRREVERSIBLE ACT THROUGH
 * IT.** As amended on 2026-09-12, a protected-work deletion goes to whoever holds the VERIFIER ROLE,
 * and silence is not approval. That makes `whois.mjs` load-bearing for the first time: it is no
 * longer a convenience for a human reading a table, it is the thing that answers "who do I send this
 * to", and a wrong answer routes a deletion into a void.
 *
 * ⚠️ **THE REPAIR THIS FILE GUARDS HAS AN OBVIOUS WRONG VERSION, AND IT LOOKS IDENTICAL FROM THE
 * OUTSIDE.** Widen what counts as a match, or stop listing the rows that disagree, and the register
 * prints clean — having lost the ability to detect a mismatch at all. **A clean register and a
 * register that can no longer tell are the same shape.** Every assertion below exists to make the
 * second one fail.
 *
 * ⚠️ **WHY THE HELPERS ARE EXPORTED RATHER THAN THE TABLE PARSED.** The script's output is a
 * human-facing table; a test that regex-matches it pins the formatting and not the decision. These
 * three functions are the decision. Importing them also means the script must not run its main body
 * on import — that guard is part of what is being protected here.
 */

describe("a marker only holds a role when git corroborates it", () => {
  const HELD = { role: "Ward Lead", session: "s", branch: "codex/task-ward-flow-live-state-20260831" };

  it("verifies a marker whose claimed branch is the branch actually checked out", () => {
    const { status, held } = statusOf(HELD, "codex/task-ward-flow-live-state-20260831");
    expect(status).toBe("verified");
    expect(held).toBe(true);
  });

  /**
   * 🔴 **THE CASE THAT PRODUCED THE RULE.** A marker left behind in an abandoned worktree still
   * named its old role and its old branch, while that folder had moved to a different branch. The
   * register printed `Ward Lead` in the role column on the left and the contradiction on the right —
   * so it showed two Ward Leads and left the reader to work out which was real, **in the one column
   * whose entire job is to answer that question.**
   */
  it("does not let a contradicted marker occupy the role column, and still reports the contradiction", () => {
    const { status, held } = statusOf(HELD, "claude/ward-lead-outstanding-2026-09-02");
    expect(held).toBe(false);
    expect(status).toContain("CONTRADICTED");
    expect(status, "the detector must still name the branch the marker claims").toContain(
      "codex/task-ward-flow-live-state-20260831",
    );
    expect(roleColumn(HELD, held), "a stale claim must not read as a held role").toBe("(stale claim)");
    expect(roleColumn(HELD, held)).not.toBe("Ward Lead");
  });

  /**
   * ⚠️ **THREE STATES, NOT TWO.** A marker that omits `branch` cannot be compared against git at
   * all, and once printed the same word as a claim git had actually checked. An unchecked claim
   * wearing the verified badge is a label lying with this tool's authority behind it.
   */
  it("treats a marker that claims no branch as unverifiable, never as verified", () => {
    const { status, held } = statusOf({ role: "Ward Lead", session: "s", branch: null }, "any-branch");
    expect(held).toBe(false);
    expect(status).toContain("UNVERIFIABLE");
    expect(roleColumn({ role: "Ward Lead" }, held)).not.toBe("Ward Lead");
  });

  it("reports a folder with no marker as unclaimed", () => {
    const { status, held } = statusOf(null, "some/branch");
    expect(status).toBe("no marker");
    expect(held).toBe(false);
    expect(roleColumn(null, held)).toBe("unclaimed");
  });
});

/**
 * 🔴 **A TEMP OR SCRATCHPAD WORKTREE IS A BUILD ROOT, NEVER A ROLE**, and listing one as
 * `unclaimed` was a false statement the tool made about itself: "unclaimed" means a role nobody has
 * taken, and no role was ever going to be taken in a Playwright build root.
 *
 * ⚠️ **THE DANGER IN FIXING IT IS THE FILTER GROWING.** A path filter that widens swallows real
 * worktrees silently and the register goes clean by forgetting them — which is the same failure in
 * the other direction. The negative cases below are the half that matters.
 */
describe("the transient filter excludes build roots and nothing else", () => {
  it.each([
    "C:/Users/joshs/AppData/Local/Temp/claude/D--Worktrees-Database-ward-lead/abc/scratchpad/baseline-e0cdd306d3",
    "C:/Users/joshs/AppData/Local/Temp/claude/x/scratchpad/clean-check",
    "D:/anywhere/scratchpad/probe",
  ])("excludes %s", (dir) => {
    expect(isTransient(dir)).toBe(true);
  });

  it.each([
    "D:/Worktrees/Database/ward-lead",
    "D:/Worktrees/Database/ward-verifier-9afb82c6e",
    "D:/Worktrees/Database/ward-mockups",
    "C:/Users/joshs/.codex/worktrees/ward-flow-live-state-20260831/Database",
    "D:/Repos/Database",
  ])("never excludes the real worktree %s", (dir) => {
    expect(isTransient(dir), "a filter that hides a real worktree is the same defect facing the other way").toBe(false);
  });

  /**
   * ⚠️ **`scratchpad` MUST BE A PATH SEGMENT, NOT A SUBSTRING.** A worktree legitimately named
   * `ward-scratchpad-review` is a real worktree; matching the bare word would hide it.
   */
  it("matches scratchpad as a whole path segment, not as a substring of a name", () => {
    expect(isTransient("D:/Worktrees/Database/ward-scratchpad-review")).toBe(false);
    expect(isTransient("D:/Worktrees/Database/scratchpadding")).toBe(false);
  });
});
