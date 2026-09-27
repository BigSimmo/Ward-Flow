#!/usr/bin/env node
/**
 * WHO IS IN WHICH WORKTREE — resolve a ward chat by LOCATION, never by name.
 *
 * A session name is not an identity. On 2026-09-01 one session messaged as `database-46` saying it
 * was NOT Ward Lead, then messaged again as `Ward Lead` from the identical address; every session
 * was renamed twice more the same day; a branch called `ward-flow-ward-board` held no board work
 * while `ward-flow-print-fixes` held all of it; and a worktree folder named for commit 89d7f99ec
 * had a different commit checked out. Four labels, four lies, one day.
 *
 * A FOLDER cannot lie about which branch is checked out in it, because git answers that, not the
 * occupant. So identity is anchored to the folder and everything else is derived.
 *
 * ⚠️ **THIS IS A FOLDER AUDIT, NOT AN IDENTITY SYSTEM, AND IT WOULD NOT HAVE PREVENTED THE
 * CONFUSION DESCRIBED ABOVE.** It answers "what is checked out in folder X". The failure asked a
 * different question — "who sent this message" — and an inbound message carries a name and a
 * transport ADDRESS, never a folder. Nothing here connects a marker to a message.
 *
 * What actually resolved that confusion was the transport address: both messages arrived from the
 * identical pipe, an identifier the occupant cannot choose the way it chooses a display name, and
 * it survived two rename waves the same day. **Route on the address. Use this to verify a folder
 * claim ONCE, and never as the thing that says who is speaking.** Full protocol in
 * docs/ward-flow/who-is-who.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = ".ward-session.json";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/** Folder -> { branch, head }, straight from git. Nothing here is self-reported. */
