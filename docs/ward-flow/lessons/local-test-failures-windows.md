---
name: local-test-failures-windows
description: "THIS Windows machine and the ways it makes correct work look broken — which test failures are environmental not real, where the repo must live (Dev Drive), NODE_COMPILE_CACHE, format outrunning tool timeouts, plugin native deps, CCleaner killing Docker, and abandoned sessions starving the CPU"
metadata:
  node_type: memory
  type: project
  originSessionId: e184e33f-a8c2-420c-b8f0-dbb9ddd6fc4d
  modified: 2026-08-18T10:21:15.644Z
---

**CONSOLIDATED 2026-09-09.** Seven memories about ONE subject — THIS Windows machine, and the ways it makes correct work look broken. Where the repo lives, which failures are environmental rather than real, and the background processes that degrade it.

⚠️ **Nothing is summarised — every folded section below is its original entry verbatim.** The merge exists because `MEMORY.md` is loaded in full at every session start and had exceeded its size limit, at which point it loads only PART of itself and says so nowhere. Each entry folded here gave back one index line. The only thing given up is recalling one of these without the others.

`npm run test` on this machine reports failures that are **not** caused by the diff under test. Verify before chasing them:

- **`tests/session-start-hook.test.ts` — FIXED 2026-08-18, no longer expect this one.** It failed deterministically at `:142`, expecting a Windows path (`C:\Users\...\.node24\node-v24.19.0-...\bin`) while the hook, running under Git Bash, wrote the POSIX view (`/tmp/.../node-v24.19.0-linux-x64/bin`). The assertion now compares the path tail using the unique `mkdtemp` basename, which holds on both platforms and loses no strength. If this file goes red again it is a real signal, not the old environmental one.
- **`tests/gate-receipts.test.ts` — FIXED UPSTREAM 2026-08-25 by `cbde6ecbb` "Make the gate-receipt tests environment-explicit so they pass under CI". Measured after merging origin: `Tests 34 passed (34)`, zero failures. STOP telling anyone to expect these two.** The stale expectation is the hazard now: an instruction to "expect exactly 2 failures here" tells a reader to look past a file that can once again fail for real. Kept below for the diagnosis, which is still the right one for any _future_ file-mode failure on this drive.
  Previously: 2 DETERMINISTIC failures, and NOT load. The group is "gate receipts — file modes (Codex review, PR #2216)"; both fail inside `chmodSync(path.join(root, "hook.sh"), 0o755)`. Run alone on a quiet machine: `Tests 2 failed | 32 passed (34)`. **This machine cannot represent a Unix file mode** — it is a ReFS Dev Drive with `core.fileMode=false` (see [[dev-drive-project-location]] and [[claude-hook-exec-bit-trap]], which is the same underlying fact biting a different way). Waiting for the machine to go quiet will never clear these two. Do not chase them, and do not "fix" them by relaxing what they assert — the exec-bit contract they protect is real and CI, on Linux, is where it holds.
