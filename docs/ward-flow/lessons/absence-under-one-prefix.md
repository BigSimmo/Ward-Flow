---
name: absence-under-one-prefix
description: "A namespaced search proves absence only inside that namespace — I grepped --ward-* and told three agents the app had no type scale, when it has seven sizes under --text-*"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a59c22f9-a8f9-4da7-99c3-cc84df2abc17
  modified: 2026-09-06T15:33:52.634Z
---

Searching one prefix and reporting what you did not find as _absent_ is a false negative with a
clean-looking probe behind it. 2026-09-06: I grepped `--ward-[a-z-]*:` in the ward token layer,
found no font-size, no font-weight and one radius, and wrote into a shared brief that the app
therefore **has** none — with a ⚠️ marking it as "the point of the exercise". The app has a full
scale: seven sizes (`--text-xs` … `--text-hero`), four weights (`--font-weight-*`) and five radii
(`--radius-*`), one layer up in `src/app/ckb-v2-tokens.css`. **45 of 51 ward stylesheets were
already using them** — 250 uses of `--text-xs` alone. The evidence that would have refuted me was
the most common string in the files I was writing about.

Three agents were dispatched on that brief before I checked. `SendMessage` was disabled, so I could
not correct them mid-flight; the fix had to be re-derived by hand afterwards.

**Why:** a prefix is a naming convention, not a boundary of capability. `--ward-*` is what the ward
layer _adds_; it inherits everything the layer beneath it defines, and inheritance leaves no trace
in a prefix search. The grep was not broken — it answered a narrower question than the one I then
reported on, which is the failure the [[a-measurement-is-scoped-to-what-it-measured]] shape
describes and the same population error as [[establish-the-unit-before-counting]].

**How to apply:** before writing that something does not exist, search for the **property**, not
the prefix — `font-size`, `border-radius`, the thing itself — across every layer that can reach the
consumer. Then confirm from the consumer side: if 45 of 51 files use a value you are about to call
absent, the count says so immediately. Treat "and this is the point of the exercise" as a signal to
re-derive, not to emphasise; the claims I mark most emphatically are the ones a reader will not
re-check. Related: [[assert-only-about-code-you-opened]], [[carry-the-antidote-with-the-assertion]].

## The sharper statement of it, from Ward Builder Two, 2026-09-06

They hit the neighbouring version of this — resolving a colour from the stylesheet that loses —
**with a standing note about that exact precedence rule already written down**, and diagnosed why
it did not fire:

> **"A note existing is not a note applying. The failure was not ignorance of the rule; it was
> asking 'where is this declared' instead of 'what wins'."**

**That names the moment, which mine did not.** The reflex has to fire at the grep, not at the
number — by the time you hold a value, the wrong question has already been answered plausibly and
there is no later step at which you notice. Same defect in both directions: I asked "where is this
declared" of a prefix and read absence; they asked it of a token and read the losing file.

**Ask "what wins" and "who uses it", never "where is it written".**

## 2026-09-11 — ENUMERATE, DON'T SEARCH. Five instances in one evening, four of them mine.

Every absence I reported and later withdrew today came from **a pattern narrower than the thing it
was looking for**, and every one was caught by **enumeration** — printing the headings, listing the
exports, dumping every visible string — never by a better search.

    reported "no dark theme"          grepped prefers-color-scheme; dark is carried by a CLASS
    reported a missing UI string      counted a design rule's own EXAMPLE as a use of the string
    reported "no cannot-be-formed"    my pattern said "cannot be"; the screen says "cannot see"
    reported 337 paint sites          \b matches before a hyphen, so a second token was swept in
    reported three absence wordings   enumeration then found a FOURTH, rendered, that I had not sought

🔴 **A targeted grep can only confirm what you already expect. Its silence is never evidence** — it
means "my pattern did not match", which is a fact about the pattern.

