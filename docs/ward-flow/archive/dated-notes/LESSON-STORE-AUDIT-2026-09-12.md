# The lesson store, audited — contradictions, decay, duplicates

**160 lessons read in full by four agents (Sonnet, extraction), each slice verified against the live
repository rather than taken on trust.** The themed index is generated at
[`RULES.md`](../../RULES.md); this file records what the reading found _about_ the store.

⚠️ **True at 2026-09-12. Every figure here is a claim about one tree at one moment** — which is the
store's own first theme, and it applies to this document.

---

# 1 · CONTRADICTIONS — four, and none should be resolved by an agent

🔴 **Two lessons that each read as correct, and point opposite ways, are not a defect in either.
They are usually two different situations that nobody has named yet — and naming them is the
owner's call.** Left unresolved, deliberately.

## ① Is a named allowlist entry the right way to widen a guard, or a thing never to add?

| Says YES, with safeguards                                                                                                                     | Says NEVER                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-flow-ledger-system.md` — _"Widen a guard by adding a NAMED allowlist entry carrying owner, date and reason; never by deleting a stem."_ | `wrong-on-purpose-and-load-bearing.md` — _"Do NOT add a checker exemption. An exemption is a small silent claim that a string is known-good; it makes the tool green and the evidence invisible. Leave it reporting and explain it in prose."_ |
| `self-invalidating-pins.md` — an exemption is acceptable if it carries its own staleness guard                                                | `a-clinical-word-that-means-two-things.md` — _"A conjunction that needs no exemption list beats a single term plus exemptions. An exemption list is a record of a predicate that does not describe the property."_                             |

⚠️ **A reader facing "should I allowlist this flagged case" gets opposite instructions depending on
which file they open first.** The situations do differ — a coverage gap versus a deliberately-wrong
evidentiary string — **but no file states the distinction.**

## ② Should a ban-shaped guard be narrowed to the states where the clause is false?

- `a-guards-condition-is-not-its-population.md` — _"Do NOT assert the false clause is absent
  everywhere… Assert its absence only at the states where it is false."_
- `a-guard-that-blocks-its-own-purpose.md` — _"BAN: the phrase ANYWHERE is the defect… Narrowing a
  ban weakens it, passes every arm."_

A reconciling distinction exists — narrowing _which states trigger the check_ versus narrowing _what
region is scanned_ — **but neither file states it.**

## ③ Point at the file, or never mention the file?

- `a-retraction-does-not-travel.md` — _"never restate a contract in prose. Point at the file."_
- `communication-style-plain-and-brief.md` — _"Skip file paths, function names."_

✅ **These do not actually conflict — one governs agent-to-agent handover, the other governs writing
for the owner.** Recorded because a reader skimming both out of context will apply the wrong one.

## ④ Pin the commit, or never pin it?

Both inside `observations-expire.md`: an OBSERVATION must be pinned to its SHA; a POINTER must name
a branch and never a SHA. **Correct, and opposite actions on the same object.** Anyone quoting half
of it gets it backwards.

---

# 2 · DECAY — five lessons that had stopped being true

🔴 **A lesson store nobody re-verifies becomes a store of confident false statements.** That is its
own theme, and it had happened five times.

| Lesson                                          | What it said                                                                             | What is true today                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-flow-coordinator-overrides-everything.md` | _"NOT overridable (3): `allocatable_bed`, `specialling`, `prior_decline`."_              | **Wrong in all three.** `specialling` became overridable 2026-09-12; `prior_decline` moved to `INFORMATIONAL_GATES`, needing no reason at all; a thirteenth gate (`acuity`) was added. **Only `allocatable_bed` is still absolute.** ✅ Corrected. |
| `rsc-boundary-invisible-to-gates.md`            | _"12 of 13 modules importing `ignoreUnavailableActivation` carry `use client`."_         | **36 files now import it, 34 carry it, 2 do not.** The population tripled.                                                                                                                                                                         |
| `hand-picked-test-subsets-ship-red.md`          | Cites `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/` as the working example | **That directory and both scripts no longer exist.**                                                                                                                                                                                               |
| `ledger-reconcile-mechanics.md`                 | Row `#Y090R5` _"is unfixed"_                                                             | **Resolved 2026-09-02.**                                                                                                                                                                                                                           |
| `ward-flow-discharged-not-released.md`          | _"35 occurrences across 16 files, not yet done"_                                         | **2 files remain.** The rename largely landed.                                                                                                                                                                                                     |

