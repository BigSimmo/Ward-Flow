# The clinician check — questions to put to a ward clinician

**Written 2026-09-06 at the owner's request.** The bed model has been revised twice and has
never been shown to a ward clinician. These are the questions that would settle it.

**How to use it:** ask them cold, before showing any screen. A screen invites agreement; a
question invites correction. Show the screens afterwards, against their answers.

⚠️ **The failure this exists to catch is a model that is coherent, well-built, fully tested and
does not describe how a ward actually works.** Nothing in this repository can detect that.

---

## What the software currently says (do not read this out)

A bed being freed moves through three states: **expected → confirmed → discharged.**
Alongside, a bed can be **blocked**.

An _expected_ discharge does not record how confident the ward is. It records **what the ward is
waiting on**, chosen from five: _awaiting ward round · awaiting family or carer agreement ·
awaiting accommodation · awaiting community team acceptance · nothing outstanding._

The board shows six figures: **Ready · Confirmed today · Expected today · Blocked · Held ·
Leave (usable).**

---

## 1. The three stages

1. **When you know a patient is going home, what do you actually record, and where?**
   _(Tests whether a staged model exists in their world at all, or whether it is one act.)_
2. **Is there a moment where a discharge stops being "likely" and becomes "definite"? What makes
   it definite — a decision, a person, a document, or the patient leaving?**
   _(Tests whether "confirmed" is a real state or an invented middle.)_
3. **Between "we think they're going" and "they've gone", how often does it fall through, and
   what causes it?**
4. **Does a bed become usable at the moment the patient leaves, or later? What happens in
   between?**
   _(Tests whether "discharged" and "ready" are the same instant — the software currently treats
   cleaning as a separate qualifier.)_

## 2. What you are waiting on

5. **When a discharge is expected but not confirmed, what is the hold-up, in your words?**
   _(Ask before showing the list of five. If their words do not map onto it, the list is wrong.)_
6. **Are those five enough? What is missing, and how often does the missing one come up?**
7. **Is there ever more than one thing you are waiting on at once? Which one would you record?**
   _(The software allows exactly one. If the real answer is routinely two, that is a defect.)_
8. **"Awaiting ward round" — is that a fixed time of day, and does that change the answer?**

## 3. The six figures on the board

9. **If a colleague rang and asked how many beds you have, what number would you give — and what
   would you mean by it?**
   _(Ask before showing the six. The word they use first is the one the board should lead with.)_
10. **Does "Ready" mean anything to you? Does "Held"? Does "Blocked"?**
    _(Tests the vocabulary, not the arithmetic. A figure everyone renames in their head is wrong.)_
11. **Is a bed on leave a bed you would offer someone?**
12. **Which of these six would you never use?**
    _(A figure nobody uses is not neutral — it competes for attention with the ones that matter.)_

## 4. Who keeps it true

13. **Who would be typing this in, and when in their day?**
14. **What happens on a day when nobody updates it? What should the board show then?**
    _(Tests the stale-data behaviour. The software's answer must degrade to "we do not know",
    never to a confident wrong number.)_
15. **If the board says three beds and you know it is one, what do you do?**
    _(Tests whether the record or the phone call is authoritative — and whether people would
    simply stop reading it.)_

## 5. The two questions that decide whether any of it is safe

16. **Is there anything on this board that, if wrong, would move a patient to the wrong place?**
17. **Would you use this instead of ringing the ward — or as well as?**
    _(⚠️ "Instead of" is the answer that makes every figure above safety-critical. "As well as" is
    the answer this prototype is currently built for, and the difference should be a deliberate
    decision rather than a discovery.)_

---

## What to do with the answers

- **A stage they do not recognise** → the model is wrong, and no amount of testing would have said so.
- **A waiting-on reason they name that is not in the five** → the list is incomplete, and it is a
  fixed list precisely so it can be argued about.
- **A figure they would rename** → the vocabulary is wrong, and it is shared across three levels of
  the board, so it is one change in one place.
- **"Instead of ringing"** → stop and re-scope. That is a different product with different
  obligations.
