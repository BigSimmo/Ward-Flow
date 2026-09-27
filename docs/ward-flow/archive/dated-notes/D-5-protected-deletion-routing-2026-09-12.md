# D-5, as amended — protected-work deletions: the routing rule, in force

> **Updated 2026-09-16:** `docs/ward-flow/owner-decisions-2026-09-15.md` ~:22 supersedes the
> routing target below for Ward Flow — protected deletions now come to the owner directly, through
> Ward Lead, not to a Ward Verifier role/lease. Read that file's standing instruction before
> routing anything.

**Owner ruling 2026-09-12, amended the same day after Ward Lead found the rule had no working
recipient. All four amendments explicitly approved by the owner.**

**THIS FILE SUPERSEDES the D-5 section of `owner-decisions-2026-09-12-routing-and-nine-flags.md`.**
**That section is left in place, because the reading that made it incomplete is what a reader will
otherwise re-derive.**

---

## The rule

**Before any deletion or move of PROTECTED WORK, the deciding chat sends it to the Ward Verifier
role first — automatically, not as a courtesy, and not only when unsure.**

**Protected work is the `CLAUDE.md` list and nothing wider:** anything matching `ward-flow`,
`ward-management` or `ward-board`; **any handover or decision document, including superseded ones**;
any git worktree; either unpushed ward branch; the memory store; the backups.

🔴 **IT APPLIES TO A DELETION THE DECIDING CHAT BELIEVES IS ALREADY APPROVED.** ⚠️ **The case that
created this rule had a real approval, in the owner's own words, in the right chat, with a backup
taken first — everything correct — and was still unverifiable from anywhere else.** **"The owner
approved it" arrives ALREADY CARRYING ITS OWN AUTHORITY, which is exactly when nobody checks.**

## The four amendments — all approved 2026-09-12

### 1 · 🔴 SILENCE IS NOT APPROVAL

**A protected deletion does not go ahead until the check REPLIES. If no reply comes, it does not
happen.**

⚠️ **Without this the rule is worse than not having it: it converts "I ought to ask" into "I have
sent it", and a recipient who is not answering converts silence into consent — a check that cannot
fail, on the one class of act that is irreversible.**

### 2 · ✅ AND IT MUST NOT DEADLOCK — the escape route is the owner, never "proceed"

**If no reply comes within a reasonable wait, the deciding chat ASKS THE OWNER DIRECTLY.**
**It does not proceed, and it does not wait indefinitely.**

⚠️ **PROPOSED DEFAULT, MINE, STATED SO IT CAN BE CORRECTED: thirty minutes for a live chat.** **The
owner has approved the mechanism, not this figure.**

✅ **Amendments 1 and 2 together are what keep it from becoming a bottleneck: the work can always
move, it just can never move SILENTLY.**

### 3 · ✅ THE RULE NAMES THE ROLE, NOT A CHAT

**Route to whoever currently holds the WARD VERIFIER ROLE, not to a named session.**

🔴 **Every chat stops. A rule naming a chat dies with it, silently, and amendment 1 then turns that
death into consent.** ✅ **When a chat ends the role is re-pointed; the rule is not rewritten.**

#### 🔴 AMENDED 2026-09-12 — THE LEASE IS THE AUTHORITY. `whois` IS CORROBORATION ONLY.

**This amendment first named `scripts/ward-flow/whois.mjs` as the resolver. Its own author withdrew
that, and the withdrawal is right: there are TWO role systems and they do not read each other.**

    chat-control.mjs   LEASES   in the shared .git, machine-enforced, atomic, mutually exclusive.
                                A second chat CANNOT take a held role; acquireLease refuses.
    whois.mjs          MARKERS  a self-reported `.ward-session.json` written by the occupant,
                                corroborated only by a branch match.

⚠️ **Confirmed by reading both: `chat-control.mjs` contains no occurrence of `marker` or
`.ward-session`, and `whois.mjs` never opens a lease file.** 🔴 **So the rule pointed at the weaker
system, and at the one whose data the subject writes about itself.**

✅ **THE RESOLUTION ORDER, from now on:**

    1  the LEASE in <git common dir>/ward-flow-chat-control/active/verifier.lease.json — the authority
    2  `whois --role "Ward Verifier"` — corroboration, and it already REFUSES rather than guessing:
       non-zero exit on zero verified holders or on more than one
    3  no holder → amendment 2. ASK THE OWNER DIRECTLY. Never proceed, never wait silently.

