# Ward Lead handover — 2026-09-12

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Read this instead of asking me what happened. It is written once, as a file, because a brief
repeated seven times is seven briefs that drift.** ⚠️ **Every SHA and count below is a measurement
with a date on it. Re-measure before acting — several figures in this programme have been true when
written and false when read an hour later.**

    line          100e91ff7d
    last union    422 files handed in · 422 RAN · 4,903 collected · 4,828 passed · 0 failed
                  measured over 4568362be1; this line adds documentation only since
    backed up     2026-09-11T193649Z — 6,155 files, including every ward file on no other branch

---

## 1 · WHAT IS BUILT — the owner's fourteen third-edition screens

    governance          ✅ folded   refuses the drawing's access-record claim (see §4)
    out of area         ✅ folded   the not-a-medical-device line stays STANDING TEXT, not a tooltip
    service statistics  ✅ folded
    ward/ED comparisons ✅ folded   the drawing's own provenance paragraph NOT carried (self-contradictory)
    transport officer   ✅ folded   model holds no person; four action buttons kept, not collapsed
    add a patient       ✅ folded   dispatches ADD_PATIENT — a different act from raising a referral
    handover            ✅ folded   no shift schedule: nothing in the model records one
    sign in and role    ✅ folded   no authentication; nothing in this app enforces a role today
    on-call             ✅ folded   a contacts screen that deliberately gives you nobody to ring
    legal forms         ⏳ built, owner has authorised the duplicate's deletion; fold follows
    alerts              🔨 in build
    settings            🔨 built, fold owed (tip conflicts — merge the line first)

    discharges          🔴 NOT BUILT, DELIBERATELY — the drawing was reproduced FROM the built screen
    statewide statistics🔴 NOT BUILT, DELIBERATELY — exists, and richer than the drawing
    ward answer         🔴 NOT BUILT, DELIBERATELY — the built screen carries PULL_PATIENT, the whole
                                     bed-release lifecycle, an override register and a suburb panel
                                     that the drawing never shows

🔴 **All three would have LOST content had they been built as drawn. Each was caught by reading the
code before building, not after.**

---

## 2 · OWNER DECISIONS RECORDED TODAY — look them up, do not ask

    O-18    five queued, two later withdrawn (see O-19)
    O-19    🔴 TWO QUESTIONS WITHDRAWN because the codebase already answered them
    O-20    a near-miss of Ward Lead's, recorded rather than tidied away
    O-21    five items: the deletion, the design confirmation, three commissions
    O-22    the three threshold questions — answered in the Settings lane's own chat
    2026-09-12-four-answers.md   legal forms split · three thresholds raised · sweep deferred
                                 with triggers · the sub-12px exception delegated

✅ **ALL ANSWERED unless marked otherwise below. The two that blocked work — the duplicate deletion
and the two scratch files — the owner has now given directly, in the chats that own them.**

### ⏳ Still genuinely open

    "record an override" as a standalone act   🔴 a QUESTION was asked back to him; a blanket
                                               "yes to all your recommendations" does not answer a
                                               question. NOT declined. NOT built.
    out-of-area's two primary actions          which one is demoted is a clinical call
    the three-way WITHDRAW_* naming            recommendation: name by ACTOR, not by verb
    referralState's fourth value               measure what would make it reachable BEFORE deleting
    the GP / CMHT consequence                  see §5 — narrower than it was first relayed

---

## 3 · 🔴 WHAT "DONE" MEANS FOR TWO OF TODAY'S RULINGS — and it is not the code

**Both the legal-forms sort and the table thresholds are specified by an artefact that is NOT the
code.** The sort cites the approved drawing's own `legalSortKey`; the thresholds are numbers a spec
prints and asserts nothing about.

🔴 **Fixing the code leaves the specifying artefact untouched and RE-ARMED. A drawing sits outside
every gate here, so the next person building from it re-commits the overruled behaviour — and it
arrives looking approved.**

✅ **Neither is finished until the drawing is annotated and the threshold spec's printed list comes
back empty.** ⚠️ **And re-measure the thresholds before editing a number: the six figures are pinned
to an older commit and one margin is 3px, which is a coin rather than a margin.**

