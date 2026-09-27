# Owner decisions, 2026-09-12 (third set) — the word "main", and the authorisation gate

**Recorded by Ward Verifier, with the question as put beside each answer.**
**Companion to `owner-decisions-2026-09-12-four-answers.md` and
`owner-decisions-2026-09-12-routing-and-nine-flags.md`.**

---

## D-8 · 🔴 "FOLD INTO MAIN" ALWAYS MEANS THE LOCAL WARD FLOW LINE

**Asked:** Lane A was told to send its work to Ward Lead "to fold into main", and stopped rather than
act. **`origin/main` auto-deploys the app and applies Supabase migrations to the live clinical
database within seconds; the ward branch is 3,243 commits past the merge-base and adds 15 routes of
synthetic prototype. A ruling that main is never touched is recorded in this repository twice
(`ca478ed2b8`).** **So the question put was: which main?**

> 🟢 **OWNER: "Whenever I say fold into main i always mean the local ward flow line. Please tell this
> to all chats and ward Lead and record it in the project behaviour/instruction file so this doesn't
> keep happening when i ask."**

✅ **Lane A's reading was correct and its restraint was correct. Nothing was folded to `origin/main`.**

### The rule this creates

**In any Ward Flow context, "fold to main" / "merge into main" / "put it on main" means the LOCAL
integration branch. It is never `origin/main`, never GitHub, never a push. No chat needs to ask again.**

🔴 **A genuine release to `origin/main` is a separate, planned act and must be asked for in those
words.**

**Recorded in `C:/Users/joshs/.claude/CLAUDE.md` under "Protected work", where every chat on this
machine loads it — because the point of the ruling is that it stops being re-asked.**

### ⚠️ The measurement that should travel with it

    migrations the ward line would ADD to main       0
    migrations main has that the ward line LACKS    10

**Among the ten: `fail_closed_unactivated_uploaded_local_retrieval`,
`fail_closed_unactivated_international_retrieval`, `correct_governed_retrieval_v3`,
`govern_australian_source_activation` — fail-closed clinical retrieval guards and source governance.**

🔴 **An ordinary `git merge` would not remove them. A force-push, a branch replacement, or a
publication branch rebuilt from a working tree WOULD, and that is a recorded incident here.**
✅ **So the protective sentence is not _"Ward Flow carries no migrations"_ — true, and it invites the
conclusion that the operation is safe in general. It is _"whatever touches main must not be a
replacement."_**

---

## D-9 · 🟢 THE MENTAL HEALTH ACT AUTHORISATION GATE IS OVERRIDABLE — with the owner's clinical reason

**Asked:** `SUITABILITY_GATES` classifies **authorisation** as overridable, beside cohort and sex-mix.
**The design standard's own §8.4 test says: a judgement about the patient is overridable by a named
coordinator with a recorded reason; a fact about the world is not.** **Whether a ward holds Mental
Health Act 2014 (WA) authorisation is a fact about the ward's legal status, so the classification and
the stated test point in opposite directions on the page.** **The 2026-09-02 ruling made every
suitability gate overridable, but nobody had confirmed it was meant to cover authorisation
specifically, and the standard does not carry the reasoning at all.**

> 🟢 **OWNER: "Yes. This is an overridable gate. Sometimes formed patients need to go in an
> unauthorised location when there is pressure. it is not common though."**

✅ **The classification is CORRECT and stays. `SUITABILITY_GATES` does not change. The engine, its
tests and the mockup's gate lists all stay as they are.**

### 🔴 What DOES change — the reasoning must be written where the contradiction is visible

**The defect was never the code. It was that the page states a test and then appears to break it,
with the justification existing nowhere a reader can find.**

1. **`WARD-FLOW-DESIGN-SYSTEM.md` §8.4** — carry the owner's reason: **a formed patient sometimes
   has to go to an unauthorised location under pressure, and it is uncommon.** ⚠️ **State it as the
   clinical reality it is, not as a softening of the test.**
2. **The Command mockup's gate detail sentence for `authorisation`** — same reason, in the words a
   coordinator would read.
3. ✅ **And the sharper half, from the 2026-09-02 ruling, which belongs beside it:** an override does
   not permit the placement — the placement happens either way under pressure. **What the override
   protects is the RECORD of it.** 🔴 **A gate nobody can override does not stop the admission; it
   stops the admission being written down.**

### ⚠️ The same answer applies to `security`, and it has NOT been put to him