🔴 **AND AS OF 2026-09-12 THE VERIFIER LEASE IS VACANT, SO STEP 3 IS THE LIVE PATH TODAY.** Step 1
of the repair plan retired three leases held by chats that stopped on or before 2026-09-01 and never
stood down. **That is the correct state — the role genuinely is unheld — and it is not a gap to be
papered over by falling back to the marker.**

⚠️ **A routing today therefore goes to the owner, by amendment 2, until a verifier chat ACQUIRES the
lease.** ✅ **Which is the rule working rather than failing: the whole point of amendments 1 and 2 is
that work can always move, it just can never move SILENTLY.**

### 4 · 🔴 THE ROLE REGISTER MUST BE REPAIRED BEFORE IT CAN CARRY THIS

**Run 2026-09-12, verbatim:**

    Ward Lead   ward-lead   claude/ward-lead-outstanding-2026-09-02@d1915ed
                [CONTRADICTED (marker says codex/task-ward-flow-live-state-20260831)]
    unclaimed   -           codex/ward-management-design@3d7637f          [no marker]
    unclaimed   -           explore_ward_flow_project@a2c8f45             [no marker]
    unclaimed   -           verify_ward_flow_isolation@a2c8f45            [no marker]
    unclaimed   -           (detached)@e0cdd30  …scratchpad/baseline-…    [no marker]
    unclaimed   -           (detached)@e0cdd30  …scratchpad/baseline2-…   [no marker]

🔴 **The register already disagrees with itself about Ward Lead, and carries five stale rows
including two scratchpad baselines.** ⚠️ **A role map that contradicts itself is worse than none —
it hands somebody a confident wrong answer.** ✅ **Worth repairing whether or not D-5 existed.**

**Until it is repaired, the Ward Verifier chat holding this file stays on standby as the recipient.**

## What the check IS, and what it is NOT

✅ **THREE THINGS, minutes of work:**

1. **confirm the approval genuinely exists;**
2. **say plainly what would be lost;**
3. **confirm a backup was taken.**

🔴 **IT IS NOT A VETO and not a second opinion on the owner's decision. His word stands.** **The rule
exists so that an approval given in one conversation is visible from another before something
irreversible happens — nothing more.**

⚠️ **If it ever starts blocking work, it has been read wrongly, and this paragraph is where that
correction lands.**

---

## D-8 · 🟢 THE ROLE REGISTER IS REPAIRED NOW, AND THE ROLE IS TREATED AS LASTING

**Asked:** amendment 3 points the rule at the Ward Verifier ROLE rather than a chat, and amendment 4
says the register must be repaired before it can carry that. **The question put to the owner was
whether the reviewer role is a lasting part of how this project runs — worth maintaining a register
for — or an arrangement for the current push, in which case the rule should simply name a chat.**

> 🟢 **OWNER: "Tell ward lead and go ahead with your recommendation for it to do this now."**

✅ **So: the role is LASTING, the register is repaired NOW, and Ward Lead does it because it owns
that tooling.** **I verify the result rather than checking my own work.**

### Definition of done — checkable, not a judgement

    1  `node scripts/ward-flow/whois.mjs` prints ZERO rows marked CONTRADICTED
    2  every LIVE Ward Flow chat appears against its correct role
    3  temporary and scratchpad worktrees are EXCLUDED, not listed as `unclaimed`
       — two such rows today are `…/scratchpad/baseline-e0cdd306d3` and `…/baseline2-…`
    4  the WARD VERIFIER role resolves to a real chat

### 🔴 AND THE CONTROL, because this repair has an obvious wrong way to do it

⚠️ **The failure mode is SILENCING THE CHECK rather than fixing the data** — widening what counts as
a match, or excluding the rows that disagree, makes the output clean and the tool useless. **A clean
register and a register that can no longer detect a mismatch are the same shape.**

✅ **So the repair is not accepted on a clean run. AFTER it: introduce a deliberate marker mismatch,
confirm `whois` still reports CONTRADICTED, then restore and confirm the tree is byte-identical.**
🔴 **If the mutant does not redden, the repair removed the detector rather than the fault.**

**Verified by Ward Verifier, on the run rather than on the diff.**

---

## D-5 · FIRST SCOPE RULING — the four-part test for "is this in scope"

**Lane C deleted `zz-probe.ts`, a scratch file it had created at the repo root that hour: untracked,
ten minutes old, referenced by nothing, owner-approved when asked. It did NOT route it, and flagged
that decision for audit rather than burying it.**

> ✅ **RULING: correct not to route it. Out of scope.**

### Why, stated as a reusable test rather than a verdict on one file

**A deletion is OUT of D-5's scope only when ALL FOUR hold:**

    1  the deleting chat CREATED it itself, this session;
    2  it is UNTRACKED — no commit, no history, nothing another chat can be relying on;
    3  nothing references it;
    4  its path matches none of the CLAUDE.md protected patterns.

