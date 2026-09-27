# Publishing Ward Flow — the runbook, written after eight pushes to land one pull request

**Written 2026-09-06, immediately after PR #2654 merged.** Eight pushes, roughly two hours,
**nine separate check failures — and not one of them was in the work under review.** Every
single one was bookkeeping: generated files, formatting, lint, and two contract tests that
had never executed in their lives.

This document exists so the next publication costs one push instead of eight. It is a
runbook, not an essay: the analysis is here only where it explains why a step exists.

---

## The failures, in the order they happened

| #   | Check                     | What was wrong                                                       | Pushes it cost |
| --- | ------------------------- | -------------------------------------------------------------------- | -------------- |
| 1   | `PR policy`               | A governance checklist box left unticked                             | 1              |
| 2   | `check:ci-scope`          | Three ward Playwright specs in the config and in no CI scope pattern | 1              |
| 3   | `check:docs-links`        | Two citations the checker could not resolve                          | 1              |
| 4   | `repo-awareness-snapshot` | **Diagnosed wrongly three times.** See below.                        | 3              |
| 5   | `design-system-contract`  | Raw literals on new screens; then its GATES figures went stale       | 1              |
| 6   | `format:changed`          | Twice — once my range was wrong, once on generated output            | 2              |
| 7   | `Lint`                    | One error, three warnings, under `--max-warnings 0`                  | 1              |
| 8   | `Unit coverage`           | Two contract tests that had never executed                           | 1              |
| 9   | `Advisory UI`             | A fixture cross-check that was right — the seed had grown            | 1              |

---

## The five root causes, and the step that closes each

### 1. I never ran the whole job before the first push

I ran the _smallest gate covering the change_, which is the right habit for iteration and the
wrong one before publishing. CI's `Static PR checks` runs roughly thirty checks; I had run
five of them.

**And CI stops at the first failing step**, so every fix revealed the next one that had never
been reached. `Lint` survived five pushes purely because the four steps before it kept dying.

> **Step: before the first push, run every check in the `static-pr` job, not a selection.**
> Extract them from `.github/workflows/ci.yml` rather than from memory — the list changes.

### 2. I verified my working tree; CI verifies the commit

Formatting, the document index and the design-system baseline are properties of **the commit
that gets pushed**. My working tree passed while the pushed blob did not, twice.

> **Step: run `format:changed` with `BASE_SHA` and `HEAD_SHA` set to the PR base and the
> commit you are about to push — not against the working tree.** This is what finally caught
> the generated-file formatting before it reached GitHub instead of after.

### 3. The publication tree is not the working tree, and nothing local knows that

Ward Flow publishes as a rebuilt single commit that **removes files** the working tree has.
That divergence is invisible to every local check, and it caused the worst failure of the
night.

`check:repo-awareness-snapshot` indexes every markdown file. I generated the index over 2,020
documents while CI checked it against 2,018, because the publication tree omitted two. **I
regenerated it three times.** Regenerating reproduced the mismatch every time, because it was
never staleness.

> **Step: exclude from the published tree ONLY what cannot be published** — here, one 118 MB
> bundle that GitHub refuses at 100 MB. Every other omission is a preference, and a preference
> that makes the published tree differ from the verified tree costs a full CI cycle per
> occurrence.
>
> **Step: when a check compares two populations, compare the populations before regenerating
> anything.** The tell was in the first failure message and I treated the symptom twice more.

### 4. Generated files must be regenerated last

I regenerated the document index, then made two more commits that changed the things it
indexes. It went stale again immediately.

> **Step: regenerate every generated file as the LAST commit before building the publication
> commit** — snapshot, design-system baseline, GATES figures, sitemap.

### 5. Some guards cannot run where the code is edited

Two of the failures were tests that **had never executed**:

- `tests/ci-cache-safety.test.ts` — twelve cases in a `describe.skipIf(process.platform === "win32")`
  block. It runs on Linux only, so on this machine it reports **skipped**, and its first ever
  execution was in CI. A workflow job had been added without its fixture, and under `set -u`
  the whole block died on an unbound variable.
