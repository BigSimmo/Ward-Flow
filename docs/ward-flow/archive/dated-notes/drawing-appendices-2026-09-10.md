# The rules and questions inside the drawings — Raise a referral

**Recorded by Ward Lead, on the line, because Lane C cannot commit while its implementer holds the
tree.** Found by Ward Builder Three (Lane C) reading `raise-a-referral-third-edition.html`'s own
numbered appendix — **§7 "Rules the build must not break"** and **§8 "Open questions the build must
settle"**.

🔴 **Nobody's task list mentioned these sections existed.** The owner's instruction for this phase
was _"implement the behaviour of the new mockups, asking for clarification rather than inferring"_ —
and **a question sitting unread inside a drawing is the likeliest place an inference happens
instead.**

⚠️ **Every lane reads its own drawings' appendices.** Only one drawing has been read so far.

---

## 1 · 🔴 THE HAZARD: Q-8's answer looks like it covers something it does not

**The drawing asks: _"What happens to a half-written history if the page reloads?"_**

**Q-8 asked whether a reload wiping the demonstration may stand this phase. The owner said yes.**
🔴 **That is about DEMONSTRATION STATE. This is about a clinician's in-progress account of a
patient, and they are not the same thing.**

**The danger is precisely that Q-8 reads as covering it.** A builder applying Q-8 here **silently
discards a written clinical account — and has a ruling to point at.**

The drawing answers itself, and its answer is a floor, not a preference:

> _"Tolerable for three checkboxes, not tolerable for four paragraphs of a risk note. Either the
> draft is held and the screen says so, or the screen warns before leaving. **It must not silently
> do neither.**"_

**Today the screen does neither of the two acceptable things.**

**RULING (Ward Lead): Q-8 does NOT extend to an in-progress referral.** Nobody may cite it there.
**Which of the two acceptable behaviours is built is the owner's, and it is queued for him.** Until
he answers, no lane builds either — but no lane may treat the current silence as sanctioned.

---

## 2 · The other three questions, against the owner's Q numbers

| The drawing asks                                                                              | Status                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Can the history be edited after sending, and does the receiving team see that it changed?** | 🔴 **NEVER ASKED, in any form.** The drawing: _"If it can be edited, the version the receiving team read must remain recoverable, or two people will be acting on different accounts of the same patient."_ **Queued for the owner.**                                                                                                                                                                                        |
| **Who can read the history after it is sent, and for how long?**                              | **NEVER ASKED.** The drawing marks it _"needs an answer before a real patient, not before it is built"_ — **so it belongs beside the three deferred real-patient gates, not in this build.** It does not block anyone; it must not be lost.                                                                                                                                                                                  |
| **Are the three sections the right three, and are the limits right?**                         | ⚠️ **HALF SUPERSEDED.** Q-13 already ruled three sections down to one — **that half must NOT be put to him again.** **The second half is live:** the drawing calls the limits _"placeholders — nobody has measured a real referral against them"_, and the model today holds exactly one, `history: 2000`, carried over unexamined. The drawing: the limits _"are clinical judgements and belong to the owner."_ **Queued.** |

⚠️ **Question 3's own framing is why it is new, and it is worth quoting:**

> _"The structured fields carry no identifying content, so access has been a low-stakes question.
> **The history changes that: it is the first thing on this form that would matter if the wrong
> person read it.**"_

---

## 3 · §7 — twelve rules, each bought by a defect. Six bind and were in no plan

The drawing's own framing: **_"Each of these is here because breaking it has already caused a defect
somewhere on this system."_**

- 🔴 **Tap targets stay at 48px, not 44.** Reducing them to satisfy a generic accessibility rule
  **reintroduces a known test flake.** ⚠️ **Twice-attested** — the repository's own standing warning
  says the same thing independently.
- **The reason sits BESIDE the Send button, never above it.** Reasons appear and disappear as you
  answer; a reason above the button **moves the button out from under a thumb.**
- **A figure beside a checkbox stays beside that checkbox; a destination's question stays on that
  destination's card.** Moving one into a rail **silently unhooks the screen-reader description.**
- 🔴 **Every list of options is generated from one source of truth, never retyped into a sentence.**
  _"Retyped enumerations produced stale copy three times, including the sentence on this very screen
  that counted the permitted facts and was still saying 'five' after a sixth was added."_
- **The rail REPORTS the history, never previews it** — _"a truncated preview implies that something
  read it."_ And **free text is never given a green state**, because green means checked and nothing
  checks this.
- **Nothing truncates the history silently** — over the limit is a blocking, visible, counted state.
  _(The app already does this correctly: the textareas deliberately carry no `maxLength`.)_
- **When more than one destination is chosen the screen says the history goes to all of them,
  BEFORE the send and not after.**
- 🔴 **"Removing a statement from the screen relocates it. It does not delete it."** The drawing
  records that v6 took a banner off at the owner's request — and the prototype mark, the free-text
  warning and the not-a-medical-device sentence **all still exist in three places a reader reaches.**
  ⚠️ **Check this rule before removing any sentence for reasons of appearance.**

---

## 4 · An unresolved date, flagged not claimed

`ward-model.ts` records the one-story-field ruling as **2026-09-05**; Q-13 and the errata date it
**2026-08-30**. **That may be two rulings — one field on the 30th, the required flag dropped on the
5th — or one date is wrong.** Lane C did not resolve it and it changes nothing being built.

⚠️ **Recorded because a date is how a later chat decides which of two rulings is newer.** A wrong
date does not fail anything today and decides an argument later.
