# Ward Lead handover — 2026-09-10

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Written at Josh's instruction to finish everything and hand over.** Supersedes nothing:
[`WARD-LEAD-HANDOVER-2026-09-09.md`](WARD-LEAD-HANDOVER-2026-09-09.md) holds the day's detail and
[`WARD-LEAD-HANDOVER-2026-09-05.md`](WARD-LEAD-HANDOVER-2026-09-05.md) holds the reword-arm ruling,
where **arm F now sits above the table**. Read those there, not restated here.

---

## 1 · Where the line stands

    master line   codex/task-ward-flow-live-state-20260831   b062d8da12
    state         154 commits today, nothing pushed, ~2400 commits local-only
    tree          clean apart from `.claude/launch.json` (a dev-server config, deliberately kept)
    format        `npx prettier --check .` exits 0 over the whole tree
    typecheck     `npm run typecheck` exits 0
    ward suite    green at last full run; the two long-standing failures are FIXED

🔴 **NOTHING IS EVER PUSHED.** Both ward branches exist on this disk only.

**Every chat's work is folded.** Ward Builder Two, Ward Builder Four, Ward Builder Three, the Ward
Verifier and the command-mockups chat are all in. **Design System is the one account still
outstanding.**

---

## 2 · The finding of the whole programme

Nine separate probe failures across four chats collapsed into one defect, in Ward Builder Two's
words:

> **"I keep accepting an answer to the adjacent question because it arrives in the right shape."**

    git log -S <text>       answers "which commit INTRODUCED this"   read as "has this landed"
    grep for a component    answers "which files IMPORT it"          read as "where is this SHAPE"
    grep for a board string answers "does any test READ this board"  read as "did my fix land"
    plant, run the suite    answers "does this redden the suite"     read as "does the guard reach"
    Win32_Process           answers "what binary is running"         read as "whose worktree is this"

**Every one returned a correct, well-formed answer to the question next door.** Not carelessness and
not a broken tool — **the rigour is what makes it persuasive.**

**"Ask the right question" is not the fix, because nobody knows they asked the wrong one.** The fix
is the control: **point the instrument at a case whose answer you already know before trusting it.**
Better still, `scripts/ward-flow/folded.sh` — a fold checker that **refuses to report at all** until
a commit known to be folded comes back folded:

> **A checker that cannot say YES cannot be trusted when it says NO.**

**Four chats have now measured the written form insufficient.** Prefer the tool that refuses to the
lesson that is read.

---

## 3 · Three inversions, found in one day

Not weak guards — guards and claims asserting **the opposite** of what they existed to protect.

| Where                             | What it did                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-scanning provenance guard  | Accepted _"These figures are NOT invented"_ — the word it denies satisfied it                                                                                                                              |
| Statistics provenance guards (×2) | Same, on the component that produced the owner's ruling. 7 of 8 defects admitted **and** 3 of 9 honest items reddened — wrong in both directions at once, which is why it read as tuned rather than broken |
| 🔴 The Command drawing            | Its Activity panel rendered a green dot and _"Live, reconciled"_ over entirely invented figures                                                                                                            |

**All three are fixed.** The third was the most exposed: **a drawing is outside every gate**, its only
reader is a person, and it was telling that person the numbers had been reconciled against something
real.

⚠️ **In every case the artefact disclosed correctly somewhere else** — a banner, a later paragraph,
a footnote. **The false sentence sat where the disclosure could not reach it.** That is the owner's
2026-09-09 ruling exactly: **a sentence must be true read alone, because a heading does not travel
with it.**

---

## 4 · Owner decisions recorded today

Full text: [`owner-decisions-2026-09-09.md`](owner-decisions-2026-09-09.md).

- **§3 — the invented-figure checker keeps the reach it has.** His words: _"leave the reach at 2, keep
  what you built."_ ⚠️ **This does NOT cancel the statistics repairs**, which were never a reach
  extension; the complement is written into the ruling so nobody reverts them later as declined work.
- **§4 — the Command drawing's Activity panel is fixed.** _"Reconciled"_ was kept because it is true;
  only the claim of liveness was false.
- **The repo-root scratch files were deleted with his approval.** `.claude/launch.json` kept.

---

## 5 · 🔴 Still with Josh — asked, not answered

**Both are drawn on the Command screen and neither exists in the software, so anyone building from
that drawing would build them.**

1. **Should beds be ordered partly by patient acuity?**
2. **Is the catchment rule real?**