- `tests/ward-flow-chat-control.test.ts` — needs a commit that a shallow clone of a rebuilt
  publication commit does not carry, so it reported "the safety disclosure is missing" when
  the disclosure was present.

**MEASURED AFTERWARDS, and the figure is worse than the two examples suggested.** Ward Verifier
walked the platform-gated files and took the count **from the runner rather than from a parser**:

    seven platform gates across six files
    3 of those 6 files skip ENTIRELY on this machine
    76 of their 165 tests skipped, 89 run

**Nearly half the cases in those files have never executed on the only development machine
this project has.**

✅ **And the good half, which belongs beside it: the ward suite skips NOTHING.** 3,430 passed,
2 expected fail, **zero skipped**. Every ward guard runs here. **The gap is entirely in the
repository-level CI guards** — precisely the surface a ward branch never touches, which is why
nobody here would ever have seen them fail.

### 5b. Four guards on this branch cannot be selected by the loop anyone actually runs

Separate from platform skips, and it has bitten twice. `vitest related` picks files by walking
the **import graph**. A guard that reads the repository from disk — `readFileSync`, a route
walk, a workflow parse — imports nothing it guards, so **no focused run can ever select it**.

Four on this branch have that property: the synthetic-data disclosure guard, `ward-nav`,
`ward-mode-workspace-reachability`, and the conditional-gate satisfiability guard. **Adding a
ward screen with no "this data is fictional" badge changes nothing the disclosure guard
imports, so a focused run over exactly that change reports green having never loaded it.**
`ward-nav` sat red for three commits for this reason.

> **Step: a focused run is not evidence about any guard whose subject is a RELATIONSHIP between
> files** — ledgers, route maps, coverage records, workflow contracts. Those need a full run,
> however local the edit looks.

> **Step: before publishing, list the platform-gated suites and treat them as UNRUN.**
> `grep -rn "skipIf(process.platform" tests/` names the files.
>
> ⚠️ **Then get the COUNT from the runner, not from reading.** A first attempt at this counted
> cases by balancing braces and reported **1** for the block that holds **twelve** — a brace
> balancer that does not understand strings and template literals closes early on the first `}`
> inside a regex or a shell fragment, and that block has several. It was caught only because
> the number disagreed with one already known. **Run the files and read what vitest says it
> skipped; the runner knows and a parser guesses.**

---

## The runbook

Run in this order. Steps 1–6 happen **once**, before the first push.

```bash
# 1. Fold everything. Nothing lands after this point.
#    Freeze the other sessions FIRST — work arriving mid-publication is what makes
#    step 6 stale before it is finished.

# 2. The full local gate set — not a selection.
npm run lint && npm run typecheck && npm run test

# 3. Every static-pr check, extracted from the workflow rather than remembered.
#    Run them ALL, collect every failure, then fix. Do not fix-and-push per failure.

# 4. Fix everything found. Re-run only what you touched.

# 5. Platform-skipped suites are UNRUN, not passed. Find them, then RUN them and
#    read the skipped count off the runner — do not count cases by reading.
grep -rn "skipIf(process.platform" tests/

# 6. Regenerate every generated file, LAST:
npm run snapshot:repo-awareness
npm run design-system:adoption:update
npm run design-system:gates-figures:update
npx prettier --write <whatever those just wrote>

# 7. Build the publication commit, excluding ONLY what cannot be published.

# 8. Verify the COMMIT, not the tree:
BASE_SHA=<pr base> HEAD_SHA=<the commit you built> npm run format:changed

# 9. Push once.
```

---

## The one method note, because it would have saved three sessions rather than one

Every failure above is a variant of **trusting a comparison without establishing that its two
sides were comparable**. The snapshot compared two document populations that were not the same
population. A case count compared a brace-balancer's guess against a number already known. A
scanner read a condition out of a copy with its strings blanked, so `gitAvailable("<sha>")`
came back as `gitAvailable(" ")` — enough to classify, useless to read, because the string
_was_ the question.

