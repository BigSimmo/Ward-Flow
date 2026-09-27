# How to fold — the doctrine, rewritten 2026-09-10

**Every rule here was paid for on 2026-09-10. Each one is followed by the incident that bought it, so
nobody has to take it on trust.** This supersedes any earlier description of folding.

**Ward Lead is the only chat that folds.** Everyone else commits on their own branch and hands Ward
Lead **SHAs**. This document is for both sides: the folder, and the chat whose work is being folded.

---

## 0 · 🔴 `main` IS NEVER TOUCHED

    the ONLY destination   codex/task-ward-flow-live-state-20260831
    main                   no merge, no fast-forward, no reset, no `branch -f`, not even locally
    origin/main            never pushed to, ever

**Owner ruling, twice:** _"the ward flow line, not main"_ and _"never add to main... it must be Ward
Flow!!!!"_

⚠️ **"Fold" in this programme has ALWAYS meant the ward line.** If any instruction seems to say
`main` — including the phrase _"folded to main"_ in a handover — **it means the ward line.**

**Bought by:** local `main` was fast-forwarded onto the ward line. It was genuinely safe — nothing
rewritten, nothing pushed, one command to undo — and the owner reversed it immediately. **Two chats
had asked him the same question and got opposite answers.**

---

## 1 · Fold BY SHA. Never by branch name.

A branch name resolves **at read time**. `codex/task-ward-flow-live-state-20260831` meant three
different commits in one afternoon.

**And when checking a merge result, compare against `MERGE_HEAD`, not the branch name.** In a
worktree `.git` is a FILE, so:

```bash
cat "$(git rev-parse --git-dir)/MERGE_HEAD"
```

---

## 2 · 🔴 CONFIRM THE ARTEFACT, NOT THE FOLD

**This is the most-repeated failure of the day. Three separate chats hit it.**

> **A fold confirmation is a claim about a SHA. The branch may have grown since.**

Twice, work was confirmed folded at a real SHA and the chat's document — committed minutes later —
was not in it. Nobody was wrong; the measurement was of a moment that had passed.

**So the requester names an artefact check, and the folder runs it:**

```bash
git show <ward-line>:docs/ward-flow/<file>.md | grep -c "<a phrase unique to the new content>"
```

⚠️ **It cuts both ways.** A chat measured a real master SHA and told me three times its work was
unfolded — the line had taken eight folds under it. **Both directions are the same error.**

---

## 3 · `git log -S` CANNOT SEE A FOLD

```bash
git log --all -S'<the text>'                          # -> the original commit ONLY
git log --all --diff-merges=separate -S'<the text>'   # -> also the merge that carried it
```

**`-S` searches diffs, and a merge has no diff against its first parent unless you ask for one.**
Without the flag it **manufactures an absence** rather than reporting one.

**The right instrument for _"has this landed"_ is:**

```bash
git merge-base --is-ancestor <sha> <ward-line>
```

**Bought by:** a chat used `-S` twice, reported a fix missing that was already merged, and had built
the control that would have caught it **one message earlier**.

---

## 4 · 🔴 POINT THE INSTRUMENT AT A KNOWN POSITIVE FIRST

> **A checker that cannot say YES cannot be trusted when it says NO.**

**Nine probes across five chats returned a confident answer to a question they could not answer.** All
nine are one defect — **question substitution**:

    git log -S <text>       answers "which commit INTRODUCED this"   read as "has this landed"
    grep for a component    answers "which files IMPORT it"          read as "where is this SHAPE"
    plant, run the suite    answers "does this redden the suite"     read as "does the guard reach"

**Not carelessness, and not a broken tool. The rigour is what makes it persuasive.** And _"ask the
right question"_ is not the fix, **because nobody knows they asked the wrong one.**

**`scripts/ward-flow/folded.sh` enforces this: it refuses to report at all until a commit known to be
folded comes back folded.** Use it. **Three verdicts, never two** — folded / not folded /
**cannot tell**. Collapsing _cannot tell_ into _no_ is the same substitution one level along.

---