---

## 4 · WHAT THE SCREENS REFUSE — the half most worth knowing

    governance    the drawing claims the access record logs "every time somebody opened a person's
                  record across the whole network". FALSE — the only log is per-page, never saved,
                  and deliberately has no "who". The panel says that instead.
    out of area   built as drawn, every phone-using coordinator LOSES the not-a-medical-device line
    compare       the drawing's provenance paragraph contradicts itself — it claims ward measures
                  cannot be derived, which is true of the drawing's hand-typed array and FALSE of
                  the built screen, which derives all four live
    legal forms   no patient name: the drawing invents fields the model does not carry
    add a patient no sex field: ADD_PATIENT has no such parameter
    transport     the model holds NO person — provider is one of three fixed ORGANISATION names
    settings      no demo clock, scenario or reset — Q-7 pins them to the Tools drawer, and a
                  RENDERED note says so, because whoever would add one reads the page, not the file

---

## 5 · ⚠️ ONE RELAYED CLAIM THAT DOES NOT HOLD, corrected before it spread

**Relayed: the owner's "just have CMHT referrals" ruling makes a declined community referral
addressable for the first time, because the reducer refuses only for want of knowing WHICH team
sent it.**

🔴 **It does not.** `Referral` carries `id` and `destinations` and **no origin team at all**;
`teamName` lives on the DESTINATION arm only, and the model's own comment says this system holds no
authoritative registry of WA community teams and that minting ids would assert a roster nobody has
ruled on.

⚠️ **Narrowing the CATEGORY to CMHT never records WHICH CMHT. There is more than one.** ✅ **The
honest note: the ruling closes the GP question for now; it does not make declined referrals reach
anybody. That needs an origin team, which is a model change with a roster problem behind it.**

---

## 6 · 🔴 RULES EARNED TODAY — these cost real time; do not re-learn them

    STATE THE POPULATION BESIDE EVERY COUNT
        "seven `sectionHeading` headings" exposes a mismatch as you type it. "seven sections" hides
        it from the author first. Five unit errors in one night across four chats, one of them
        INSIDE a sentence correcting a unit error.

    A CHECK THAT PASSES IN BOTH THE GOOD AND THE BAD CASE IS NOT A CHECK
        An older edition of this app is merged to `main`, so "does this directory exist" is true on
        the wrong base. Four agents passed it from `main`. What caught it was an agent that REFUSED
        and handed back — the refusal clause, not the verification step. Write refusal clauses.

    AGREEMENT BETWEEN TWO PARTIES USING THE SAME INSTRUMENT IS NOT CORROBORATION
        It is the instrument reporting twice. Two chats independently got the same number and each
        read the match as confirmation; it was one blind pattern run twice.
        ✅ The rule is neither trust nor distrust: ASK WHAT WOULD HAVE MADE THEM DIFFER. Agreement
        is evidence only in proportion to how easily it could have failed to happen.

    THE INSTRUMENT NAMED A PLACE WHERE IT MEANT A PROPERTY
        "Ward CSS" is a property; a directory glob is a GUESS AT WHERE THAT PROPERTY LIVES, and a
        new top-level folder is what happens when the guess ages. Four boundary corrections in one
        night, every one a DIRECTORY, none of them the METHOD — until the fourth.

    A CONFLICT WHOSE TWO SIDES AGREE INVITES THE ONE RESOLUTION THAT IS WRONG
        Three lanes each added a route, each counted 36 and wrote 37. The union is 38. BOTH hunks
        said 37, so the sides did not even look like they disagreed. Re-derive the number; never
        choose a side, and never increment — incrementing is right only if exactly two lanes
        collided, and nothing in the diff says how many did.

    THE STATUS FIELD IS NOT THE OUTCOME
        A 0-byte output file with status "completed". An agent whose completion message described
        FUTURE work — "no need to do anything further right now" — having delegated to four children
        and terminated, so 21 files went unsurveyed. A task killed mid-run that had ALREADY
        COMMITTED. Three shapes, one root: only the CONTENT distinguishes them.

    A CONDITIONAL SKIP IS HOW A TEST STOPS TESTING WITHOUT GOING RED
        `if (x === null) return;` is a skip. `expect(x).not.toBeNull();` is a test. They look the
        same in a diff, and the skip keeps printing its name so the test count does not move.

    PERMISSION THAT EXISTS BECAUSE A PERSON MUST DECIDE CANNOT BE ARMED BY AN AGENT QUOTING THEM
        Two lanes refused Ward Lead on this and were right. ✅ And the reason is what makes it work:
        a lane CANNOT TELL AN ACCURATE RELAY FROM A MISTAKEN ONE — so the refusal costs nothing when
        the relay is right and saves everything when it is wrong.
        🔴 "The tests are red" is not consent either. A deletion performed to make a gate green is
        precisely the pressure the rule exists to withstand.

    PROSE AND CODE ARE READ WITH THE SAME EYES BY EVERY TOOL HERE
        A comment satisfying a guard. A comment BREACHING one — the D-3 counter reads comments by
        design, so documenting the rule breaches it. And a comment FABRICATING entries: a note
        placed inside an array literal turned each of its code spans into a phantom protected path
        and reddened two gates.