**Two rules come out of it, and the second is the cheap one:**

> **Locating and reading are two jobs wanting two texts.** Blank comments and strings to FIND
> a construct; read its content from the raw text at the same offsets. Keep the stripper
> length-preserving so the offsets still line up.

> ⚠️ **Write the control BEFORE trusting the scanner, in the exact form the scan is meant to
> meet.** The stripper bug above announced itself only because an assertion already expected
> `process.platform === "win32"` and received `process.platform === " "`. **A control written
> first turns a silent parsing bug into a red line with the answer in it.** Written afterwards,
> it agrees with whatever the scanner produced.

**And one thing about the controls themselves**, because it decides whether four mutations are
worth more than one. Of the four run against the satisfiability guard, **three exercised an
exported helper over synthetic input.** Only the fourth made the walk, the classifier and the
register work together over the real tree — and it is the only one that could have caught **a
classifier that was correct and wired to nothing.** Its author nearly stopped at three.

> **Step: at least one mutation must run the whole thing end to end over the real repository.**
> Mutations against a helper prove the helper. They cannot see a correct component connected to
> nothing, which is the defect that survives a careful review.

> 🔴 **THE WIRING COVERS GUARD MUTATIONS, NOT FIXTURE SWEEPS.** Say it that way rather than
> rounding it up. `npm run mutate` takes ONE file and a `--find` that must match **exactly once**,
> so a targeted change to a guard goes through it and is better for it — the harness names the
> catching assertion unprompted, which otherwise means grepping the runner's output. **A sweep that
> plants the same probe into 51 stylesheets is REFUSED by design** (`--find matched 30 times … it
must match exactly once`), and there is no anchor to give it. **Measured by Ward Builder Three
> against both shapes of control they actually ran, 2026-09-06.**
>
> ✅ **CLOSED 2026-09-06 — `--append` exists and the sweep half is covered.** The evidence is a real
> sweep, not a synthetic one: **Ward Builder Three re-ran their own 51-stylesheet sweep entirely
> through the harness — 51 of 51 caught AND NAMING THE FILE, zero survived, zero refused, zero
> restore mismatches.** "Named" was required rather than merely "red", so the probe was counted
> rather than coincidentally present. **The paragraph above is kept rather than deleted because the
> gap it describes is why the mode exists**, and because the wording moved only when the review
> landed, not when the code was written.
>
> ⚠️ **AND `SURVIVED` IS A WEAKER VERDICT IN APPEND MODE — this is the part to carry forward.** The
> probe always lands at end of file, top level, outside every at-rule, so a survival means _"no
> assertion covers a probe AT END OF FILE"_, not _"no assertion covers this"_. A guard that only
> inspects inside `@media (forced-colors: active)` will report a survival **while being perfectly
> correct not to look there.** And a probe the gate cannot see — a comment — mutates nothing while
> changing the bytes, so it survives too. **Confirm the probe is functional before believing a
> survival; `CAUGHT` is exactly as strong as in find mode.** Neither can be refused mechanically —
> a comment is a legitimate probe for a guard that scans comments — which is why they are written
> down instead of guarded.
>
> 🔴 **Step: run the mutation through `npm run mutate`** — `scripts/ward-flow/mutation-run.mjs`,
> which refuses an untracked target, refuses a `--find` matching other than exactly once, and
> restores in a `finally` **from bytes captured before the edit**. Its own words, and they are the
> sentence that matters: _"not from `HEAD`: whenever the file carries uncommitted work, `HEAD` is a
> different thing from 'the file a moment ago', and restoring to it silently discards the very
> change under test."_
>
> ⚠️ **Both failures that sentence describes were committed by hand on 2026-09-06, an hour after
> the rule was quoted between two chats.** One session restored guard and fixture from `HEAD` and
> destroyed its own uncommitted fix. The same session then truncated an 87-line fixture to two by
> opening it for writing before reading it — **and the control still went red, because a file
> containing only the planted violation gives the same verdict as an intact one.**
>
> 🔴 **AND "RESTORED, HASH MATCHES" CANNOT CLEAR A CONTROL OF THIS.** The restore proof sits
> _downstream_ of the damage: truncate, plant, red, restore, and the hash matches perfectly. Four
> chats' work was folded on that phrase tonight. **What DOES clear a control is a red carrying a
> number or name derived from PRE-EXISTING content** — _"7 uses, ceiling 6"_ proves the six were
> there; _"line 88 of an 88-line file"_ proves the file was 88 lines. A red saying only _"a
> violation was found"_ proves nothing about its input.
>
> **Asserting the fixture survived is the FALLBACK, for anything the harness cannot drive.** The
> primary is the harness, because structural immunity beats a rule that four tired sessions each
> broke once in a single night.