## 5 · Measure the contribution against the MERGE BASE, not against HEAD

```bash
BASE=$(git merge-base HEAD <sha>)
git diff --stat $BASE <sha>          # what they actually contributed
```

⚠️ **`git diff HEAD <sha>` reports every commit the ward line has taken since their branch point as a
DELETION.** It is a base difference, not a deletion, and it looks alarming and identical.

---

## 6 · 🔴 A FORMAT PASS IS THE MOST DANGEROUS THING TO FOLD

**Run the full suite AFTER a whole-tree reformat and BEFORE folding it.** That is the rule. Not a
cleverer search — sequencing.

**Bought by:** a 95-file `prettier --write` broke **ten byte-for-byte guards** — mockup HTML compared
letter-for-letter against a stylesheet, reflowed differently as HTML and as CSS. I folded it and
found out from the suite an hour later.

⚠️ **NEVER RESOLVE A FORMAT CONFLICT BY PICKING A SIDE.** Both conflicts that day were the same shape:
**the format branch had prettified a superseded version.** Taking "theirs" on one would have silently
reverted a fix and reinstated thirteen type errors — **with prettier's blessing on the diff.**

> **Every hunk in a format conflict looks cosmetic, and one of them was a type fix.**

**Take the semantically newer content, then re-run prettier on it.**

**And fold the format pass LAST** where the chain allows — it touches hundreds of files across
several chats' territory, and anything folded after it inherits the conflict surface.

---

## 7 · 🔴 A HAZARD IDENTIFIED IS NOT A HAZARD SWEPT

**Four instances in two days, two of them mine.**

> **A green instance from inside a class you have just NAMED is the most persuasive possible way to
> under-report it.** The check was real, the result was true, and the sentence covered more than the
> evidence — **so nothing about it invites a second look.**

**Naming a class obliges you to walk it.** And when you cannot enumerate it cheaply, **say so** —
a proposed remedy that was never run is worse than none, because **a fix arrives wearing the
authority of the correction that carried it.**

**A one-file repair to a nine-site string reads identically to a complete one in every record that
exists.**

---

## 8 · Back up BEFORE every fold — and read the tip OUT of the bundle

```bash
env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh
git bundle list-heads <backup>/bundles/all-branches.bundle | grep ward-flow-live-state
```

⚠️ **`env -u` is not optional.** `MSYS2_ARG_CONV_EXCL="*"` — the standard fix for
`git show <branch>:<path>`, which every chat is told to use — **stops the backup writing anywhere**,
and the script hides its own error. **The instruction everyone follows disables the backup,
immediately before a fold.**

⚠️ **And `git bundle verify` checks a bundle against ITSELF.** It passes on a bundle that does not
hold the tip you think. **Read the tip out of the bundle.**

**Bought by:** the backup saved conversation history from **one project folder out of eighty-two** for
weeks, reporting success throughout — exit 0, healthy file count, printed `DONE`. **Nothing
distinguished "saved everything" from "saved 1/82".**

---

## 9 · Every fold message carries what the diff cannot

**A fold commit is the only durable record of why a change was taken.** It carries:

- **the SHA folded, and the range** — never the branch name;
- **what the contributing chat believed but had not measured**, labelled as belief;
- **anything they withdrew**, and why it was persuasive at the time;
- **any conflict, and which side was taken and why**;
- **what was NOT done**, so nobody inherits it as done.

⚠️ **"UNEXAMINED" and "compliant" are different states and they read identically in a count.** So are
_measured-and-sound_, _never-examined_, and _cannot-be-examined_.

---

## 10 · The habit that produced most of the real findings

> **A result that agrees with you is the one nobody audits.**

**Every chat that checked something already going its way found a real defect** — a peer's repair
right after it was praised, a range already reported complete, a causal story that made its own
finding more important, and a search whose silence was doing the work.

**And the corollary, from the chat that named it:** record **who ran the check**, not only who was
right. Across three corrections in one day, one chat supplied the argument and another supplied the
measurement, every time. **It was not thinking harder that closed them. It was somebody running the
command.**
