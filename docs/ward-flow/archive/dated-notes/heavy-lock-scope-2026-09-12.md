# The heavy lock's actual scope — what it serialises, and what it is blind to

**Ward Verifier, 2026-09-12, measured at `f57435cd45`.** **Written because I told Ward Lead the
lock made a browser run safe to start alongside the lanes, and that was wrong in the reassuring
direction.** **The lock is real; my statement of its coverage was wider than the coverage.**

---

## 1 · 🔴 THE FINDING

> **The two heavy things this project runs are on OPPOSITE SIDES of the only coordination
> mechanism it has. A browser run and a ward vitest suite cannot be scheduled against each other
> by any tool here. Only a person can — and that person has to know which wrapper each running
> thing used.**

## 2 · The participants, enumerated rather than assumed

    scripts/measure-cls-attribution.mjs    import 1   call 1
    scripts/run-heavy.mjs                  import 1   call 1
    scripts/run-lighthouse-budget.mjs      import 1   call 1
    scripts/run-live-tests.mjs             import 1   call 1
    scripts/run-playwright.mjs             import 1   call 1     ← the browser runs
    scripts/run-vitest.mjs                 import 1   call 1     ← `npm run test`
    ────────────────────────────────────────────────────────
    scripts/run-ward-tests.mjs             import 0   call 0     🔴 THE WARD SUITE

**`scripts/run-playwright.mjs:13` imports `acquireHeavyRunLock` from `scripts/test-run-lock.mjs`
and calls it at `:124`.**

### ⚠️ A false reversal I nearly relayed, caught before sending

**`grep -rln "acquireHeavyRunLock" scripts/` LISTS `run-ward-tests.mjs`** — which reads as though
the limitation had been fixed and its header had gone stale. **It has not.** The only occurrence is
**line 40, inside the doc comment**, in the sentence that explains what the OTHER wrapper does:

> _"`npm run test` goes through `scripts/run-vitest.mjs`, which calls `acquireHeavyRunLock` first."_

🔴 **`-l` matched prose about the function, not a call to it.** **No import, no call site.** ✅ **The
distinction was settled by grepping for `^import` and for `acquireHeavyRunLock(` separately, not by
reading the file's own header a second time.**

## 3 · What `run-ward-tests.mjs` says about itself, verbatim

`scripts/run-ward-tests.mjs:37–46`:

> ⚠️ **"KNOWN LIMITATION, 2026-08-30: THIS DOES NOT TAKE A REPOSITORY COORDINATOR LEASE.**
>
> **It spawns `npx vitest` directly. `npm run test` goes through `scripts/run-vitest.mjs`, which
> calls `acquireHeavyRunLock` first; the coordinator permits at most two focused Vitest leases
> across all worktrees and treats a full run as exclusive. So several sessions running the whole
> ward suite through this wrapper bypass that limit entirely — and the limit is real: probed at
> 13:34 the coordinator refused a run outright because a live Codex worktree held capacity.**
>
> 🔴 **That is a CANDIDATE cause of the `VirtualAlloc failed` worker death this tool exists to
> catch — memory exhaustion from concurrent unthrottled runs. Stated as a hypothesis and not a
> measurement."**

## 4 · The lock's own parameters, from `scripts/test-run-lock.mjs`

    sharedLeaseLimit               2
    default wait, shared           30_000 ms
    default wait, exclusive        15 * 60_000 ms
    stale heartbeat                60_000 ms
    stale reclaim                  30 * 60 * 1000 ms

**So it has two modes and a real queue.** ✅ **It works. It is simply not consulted by the wrapper
every ward lane uses.**

## 5 · 🔴 OBSERVED, not inferred — the lock did not pause a browser run against a live ward suite

    WARDJOURNEYS start   00:22:36    (npm run test:e2e:ward-journeys)
    build begins         immediately — no wait line, no queue line, no refusal
    Ward Lead's union ward suite     still running, finished 00:23:32
    overlap                          ~56 s

⚠️ **Corroborated independently by my own load sampling, which was not taken for this purpose:**
`00:23:26 node=108` → `00:23:41 node=95`. **The drop of 13 node processes brackets Ward Lead's
finish time from a separate instrument.**

## 6 · ⚠️ THE ERROR THIS DOCUMENT EXISTS FOR

**I verified that `run-playwright.mjs` takes the lock — at two line numbers — and then wrote:**

> _"It cannot steal the machine from a lane or manufacture a false red for anybody. The question is
> 'is the lock free', which the tool answers itself — not 'is the machine quiet', which nobody can
> answer."_

🔴 **True only against other lock-takers. The lanes are not lock-takers.** **I checked that the
mechanism EXISTS and did not check WHAT IT EXCLUDES, then wrote a conclusion wider than its
coverage — in the reassuring direction, on the claim that released a scheduling hold Ward Lead was
right to be keeping.**

✅ **The general form, which is the fourth instance of one fault in two days here: compare the
CLAIM's scope against the METHOD's scope. It is checkable without knowing anything about the
subject, and it catches this whether or not anyone suspects the speaker.** ⚠️ **I had applied that
detector to two of someone else's claims earlier the same night and did not turn it on my own.**

## 7 · What follows for practice

- **"Is the machine quiet" is the question, and nothing here answers it.** A green obtained while a
  non-participating run was live is a green under unmeasured contention.
- **A contention confound can only manufacture a RED.** ✅ **It cannot manufacture a green — so an
  overlapping run makes a PASS stronger, never weaker.** That is what made Ward Lead's 4,673-pass
  union result unaffected by my build starting alongside it.
- 🔴 **The fix is not documentation.** The header has said this since 2026-08-30 and was read by
  nobody for eleven days while four lanes ran the wrapper concurrently. **Either the ward wrapper
  joins the coordinator, or every ward figure carries "unserialised" beside it.**

## 8 · What this does NOT establish

- **The `VirtualAlloc` link remains the header's hypothesis.** **No `VirtualAlloc` death occurred in
  any run I measured**; what I measured is timeout variance, which is a different failure.
- **Nobody has run the ward suite serialised** through `run-vitest.mjs` with the lease held. **That
  comparison would settle it and has not been done.**
- **I did not read the lock's admission logic**, only its constants and its call sites. Whether a
  shared lease would in fact have admitted two browser runs is untested here.