---

## A gate can be clean because a DIFFERENT gate cleaned its input

Found 2026-09-06 by an injection sweep over the ward status-colour guard. **Fifty-one of
fifty-one stylesheets went red on a planted regression** — which reads as unconditional
coverage, and is not.

The guard's parser cannot see `var( --success-text )` at all: it cuts the token name at the
first of `,`, `)` or a space, so **leading whitespace makes the token read as the empty
string**. A single space defeats it. The reason no such line exists anywhere in `src/**/*.css`
is **Prettier**, which rewrites both `var( --x )` and the multi-line form back to `var(--x)`
before anything is committed.

So the honest claim is **"zero violations, provided the format gate ran"** — and the format
gate has a documented bypass (`SKIP_FORMAT_GUARD=1`, and `AGENTS.md` records that an agent
pushing from its own environment misses the pre-push hook entirely). **A protection that is
real, load-bearing and skippable, reading as boilerplate.**

> **Step: when a guard reports a clean estate, ask what KEEPS it clean** — the guard, or
> something upstream that normalises the input before the guard sees it. Formatters, codegen,
> lint autofix and schema validators all do this. If it is the upstream thing, that dependency
> belongs in the guard's own docblock, because the next person reads the count and not the chain.

**THE RULE THAT CAME OUT OF SWEEPING FOR MORE OF THEM**, and it is worth more than either
instance because it can be applied without re-running the sweep:

> **A guard that recognises a violation by its SPELLING inherits a dependency on whoever
> guarantees the spelling. A guard that parses structure — AST, bytes, identifiers — does not.**

It retrodicts the whole result. A second guard was found with the same property by a different
dimension: it matched `composes: x from "path"` with **double quotes only**, and single quotes
are valid CSS Modules and the documentation's own style — the identical non-existent target
went red double-quoted and **passed silently** single-quoted. Both hits match quoted literals
or raw spacing. All six guards that cleared parse a TypeScript AST, raw bytes, or bare
identifiers no formatter rewrites. The one that _could_ have had the dependency — a hex scan,
and Prettier does lowercase hex — escaped only by being case-insensitive.

⚠️ **And the second guard's anti-vacuity floor could not have noticed, because it was floored on
the numerator**: "more than 10 declarations" against a measured population of **73**. Sixty-three
could have dropped out of its view with the floor still green. A floor seven times below the
population is not an anti-vacuity check.

> **Step: reading a guard, ask what dimension its pattern is sensitive to — quote style,
> whitespace, case, ordering — and then ask who normalises that dimension.** If a formatter
> does, the guard's clean result is the formatter's result. Prefer structure over spelling;
> where a text scan is unavoidable, absorb the dimension into the pattern.

> **Step: report coverage as "N of N on the shapes tested", and name the shapes.** This sweep
> proved three: plain, nested fallback, and whitespace. `var()` inside `calc()`, inside a
> custom-property definition, and behind `@supports` were untested — and "the parser is sound"
> would have silently covered all three.

---

## "Restored, hash matches" cannot clear a control

**The single most-repeated evidence claim of 2026-09-06, and it proves nothing.** Four sessions
reported mutation controls as sound on the strength of it, and I accepted it every time.

