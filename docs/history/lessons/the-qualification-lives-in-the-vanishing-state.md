---
name: the-qualification-lives-in-the-vanishing-state
description: "A sentence's honest qualifier sits in the empty state, so it disappears exactly when rows arrive and the unqualified claim becomes the only thing on screen"
metadata:
  node_type: memory
  type: project
  originSessionId: 375480d8-c65a-4a85-9c03-411b49e19410
  modified: 2026-09-10T16:33:41.959Z
---

Ward Flow's Patient search "Access record" panel, measured in the third-edition drawing on
2026-09-11. Two sentences, both authored, one honest:

    header note (ALWAYS visible)   "Who looked, and when. Every search is recorded."
    empty state (visible ONLY
    while the list is empty)       "Nothing searched yet this session. Every search run from the
                                    bar is recorded here with the role that ran it and when, and
                                    none is sent anywhere."

The empty state is careful — _this session_, _none is sent anywhere_. **The header note is not, and
the header note is the one that survives.** The moment the panel has a single row the empty state is
replaced, and the only sentence a reader can see is the unqualified claim.

**So the screen is most honest when it has nothing to be honest about, and makes its strongest
unqualified claim exactly when it starts holding data.** Nothing goes red, because both sentences
were written truthfully by someone who had the whole panel in mind at once.

⚠️ **The severity comes from the subject, not the mechanism.** _"Every search is recorded"_ on a
clinical screen is an accountability claim — to a clinician it says their lookups are logged, to a
patient it is the assurance that opening their record leaves a trace. The build records nothing
beyond the current page view, and that design is correct: a persisted record of who looked at whom
is a privacy surface nobody authorised. **A screen that invites reliance on a trace that does not
exist is worse than one that says nothing.**

**How to catch it:** for any qualifying clause — _this session_, _not yet_, _in this prototype_,
_none is sent anywhere_ — ask **which state it renders in**, then ask whether the claim it qualifies
is visible in the OTHER states. A qualifier is only doing its job if it appears wherever the claim
does. Related: [[a-sentence-must-be-true-read-alone]], [[adding-data-makes-an-unchanged-screen-lie]],
[[an-absence-promoted-to-a-headline]], [[the-same-words-true-on-one-screen-false-on-another]].

**Second lesson, from how it was found.** The Lane C plan had been quoting the master plan's _prose_
for panel copy rather than the drawings. Re-deriving panel _names_ caught several paraphrases; this
was the first time the drift reached a **sentence**, and it was the sentence that mattered most on
the screen. **Prose describing a drawing is not the drawing.** Related:
[[a-grep-for-a-filename-finds-its-prose]].
