# Draft clause for the standard — every layer carries the words

**A draft for Ward Mockups to place in `WARD-FLOW-DESIGN-SYSTEM.md`**, written 2026-09-11 by the
design-review chat at Ward Lead's request. The standard is Ward Mockups' file; this draft is not an
edit to it. **Proposed home: a new §8.8 under "Wording and honesty about data", beside §8.1 "Words
before colour", which it extends from one layer to every layer.**

**Authority:** owner ruling, 2026-09-11, relayed by Ward Lead: _colour is never the only carrier of a
state — the visible layer must carry words._ **Provoked by** the shell's Activity button, which
announced _"Activity, reconciliation not available"_ to a screen reader while a sighted reader saw
only _"Activity"_ and a wordless coloured dot [L Ward Lead, 2026-09-11].

---

## 8.8 Every layer carries the words (draft)

A state has as many layers as the ways a person can receive it: what is painted, what is announced
to a screen reader, what is printed, and what a control's name says when it is read alone. **§8.1
says the painted layer carries a word before it carries a colour. This clause says the same of every
layer, and that no layer may say more than the others.**

1. **Words in every layer.** Wherever a state is carried by colour, by a dot, by a tone, by an icon
   or by position, the same layer also carries the words for that state, in the shape §8.2 gives for
   an absence and §8.3 gives for an invented figure. A wordless dot beside a label is a state with no
   words in the layer a sighted reader receives, whatever a hidden span beside it says.
2. **No layer says more than another.** The visible words, the announced words and the printed words
   describe the same state at the same moment. A visually-hidden span that adds a fact the visible
   layer omits is not generosity to one audience; it is a statement two audiences will disagree about,
   and neither will know. The fix is never to remove the fuller sentence — it is to give the visible
   layer the words it lacked.
3. **Three states, not two.** A check of this clause compares the layers pairwise and reports one of:
   - **agree** — the layers carry the same state in the same words, or in words that differ only in
     the shape §7.4 requires of an announcement;
   - **disagree** — the layers carry different states, or one carries a state the other contradicts
     (a refusal beside a spoken count of matches is the recorded instance);
   - **one layer silent** — one layer carries the state and the other carries nothing about it (the
     Activity dot is the recorded instance). Silence is the commoner failure and the harder one to
     see, because nothing contradicts anything.
4. **A refusal is alone; a marker is together.** When a refusal stands (§8.6), no layer may carry any
   claim about matches, counts or results. When a figure is invented (§8.3), every layer that carries
   the figure carries its marker with it. These are opposite assertions and both are required.
5. **Where the check has to live.** No DOM test can see a colour, a screenshot cannot see a hidden
   span, and a person looking at the page sees only the painted layer. So this clause is proved by
   reading each layer deliberately on every screen it is mounted on — the announced text on every
   route, not once for the shell — and the report names which screens were read. A shared component
   that speaks (a live region, a status) is read on every screen that mounts it, because the
   disagreement does not live in the component; it comes into being beside whatever the screen has
   just said.

### The worked example — why two states are not enough

An independent enumeration of the shell's Activity button on 2026-09-11 found **all three of its
tones one-layer-silent, and none of them disagreeing** [L Ward Lead]:

    neutral   sighted: "Activity" + grey dot     heard: "Activity, reconciliation not available"
    good      sighted: "Activity" + green dot    heard: "Activity, figures reconcile"
    danger    sighted: "Activity" + red dot      heard: "Activity, figures need a look"

A check with two verdicts — agree or disagree — returns this button **clean in every state**, because
nothing contradicts anything. Only the third verdict, _one layer silent_, sees it. That is why the
clause has three states and why silence is named as the commoner failure.

6. **The check strips the invisible layer before it reads the visible one.** The button's own existing
   test asserts on the trigger's whole text content, **which includes the visually-hidden span** — so it
   passes on the announced string alone and proves nothing about what a sighted reader sees [L Ward
   Lead]. Any assertion written against an element's accessible name has the same hole. A check of the
   visible layer removes visually-hidden content first and asserts on what remains, **with a floor
   proving that something was actually stripped** — a strip that removed nothing has not separated the
   layers, and its green means the same as no check.

### What this clause does not do

- It does not require the visible and announced sentences to be identical. §7.4 gives an announcement
  its own shape — one sentence to the live region per change of subject — and a visible label may be
  shorter. It requires them to carry the **same state**.
- It does not add a fourth wording for absence. §8.2's forms and D-6's two recorded absence wordings
  stand; the clause is about which layers carry them.
- It does not license removing a screen-reader sentence to restore symmetry. The recorded instance is
  fixed by adding words to the visible layer, and every instance is fixed in that direction.

### The recorded instances, so the clause is checkable against something real

| Where                    | Layer that spoke                                        | Layer that was silent or contradicted                              | Fixed how                                                                               |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Shell Activity button    | announced _"Activity, reconciliation not available"_    | visible: _"Activity"_ + a coloured dot, no words                   | visible words added [L Ward Lead, 2026-09-11]                                           |
| Patient search typeahead | announced _"Nobody matches."_ beside a standing refusal | visible: the refusal, correct                                      | the announcement made silent while a refusal stands [L errata §U]                       |
| Community index counts   | announced _"n of total names shown"_                    | the invented-names marker only in the visible layer, 63 lines away | flagged, deliberately unguarded until the marker guard has its own brief [L errata §V2] |

_Tags as in the master plan's second edition: [L] measured by a lane or Ward Lead and recorded._