**Truncate the fixture → plant the violation → the gate goes red → restore from `HEAD` → the
hash matches perfectly.** Every step reports success, and the file under test was destroyed
before the gate ever ran. **The restore proof sits downstream of the damage and is structurally
incapable of seeing it.** Found when a probe written as
`open(f,"w").write(open(f).read() + probe)` truncated an 87-line stylesheet to 2 lines — Python
opens for writing, truncating, before evaluating the read — and the gate went red **exactly as
predicted**, because a file containing only the violation yields the same verdict as an intact
file containing it.

⚠️ **The only thing that disagreed was a line number.** It reported `:2` for something appended
to an 87-line file. The first instinct was to hunt a bug in the guard's line arithmetic; the
arithmetic was right and the file was wrong.

> **Step: judge a control by what its RED said, not by whether the restore passed.** A red
> carrying a number or name derived from **pre-existing** content cannot have come from a
> destroyed file — "7 uses, ceiling 6" proves the six baseline uses were there; "line 88 of an
> 88-line file" proves the file was 88 lines. **A red saying only "a violation was found" proves
> nothing about its input.**

> **Step: mutate through `scripts/ward-flow/mutation-run.mjs`, not by hand.** It captures the
> original bytes into a variable _before_ any write and restores from that capture in a
> `finally` — **structural immunity, where a rule is only as good as the tiredest session
> applying it.** Restoring from `HEAD` has a second failure of its own, in the harness's words:
> _"whenever the file carries uncommitted work, `HEAD` is a different thing from 'the file a
> moment ago', and restoring to it silently discards the very change under test."_ That is how
> one session lost its own fix an hour after quoting the rule against it.

⚠️ **That harness had been committed since 2026-09-04 and invoked by nothing** — not in
`package.json`, referenced only by its own self-tests — while four chats hand-rolled the same
job four different ways. Which is the pattern of the whole night, stated once:

> **A safeguard nobody invokes and a safeguard nobody knows they depend on fail the same way.**

Both appeared within an hour: Prettier silently holding up two guards, and a mutation harness
holding up nothing at all.

---

## The ancestry trap, which four sessions hit and which lies in BOTH directions

A publication commit is rebuilt from a tree. It carries none of the integration line's
ancestry, so `git merge-base --is-ancestor`, `git rev-list --count` and `git branch --merged`
answer a question nobody asked. **Only a blob comparison says whether the work is there.**

Four sessions independently found this in one night. It was also the check that proved the
merge landed clean, so it is not merely a hazard — it is the method.

> ⚠️ **The direction that gets through is the REASSURING one.** As a false alarm it says "my
> commits are missing" and somebody investigates. As a false reassurance it says "master is
> only four commits ahead and they are all docs, so those violations were never there" — which
> reads as _no work needed_ and ends the inquiry. One session reached exactly that conclusion
> and caught it only because the blob comparison disagreed.
>
> **Step: after any fold or publication, verify by content — `git rev-parse <ref>:<path>` per
> file, and `git cat-file -e` to tell "changed" from "absent", because `rev-parse` prints the
> unresolved string and exits 0 on a path that is not there.**

---

## Two smaller traps, both of which bit tonight

**Backticks in a commit message written through a shell heredoc are executed.** A message
explaining a `https://` parsing bug had that string substituted away by bash before git saw
it. **Write commit messages to a file and use `-F`.** The merge commit at `HEAD~2` carries the
damage; it is left rather than amended, because the record showing the error is worth more
than a tidy message.

**An npm script that does not exist exits 1 and looks like a failing gate.** `npm run
check:docs-links` is not a script; the real one is `docs:check-links`. I spent a minute
treating a typo as a red gate.

---

## What this would have cost with the runbook

Failures 1, 2, 3, 5, 6 and 7 are all caught by step 3 — one local run, one batch of fixes.
Failure 4 is caught by step 7's rule about what may be excluded. Failure 8 is caught by step 5.
Failure 9 — the referral board's decided count crossing its display cap — is a genuine finding
and would still have taken its own push, which is the correct cost for a real defect.

**Eight pushes becomes two: one to publish, one for the real finding.**