function worktrees() {
  const out = [];
  let current = null;
  for (const line of git(["worktree", "list", "--porcelain"]).split(/\r?\n/)) {
    if (line.startsWith("worktree ")) current = { dir: line.slice(9), branch: null, head: null };
    else if (line.startsWith("HEAD ")) {
      if (current) current.head = line.slice(5, 12);
    } else if (line.startsWith("branch ")) {
      if (current) current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line.startsWith("detached")) {
      if (current) current.branch = "(detached)";
    } else if (line === "" && current) {
      out.push(current);
      current = null;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * The marker a chat writes INSIDE its own worktree. It is a claim — but a claim pinned to a
 * location, which is the binding that was missing. A marker naming a branch the folder does not
 * hold is reported as STALE rather than believed.
 */
function marker(dir) {
  const file = path.join(dir, MARKER);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { role: "(unreadable marker)", session: "?", branch: null };
  }
}

/**
 * 🔴 **A WORKTREE UNDER A TEMP OR SCRATCHPAD PATH IS A BUILD ROOT, NEVER A ROLE.** Playwright and
 * this project's own baseline checks create detached worktrees under the OS temp directory; the
 * register used to list them as `unclaimed`, which is a FALSE STATEMENT THE TOOL MAKES ABOUT ITSELF
 * — "unclaimed" means "a role nobody has taken", and no role was ever going to be taken there.
 *
 * ⚠️ **The filter is narrow on purpose, and it is a FILTER, not a widening of what counts as a
 * match.** It excludes only paths inside the OS temp directory or carrying a literal `scratchpad`
 * segment. It can never hide a real worktree under D:/Worktrees or D:/Repos, and the count it hides
 * is printed, as with the name filter above.
 */
export function isTransient(dir) {
  const normalised = dir.split("\\").join("/").toLowerCase();
  const temp = os.tmpdir().split("\\").join("/").toLowerCase();
  return normalised.startsWith(`${temp}/`) || /(^|\/)scratchpad(\/|$)/u.test(normalised);
}

/**
 * The three states, unchanged in meaning and now returned rather than printed, so a test can reach
 * them without parsing the table. `held` is the half that matters to D-5: it is true ONLY for a
 * marker git has actually corroborated.
 */
export function statusOf(mark, branch) {
  if (!mark) return { status: "no marker", held: false };
  if (!mark.branch) return { status: "UNVERIFIABLE (marker claims no branch)", held: false };
  if (mark.branch !== branch) return { status: `CONTRADICTED (marker says ${mark.branch})`, held: false };
  return { status: "verified", held: true };
}

/**
 * 🔴 **A CONTRADICTED MARKER MUST NOT OCCUPY THE ROLE COLUMN, AND UNTIL NOW IT DID.** The row
 * printed `Ward Lead` on the left and the contradiction on the right, so the register showed two
 * Ward Leads and left the reader to notice which one was real — in a column whose entire job is to
 * answer "who holds this role".
 *
 * ⚠️ **THIS DOES NOT WEAKEN THE DETECTOR AND MUST NEVER BE MADE TO.** The contradiction is still
 * reported, still names the branch the marker claims, and the claimed role is still shown — moved
 * into the status text, where it reads as evidence rather than as an answer. A repair that made the
 * mismatch stop printing would be a clean register and a blind one, which are the same shape.
 */
export function roleColumn(mark, held) {
  if (!mark) return "unclaimed";
  return held ? mark.role : "(stale claim)";
}

const argv = process.argv.slice(2);
const showAll = argv.includes("--all");
const roleFlagAt = argv.indexOf("--role");
const roleQuery = roleFlagAt === -1 ? null : (argv[roleFlagAt + 1] ?? "");
const wanted = argv.filter((a, i) => !a.startsWith("--") && i !== roleFlagAt + 1)[0]?.toLowerCase() ?? null;

/*
 * ⚠️ THE DEFAULT VIEW FILTERS BY NAME, WHICH IS THE MISTAKE THIS TOOL EXISTS TO FIX — so the
 * filtering is now VISIBLE rather than silent. Ward Verifier found the old filter omitted
 * D:/Worktrees/Database/pr-2390-fix: no "ward" in the path and no marker, yet it is the recorded
 * working line and one of the six live paths a verification claim depends on. A who-is-where
 * tool that cannot see the working line is doing exactly what it was built to prevent.
 *
 * The filter stays — this machine has over 160 worktrees and an unfiltered list is unusable.
 * What changed is that the number it hides is printed, and --all removes it.
 */
/**
 * 🔴 **THE MAIN BODY RUNS ONLY WHEN THIS FILE IS THE COMMAND, NOT WHEN IT IS IMPORTED.** The
 * three decisions above are exported so a test can reach them directly rather than regex-matching a
 * human-facing table — which would pin the formatting instead of the decision. ⚠️ **Without this
 * guard, importing the module shells out to git, prints a table into the test output, and — in
 * `--role` mode — calls `process.exit`, which ends the test RUN rather than the test.** A suite that
 * dies mid-file and a suite that finishes are not distinguishable from an exit code, which is the
 * failure this project has now recorded six times.
 */
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

function main() {
  const all = worktrees().map((w) => ({ ...w, mark: marker(w.dir) }));
  const transient = all.filter((w) => isTransient(w.dir) && !w.mark);
  const candidates = showAll ? all : all.filter((w) => !transient.includes(w));
  const rows = showAll ? candidates : candidates.filter((w) => w.mark || /ward/i.test(w.dir));
  const hidden = candidates.length - rows.length;

  /**
   * 🔴 **THE ROLE LOOKUP D-5 ACTUALLY NEEDS, AND IT REFUSES RATHER THAN GUESSES.** The owner's
   * amended rule routes a protected-work deletion to whoever holds the VERIFIER ROLE. A table a human
   * reads is not an answer to that; this is. It exits non-zero, with a sentence saying which of the
   * two failures happened, when the role resolves to NO verified holder or to MORE THAN ONE.
   *
   * ⚠️ **Only `verified` holders are eligible.** A contradicted or unverifiable marker cannot answer
   * a routing question — that is the whole point of amendment 4, and it is why the eligibility test
   * here is `held`, not "a marker exists saying this role".
   */
  if (roleQuery !== null) {
    const q = roleQuery.trim().toLowerCase();
    if (q === "") {
      console.error('--role needs a role name, e.g. --role "ward verifier".');
      process.exit(2);
    }
    const holders = all.filter((w) => {
      const { held } = statusOf(w.mark, w.branch);
      return held && String(w.mark.role).toLowerCase() === q;
    });
    if (holders.length === 1) {
      const w = holders[0];
      console.log(`${w.mark.role}
    session ${w.mark.session}
    branch  ${w.branch}@${w.head}
    dir     ${w.dir}`);
      process.exit(0);
    }
    const claimants = all.filter((w) => w.mark && String(w.mark.role).toLowerCase() === q);
    const lines =
      holders.length === 0
        ? [
            `NO VERIFIED HOLDER of role "${roleQuery}". ${claimants.length} marker(s) claim it and git corroborates none of them.`,
            `Routing to this role is NOT safe. Repair the register, or ask the owner directly — do not proceed on silence.`,
          ]
        : [
            `${holders.length} VERIFIED HOLDERS of role "${roleQuery}". A role with two holders cannot be routed to.`,
            ...holders.map((w) => `  ${w.dir}  ${w.branch}`),
          ];
    console.error(lines.join("\n"));
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log("No ward worktrees and no session markers found.");
    process.exit(0);
  }

  let contradicted = 0;
  for (const w of rows) {
    const m = w.mark;
    const { status, held } = statusOf(m, w.branch);
    if (status.startsWith("CONTRADICTED")) contradicted += 1;
    const role = roleColumn(m, held);
    const claimedRole = m && !held ? `, claims role ${m.role}` : "";
    const session = m?.session ?? "-";
    if (wanted && !`${role} ${m?.role ?? ""} ${w.dir}`.toLowerCase().includes(wanted)) continue;
    console.log(
      `${role.padEnd(14)} ${String(session).padEnd(34)} ${w.branch ?? "?"}@${w.head ?? "?"}
  ${" ".repeat(14)} ${w.dir}   [${status}${claimedRole}]`,
    );
  }

  if (transient.length > 0 && !showAll) {
    console.log(
      `
  ${transient.length} transient build root${transient.length === 1 ? "" : "s"} excluded — temp/scratchpad paths, which are not roles and were never going to be claimed. --all shows them.`,
    );
  }

  if (hidden > 0) {
    console.log(
      `
  ${hidden} further worktree${hidden === 1 ? "" : "s"} hidden by the name filter — run with --all to see every one.`,
    );
  }

  /**
   * ⚠️ **THE ONE LINE THAT MAKES A CLEAN REGISTER MEAN SOMETHING.** A register with no
   * contradictions and a register that can no longer detect one print the same table. This prints the
   * count either way, so "zero contradicted" is a MEASUREMENT the reader can see was taken, never an
   * absence they have to infer from silence.
   */
  console.log(`
  ${contradicted} contradicted marker(s) among ${rows.length} listed worktree(s).`);
}

if (invokedDirectly) main();
