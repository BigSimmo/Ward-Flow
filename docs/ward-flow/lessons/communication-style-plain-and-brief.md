---
name: communication-style-plain-and-brief
description: 'how to talk to Josh, a psychiatrist and not an engineer — answer first in plain English, ONE recommendation never a menu, when to offer a background task chip, what the "questions" command means, and why a resolved question is struck through rather than deleted'
metadata:
  node_type: memory
  type: feedback
  originSessionId: c34c06c3-837f-4630-8e85-7034426b46fd
  modified: 2026-09-01T05:01:42.812Z
---

**CONSOLIDATED 2026-09-09.** Five memories about ONE subject — how to talk to Josh, who is a psychiatrist and not an engineer. Style, the shape of a recommendation, when to offer a background task, the "questions" command, and what to do with a question he has already answered.

⚠️ **Nothing is summarised — every folded section below is its original entry verbatim.** The merge exists because `MEMORY.md` is loaded in full at every session start and had exceeded its size limit, at which point it loads only PART of itself and says so nowhere. Each entry folded here gave back one index line. The only thing given up is recalling one of these without the others.

Josh settled a message format on 2026-09-01, after re-explaining it to several chats one at a time.
**Use it in every substantive reply.** Full text: `docs/ward-flow/how-to-write-to-the-owner.md` on
the Ward Flow master line, pointed at from section 0 of the working agreement.

**Detail first, at whatever length the subject genuinely needs — this is NOT a brevity rule.** Then
a horizontal rule, the heading `Summary`, then:

- **DID** — what you actually did, including work not discussed above. Say whether it worked,
  half-worked or failed, and carry the limitation, not just the outcome.
- **ISSUE** — anything wrong or risky, in words that scale with severity. Also owns danger: name
  exactly what would be lost before anything irreversible.
- **GAPS** — what you did NOT check that he might assume you did.
- **NEED** — only decisions you genuinely cannot make yourself.
- **RECOMMEND** — your view on NEED, kept separate so he sees the question before your answer.
- **NEXT** — what you are about to do. Announce, then act.

**ISSUE and GAPS always print, even as one word** — they protect him and are the easiest to skip on
a good turn, so their absence would look identical to not having considered them. The others print
only when they have content.

**Two binding properties:** the Summary must stand alone (readable cold), and the detail EXPLAINS
while the block STATES — if the detail is itself a list of points, he reads the same thing twice.

**Why:** he is a psychiatrist, not an engineer, reading between other work, and he was tired of
re-explaining this to every new session.

**How to apply:** write the explanation, then the block. GAPS must say something new or "none" —
the same gap repeated becomes wallpaper. If you have asked the same question twice with no answer,
stop asking, choose, and record it in DID. Related: [[one-recommendation-one-decision]],
[[questions-command]], [[observations-expire]].

---

# one-recommendation-one-decision

> Never bundle a second decision inside a recommendation — especially a substitution that reduces your own work

_Folded from a memory last modified 2026-08-29 on 2026-09-09. Text below is VERBATIM — nothing summarised._

Advising Josh on 2026-08-30, I answered one question — should a community clinician see an
ED's patient list — with "no, **but** let the referrer still track their own referral's
progress." The first half is a clinical-privacy judgement, mine to offer. The second half
quietly replaced a mechanism he had written in his own words, and it arrived inside the answer
to a different question, so agreeing with the first half meant agreeing with both.

**Why:** a substitution that happens to reduce my own work is the one that most needs his
explicit signature — and it is the hardest to catch, because proposing it does not feel like
advocacy. It feels like being helpful about cost.

**How to apply:** one recommendation, one decision. When advice touches a second decision —
above all one he has already made — split it out, name it as separate, and say which part is
mine to suggest and which is his to make. Offer the cheaper alternative as "if you say no,
this may still satisfy what you asked for — your call whether it does."

**And do not over-correct.** When this was caught I withdrew the whole recommendation, which
was worse: withholding judgement whenever it touches something he wrote makes me less useful
exactly where an opinion is worth having. The packaging was wrong, not the opinion. Retraction
wears the costume of rigour — see [[a-correct-diagnosis-that-stops-the-inquiry]].

Related: [[communication-style-plain-and-brief]], [[check-the-conclusion-that-flatters-the-theme]].

---

# offer-task-chips

> Josh values background-task chips (spawn_task) for follow-up work — offer one proactively instead of only describing the work in prose

_Folded from a memory last modified 2026-08-21 on 2026-09-09. Text below is VERBATIM — nothing summarised._

When work surfaces that is worth doing but would bloat the current change, create a
background-task chip with `spawn_task` rather than only describing it. Josh said plainly that
getting one was useful (2026-08-21, during the Claude-cloud-parity PR), and he started it
immediately — after the same recommendation had been made three times in prose and not acted on.

**Why:** a chip is a one-click handoff into its own session. Prose recommendations put the whole
burden of restating the task on him; a chip carries the brief. It also stops the current session
from either doing out-of-scope work or nagging.