**Ward Lead is the named un-deferrer.** A deferral with nobody named against it is how a statistics
instruction stayed in force for a day after Josh had personally lifted it.

**And the three gates before any real-patient use are unchanged and unstarted** — TGA/SaMD
classification, sex-and-gender identity as one field driving bed matching, and Aboriginal cultural
safety review. **Two of the three cannot be met from inside this project.**

---

## 6 · Open work, in priority order

|     | Item                                                                                                                                                 | With                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | **Two holes in the repaired provenance predicate** — no `RETRACTED` check, and `MENTIONS_A_FIGURE` is a whitelist that leaves clauses **UNEXAMINED** | Ward Builder Two                    |
| 2   | **A limits section that was never floored** — documents the colon hole, silent on its siblings                                                       | Ward Builder Four                   |
| 3   | **Design System's handover**, and whether the third-edition identity replacement has moved                                                           | Design System                       |
| 4   | **Five ledger inbox requests** need `npm run issues:reconcile` from a dedicated fresh-base branch                                                    | nobody — held while chats were live |
| 5   | **The query of every NON-ban guard** in both reword ranges                                                                                           | **UNEXAMINED, not clean**           |

⚠️ **Three cases are shared by two independent implementations — a colon, an `and`, a comma — and
must NOT be chased.** Splitting on any of them destroys real honest prose.

> **A residual shared by two independent implementations is a property of the approach, not a bug in
> either.** Reporting it against whichever one you measured second is how a sound design gets churned.

---

## 7 · What a chat picking this up must not do

- **Never push.** Both branches exist on this disk only. No PR, no remote.
- **Never delete or move** anything matching `ward-flow` / `ward-management` / `ward-board`, or any
  handover or decision document **including superseded ones**, without asking Josh and saying exactly
  what would be lost. _"Nothing imports it"_ is never sufficient.
- **One chat per folder**, and **only Ward Lead merges.**
- **Never `git add -A`**, never bare `git stash`, never remove a worktree.
- ⚠️ **Never trust `npm run format`.** On one worktree today it printed _"'prettier' is not
  recognized"_ and **exited 0 having changed zero files** — and a zero-file result reads as a clean
  tree. **Zero is the tell.** Run `npx prettier --write .` and check `ls node_modules/.bin | wc -l`.
- ⚠️ **Never resolve a format conflict by picking a side.** Every hunk looks cosmetic, and one of
  today's was a type fix that taking "theirs" would have silently reverted.

---

## 8 · The habit that mattered most

> **Test the instrument on a question you already know the answer to, before pointing it at one you
> do not.** — Ward Verifier

**And the one that produced the best work today, which is different:** every chat that checked
something **already going its way** found a real defect. Ward Builder Four verified a peer's repair at
the moment I had just praised it and found five more holes. Ward Builder Two re-checked a range they
had reported complete and found the worst defect of the day. **I re-ran my own probe and discovered it
had been pointed at a file the test never loads.**

**A result that agrees with you is the one nobody audits.** That is where four of today's nine bad
probes lived.

---

## 9 · Added after the wind-up, because the last hour produced the sharpest findings

### 🔴 The format pass broke ten byte-for-byte guards, and I was warned about the class

Ten mockup HTML files are compared **letter for letter** against a shared stylesheet. Prettier
formats HTML as HTML and CSS as CSS, so a whole-tree pass reflowed the two differently and the
embedded copy stopped matching. Restored to their pre-format bytes; the directory is now in
`.prettierignore` with the measurement in the comment. **These are artefacts, not code — a
byte-pinned drawing should never have been in a format pass's population.**

⚠️ **Ward Builder Two named this exact hazard before the format landed**, checked their own
text-parsing guard, and it survived. **Neither of us enumerated the others.**

> **A hazard identified is not a hazard swept.** One instance proved safe is not a class walked.

**Third instance in one day of a correction that did not sweep the class it named — and this one is
mine, as the chat that folded it.**

### One family, three surfaces, three sessions, one day

**"The run went fine" signals that survive the run not happening:**

    a wrapper's exit status              npm run format: "not recognized", exit 0, zero files
    a zero-change count                  indistinguishable from a clean tree
    a background-task completion notice  harness said exit 0 twice; the real Node exit was 1

⚠️ **The third is the worst, because it arrives unbidden, looks authoritative, and nobody types it.**
A pipe is at least something you wrote. **Re-check the artefact; never trust the run.**

### One signal, two states, opposite responses

    ls node_modules/.bin | wc -l   ->   0