**`security` was raised in the same breath as `authorisation` — whether a locked bed exists is
equally a fact about the world.** 🔴 **He answered about authorisation. I am not extending his words
to security by inference; that is the fourth element of the D-5 check ("was the approval about
THIS?") and it applies to me here.** **It should be asked as its own question.**

---

## D-10 · ⏸️ THE SMALL-TEXT RAISE IS DEFERRED — with the triggers written down, because a deferral without one is a drop

**Asked:** how long would it take to raise the sub-floor text. **Measured at `57ca0ed793`:**

    coordinator.module.css              69 sub-floor declarations   overwhelmingly WORDS
    ward-management-network.module.css  33                          mostly figures

**The coordinator's are `.shortlistGateVerdictBad` · `.shortlistGateVerdictOk` · `.shortlistLegalBreach`
· `.refusalReason` · `.refusalAt` · `.refusalAttempt` · `.diagramEligibleBadge` ·
`.diagramIneligibleBadge` · `.diagramUnauthorisedBadge` · `.exceptionDetail` · `.exceptionOwner` ·
`.shortlistRestrictiveNote` · `.shortlistOverrideLabel`.** 🔴 **Gate verdicts, refusal reasons and
legal-breach notes below the legibility floor — the words that explain why a patient cannot go
somewhere.**

**Estimate given: the token swap is under an hour; doing it safely is half a day, because this text
was sized small TO FIT and raising it risks overflow against the existing table-width guards. A
screen at a time with a width check, never a sweep.**

> 🟢 **OWNER: "Leave the small text task for now."**

✅ **Deferred as a SWEEP. Not cancelled, and not a judgement that the text is fine.**

### 🔴 THE TRIGGERS, so this does not need re-discovering

1. ✅ **O-15.1 already handles it incrementally and is UNAFFECTED by this deferral** — it raises
   grandfathered small text **at each screen's rebuild**. **So any lane rebuilding one of these
   screens still raises that screen's text. The deferral is of the sweep, not of the standing rule.**
2. 🔴 **HARD TRIGGER: before Ward Flow goes in front of a real bed coordinator.** ⚠️ **A refusal
   reason too small to read is a different class of problem from a small bed count, and this is the
   point at which it stops being cosmetic.**
3. ⚠️ **Re-raise if any of the named selectors gains a new declaration** — the text-size ratchet is
   per file and will catch a rise, but it welcomes a fall and says nothing about legibility.

🔴 **STATE IS "DEFERRED, MEASURED, AND KNOWN" — not "checked and acceptable". Nobody has judged
whether a coordinator can read them; the count is all that exists.**

---

## D-11 · 🔴 TWO LEDGERS IS CORRECT AND INTENDED — WARD FLOW TASKS GO ON THE WARD FLOW LEDGER, AND THE MAIN PROJECT'S IS DISREGARDED FOR THIS PROJECT

> 🟢 **OWNER, verbatim:** _"there should be two ledgers... The main project and then Ward
> Flow. All tasks for this project go on ward flow and disregard the main project ledger"_

**Supersedes nothing.** It CORRECTS a recommendation I put to him twenty minutes earlier — that
`origin/main`'s copy should be treated as authoritative and Ward Flow's kept local. He ruled the
other way, and he was answering a different question from the one I asked.

### 🔴 THE MISTAKE THAT MADE THE RECOMMENDATION WRONG, recorded because it will recur

**THREE THINGS CARRY THE WORD "LEDGER" AND I HAD COLLAPSED TWO OF THEM INTO ONE.**

    1. docs/ward-flow-ledger.md          WARD FLOW'S OWN. 784 KB. Mission, open questions owed by
                                         the owner, decision register, permanent refusals with
                                         reasons, risks and debts, state, identity register.
                                         NOT a ticket list — it is this project's memory of what
                                         has been decided and what is still owed.

    2. docs/outstanding-issues.md        THE MAIN PROJECT'S. 543 KB. A numbered table with an
                                         inbox queue, reconcile tooling and a write-discipline
                                         guard. RAG, the database, Caring Contacts, releases.

    3. the SPLIT Ward Verifier reported  TWO BRANCH COPIES OF (2) — `origin/main`'s `dbec7d35f3`
                                         against the ward line's `6511f71ab7`, 25 insertions and
                                         30 deletions apart.

⚠️ **(1) AND (2) DIFFER IN KIND, NOT MERELY IN CONTENT** — one is a decision record, the other is
a ticket queue. **(3) is a divergence WITHIN (2) and has nothing to do with the two-ledger
question at all.** I answered (3) when he asked about (1) versus (2), which is why my
recommendation pointed the opposite way to his ruling: I was solving a merge problem while he was
describing a filing rule.

✅ **The tell was available and I walked past it: the two files have completely different
SECTION STRUCTURES.** A ticket table and a decision register are not two copies of anything. One
`grep` of the headings would have shown it, and I ran that grep only after he asked me to check
whether I understood the difference.

### The rule this creates

- **Ward Flow work is recorded in `docs/ward-flow-ledger.md`.** Its twelve rules still bind:
  namespaced decision IDs (`P6-D5`, never a bare `D3`), state what is superseded even when nothing
  is, update the superseded entry in the SAME edit, and quote a reversed decision's own words.
- **The main project's `docs/outstanding-issues.md` is DISREGARDED for this project.** Do not
  reconcile Ward Flow work into it, and do not treat its Ward Flow rows as the live list.
- 🔴 **DO NOT "FIX" THE TWO LEDGERS INTO ONE.** The split is the design. Anyone finding two
  ledgers and tidying them together is deleting the distinction the owner has just ruled for.

### ⚠️ WHAT THIS RULING LEAVES IN THE WRONG PLACE — measured 2026-09-12, and NOT acted on

    ward-flow references already in docs/outstanding-issues.md   29 lines
    including the four Ward Flow P1s reported to him tonight
    ward-side requests queued against that same ledger           27

**Deliberately not migrated tonight.** Moving rows between two differently-shaped ledgers at the
end of a long day is how one gets dropped silently, and a migration wants a count out equalling the
count in. ✅ **His instruction was explicit that the one exception is the stale P1 title, which is
being corrected WHERE IT CURRENTLY SITS** — because the harm is that people read a false headline,
and they read it where it is today, not where it ought to be filed.

### ⏳ STILL OWED BY HIM, asked and deliberately not guessed

**Should the 27 queued requests be filed into the main ledger first and then migrated, or
redirected to the Ward Flow ledger directly?** Put to him; he has not answered; it is not inferred.

---

## STATUS OF THE TRIAGED P1

**This closes `017b63bd` from the inbox triage — the P1 recorded as OWNER-BLOCKED.** ✅ **It resolves
in favour of the existing code, with documentation work attached. Nothing in the engine moves.**