**How to apply:**

- Offer one for real follow-ups — a split, a deferred fix, a cleanup — not for vague observations
  or anything trivial enough to just do.
- Write the prompt to stand alone: file paths, why it matters, constraints, the verification
  commands, and which known failures to ignore. He will not be re-explaining it.
- **Point `cwd` at the main repository, not a git worktree.** In a worktree `.git` is a file
  rather than a directory, so the chip cannot resolve the GitHub remote and shows
  "No GitHub remote configured — cloud sessions need a repo URL", which blocks the cloud option.
  "Start with worktree" still works, but the cloud route does not.
- Tell him plainly it starts a session, and whether that session is local or cloud.
- One chip at a time; withdraw a stale one with `dismiss_task` before adding its replacement.

Related: [[communication-style-plain-and-brief]].

---

# questions-command

> When Josh says 'questions', list everything needing his decision — skimmable, one recommendation each, no menus

_Folded from a memory last modified 2026-08-29 on 2026-09-09. Text below is VERBATIM — nothing summarised._

**When Josh says "questions" (or "what questions do you have"), that is a command, not small talk.**
Stop and produce a complete list of everything currently waiting on his opinion or decision.

His instruction, 2026-08-29: _"when I say questions what you do is list everything you need my
opinion or answer on and you explain it clearly and succinctly and easy to skim and understanding as
well as your clear recommendation"_.

## The format

For each item, in this order, and nothing else:

1. **A bold one-line question** — the actual decision, phrased so it can be answered in a sentence.
2. **Two or three lines of context** — why it is open, what turns on it, in plain English. No file
   paths, no function names, no internal detail unless it changes his answer.
3. **"My recommendation:"** — one option, stated plainly, with the reason in a clause. Never a menu.
   If the choice is genuinely his (clinical judgement, product direction, money, risk appetite), say
   so — but still say which way you would go and why.

Order by what costs most to get wrong, not by what you happen to have been working on.

## Rules

- **Completeness is the point.** A question left off because it felt minor is the failure mode; he
  cannot answer what he is not shown. Include the ones you have been quietly working around.
- **Include questions whose answer you have assumed.** If you built something on a guess, that guess
  is a question. Say what you assumed and that it is reversible.
- **Say what is NOT a question** — if the list is short, say so, rather than padding it.
- **Never bundle two decisions into one question.** He answers in one line; a compound question gets
  half an answer.
- **If nothing is open, say "nothing" in one line.** Do not manufacture questions to look thorough.

**Why:** he is a psychiatrist, not an engineer, and he is deciding things across five parallel chats.
A question buried in a status update does not reach him. See
[[communication-style-plain-and-brief]] — this is that rule with an explicit trigger.

**How to apply:** treat the word "questions" as an interrupt. Answer it before continuing whatever
you were doing, and go back to work afterwards without waiting, unless something is genuinely
blocked on his answer — say which those are.

Related: [[ward-flow-coordination-state]], [[parallel-chats-and-cross-chat-sync]].

---

# strike-through-and-answer

> A resolved question deleted from a decision record leaves no trace it was ever raised; left standing, it gets re-asked of the owner by the next reader

_Folded from a memory last modified 2026-09-06 on 2026-09-09. Text below is VERBATIM — nothing summarised._

2026-09-06, Ward Flow. `docs/ward-flow-phase-6-7-decisions.md` Q5 carried **"Outstanding question
for the owner: who decides a leave bed is usable, and on what basis?"** Owner ruling 11 answered it
that day — nobody does, because a ward cannot know it — and the field was removed entirely.

**Both obvious treatments are wrong.** Leaving the question standing means the next reader re-asks
the owner something he has already ruled on. Deleting it leaves no trace the question was ever
raised, so nobody can tell a settled question from one never asked — and the reasoning that produced
the ruling loses its subject.

**The treatment: strike the question through, write the answer beneath it, name the ruling and the
commit.** The record then says what was asked, that it is closed, and by what.

⚠️ **Three chats converged on this independently in one night** — a retired census paragraph, a
tombstoned typo, and this — and Ward Lead made it Ward Flow house style. Convergence is why it is
worth writing down; a convention three people reinvent is one nobody recorded.

**Before editing a shared decision record you do not own**, prove it is byte-identical to the master
line first (`git rev-parse <master>:<path>` against `HEAD:<path>`) — that is the only version of "not
my document" that means anything, and it is what makes the edit safe to make without asking. Say in
the commit that the file is shared and who should know.

**How to apply:** when a ruling closes a question recorded somewhere, correct it _where the question
lives_ — a note filed elsewhere is not read by whoever reads the original. Strike, answer, cite. This
is the same act as [[publishing-a-verdict-into-the-artefact-under-trace]], and carries its caveat:
if an independent re-check of the ruling would have to read that file, publish the verdict elsewhere
and leave a pointer instead.