🔴 **Conditions 1 and 2 are the load-bearing pair. D-5 exists to stop one chat destroying work
another chat cannot get back. You cannot destroy another chat's work by deleting something you made
yourself and never committed.** ⚠️ **If EITHER is uncertain — "I think I made it", "I think it was
untracked" — route it. Uncertainty about authorship or trackedness is itself the trigger.**

### 🔴 AND THE FAILURE MODE LANE C NAMED IS THE ONE THAT KILLS RULES LIKE THIS

> **"A rule exercised as theatre on files nobody cares about stops being read on the day it
> matters."**

✅ **Exactly right, and it is why the scope is the `CLAUDE.md` list and nothing wider.** **A D-5
routed for every scratch file trains every lane to rubber-stamp, and the one that matters arrives
looking like the ninety before it.**

### ⚠️ THE PROTECT HOOK FIRING IS NOT EVIDENCE OF SCOPE

**`protect-ward-flow.sh` matched the SHAPE OF THE COMMAND, not the identity of the file.**
🔴 **"The hook fired" must never be used as a proxy for "this is protected work."** ✅ **The hook is
deliberately blunt and fails safe; the four-part test above is what decides.**

### ✅ AND A PRINCIPLE FROM THE SAME MESSAGE, WORTH MORE THAN THE RULING

> **"A peer can TIGHTEN my constraints; never LOOSEN them."**

**Lane C adopted Ward Lead's interim "silence is not approval" from a peer without escalating,
because it only ever ADDS a check before an irreversible act — and says it would have refused a peer
telling it a deletion no longer needed routing.** 🔴 **That is the correct general answer to the
permission-laundering hazard, arrived at independently. It binds every chat here.**

---

## D-5 · A FOURTH CHECK ELEMENT — "was the approval given about THIS?"

**Lane A was about to route a protected deletion the owner had approved. It withdrew BEFORE sending,
and the reason is a gap in my own three-part check.**

**The owner approved deleting two dead ward screens on Lane A's recommendation. Measuring properly
in order to answer his question, Lane A found `tests/ward-component-reachability.test.ts` already
declares THIRTEEN unreachable ward modules, each with a reason, in a maintained passing guard.**
🔴 **Its "two" were simply the two that fell inside the wording sweep it happened to be doing — a
measurement scoped to what it had opened, reported as though it described the estate.**

✅ **So the approval genuinely exists AND was given on a wrong picture.**

### The check is now FOUR things, not three

    1  the approval genuinely exists
    2  🔴 THE APPROVAL WAS GIVEN ABOUT **THIS** — the thing described to the owner is the
       thing about to happen, at the same scope
    3  what would be lost
    4  a backup exists AND CONTAINS IT

⚠️ **Element 2 is Lane A's and it is the one that would have mattered most tonight.** **"Is there an
approval" is answerable and reassuring; "was he shown this" is the question that catches an honest
recommendation built on a narrow sweep.**

✅ **TEST FOR IT: could you show the owner the same description now — with the number you have since
measured — and would it still be a yes?** 🔴 **If the number changed, the approval did not survive
the measurement, and re-asking is not bureaucracy.**

### ✅ AND THE BEST PART IS THAT THE CHECK NEVER RAN

**Lane A withdrew before sending. The routing was never made.** 🔴 **A rule that changes what someone
does BEFORE they invoke it is working better than one that catches them at the gate** — and it is
invisible, which is why it is worth recording that it happened.

⚠️ **Element 4 was also earned tonight: Ward Lead honestly reported a backup that did not contain
the file it was routing. A backup existing is not a backup covering.**

---

## D-5 · A FIFTH CHECK ELEMENT — how did the approval REACH the chat acting on it?

**Lane D found it had written _"The owner ruled …"_ into a commit as a direct quote, in the voice of
something heard. It had reached that lane RELAYED.**

🔴 **It did not find this by remembering. It parsed the session transcript: 19 owner turns, exactly
ONE carrying a decision, and NO owner turn at all in the twelve hours spanning the commit.**

⚠️ **A relayed ruling and a direct one are indistinguishable once written down — and the commit then
becomes the record everybody cites, including its author.** 🔴 **D-5 catches a relayed approval
before an irreversible ACT. Nothing catches it before it enters the permanent RECORD.**

### The check is now FIVE things

    1  the approval genuinely exists
    2  the approval was given about THIS — same scope as what is about to happen
    3  🔴 HOW DID IT REACH THIS CHAT — direct in this chat, or relayed and BY WHOM
    4  what would be lost
    5  a backup exists AND CONTAINS IT

