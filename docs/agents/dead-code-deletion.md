# Deleting Code You Believe Is Dead

_Updated 2026-10-24 - `worker/` is no longer searched; the deepen fetch needs confirmation under hard rule 3; Documentation owns._

> **Ward Flow scope note (3 October 2026):** `npm run check:dead-code-candidate` remains active and fails closed by default in `BigSimmo/Ward-Flow` (with `DEAD_CODE_OWNER_APPROVED=1` permitted only on a single owner-approved invocation per [`AGENTS.md`](../../AGENTS.md)). Historical PsychSift examples below (`bestEffortReembedRegistryRecordAfterEdit`, `worker/`, PR #2204) are retained for provenance only.

<!-- BEGIN:dead-code-deletion -->

# Deleting code you believe is dead

"Nothing imports it" is necessary and **nowhere near sufficient**. On 2026-08-20 a cleanup
sweep (PR #2204) targeted ~1,644 lines on that single test and had to be walked back seven
times. Four of the survivors had zero importers and were all alive: Ward Flow's
`wallClockNow` and `movementsByStage` (named exports in a phase plan whose 55 tasks were all
unchecked), the Caring Contacts fixtures, and `bestEffortReembedRegistryRecordAfterEdit`
(any future registry write route **must** call
it). A module contract whose consumer has not been written yet is indistinguishable from
debris under a reachability scan.

Before removing any exported symbol, run:

```bash
npm run check:dead-code-candidate -- --diff origin/main
```

It fails closed and refuses a candidate that is: named in a `docs/superpowers/plans|specs`
file with unchecked tasks; pinned by a committed test; present as a string literal anywhere
in `src`/`tests`/`scripts` (the PsychSift `worker/` tree was dropped from this search on 26 September 2026);
introduced within `DEAD_CODE_RECENT_DAYS` (default 30); or assessed on a **shallow clone**,
where nothing can be dated — deepen the history with `git fetch --deepen=2000` rather than
proceeding on the weaker signal. That fetch is network Git, so ask Josh first (AGENTS.md hard rule 3). It also warns when the symbol is mentioned in any doc, and when its file
still exports other symbols, because deleting the file is then wrong even if the symbol is not.

A refusal exits 1 by default. The only exception is an explicit per-run override,
`DEAD_CODE_OWNER_APPROVED=1`, which is permitted only when Josh has approved that specific
cleanup for that run; set it on the single invocation, never as a default, never inside a
script or hook, and record the approval in the PR.

Do not tune the threshold or the refusal list to make an existing diff pass. The sweep's
own diff was cut back to satisfy this gate, not the other way round.

<!-- END:dead-code-deletion -->