Related: [[a-retraction-does-not-travel]], [[a-deferral-whose-reason-expires]],
[[no-longer-compresses-to-never]], [[ward-flow-ledger-system]].

## The looser standard must never go to the reader who cannot check it (2026-09-10)

Two ward chats measured "how many screens disclose provenance" and got **45** and **51** —
different readings of "discloses", nothing resting on it. One chat **deliberately recorded both as
unreconciled in the test file**, which was right. An hour later the same chat quoted the other
chat's **51** to Josh as a bare fact.

**The direction is the whole finding.** A file is re-read by someone who can open the code and
disagree. Josh is not an engineer and has no way to test a number in a sentence. **He needs the
caveat more than the file does, and he got it less** — the strict standard went to the reader who
could check it and the loose one to the reader who could not.

**A figure that is unreconciled in the artefact is unreconciled in the summary.** If a caveat is not
worth a clause to him, the figure was not worth stating. This does not mean more detail — it means
_"about 45 to 50, two counts disagree"_ instead of _"51"_.

⚠️ **Related and worse: never put an option to him that your own measurement has ruled out.** Two
chats offered him the same decision; one framing closed by offering to take on work the other's
measurement had already priced as not working as posed. **"Yes, go" to that framing commissions the
wrong work**, and two honest recommendations agreeing does not catch it.

## 2026-09-10 — a command that works for every agent and fails for the one human

Six agents circulated `grep -c TRANSCRIPT_DIRS ~/.claude/scripts/backup-work.sh` as the check for a
backup defect. **Josh ran it and PowerShell 7.7 has no `grep`.**

🔴 **THE DEFECT IS INVISIBLE FROM INSIDE THE POPULATION THAT WROTE IT.** Every agent runs bash, so the
command passes every test any of us would run. _"It worked when I ran it"_ cannot detect this class —
the only reader it breaks for is the one who is not an agent, and they are the reader it was written
for.

**Josh's terminal is PowerShell.** Before handing him a command, check it for `grep`, `wc`, `ls | ...`,
`[ -d ... ]`, `||`, backticks, `$(...)`, single-quoted globs — all bash-only.

**Shell-agnostic (safe to hand over as-is):** a bare executable with plain arguments — `git`, `npm`,
`node`, `npx`. No pipes, no builtins, no test brackets.

**Worked replacement, tested by two parties in PowerShell:**

    (Select-String -Path "$HOME\.claude\scripts\backup-work.sh" -Pattern "TRANSCRIPT_DIRS").Count

⚠️ **Same family as one-signal-two-states and question substitution: the check is real, the result is
true, and it is about the wrong thing — here, about MY shell rather than his.** Related:
[[a-measurement-is-scoped-to-what-it-measured]].

## 2026-09-10 — 🔴 EVERY COMMAND HANDED TO JOSH MUST RUN IN POWERSHELL

**His terminal is PowerShell 7.7. Mine is bash. I gave him a bash command and it failed in front of
him:**

    grep -c TRANSCRIPT_DIRS ~/.claude/scripts/backup-work.sh
    grep: The term 'grep' is not recognized as a name of a cmdlet...

**It was the integrity check for his backup script — the last command you want unusable by the owner.**
He is not a programmer: he sees an error, not a diagnosis.

⚠️ **WHY NO EXISTING HABIT CATCHES THIS, AND IT IS THE WHOLE POINT.** The command was correct **for
me**. Every agent on this machine runs bash, so it passes every test any of us would think to run.
**The defect is invisible from inside the population that wrote it, and it breaks for exactly one
reader — the one it was written for.**

> **"It worked when I ran it" cannot detect this class.**

**And the standard control fails too** (Ward Builder Two's sharpening, which is better than mine):
_pointing the instrument at a case whose answer you know_ **passes — because I know bash works.** It
is question substitution with the target swapped: the right question, asked about the wrong shell.

**THE TEST, before handing him anything in a code block:**

**Shell-agnostic = a bare executable with plain arguments** — `git`, `npm`, `node`, `npx`, `gh`.
**NO pipes, NO shell builtins, NO test brackets, NO `~` paths, NO `$VAR`.**

| Bash-only                  | PowerShell form                                   |
| -------------------------- | ------------------------------------------------- |
| `grep -c X file`           | `(Select-String -Path "file" -Pattern "X").Count` |
| `ls dir \| wc -l`          | `(Get-ChildItem dir).Count`                       |
| `[ -d x ] \|\| echo "..."` | `if (-not (Test-Path x)) { "..." }`               |
| `~/.claude/...`            | `"$HOME\.claude\..."`                             |

**RUN IT BEFORE SENDING IT.** `powershell.exe -NoProfile -Command "..."` from bash tests the real
thing. I did this for the replacement and it returned the same answer his terminal did.

Related: [[a-measurement-is-scoped-to-what-it-measured]],
[[a-control-must-test-the-premise-not-the-measurement]], [[one-word-two-states]].