⚠️ **And the same applies to any GREEN instrument, at any scale.** A staleness trigger passed on
sections that were wrong in four dimensions because it detects one mechanism; a probe would have
reported INERT while measuring nothing. **A green instrument means "the one thing I check is fine",
never "this is fine".**

**The method that works:** enumerate the population first — every heading, every export, every
visible literal — _then_ search within what you can see. It costs one extra command and it is the
only version that can surface something you did not think to ask for.

⚠️ **The tell that you are about to make this mistake: you are searching for a specific string in
order to prove it is ABSENT.** That is precisely the case where a narrow pattern and a true absence
are indistinguishable. Related: [[a-clean-negative-that-measured-nothing]],
[[establish-the-unit-before-counting]], [[compliance-without-coverage]], [[checks-that-cannot-fail]].

## 🔴 2026-09-12 — WE CORRECTED THE DIRECTORY THREE TIMES AND NEVER QUESTIONED THE METHOD

Two chats spent an hour refining the boundary of one claim — _"how many guards walk a population?"_ —
and **corrected it in four directions, every one of them a DIRECTORY**:

    searched tests/ for a gate that lived in scripts/
    scoped the class to tests/, then widened to tests/ + scripts/
    said "124 in the class" when 124 was tests/ alone
    🔴 counted ONE ENUMERATION METHOD and called it the class

🔴 **All four corrections used the same shaped pattern — `readdirSync` / `globSync`.** ⚠️ **Both chats
independently got 53 for `scripts/`, which felt like confirmation and was actually two runs of the
same blind instrument.** The file we were both discussing enumerated by `git ls-files` and appeared in
neither count: **34 more walkers than either of us had, invisible to every correction we made.**

### The shape

**Agreement between two people using the same instrument is not corroboration — it is the instrument
reporting twice.** ⚠️ **And a scope correction FEELS like rigour**, which is exactly why four of them
in a row never prompted the question _"is the pattern itself the boundary?"_

🔴 **I also asserted a specific file was inside my count without checking that file.** The
CONCLUSION (it is outside the survey's scope) was right; the EVIDENCE was wrong — and a right
conclusion on wrong evidence survives until the evidence is needed for something else.

### How to apply

- **When correcting a scope, name the INSTRUMENT in the same breath as the directory**: _"63 ward
  test files that walk a population **by `readdirSync`/`globSync`**"_. The method is the boundary
  nobody writes down.
- **Before trusting a count, ask what OTHER way the same thing could be done** — `git ls-files`,
  a hard-coded array, an import graph, a build-time manifest. One alternative method found 34 files.
- ⚠️ **If a peer's independent count matches yours exactly, check whether you used the same pattern
  before treating it as confirmation.**
- **Never assert a named file is inside a set you counted by pattern without grepping that file.**

Kin: [[a-measurement-is-scoped-to-what-it-measured]], [[right-conclusion-wrong-evidence]],
[[enumerate-to-establish-what-exists]], [[a-clean-negative-that-measured-nothing]].

### 🔴 THE RULE THAT RECONCILES IT: ASK WHAT WOULD HAVE MADE THEM DIFFER

Same night, the mirror case. Two full-suite runs over the same line returned **identical** counts, and
the peer **refused** to call it corroboration — because their run had added only my commits to a line
already green, **so agreement was forced by the arithmetic.**

    two runs AGREED → read as corroboration → it was one blind instrument twice   (the 53s)
    two runs AGREED → refused as corroboration → agreement was FORCED               (the suite counts)

✅ **So the rule is neither "distrust agreement" nor "trust it":**

> **Agreement is evidence only in proportion to how easily it could have failed to happen.**

⚠️ **For the 53s nothing could have made them differ — same pattern, same tree.** For the suite
counts a disagreement was possible and would have been the finding; **the match was the null result,
not the confirmation.**

**How to apply:** before treating two matching results as confirmation, ask **what would have had to
be true for them to disagree.** If the answer is "nothing", you have one measurement written twice.
