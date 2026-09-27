# Opening prompt — third edition repair

Paste the block below as the first message of a new chat. Written 2026-09-09 by Ward Lead, from the
review at [`third-edition-review-2026-09-09.md`](third-edition-review-2026-09-09.md).

```
You are WARD DESIGN REPAIR for Ward Flow. Work in a fresh worktree cut from the master line
codex/task-ward-flow-live-state-20260831 (it was at c23729d8a6; confirm with git log, it moves).
Ward Lead merges; you commit and hand back.

STANDING RULES — these override anything you infer later:
- Ward Flow is NEVER pushed. It exists on this disk only. Do not push, do not open a PR.
- Never `git add -A`, never bare `git stash`, never delete or move a worktree.
- Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so EVERY time.
- Josh is a psychiatrist, not an engineer. Answer first, plain English, numbered steps, no file
  paths or jargon unless he asks.
- Before deleting or moving anything matching ward-flow / ward-management / ward-board, or ANY
  handover or decision document INCLUDING superseded ones, ask him first and say exactly what
  would be lost.
- One chat per folder. Never two — the pre-commit hook reads the whole tree, so two chats in one
  folder deadlock and NEITHER can commit until one tree is empty.
- Set MSYS2_ARG_CONV_EXCL="*" in every shell. Without it `git show <rev>:<path>` is mangled into a
  Windows path and you get a FALSE "does not exist".

YOUR SUBJECT is PR #2738, merged to main at ef582b110f — a "third edition" design system, a Command
mockup, and a self-check kit. Read `docs/ward-flow/third-edition-review-2026-09-09.md` first; it is
the review this brief compresses. RE-DERIVE ANYTHING YOU INTEND TO ACT ON. Every finding below was
measured, but a measurement has a shelf life and three of these files have been edited since.

THE FILES ARE NOT IN THE WARD LINE'S WORKING TREE. They are on origin/main. Read them with
`git show ef582b110f:<path>`.

=== A. THE COMMAND DRAWING IS NOT SAFE TO BUILD FROM — five claims the data cannot support ===

A mockup sits outside every gate, which is the whole risk: a defect that was found and fixed in the
live app can be redrawn, approved and published, and nothing goes red. That is what happened here.
Three of these five change WHICH BED a coordinator is shown first.

1. A FABRICATED ACUITY GATE. Units carry acuityInUse/acuityCeiling, movements carry highAcuity, and
   eligibility is decided by `acuityOk = !m.highAcuity || u.acuityInUse < u.acuityCeiling`.
   ELIGIBILITY_GATES (src/components/ward-management/ward-eligibility.ts) is a fixed list of twelve
   and acuity is not among them; `highAcuity` appears nowhere in the repository outside the mockup.
   ⚠️ AND THE SAME PAGE SAYS THREE TIMES that search never returns an acuity score. It disclaims the
   thing it then sorts beds by.

2. THE PREVIOUSLY-DECLINED RULING, INVERTED. The drawing puts prior_decline in its absolute tier
   alongside "no bed exists", and states "a recorded reason does not undo a ward's decline". The
   live model has INFORMATIONAL_GATES = ["prior_decline"] in ward-derivations.ts, ranks it ABOVE
   overridable, and needsNoRecordedReason() returns true — because the owner ruled that
   re-approaching such a ward needs NO WRITTEN REASON. The drawing presents the easiest route as the
   hardest.

3. A TENTATIVE DIAGNOSIS ON PRE-BED PATIENTS. The ICD-10-AM vocabulary is real and current, but it
   is wired to Admission.tentativeDiagnosis, which exists only AFTER a bed is confirmed. Movement has
   no diagnosis field and Referral's own guard forbids one. Command's population is people still in
   an emergency department, who by definition cannot have one.

4. AN INVENTED CATCHMENT GATE (`u.service === m.homeService`), overridden four times in the drawing's
   own register. Neither eligibility() nor referralEligibility() tests any such thing.

5. 🔴 A PREVIOUSLY-FIXED DEFECT, RE-COMMITTED. "2 specialling shifts available, 1 required" —
   Movement.specialling is a BOOLEAN. The live gate carries a comment naming this exact claim as a
   fixed bug: the authored total is never decremented, so the screen told coordinators slots were
   free and PULL_PATIENT then refused the placement. tests/ward-specialling-detail-claims-no-headroom.test.ts
   guards it. A TEST CANNOT SEE A DRAWING.

⚠️ TWO OF THESE MAY BE THINGS JOSH WANTS TO EXIST — the acuity gate and the catchment rule are
clinical questions, not errors. PUT THEM TO HIM; do not decide them. The other three are wrong
against rulings already made and should be corrected in the drawing.

=== B. THE IDENTITY REPLACEMENT IS JOSH'S DECISION, NOT A DEFECT — do not act without his answer ===

The third edition REPLACES the locked design language rather than extending it. Nine of eleven
locked colours changed, two dropped with no successor, and the heading face swapped from Schibsted
Grotesk to Source Serif 4 — a family new to this repository. Kept: Source Sans 3, JetBrains Mono,
13.5px base, tabular numerals. The accent moved from teal #0e7c86 to navy slate #2f4c66, which is a
hue swap and not a shade.

Its own section 13 is a FIVE-WAVE PLAN to migrate all eighteen mockups onto the new identity,
including the ones currently correct. So this is a whole-programme decision that arrived inside a
merged pull request. ⚠️ DO NOT START THE MIGRATION. Ask him.

=== C. GRAFT TRAPS — real defects whichever way B goes ===

6. TOKEN NAME COLLISIONS. The kit names tokens bare (--surface, --danger, --ink, --accent, --line…)
   where the live app namespaces everything --ward-* precisely so nothing collides. --surface and
   --danger ALREADY EXIST in src/app/globals.css with different values. The kit's own instruction is
   to copy its stylesheet "verbatim", which would silently overwrite them. Namespace them.

7. TWO RAW HEX VALUES in files whose own commentary claims tokens only: four #000 in a mask-image
   ramp in shell/shell.css (self-disclosed in SHELL-NOTES.md) and `background: #fff` in a print block
   in design-system-third-edition.html. Raw colour under src/components/ward-management is forbidden
   with no exemption; a drawing meant to be grafted should not need it.