Means **broken bookkeeping** (packages present, repair it) _or_ **never installed** (deliberate, do
NOT repair). The prescribed repair is right for one and harmful for the other. Corrected form:

    [ -d node_modules ] || echo "NEVER INSTALLED — not this fault; do not repair"
    ls node_modules/.bin 2>/dev/null | wc -l

**Its author wrote the warning about that defect class and shipped one**, then corrected it in the
catcher's words with the attribution rather than defending it: **_"I had that written down. I still
shipped it."_** **Knowing a failure mode is not immunity to it** — the fifth control today built by
somebody who had just written up the failure it prevents.

### A statement about somebody else's state expires when they act

Three sightings in three days, all in one chat's own text: _"routed, not fixed"_ → they fixed it;
_"fixed, not folded"_ → it was folded. **True when written, expired the moment the other party acted,
carrying no expiry date, and nothing anywhere goes red.** The work-claims register has no mechanism
for a row to learn that its routed half was answered. **A class, not three incidents.**

### When two chats report a failure in the same artefact, name the MECHANISM

Two chats reported `backup-work.sh` failing. **Different faults, both real:** an empty
`node_modules/.bin` (which the script is _immune_ to — it is pure git and shell) and
`MSYS2_ARG_CONV_EXCL="*"` inherited from the shell, which stops git writing to a POSIX destination.

⚠️ **The second is the worse one:** `worktree-ownership.md` tells every chat to read Ward Flow
documents with `git show <branch>:<path>`, and the standard fix for _that_ is exactly that variable.
**The instruction everyone follows disables the backup, immediately before a fold**, and the script
hides its own error behind `>/dev/null 2>&1`. Fix: `env -u MSYS2_ARG_CONV_EXCL bash …`.

> **Name the mechanism in each report, or the second gets closed by the first's correction.**

### 🔴 Unowned and still true

**`D:/Repos/Database` — the PRIMARY checkout — reads 0 binaries.** Anyone running a format or a gate
there gets the silent version. **Three chats independently declined to repair another tree unasked.**
Repair is `npm rebuild` then `npm install` — **never `npm ci`**, which deletes `node_modules` and has
crashed on this machine.

---

## 10 · 🟢 The line is green, measured after every fold

    Test Files  350 passed | 11 skipped (361)
    Tests       4202 passed | 2 expected fail | 75 skipped (4279)
    exit        0
    prettier    --check . clean over the whole tree
    typecheck   0 errors
    tree        clean apart from `.claude/launch.json`, a dev-server config kept deliberately

**The eleven failures from the previous run are gone**: ten were the format pass reflowing
byte-pinned mockups, now restored and ignored.

⚠️ **The eleventh did not recur, and "did not recur" is not "was fine."**
`ward-flow-chat-control.test.ts` failed once under a full-suite load with
_"canonicalPath docs/archive/ward-flow-questions-rule.md does not exist at activation source"_, taking 70
seconds on that one case. **The file exists, at that source and in the tree** — measured. It passes
alone (44/44) and passed in this full run. **A non-reproduction is not a negative**, so it is
recorded here rather than closed: a git-subprocess read under parallel load on this machine is the
likeliest explanation and nobody has proved it.

---

## 11 · Owner decisions, 2026-09-10, end of day

- **The fourteen unexamined screens — LEAVE AS IS.** His words: _"just leave this as it is, it is
  just fake data used to demonstrate the system."_ ⚠️ **They remain UNEXAMINED, not compliant** — that
  distinction survives the decision, because the decision is about priority and not about state.
- **The next phase is to implement the behaviour of the new mockups**, asking for clarification
  rather than inferring.
- 🔴 **TWO BEHAVIOURS PUT BACK TO HIM AND NOT YET ANSWERED**, because _"build what is drawn"_ would
  decide them by default and they are not drawing decisions:
  1. **Acuity ordering** — the board would rank one patient ahead of another on a clinical basis.
     **Everything Ward Flow does today is operational and it never assesses a patient. This would be
     the first thing that does**, and it is precisely what the TGA/SaMD gate is about.
  2. **The catchment rule** — the board would narrow where a patient can go by where they live. **If
     it does not match how WA services actually work, it sends people to the wrong place,
     confidently.**
- **The 58 test files named in dated plans and never written** — one decision requested: **are those
  plans still the plan?** If yes, 58 pieces of promised safety-checking do not exist and should be
  understood before more surface is added. If no, the figure is meaningless and should be struck.
  **Not answerable from the code — it is about intent.**