**Added 2026-09-12, Step 4: do these bind me, the one who earned them?** Yes. Every lesson above was
paid for by a mistake in this chat's own work tonight — the unit errors, the base check, the
agreement-is-not-corroboration read, the directory-glob boundary, the conflict resolution, the
status-field confusion, the conditional skip, the relayed-permission refusal, the comment-vs-code
reading. **These are not instructions for lanes; they are what I am committing to stop doing.**

---

## 7 · THE GUARD ESTATE — surveyed, and what it means

**63 ward guards that walk a population were read.** 🔴 **The headline is NOT "the guards are
blind".** Most have a floor. ⚠️ **But the floors catch COLLAPSE and what actually happens is
ATTRITION** — a floor of five is satisfied by four when one silently drops out.

    one guard is blind TODAY   the expected-reds manifest ships with zero entries, so two loops
                               over it pass every day having examined nothing
    tier 3 exists ONCE in 63   naming what was FOUND but NOT SCANNED, with the counts tied — and it
                               is the guard that caught the on-call defect that started this
    three P1 files             🔴 NOT a blanket fix. A floor on the WRONG population is worse than
                               none: it reports healthy while the thing it watches is empty.

**Scope, stated because it took four corrections to establish: 63 ward test files walking a
population by `readdirSync`/`globSync`. NOT `git ls-files` walkers, NOT `scripts/`.** **The survey
covers populations that silently EMPTY; populations that silently FILL are a declared uncovered
sibling — and a filled one is arguably worse, because phantom entries look like real findings and
cost somebody time to disprove each.**

---

## 8 · D-3, THE OWNER'S 12px RULING — now enforced, and it was ALREADY DEFEATED

**The script implementing it was wired into nothing. Worse: its baseline pinned a TOTAL, and two
files had left the population, so their nine occurrences had already become allowance.** 🔴 **Nine
new forbidden declarations were appended as a probe and it printed "Not risen".**

✅ **Rebuilt per-file — no shared pool, so one file's fall cannot pay for another's rise.** **Wired
two ways. Mutation-proven on BOTH arms, and the two arms were proven by two different people who
each believed they had proven the whole thing.**

⚠️ **Its own footer is the specification, not the caveat: it cannot see a raw `font-size: 10px`, and
it counts comment text by design.**

---

## 9 · WHAT I NEED FROM EACH CHAT

1. **Which owner decisions have YOU had answered directly?** ⚠️ **I only know what has been relayed
   to me, and a decision answered in your chat is invisible here until you say so.**
2. **Your tip, with its own suite number AND its population** — files handed in beside files that
   ran, read from the runner's own summary. 🔴 **Never an exit code: a background notification said
   "exit code 0" over a run whose own line read `failed: 5`.**
3. **Whether your tip conflicts with `100e91ff7d`.** ✅ **If it does, merge the line YOUR side and
   resolve there.** 🔴 **I will not resolve a test-expectation conflict blind — a test expectation is
   a ruling, and resolving one blind silently reverts whoever made it.**
