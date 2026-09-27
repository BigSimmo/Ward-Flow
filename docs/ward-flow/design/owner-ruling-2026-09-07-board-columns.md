# Owner ruling 2026-09-07 — the ward board's five additions, and "Presentation"

**All five are approved. Route B, in the build plan's terms.**

| Column                | Status | Note                                                                                                       |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| **Presentation**      | BUILD  | ⚠️ **RENAMED BY THE OWNER from "Story".** Use "Presentation" at every rendered site and in the field name. |
| Review status         | BUILD  | who reviewed, and when                                                                                     |
| Plan                  | BUILD  | free text                                                                                                  |
| Bed number            | BUILD  | a bed fact, not a clinical record                                                                          |
| **Legal form expiry** | BUILD  | the fifth gap, and the plan rates it the highest-value single addition                                     |

## 🔴 THE STRUCTURAL REQUIREMENT, IN THE OWNER'S OWN WORDS

> _"I may add more sections later so make that possible or easy to do."_

**So the column set is not five hard-coded additions. It is a LIST somebody can extend without
touching the board's rendering.** A sixth column added later must cost one entry, not a sweep of the
table component, the header row, the phone layout and four tests.

⚠️ **Build it that way FIRST.** Adding five columns by hand and generalising afterwards is how the
generalisation never happens — and the owner has said, in advance and unprompted, that a sixth is
coming.

## ⚠️ AND THE OBJECTION THAT WAS RAISED AND OVERRULED, RECORDED SO IT IS NOT RE-RAISED

Ward Lead argued against Presentation, review status and plan on the ground that they duplicate a
medical record, citing the owner's own 2026-09 ruling against a second legal-status field —
_"a clinician states the same fact twice with nothing to say which copy is right."_

🔴 **THE OWNER OVERRULED IT AND THE OVERRULE IS CORRECT ON THE MERITS, NOT MERELY BY AUTHORITY:**

> _"Remember… this is a useful ED tool."_

**In an emergency department the presentation and the plan ARE the working record for that episode.**
There is no second copy to disagree with, because for a patient in the front door this IS the copy.
The duplication objection was an INPATIENT objection applied to an ED screen — the same words, true
on one screen and false on another.

**Do not re-raise it.** If it returns, it returns as "does this still hold for an admitted patient on
a ward board?", which is a different and narrower question.

## What each of the five still needs from the owner before it can be built truthfully

These are not blockers on starting; they are the decisions a builder will hit.

1. **Review status** — is it a free date+person, or a set of states? A state set is a clinical
   vocabulary and needs his words.
2. **Legal form expiry** — which forms carry one, and is the expiry a date or a datetime? The
   prototype's line is _"Form 4C expires today, a decision is needed before 18:00"_, which implies a
   time, not a date.
3. **Plan and Presentation** — length limits, and whether they are truncated or scrolled on the
   board. ⚠️ The referral form's history field is capped and NEVER truncated, by ruling; the same
   question arises here and the same answer may not apply, because a board row is not a form field.
4. **Bed number** — the owner ruled on 2026-09-07 to **drop the bed numbers** from bed identity
   elsewhere. ⚠️ **That ruling and this column are in tension and somebody must ask.** It may be
   that identity has no number while a board row does, which is coherent — but it must be said
   rather than assumed.

## Where this ruling came from

Answer to the plan's "Open questions for the owner" §1 and §2, in
`docs/ward-flow/design/FRONT-DOOR-BOARDS-BUILD-PLAN.md`. Questions 3 (does the design govern every
ward screen) and 4 (arrow direction language) are **still unanswered**.