---

## 12 · The width band nothing samples, and a defect that came back

**The failing referral-column check is not an ordinary layout nit, and two chats had it wrong in
both directions before anyone read the spec.** Its own comment, which I opened rather than took:

> _"THIS WAS A LIVE DEFECT UNTIL 2026-09-05 AND MY OWN DESIGN PASS WALKED PAST IT … at a 641px
> viewport … `Sex` and `Home region` sat outside the queued table … Every column was in the document
> at every width, which is why nothing went red — they were simply never on the screen."_

**So the guard was written for this exact defect, on this exact column, after it survived a design
pass — and today it fails on `Home region` again.** Columns present in the DOM and unreachable on
screen is the failure this guard exists to prevent.

⚠️ **It is NOT recorded as a regression.** The guard landed around 2026-09-05 and this was the first
full run of that suite since 2026-09-06. **Nobody has bisected. "It came back" is a hypothesis; the
finding is that it fails now and nobody knows when it started.**

### The transferable part, and it is worth more than the defect

The spec author's own note:

> _"I measured 375px and 1440px and nothing in between. A scroll threshold does its damage in the
> band between the card swap and a desk screen, which is exactly the band neither of those two
> widths is in."_

**Measured across all twelve ward browser specs — how many widths each samples in 641–1000px:**

    ui-ward-discharges         4      ui-ward-coordinator          0
    ui-ward-referrals          4      ui-ward-morning              0
    ui-ward-search             4      ui-ward-roles                0
    ui-ward-chrome-header      1      ui-ward-statistics-compare   0
    ui-ward-forced-colors      1      ui-ward-statistics-journey   0
    ui-ward-management         1      ui-ward-table-thresholds     0

**Six of twelve never look in that band at all.** Every one of them samples a phone width and a desk
width, which is exactly the pair that cannot see a scroll threshold.

⚠️ **AND MY FIRST MEASUREMENT OF THIS WAS WRONG, in the same shape as the thing it measures.** My
grep matched `setViewportSize({ width: N })` and missed `for (const width of [641, 700, 760, 820])`
entirely — so it reported three specs as sampling the band when six do. **An instrument that reads
one of two spellings returns a confident undercount**, and I caught it only because a file I knew
loops four in-band widths came back reading one.

### The sequence, recorded because only one of the three errors was anyone else's

    a wrong causal story attached to a true measurement    Ward Verifier — retracted
    the story amplified, the measurement discarded         Ward Builder Four — endorsed the story
    the retraction accepted without reading the spec       both, and me

**The number was never in question at any point.** A true measurement acquired a story, lost the
story, and was then filed as trivial — and the measurement was the only part that was ever solid.

---

## 13 · Naming a class and walking one member of it

**The ten broken mockup guards are jointly Ward Builder Two's and mine, and their half is the more
interesting one.** They named the class — _guards that parse source as TEXT and would break under a
prettier rewrap_ — **walked exactly one member of it**, found it green, and wrote a sentence that
read as coverage. I folded on it.

> **A green instance from inside a class you have just NAMED is the most persuasive possible way to
> under-report it.** The check was real, the result was true, and the sentence covered more than the
> evidence — **so nothing about it invites a second look.**

**That is measuring a predicate and calling it a guard, one level up: measuring an INSTANCE and
calling it the CLASS.** Third variation of the same defect in one day.

### ⚠️ And the remedy offered with the correction does not survive measurement

They proposed that one command — `grep -l readFileSync tests/` — would have kept the ten out of the
fold. **Measured:**

    grep -l readFileSync tests/*.test.ts*              392 files
    narrowed to byte/exact-comparison shapes            97 files
    narrowed to those reading a file prettier formats   189 files

**Both files that actually broke appear in all three sets** — findable, inside a haystack of 97 to
392, most of which read JSON, run scripts or check paths and are untouched by a reformat.

> **The class is not cheaply enumerable by grep.** What actually caught it was **running the full
> suite after the reformat**, which is sequencing, not a cleverer search.

**So the correction was right and the fix attached to it was not**, and a correction that arrives
with an untested remedy is the same shape as everything else in this document. **The rule for the
next whole-tree reformat: run the suite before folding it, not after.**

### One distinction worth keeping on its own

> **"Did more than asked" and "could not do all of it and said which part" look identical from
> outside, and are not the same thing.** — Ward Builder Two, refusing credit for the second.