=== D. THE SELF-CHECK KIT — mostly honest, one gate that cannot fail ===

⚠️ SAY THIS PART OUT LOUD BEFORE THE CRITICISM: thirteen distinct claims were broken one at a time
and ALL THIRTEEN went red with the correct message, no cross-contamination. check.mjs,
check-standard.mjs and shell/check-preview.mjs are genuinely discriminating. Do not rewrite them.

8. 🔴 recompute-contrast.mjs CANNOT FAIL. Fed text at 1.29:1 — functionally invisible — it printed
   the violation AND eight discrepancies against its own reference file, and exited 0.
   `grep -n "process.exit\|exitCode"` returns NOTHING: there is no failure path in the source. Worse,
   it REWRITES the page it audits on every run, so a re-run after a defect absorbs the bad numbers
   into the artifact instead of reporting them. Give it a failure path AND stop it writing to its
   own subject. Prove the fix by feeding it a bad pair and watching the exit code.

9. ALL THREE PLAYWRIGHT CHECKERS hardcode chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }),
   a path from the Linux sandbox they were authored in. They crash on this machine. Every result in
   the review needed that one line patched first. Nobody can run this kit's own verification here as
   shipped.

10. check-output.txt RECORDS ONLY check.mjs, twice. The two more thorough checkers — one sweeping
    ~2,980 elements against check.mjs's ~430, the other the ONLY thing that touches shell/preview.html
    — have never had their output recorded anywhere. "The run it claims" covers half the kit.

11. 🔴 REVIEW-FINDINGS.json IS STALE AND HAS NO WAY TO SAY SO. 82 findings; grep for status/fixed/
    resolved/open returns ZERO matches — there is no such field. Of eight sampled across all
    severities, SIX were already fixed in the shipped file, including two "high" items from two
    different reviewers. Read at face value it says 82 open problems. Add a status field before
    anyone re-fixes six things.

=== E. COVERAGE — the standard's twelve screens are not the system's screens ===

12. The third edition indexes TWELVE screens. Josh's own inventory names fifteen or sixteen. The
    twelve leave out Delays, New patient, Discharges, Transport officer, Out of area, the network
    diagram, the bed board and the entry page. Two matter more than the rest: DELAYS is the screen
    Josh personally locked and reviewed, and NEW PATIENT is his stated first priority and the front
    door of the whole system. Handover, his second priority, IS covered. See
    docs/ward-flow/mockup-coverage-2026-09-09.md.

13. 🔴 FIVE DRAWINGS EXIST ONLY AS ARTIFACTS AND NOT IN THE REPOSITORY: Command, Capacity, Movements,
    Delays and the patient "Now" screen. Searched every branch across the whole history — no HTML
    file has ever existed for any of them. The Delays case is the sharpest: the built screen is
    supposed to match a drawing Josh locked, and nobody working in the code can reach it to check.
    Getting those five exported into docs/ward-flow/design/prototypes/ is a small job with a large
    payoff, and it needs Josh, because only the chats holding them can export them.

=== WHAT CHECKED OUT CLEAN — do not spend time re-deriving these ===

- The Command drawing's arithmetic: 16 units, and for every one, ready+held+blocked+occupied == beds,
  locked <= beds, and the sex mix sums to occupied. No failures.
- Its "Ready N · Held N · Blocked N · Occupied N" wording matches the live shortlist panel verbatim.
- Its override reason strings are verbatim entries from the real list in ward-change-reasons.ts.
- Its legal form codes (1A, 3B, 4A, 4C) are all valid, and the capacity-freshness override is correct
  per the 2026-09-02 owner ruling. (One nit: "Form 4A, transport authority" — the register title is
  "Transport order".)
- The design system's light/dark/forced-colors/reduced-motion handling is complete and correct.
- Section 8, the honesty rules, is the strongest thing in the whole edition. Do not weaken it.

=== METHOD, and it is not optional here ===

- A MOCKUP SITS OUTSIDE EVERY GATE. Before you change a drawing, read what the LIVE screen does and
  audit what your drawing FORGETS. Every one of A1-A5 is a thing the live code already knew.
- Verify against CODE, not documents. Documents under docs/ward-flow/ are frequently out of date and
  several have been formally retracted.
- Label every claim VERIFIED or ASSUMED. Paste the decisive line, never a summary of it.
- ONE MUTATION PER ASSERTION, and read WHICH message came back, never just the colour. Two mutations
  in one test means the first failure stops the run and the second never executes, while the file
  goes red and reads as proof of both.
- A CHECK THAT CANNOT FAIL IS WORSE THAN NO CHECK, because it discharges the reader's suspicion.
  Before believing any green, break the thing it watches and confirm it goes red.
- If you find a defect in a file another chat owns, ROUTE it to that chat directly rather than fixing
  it, and claim the DEFECT in docs/ward-flow/control/work-claims.md before you edit — not the
  filename. Two chats fixing different defects in one file is ordinary; the same defect twice is what
  the register catches, and duplicated effort is invisible to every gate.

FIRST ACTION: re-derive A1 and A5 yourself — the acuity gate and the specialling claim — and tell
Josh in plain English which of the five you can correct without a ruling from him and which two need
his clinical answer. Do not edit anything before that.
```