- **`tests/codex-cloud-setup.test.ts` — times out at 30s under load, passes in isolation** (`:754`, "writes managed shell policy behaviorally"). Same contention class as the entries below; observed 2026-08-18 during a `verify:pr-local` run with several other agent sessions active.
- **`tests/worker-observability.test.ts` — times out at 30s under load, passes in isolation.** Resource contention when the full suite runs alongside other heavy commands.
- **`tests/http-readiness.test.ts` — "destroys stalled requests and resumes polling" counts one extra request under load** (`:61` expects 3, gets 4). Timing race in a polling test, same contention class. It imports only `scripts/lib/http-readiness.mjs` and node builtins, so it can never be implicated by a `src/`, `worker/`, or `supabase/` diff.
- **CORRECTED 2026-08-22 — it was never `gh`.** An earlier note here blamed the `gh` binary for taking ~97 s (`gh --version`, 2026-08-20) and pointed at Defender scanning it. Wrong diagnosis: on 2026-08-22 the same unchanged binary measured **0.2 s**, while `node --version` moved 17 s → 0.08 s over the same period. The real cause was **machine-wide process-spawn starvation** from accumulated sessions — see [[claude-session-accumulation-starves-machine]]. **The diagnostic is `time node --version`:** sub-second = healthy; several seconds = close sessions or reboot. Do not attribute slow spawns to whichever binary you happened to time first. The consequence at the time was real (tests spawning `gh` blew vitest's 30 s limit; every `git push` took 5–10 minutes because `guard-push.mjs` invokes `gh` several times) — but the fix is freeing the machine, not touching `gh`.
- **`tests/guard-push.test.ts > push-range parsing > keeps a Windows new-branch static command scoped …` times out even in isolation (61 s).** Genuinely I/O-heavy — it writes 360 files with 96-char names into a real git repo and commits them. Not a stubbing defect; deliberately NOT "fixed" by raising its timeout.
- **Whole-suite failure counts swing wildly under load.** On 2026-08-18 the same commit produced **10 failures across 8 files** on one `verify:pr-local` run and **2 failures across 2 files** on a re-run 20 minutes later, including a `@testing-library` DOM assertion that did not recur. Treat a double-digit failure count as a load signal, not a break signal, until the failing set is named.
- **THE SWING HAS A POSITIVE DIAGNOSTIC, AND IT IS IN THE LOG — 2026-09-06.** Same branch, same tree: one full run gave **2 failed files / 2 failed tests of 1183 files, 15479 tests**; a later one gave **10 failed files / 80 failed tests of 1181 files, 15285 tests**. The tell that it was the machine and not the diff was not the swing — it was that the log carried **20+ `FATAL ERROR: … Allocation failed - process out of memory`**, one `spawnSync git ENOMEM`, **25 × `spawnSync git UNKNOWN`**, and `[vitest-pool]: Worker forks emitted error` × 17. **Every one of the nine extra red files spawns a child process** (`gate-receipts`, `guard-push`, `browser-test-plan`, `adopt-visual-baselines`, `codex-cloud-setup`, `dead-code-candidate`, `dependency-drift-check`, `design-sync-contract`, `session-start-hook`, `ward-flow-chat-control`) — a machine with no memory cannot fork, so the child-process suites are exactly the ones that die. All ten passed in isolation minutes later: **302 tests, exit 0**, with 12 GB free and 54 node processes holding 7.2 GB across five live ward sessions. **Note also that fewer files were COLLECTED (1181 vs 1183) — a suite that lost two files before it started is reporting on a smaller run, and a smaller run cannot be compared with a larger one.** So: `grep -cE "FATAL ERROR|ENOMEM|Worker forks emitted error"` the log before theorising, and re-run the named set alone rather than re-running the suite.

- **🔴 "0 failed" AND "exit 1" CAN APPEAR TOGETHER, AND THE EXIT CODE IS THE ONE TELLING THE TRUTH — 2026-09-06.** A run reported `Test Files 1175 passed | 4 skipped (1180)` and `Tests 15329 passed | 0 failed`, with `vitest exit: 1`. Vitest had caught 4 unhandled errors: two heap-exhaustion `FATAL ERROR`s and two `[vitest-pool]: Failed to start forks worker … Caused by: Error: spawn UNKNOWN`. **The machine could not fork, so those files never ran — and a file that never ran contributes nothing to the failure count, so it is indistinguishable from a pass.** Same day, bash itself hit it: `fork: retry: Resource temporarily unavailable`, `cygheap read copy failed`, with 72 node processes holding 14.7 GB and 6.1 GB free; a targeted `vitest run` on one file also printed `Tests no tests` and then passed normally on immediate re-run. **The tell is the COLLECTION COUNT, not the failure count** — a healthy run on that branch collected 1183 files, this one 1180, and 1175 + 4 skipped accounts for only 1179 of its own 1180. Two of the missing files were named in the log (the default reporter lists only failures, so the third was unidentifiable) and both passed when run alone. **How to apply:** never read a zero-failure line without the exit code beside it; when they disagree, `grep -cE "FATAL ERROR|ENOMEM|Failed to start forks worker|Worker forks emitted error"` the log and compare the collected file count against a known-good run, then re-run the named files alone rather than re-running the suite.

- **🔴 `tasklist /FI "PID eq <n>"` RETURNS BLANK FOR A LIVE PROCESS UNDER LOAD — 2026-09-18, and it fails in the direction that looks like a finding.** Checking who held the machine-wide heavy-run lock, it printed nothing for the owner PID, so I read "dead", concluded the lock was stale, and wrote into two commit messages that the repo fails to reclaim a dead owner's lease. **There was no defect.** A live session was running heavy suites back-to-back and the owner PID rotates between runs; I had sampled two gaps. `tasklist` with no filter also hung past 120 s on the same machine. ✅ **Use Node's own check, the one `scripts/test-run-lock.mjs` uses, WITH BOTH CONTROLS:** `node -e "const a=p=>{try{process.kill(p,0);return true}catch(e){return e.code==='EPERM'}};console.log(a(process.pid),a(999999),a(TARGET))"` — expect `true false <answer>`. A liveness check that cannot say "alive" for your own PID cannot say "dead" about anyone else's, and the reading that happens to be right is luck. See [[a-clean-negative-that-measured-nothing]] and [[designing-a-control-that-can-actually-discriminate]].

**Why:** on 2026-08-18 two full-suite runs reported 3 and then 2 failures with **completely disjoint** file sets, which is the signature of environment/flake rather than a break. Confirmed by re-running the named files alone and by checking that neither the test nor the hook it exercises appeared in the diff.

**How to apply:** first ask whether the failure is a TIMEOUT (load) or a deterministic assertion/syscall failure — the two need different responses, and treating a deterministic one as flake means re-running forever. For timeouts, check check (a) whether the failing set differs between runs, and (b) whether the file is in `git diff origin/main..HEAD`. If both say unrelated, report them as pre-existing with that evidence rather than as verification debt — and never claim a suite is green when it is not. The flake ledger (`tests/flake-ledger.json`) is Playwright-only and intentionally empty, so it will not excuse either of these. Related: [[db-remediation-coordination-state]].

---

# node-compile-cache-set-to-1

> NODE_COMPILE_CACHE=1 is a Windows User env var on this machine; Node reads it as a directory path, so every Node tool litters a folder named \"1\

_Folded from a memory last modified 2026-08-27 on 2026-09-09. Text below is VERBATIM — nothing summarised._

`NODE_COMPILE_CACHE=1` is set as a **Windows User environment variable** on Josh's machine
(confirmed 2026-08-27: User = `1`, Machine = empty).

That variable takes a **directory path**, not a boolean. Node therefore treats `1` as a relative
directory and every tool that calls `module.enableCompileCache()` — eslint, prettier, typescript
(`tsc`, `tsserver`), jiti — creates a folder literally named `1` in whatever the current working
directory is, containing `v<node-version>-<arch>-<hash>/`. Measured: ~2,835 files / 20 MB per
worktree, present in at least 12 worktrees.

**Why it matters beyond tidiness:** the folder is untracked and not gitignored, so
`scripts/ci-change-scope.mjs` counts thousands of phantom changed files and forces every scope
classification to the heaviest route. It is also a `git add -A` landmine.

**Do not "fix" it by deleting the folders** — they regenerate on the next tool run. And do not
change the variable yourself: modifying system settings is out of bounds. Tell Josh to set it to a
real absolute path outside every repo, which both stops the litter and delivers the speed-up the
setting was presumably added for:

```powershell
[Environment]::SetEnvironmentVariable('NODE_COMPILE_CACHE','D:\.node-compile-cache','User')
```

Then a new terminal, and delete the stray `1` folders once.

Related: [[dev-drive-project-location]], [[token-usage-hygiene]].

---

# format-runs-longer-than-tool-timeouts

> npm run format exceeds 7 minutes on this repo; run it in the background or check only changed files

_Folded from a memory last modified 2026-08-22 on 2026-09-09. Text below is VERBATIM — nothing summarised._

`npm run format` (whole-tree Prettier write) on Database exceeds the 7-minute Bash timeout and gets
killed mid-run; `npx prettier --check .` took roughly 10 minutes on 2026-08-22 and passed clean.
A killed `format` left no partial writes, so it is safe to interrupt — but it produces no evidence.

**Why:** AGENTS.md requires running `npm run format` and committing the result before a normal
engineering push, and warns that a per-file check is not the repository-wide check. Both are true,
but a foreground run cannot finish inside a single tool call, so sessions either time out or skip
the gate and report it as unverified.

**How to apply:** start `npx prettier --check .` with `run_in_background: true` at the moment you
begin writing the PR body, and check `npx prettier --check <changed files>` immediately for a fast
signal. The background result usually lands before the push. The pre-push guard
(`guard-push.mjs`) independently re-runs Prettier against the pushed SHA in an isolated worktree, so
a clean changed-file check plus a successful push is already strong evidence; the whole-tree run is
what lets you quote a repository-wide line. Related: [[heavy-lock-refusal-looks-like-failure]],
[[gate-wrappers-mask-exit-codes]].

---

# claude-plugin-native-deps-trap

> Claude Code plugins with native deps ship without node_modules; npm 11 then blocks their build scripts, so the feature silently half-works

_Folded in on 2026-09-09. Text below is VERBATIM — nothing summarised._

`claude plugin install` does NOT install a plugin's npm dependencies. For plugins with
native modules (episodic-memory needs better-sqlite3, onnxruntime-node, sharp, protobufjs)
the CLI and MCP server fail with `ERR_MODULE_NOT_FOUND` until you run `npm install
--omit=dev` inside the plugin's cache directory
(`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`). That install took ~9 minutes
for episodic-memory 1.4.2.

Second trap: npm 11 on this machine blocks package install scripts by default
(`npm warn allow-scripts`), so native rebuilds report failure even though the package files
land. episodic-memory's own postinstall printed
"rebuild of better-sqlite3 failed (status=1)". Despite that warning, better-sqlite3 and the
HuggingFace embeddings both worked — verified 2026-08-21 by running `node
cli/episodic-memory.js stats` and a real `search` that returned 81% matches. So treat that
postinstall warning as advisory, not proof of breakage; prove it with `stats` + `search`
before either declaring it broken or declaring it fine.

Related: [[local-test-failures-windows]], [[checks-that-cannot-fail]].

---

# ccleaner-breaks-docker

> CCleaner repeatedly disables WSLService, which kills Docker; a watchdog scheduled task now repairs it automatically

_Folded from a memory last modified 2026-08-21 on 2026-09-09. Text below is VERBATIM — nothing summarised._

CCleaner 7 (Piriform, `C:\Program Files\Piriform\CCleaner 7`) periodically disables Windows
services in bulk sweeps, and `WSLService` is one of its casualties. With that service disabled,
WSL cannot create a VM (`0x80070422`) and Docker Desktop hangs "starting" forever, blaming
whichever disk it was touching — which sends you chasing `.wslconfig`, the Dev Drive, or the
86 GB image disk instead of the actual cause.

Confirmed on 2026-08-22 from System event 7040: `WSLService` was disabled on 23 Jul, 30 Jul,
6 Aug, 14 Aug, 19 Aug (twice) and 22 Aug. Four of those disable events landed in the same minute
a CCleaner log file was created. The same sweeps also disabled Tailscale, the Claude service,
Intel Graphics Software and Microsoft Copilot Elevation Service. A "CCleaner 7 - Skip UAC"
scheduled task lets it do all of this with Administrator rights and no prompt.

**Why:** re-enabling the service fixes the day and not the week — without knowing the cause, the
outage recurs every few days and each time looks like a fresh, different Docker fault.

**How to apply:** if Docker hangs starting, check `WSLService`'s start type before anything else
(`Get-CimInstance Win32_Service -Filter "Name='WSLService'"`). A watchdog scheduled task,
`DockerRepair-KeepServicesEnabled`, now fires on event 7040 and restores WSLService, vmcompute,
hns, BFE and com.docker.service if any is found Disabled — measured recovery ~46s. It runs as
SYSTEM, so a non-elevated `schtasks /Query` on it returns "Access is denied", which means it
exists, not that it is missing. Remove it with `fixdockerdesktop.bat -unguard`.

The repair tool is `C:\Users\joshs\Desktop\fixdockerdesktop.bat` (self-elevating, log to
`Desktop\docker-fix-log.txt`); `-check` diagnoses without changing anything. See
[[dev-drive-project-location]] for the Dev Drive that these hunts keep misattributing faults to.

## Still open as of 2026-08-22 02:30

Josh decided to **uninstall CCleaner** (Settings > Apps > Installed apps > CCleaner 7) but had
not done it yet when the session ended. Until that happens the watchdog is the only thing
holding Docker up, and it is a mitigation, not the fix. If a later session sees fresh 7040
disable events for `WSLService`, CCleaner is still installed — check before re-diagnosing.

Also unresolved: Docker's data disk was rebuilt from empty at 2026-08-21 23:55, leaving 9 images.
Nobody recorded how many existed before, so it is unknown whether anything was lost. Do not
repeat the "40 images" figure from that session — it was asserted and never verified.

---

# dev-drive-project-location

> The Database repo lives on the D: Windows Dev Drive (ReFS); C: worktrees belong to other agents and are out of scope

_Folded from a memory last modified 2026-08-22 on 2026-09-09. Text below is VERBATIM — nothing summarised._

The canonical location for this project is **`D:\Repos\Database`** on a **Windows Dev Drive**
(`D:`, ReFS, 80 GB as of 2026-08-22). The npm cache is on the same volume at `D:\.npm-cache`. Treat `D:` as the
project drive for every measurement, cleanup proposal, and capacity claim.

**Ignore the C: worktrees.** As of 2026-08-18 the repo had 48 registered worktrees split almost
evenly across volumes — 21-with-`node_modules` on `D:`, 21 on `C:` under
`C:\Users\joshs\.codex\worktrees\` and `C:\Users\joshs\.gemini\antigravity\worktrees\`. The `C:`
ones belong to Codex and Antigravity/Gemini sessions, not to Claude Code. Do not count them,
clean them, or cite them in disk figures. The user's instruction: "mark Dev drive as the project,
forget C drive."

**Why the drive matters, not just as trivia:**

- `core.fileMode=false` here, because Windows has no POSIX permission bits. Git therefore ignores
  filesystem exec bits entirely, and a local `chmod +x` is a silent no-op. The only way to make a
  script executable in the index is `git update-index --chmod=+x <path>`. This blind spot shipped
  `.claude/hooks/session-start.sh` as `100644` while both siblings were `100755` — see
  [[claude-hook-exec-bit-trap]].
- Capacity is a real constraint, not hygiene. On 2026-08-21 `D:` was **6 GB free of 50 GB
  (88% full)**; after a worktree clean-up and a resize it is **80 GB with ~60 GB free
  (2026-08-22)**. 16 D: worktrees each hold a **real** (never junctioned/hardlinked)
  `node_modules` at ~0.89 GB, and worktree `.next` build output added another 4.8 GB.
  `npm run clean:worktree -- --merged --squashed --dry-run --drive D` is the first-line
  remedy and it refuses to touch the current worktree, main, dirty trees, or patch-id
  candidates it could not corroborate. Every new `newtask` worktree costs ~0.9 GB.
  ReFS hardlinks are supported (probed directly), but npm extracts fresh copies rather than
  linking from cache, so there is no dedup in practice.

- **`D:` is a dynamically-expanding VHDX at `C:\DevDrive\DevDrive.vhdx`, not a partition.**
  Growing it is two steps and both need an elevated shell with nothing holding `D:` open:
  `diskpart` `detach vdisk` / `expand vdisk maximum=<MB>` / `attach vdisk`, then
  `Resize-Partition -DriveLetter D -Size (Get-PartitionSupportedSize -DriveLetter D).SizeMax`.
  The Hyper-V PowerShell module is **not installed**, so `Get-VHD` / `Resize-VHD` do not exist
  here — use `diskpart`. Helper scripts live in `C:\DevDrive\`. Trap found 2026-08-22: the
  "expand to 100 GB" helper was a copy of the 80 GB one with only the label changed, so it
  passed `maximum=81920` (= 80 GB, the size it already was), expanded nothing, and still printed
  a green `DONE`. Fixed to `102400` plus a post-resize size assertion. `expand vdisk` to a size
  at or below the current one is a **silent no-op** — always assert the resulting size.

- Because the cache sits on `D:`, the `C:` worktrees are cross-volume from it and cannot link at
  all — another reason they are the other tools' problem, not this project's.
- `fsutil devdrv query D:` needs elevation and returned `Access denied`, so Dev Drive trusted
  state and whether `D:\.npm-cache` is a registered trusted cache are **unverified**. If it is not
  registered, Defender is scanning every install.

Related: [[local-test-failures-windows]] — `tests/session-start-hook.test.ts` has a pre-existing
Windows path failure (POSIX vs `C:\...` path assertion) unrelated to any current diff.

---

# claude-session-accumulation-starves-machine

> Abandoned Claude sessions accumulate until the workstation is CPU/RAM starved and every command takes seconds — diagnose by process spawn latency, not by feel

_Folded from a memory last modified 2026-08-21 on 2026-09-09. Text below is VERBATIM — nothing summarised._

On 2026-08-22 the workstation had **43 concurrent `claude.exe` sessions**, the oldest ~49 hours
old, holding 8.9 GB and leaving 2.4 GB free of 32 GB. A stray `find` (PID 56428) had also been
pinning a full core for 18 hours. Symptom the user reported was simply "Claude is slow".

**The diagnostic that actually works** — measure tiny-process spawn latency, because that is what
Windows starvation degrades and what every hook/tool call pays:

- Healthy: ~10-40 ms for `cmd /c "exit 0"`.
- Starved that day: **1800 ms**. After cleanup: **40-83 ms**. Free RAM 2.4 GB -> 15.2 GB.

**Do not trust `Win32_Processor.LoadPercentage`.** It read a flat `100%` both before and after the
fix. A sampled `Get-Process | $_.CPU` delta over 5-6 s showed the truth: real consumers totalled
only ~29% of the 8 cores once the stuck process was gone. Sample the delta; never quote the WMI
snapshot as evidence.

**Why it hurts this repo specifically:** every Bash/PowerShell tool call fires three hook
invocations (`pr-handoff-stop.sh` pre + post, `push-format-guard.sh`) registered in
`.claude/settings.json`. Each spawns dozens of subprocesses. At healthy spawn latency that is
~5-6 s per command; under starvation it was 12-26 s, which is what "slow" actually meant.

**Not fixable from inside a session:** Defender real-time + script scanning are on, `D:` is an
80 GB ReFS Dev Drive, and reading or setting exclusions needs admin. Changing security settings is
prohibited for the agent — recommend Dev Drive performance mode / exclusions to the user and let
them do it.

**Why:** the user leaves sessions open across days; nothing reaps them, so this recurs.

**How to apply:** if the user says Claude feels slow, time a trivial spawn first, then count
`claude.exe` processes and their ages, before touching the repo, the hooks, or `AGENTS.md`.
Killing abandoned sessions loses only the chat — files on disk are untouched — but it is not
reversible, so list what will die before killing. Related: [[token-usage-hygiene]] (do NOT shrink
`AGENTS.md` to chase speed — that is a separate, deliberate decision), and
[[concurrent-agent-worktree-destruction]] for the other cost of many live sessions.