🔴 **THE ELIGIBILITY ONE IS THE ONE TO LEARN FROM, AND NOT FOR THE REASON IT LOOKS LIKE.** That list
was **derived** — `ELIGIBILITY_GATES` minus `SUITABILITY_GATES` — which is exactly what the file
tells its reader to do instead of copying a list. **A derived list is still a snapshot.** It aged
silently the moment a gate moved, and nothing failed. Its correction now tells the reader to derive
it _again, in the file_, rather than trusting the corrected list either.

⚠️ **And I made it worse the same night**, by ruling `specialling` overridable without touching the
lesson that classified it.

---

# 3 · DUPLICATES — and one with a conflicting author

**Same incident, written up twice:**

- `a-shared-decision-is-not-a-behavioural-property.md` ⟷ `a-structural-guarantee-is-invisible-behaviourally.md` — same incident, same fix, near-identical prose
- `two-task-lists-one-check.md` ⟷ `verifier-output-is-ephemeral.md` — the same agent-sub-delegates-and-returns-a-promise shape, a day apart
- `differs-is-not-owns.md` ⟷ `not-an-ancestor-is-not-unfolded-work.md` — the same underlying check
- `ledger-rows-lag-reality.md` ⟷ `prove-the-task-is-still-outstanding.md` — already cross-referenced
- Three files retell their own example twice internally, under two headings

## 🔴 The one worth your eyes: the same event, two different authors

`a-partial-withdrawal-reads-as-a-careful-one.md` and a section inside
`a-correction-that-agrees-with-you.md` describe what looks like **one incident** — same date, same
gate, same (a)/(b) structure, same outcome — **with opposite attribution.**

> **Standalone, first person:** _"I did this on 2026-09-12. I had told two chats the ward text-size
> gate was (a) wired to nothing and (b) missing a folder…"_
>
> **Embedded, third person:** _"A peer reported a gate as (a) unwired and (b) not covering a sibling
> folder… they had merged the fix themselves."_

⚠️ **Either two coincidentally identical incidents, or one event recorded under two different
authors** — which would itself be the false-attribution failure this store warns about, recorded
inside the store. **Not resolved here.**

---

# 4 · WHAT THE AUDIT DID NOT CHECK

✅ **Stated because a partial pass reported as complete is worse than a narrow one reported
honestly** — the store's own rule, applied to the audit of the store.

- **The great majority of specific figures were not re-derived** — commit SHAs, PR numbers, test
  counts, hex values. Structural claims were checked (does the file exist, does the mechanism work
  as described); the numbers inside them mostly were not.
- Two of the largest consolidated files were read to roughly a third of their length.
- Nothing was verified against another branch. A file absent here may exist elsewhere — the exact
  trap `differs-is-not-owns.md` names.
- No provider state (Supabase, Railway, GitHub) was checked.

🔴 **AND THE AUDIT HIT THE STORE'S OWN TRAP WHILE AUDITING IT.** One agent's `grep` silently switched
to binary mode and stopped printing, because a lesson contains **literal NUL bytes as its
subject matter** (`corruption-that-makes-checks-pass-harder.md`, 3 NUL bytes).
⚠️ **THIS DOCUMENT FIRST SAID TWO SUCH FILES. A byte-scan of all 161 found ONE.** Corrected
openly rather than quietly — and it was findable only because §4 below states that most
figures here were not re-derived. **A caveat is what makes a wrong number recoverable.**
The original sentence continued: **literal NUL bytes as their
subject matter**. It noticed only because the file count came up short, re-ran in text mode, and
confirmed nothing was corrupt. **That is the exact failure `checks-that-cannot-fail.md` documents,
encountered while reading `checks-that-cannot-fail.md`.**

⚠️ **A second one happened to me.** I "contradicted" an agent's finding that `INFORMATIONAL_GATES`
exists, having searched one file and read its silence as absence. **It exists in
`ward-derivations.ts`.** The agent was right; my instrument was narrower than my claim — which is
`absence-under-one-prefix.md`, verbatim.

---

# 5 · WHAT TO DO WITH THIS

1. **The four contradictions want a ruling, not a merge.** Each is two correct lessons meeting on one
   case nobody has named.
2. **The five decayed lessons are corrected or listed above.** One is fixed; the rest are recorded
   here rather than silently edited, so the correction is auditable.
3. **Do not merge the duplicates yet.** Two of them differ in _author_, and merging would destroy the
   evidence of that discrepancy.
4. 🔴 **Re-run this audit when the store next grows.** `RULES.md` regenerates and `--check` catches a
   stale index — **but nothing catches a lesson whose content quietly stopped being true.** That
   still needs somebody reading.