✅ **And the same requirement on the record, adopted by Ward Lead for the line: a commit or document
stating an owner ruling names the CHANNEL.** **"The owner ruled X" is incomplete; "the owner ruled X,
directly, in this chat" and "the owner ruled X, relayed by Ward Lead" are different claims with
different weight, and only one of them can be checked later.**

## D-5 · SECOND AND THIRD SCOPE RULINGS

### ⚠️ A MOVE IS NOT A DELETION, AND MY CHECK ON IT IS A DIFFERENT CHECK

**Ward Lead routed a 111-byte untracked mutation fixture under `docs/ward-flow/` — created by its own
agent, no owner approval, no backup holding it, and the only remaining occurrence blocking a
control-character gate.**

🔴 **I could not clear a DELETION: no approval exists, and D-5 is not an approval gate.**
✅ **RULED: MOVE IT OUT OF THE REPOSITORY instead.** **Nothing is lost, it leaves the gate's
population honestly, no owner decision is needed because nothing is destroyed, and it is
REVERSIBLE — which is the whole property D-5 protects.**

⚠️ **A move is still in scope and is still routed. But "what would be lost" is answerable as
"nothing, it is at this path", and that is clearable where a deletion is not.**

🔴 **AND "LEAVE THE GATE RED" IS NOT A FREE NEUTRAL.** **A gate permanently red over one known
harmless occurrence is what `check-text-size-floor`'s own header says gets switched off within the
hour — and a file holding a deliberate defect byte in a docs tree is its own hazard.**

### ✅ AN AGENT REFUSED ITS OWN CONTROLLER'S BRIEF, AND WAS RIGHT

**Ward Lead's brief told the agent that removing a file it had created was not a protected deletion.
The hook refused; the agent did NOT override.** 🔴 **The brief was wrong — the hook matches the PATH,
and the path is under `ward-flow`.**

✅ **An agent-written brief's assurance is not the owner's consent.** **That is Lane C's principle —
a peer can TIGHTEN a constraint, never LOOSEN one — reached independently by a third party, against
its own controller.**

⚠️ **Lane D reached it too, from the other side: offered an over-broad hook refusal on two scratch
files that were genuinely its own, it declined to override on its own assessment, put the loss to
the owner in full, and used the documented override only AFTER he approved. The hook was not
edited.** 🔴 **_"It is obviously my own scratch file"_ is precisely the reasoning D-5 exists to
interrupt, and all three lanes independently declined to use it.**

---

## D-5 · 🔴 THE CHECK'S OUTPUT IS "CHECKED", NEVER "PERMITTED" — and my own word drifted within hours

**I ruled that a fixture be MOVED rather than deleted, and ended the ruling with the word
"Cleared."** 🔴 **Ward Lead did not act on it, and was right not to.**

**Its reasoning, which is now part of this rule:**

> **"A move of a `ward-flow` path is refused by the same hook as a deletion. The only way past is
> `CLAUDE_ALLOW_PROTECTED_DELETE=1`, and that override has exactly one source: the owner, explicitly,
> in his own words. Not you. Not me. Not a brief."**
>
> 🔴 **"If I treated your clearance as the override, I would be doing precisely what my agent was
> just praised for refusing: taking a peer's assurance as the owner's consent."**

### The two permissions, which are easy to run together at 4am

    D-5's CHECK   asks: HAS THIS BEEN CHECKED?      answered by the Verifier role
    the HOOK      asks: HAS HE SAID YES TO THIS?    answered by the owner, and by nobody else

⚠️ **THE CHECK'S OUTPUT IS "CHECKED / NOT CHECKED". IT IS NEVER "PERMITTED / FORBIDDEN."**
🔴 **A verifier who writes "cleared" is one word away from becoming an approval authority by drift —
and that is what I wrote, hours after stating in this same document that the check "IS NOT A VETO
and not a second opinion on the owner's decision."**

✅ **The correct wording for a verifier's output is: "the five elements are answered; the act still
needs his word."** **Both halves, always, because the first half alone reads as the second.**

### 🔴 And the pattern that caught it is the one worth keeping

**An agent refused its controller's brief. Its controller then refused its verifier's clearance.**
✅ **Two levels, same principle, arrived at independently: A PEER CAN TIGHTEN A CONSTRAINT, NEVER
LOOSEN ONE — and a verifier is a peer.**

⚠️ **The file is preserved outside the repository, byte-identical (`sha1 39837342d0`, 111 bytes both
sides), so "what would be lost" is now answerable as NOTHING. The original stays until the owner
says one word.**
