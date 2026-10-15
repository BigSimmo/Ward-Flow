# An answer that never reaches the chat that asked

**Draft proposal, written 2026-09-12 at the owner's instruction, after this failure cost several
hours in one evening.** Nothing here is in force. It is one recommendation with its reasoning, so
the owner can reject the reasoning rather than only the mechanism.

---

## 1 · What actually happened, because the obvious diagnosis is wrong

I put three clinical questions to the owner: three numbers that turned screens amber, each chosen
during a build, none approved by a clinician. I then told him — repeatedly, over hours — that three
fixes were blocked on his answer.

**He had already answered.** The answer was given in another chat, recorded there as `O-22`, and
carried in Ward Lead's own handover as _"the three threshold questions — answered in the Settings
lane's own chat"_. I found it only because I happened to read that handover for an unrelated reason.

🔴 **THE OBVIOUS DIAGNOSIS — "nobody wrote it down" — IS FALSE, AND THAT IS THE IMPORTANT PART.**
It was written down, promptly, in the right form, by the right chat. This programme has ten owner
decision files and they are good: each entry carries the date, the chat, **Asked as**, and
**Answer, in his words**. The recording discipline is not the problem and does not need improving.

**The problem is that the chat which ASKED had no way to learn that an answer existed.** The write
happened. The read never did, because nothing told anybody to look.

⚠️ **And the second half, which is worse: I did not merely fail to notice. I actively asserted the
opposite, several times, to the owner, with confidence.** _"Three fixes are blocked on your
answer"_ is a status claim about somebody else's action, and such a claim is false from the moment
they act. Nothing anywhere could have contradicted me.

---

## 2 · The one design principle

> **The destination of an answer must not depend on which door it came in.**

The owner answers in whichever chat he is in. That is not a fault to be corrected in him — it is
the condition the system has to absorb. A design that requires him to answer in the chat that
asked has already failed, because he will not, and should not have to.

Everything below follows from that single line.

---

## 3 · Why the existing machinery cannot catch it

| What exists                  | Why it does not close this                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Ten owner-decision files     | Indexed by **date and topic**, never by the question. Nothing connects an answer to whoever was waiting for it.                |
| `docs/ward-flow` handovers   | Push-shaped and read by chance. Mine reached me by luck, four hours late.                                                      |
| Cross-chat messages          | Reach whoever the sender thinks of. The sender does not know who is blocked — that is exactly the information that is missing. |
| `docs/outstanding-issues.md` | Tracks **work**, not questions, and a question is not a task until it is answered.                                             |

**The common shape: every one of them records the answer. None of them carries a return address.**

---

## 4 · The proposal — one ledger of QUESTIONS, and three controls

### 4.1 · One row per question, created when the question is ASKED

Not per answer, and not after the fact. A single file, `docs/ward-flow/owner-questions.md`, one row
each:

    ID       Q-0042
    asked    2026-09-11, by Ward Mockups
    one line Three screens turn amber on invented thresholds (200min ED, 120min referral,
             120min legal form). Real numbers, or strip the colour?
    status   OPEN | ANSWERED | WITHDRAWN
    answer   verbatim, when it comes
    where    the chat it was answered in, and the date
    recorded the full write-up's file, if there is one

**The prose write-ups stay exactly as they are.** They are good and they carry reasoning a table
cannot. This ledger is an **index with a return address**, not a replacement.

✅ **The one field that fixes tonight's failure is `asked … by`.** An answer arriving at any door
now has somewhere to go back to. That alone is worth more than the rest of this document.

### 4.2 · Control one — the return address, and it needs no tooling at all

**Whoever receives an answer updates the row and messages the chat named in it.** One line of
discipline, no scripts, available today.

⚠️ **On its own it is not enough, and the reason is the whole point of the next two: it depends on
somebody remembering, and this evening is the proof that people do not.** Ward Lead recorded the
answer correctly and still did not tell me, because the row that would have named me did not exist.

### 4.3 · Control two — a pull at session start, where every chat definitely reads

A `SessionStart` hook already prints the outstanding-work queue to every session in this repository.
Extend it by a few lines:

    YOUR OPEN QUESTIONS (2)
      Q-0042  three invented amber thresholds            asked 11 Sep
      Q-0051  the not-a-medical-device line, 32 drawings asked 12 Sep

    🔴 ANSWERED SINCE YOU LAST LOOKED (1)
      Q-0042  ANSWERED 12 Sep in the Settings lane — "drop them"

**This is the mechanism that would have caught tonight**, and it is cheap: the machinery exists, the
hook exists, and the read happens at the one moment a session cannot skip.

### 4.4 · Control three — a gate at the moment the false claim is made

The dangerous act is not forgetting an answer. **It is asserting that a question is still open.**
So the control belongs there, and it is the only one that works when a chat closes without
recording anything.

A check on commit messages and handover documents:

- 🔴 **REFUSE** when the text claims a question is awaiting the owner **and names an ID whose row
  says ANSWERED** — printing the answer. This is a provable contradiction, so **it cannot fire on
  correct work**, which is the property every guard in this repository has had to earn.
- ⚠️ **WARN, never block,** when the text makes such a claim and names no ID at all: print this
  chat's open rows and carry on. A missing ID may be a genuinely new question, and a gate that
  blocks a new question would be a guard obstructing its own purpose.

**That asymmetry is deliberate.** A guard written wider than its defect gets widened until it means
nothing — this repository has three instances of that already, and I tripped my own over-wide guards
three times in one evening while doing tonight's work.

---

## 5 · What I would do, in order

1. **Create the ledger and backfill every question currently open**, from all ten decision files
   plus the live chats. Perhaps twenty rows. **Do this first and alone** — it is the whole of
   control one, it needs no code, and it is useful the moment it exists.
2. **Extend the SessionStart hook** (§4.3). Small, and it is the control that would have caught
   this.
3. **Add the commit-message check** (§4.4), refuse-on-contradiction only at first.

⚠️ **Do not start with the gate.** It is the strongest control and the easiest to get wrong, and it
is worthless until the ledger has rows to check against.

---

## 6 · What this does NOT fix, stated plainly

- **An answer given in a chat that then closes without recording it.** Nothing here reaches inside
  a conversation. §4.4 is the only defence, and it works by stopping the _next_ false claim rather
  than by capturing the answer.
- **An answer the owner gives in conversation and does not think of as a ruling.** Several of this
  programme's rulings were answers to something else entirely.
- **Two chats asking the same question and getting two honest, different answers** — a failure this
  programme has already recorded. The ledger makes it _visible_, because the second asker would see
  the first row. It does not prevent it.

---

## 7 · The one-sentence version

**Record the question, not just the answer — and name who is waiting, so an answer arriving at any
door knows where to go.**
