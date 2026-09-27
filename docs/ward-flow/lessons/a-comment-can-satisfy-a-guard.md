---
name: a-comment-can-satisfy-a-guard
description: "a comment satisfies the guard, a commented-out line disarms it, an alias or a rephrasing slips past it, and a guard matching spelling inherits a dependency on whoever guarantees the spelling"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 7 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 7 index lines for one subject crowd out 6 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-comment-can-satisfy-a-guard

> A test that text-scans source can be satisfied by a comment — and the realistic trigger is not prose, it is the watched line commented out with a note saying why

**Any test that reads a source file and matches against its TEXT can be satisfied by a COMMENT,
because a comment is text.** `expect(source).toContain("X")` passes when "X" appears only in prose —
including in a commented-OUT line of code. Eight ward guards were defeated this way on 2026-09-04,
each proved by mutation before being touched.

## The two directions are not equally dangerous

|                                 |             |                                                                      |
| ------------------------------- | ----------- | -------------------------------------------------------------------- |
| **A comment BREAKS a guard**    | false red   | **Loud.** Somebody is staring at it; fixed within the hour.          |
| **A comment SATISFIES a guard** | false green | 🔴 **Silent.** A check that cannot fail. Nothing will ever tell you. |

Both happened the same day from the same root. Only the second matters, and **nobody had ever
looked for it** — because the loud one is what gets noticed and then treated as the whole problem.

## ⚠️ THE REALISTIC TRIGGER IS NOT PROSE

Nobody writes a sentence that accidentally matches a guard. **People comment code out with a note
saying why** — an ordinary, careful, well-mannered act — **and that silently disarms the check
watching that code.**

```
delete the real `triagedAt: event.triagedAt,` write          2 of 6 failed   caught
same deletion, line left in place COMMENTED OUT with
  "-- temporarily disabled pending the redesign"             1 of 6 failed   GREEN
```

The worst instance was an orphan-route scan: breaking the only real link went red, then **one
comment containing the original URL turned the whole suite green, 61 of 61, with no working link
anywhere.** A page nothing could reach, vouched for by a sentence.

## How to prove it before fixing anything

**Two-step mutation, always, and report LIVE or LATENT:**

1. Break the real thing. The guard must go RED. (If it does not, the guard was already broken.)
2. Leave it broken; add ONE comment containing the matched text. **Green means proved.**

⚠️ **If step 2 stays red the guard is NOT vulnerable — say so and do not "fix" it.** Of the first
three checked, two were LIVE and one LATENT. "Hardened three guards" and "fixed three broken
guards" are different claims; only one can be true, and paper reasoning over-called once.

## Fixing it

- **Strip comments, but BLANK rather than DELETE** — a stripper that deletes shifts every line
  below the first comment, and a guard naming the wrong line is worse than one naming none.
- **A string-aware scanner is what makes stripping safe.** The usual objection — "it would eat the
  `//` in a URL" — is true of a regex and false of a character scanner that copies literals through.
- ⚠️ **A stripper that only removes `//` at LINE START leaves a trailing-comment hole.** That
  restriction is often deliberate (other guards depend on it), so add a second opt-in function
  rather than widening the shared one.
- 🔴 **The better mechanism is a discriminator, not a stripper:** treat text as prose only if it
  OPENS as a comment _and_ contains no code token (`;{}=()[]` or `name:`). A commented-out
  `preparing: false,` then correctly reads as witnessing code. Found already built in the same
  repository — **read what the codebase has learned before inventing.**
- **Record the residual hole as a characterisation test**, whose name says a RED means somebody
  closed it and should DELETE the test. Once, with pointers — not copied into every consumer, or
  the copies that get missed become false claims.

## And leave the deliberate ones alone

Some guards scan raw ON PURPOSE and argue it: for a clinical-wording check, a false alarm from a
comment is safer than an AST scan missing a real violation. **A `.not.toContain` is also safer
unstripped** — stripping makes it more permissive. ⚠️ Hardening in the wrong direction is a
regression wearing a repair's clothes.

## The neighbouring class, found while looking

**An assertion that a file contains a token that file itself defines can never fail.** Structurally
vacuous rather than comment-satisfiable, and it needs its own sweep.

Related: [[checks-that-cannot-fail]], [[a-tautology-that-regenerates]] (a repaired guard inherited
the same hole one layer down), [[a-property-that-does-not-discriminate]],
[[run-the-mutation-before-relaying]].

## 🔴 A guard hung on a precondition you cannot control will pass on the day the world is not in that state

2026-09-04. A print defect: a table's two rightmost columns fell off an A4 sheet because three
separate rules forced it too wide. The guard written for it asserted the symptom —
`scrollWidth - clientWidth <= 0`. **It passed. It also passed IDENTICALLY with the fix deleted**,
because the query the test issued did not seed enough rows to make the table overflow in the first
place. Green for the wrong reason, in the very file written to hunt guards that are green for the
wrong reason.

⚠️ **THE DEFECT NEEDED 43 ROWS AND THE TEST COULD NOT RELIABLY PRODUCE 43 ROWS.** The guard was
hung on a precondition it did not control.

**So pin the MECHANISM, not the emergent measurement.** The fix released three constraints —
a container's `overflow-x`, a `min-width` floor, and `white-space: nowrap` on the headers. Each is
deterministic: assert all three are released and the guard has teeth whatever the data does.

⚠️ **And releasing ONE of the three looks exactly like fixing it.** Dropping the container's
overflow stops the clipping and leaves the table just as wide, so the columns fall off the paper
instead of into a scroll box — identical on paper, and a naive "no longer scrolls" check passes.
**When several conditions jointly cause a defect, a guard that watches one of them is a guard that
watches none.**

### How it was found, which is the only method that could have

**By deleting the fix and re-running — not by reading the assertion.** The assertion reads
perfectly. Nothing about `expect(hidden).toBeLessThanOrEqual(0)` suggests it can never be non-zero.
⚠️ **Every new guard gets its fix deleted once**, and if it still passes it is measuring nothing.

Related: [[checks-that-cannot-fail]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[a-property-that-does-not-discriminate]].

## 🔴 A GUARD THAT MUST DEMONSTRATE IT CAN GO RED: immune to a comment COPY, open to a comment REPLACEMENT

2026-09-04. `tests/ward-statistics-claims.test.ts` matches each claim's cited evidence against the
source with **whitespace collapsing and no comment stripping** — textbook shape for this defect. It
also requires every claim to carry a **falsifying edit**, which the test applies to the source text
before re-scanning for the evidence. I proposed that this closes the comment hole outright.

**Half right, and the wrong half is the half that happens.** ward-verifier settled it by copying the
four pure functions out and running them over synthetic sources — control green, known-bad red.

| the comment                                                          | result                                       |
| -------------------------------------------------------------------- | -------------------------------------------- |
| evidence copied into a comment **beside** the live code              | ✅ RED (`anchor-ambiguous`) — as I predicted |
| watched code **commented out**, or deleted with a note describing it | 🔴 **GREEN** — I never tested this           |

⚠️ **The green case is the realistic one, and it is the trigger this whole file exists to name.**
Anchors stays 1, because the only occurrence is now _inside_ the comment; the falsifying edit
rewrites the comment; the evidence is gone; no problem is reported. Both variants came back green —
the line commented out in place with a "removed, see ruling" note, and the code deleted with a doc
comment saying the derivation historically classified this way.

`isEntirelyComment` does not save it: that asks whether the **claim's evidence string** opens as a
comment, never whether the **match site** does. Evidence that is code text sails past it.

**Why the copy case is structural rather than lucky:** a claim can only pass at all when its anchor
lies _inside_ its own evidence (an anchor elsewhere in the file returns `evidence-survives`). So any
faithful copy necessarily duplicates the anchor. That part generalises.

⚠️ **So never write "we tested comments and it holds."** It is true of the case somebody considered
and false of the case that actually occurs. Say which direction was tested.

## 🔴 And the process lesson, which is the transferable one

I declined to run the proof because it meant mutating a source file several sessions were reading,
and handed it over labelled unproven. **Declining was right; the labelling was right; the premise was
wrong.** The guard machinery was a **pure function of (source string, claim)** — it needed no file,
no repository, and no mutation of anything shared.

> **Before deciding a mutation is too expensive or too risky to run, check whether the thing under
> test is a pure function.** A surprising amount of guard machinery is.

Related: [[run-the-mutation-before-relaying]], [[a-correction-that-agrees-with-you]],
[[false-attribution-manufactures-corroboration]].

## 2026-09-04: the exception, and why it is only half an exception

A guard that must DEMONSTRATE it can go red resists the comment trick in one direction. The ward
statistics claims register applies a "falsifying edit" to an in-memory copy of the source and demands
the cited evidence disappears. MEASURED on synthetic input (the checker is a pure function of a
source string, so no tree was touched): a comment COPY of the evidence beside live code is caught,
`anchor-ambiguous` — and structurally, because a claim can only pass at all when its anchor lies
INSIDE its own evidence, so any faithful copy duplicates the anchor.

🔴 **But comment the watched code OUT and the guard goes green.** Anchors stays 1, because the only
occurrence is now the one inside the comment; the edit rewrites the comment; the evidence is gone;
nothing is reported. Same for deleting the code and leaving a doc comment describing it.

⚠️ **So "we tested comments and it holds" was true of the case considered and false of the case that
happens.** Copy-alongside is the case people imagine; comment-out-with-a-note is the case people do.
Test both directions before recording a guard as comment-proof.

⚠️ **Method:** before judging a mutation too expensive or too disruptive to run on a shared file,
check whether the thing under test is a PURE FUNCTION. A colleague correctly declined to mutate a
file three live sessions were reading — and the question was answerable with no tree at all.

## 🔴 2026-09-05 — COMMENT REASSEMBLY FAILS IN WHICHEVER DIRECTION THE ASSERTION POINTS

Sharper than "a comment can satisfy a guard", and measured on a real file by Ward Verifier after I
found one instance and called it a JSX quirk.

**The mechanism:** a source-scanning guard that strips Prettier's `" * "` continuation markers to
find a WRAPPED sentence thereby **reassembles wrapped comment text into a flat sentence too.**
Comment prose becomes MORE matchable, not less. Then:

```
positive assertion (must contain)  ->  a comment quoting it   = FALSE GREEN
negative assertion (must NOT)      ->  a comment quoting it   = FALSE RED
```

**Same mechanism, opposite outcomes, and only one of them is visible.** Measured on
`statistics-section-frame.tsx`: a governance claim DELETED from the rendered output, with a comment
still quoting it, left the guard **green**. A retired phrase merely documented in a comment turned
another guard **red**.

⚠️ **I created this defect by fixing the other half of it.** I stripped the markers to close a
false-red on wrapped prose — correct for the problem in front of me — and that strip opened the
false-green. **A fix that regenerates the defect it just closed, in the opposite direction.**
See [[a-tautology-that-regenerates]].

**The fix is to strip comments OUTRIGHT — `{/* */}` and `/* */` both — before any marker or
whitespace normalisation.** Not to normalise them into matchable text.

**The test: WRAP the subject as well as rewording it.** Two different attacks; a guard can survive
one and fail the other. Prove it with a mutation in both directions, not by reasoning.

⚠️ **And a near-miss worth keeping: Verifier's own guard escaped this only because it stripped
comments for an unrelated reason.** Their words — _"that was luck as much as judgement. Had I
reached for the marker strip first I would have built your bug."_

## Attribution, same day

I credited Verifier with the corrected regex. **It was Ward Lead's**; Verifier's own version was the
`\s+` collapse that does not work. They corrected it unprompted: _"a misattributed fix reads as two
people having converged on it, which is corroboration that never happened."_
See [[false-attribution-manufactures-corroboration]] — I have this exact lesson written down and
still did it while relaying at speed.

## 🔴 CORRECTION, same day — "STRIP COMMENTS OUTRIGHT" IS NOT THE GENERAL RULE. I wrote it as one.

Above I concluded _"the fix is to strip comments OUTRIGHT… before any normalisation."_ **That is right
for a guard about what a SCREEN says and WRONG for a guard about the SOURCE RECORD.** Ward Lead
settled it by mutation, against their own expectation:

```
tests/ward-statistics-sections.test.ts
  comments included (as shipped)   27 passed
  comments stripped (my advice)     6 FAILED
```

**Every assertion in that file is about the tree, not the page** — that a correction is written down,
that a retired wording is absent from source. Stripping comments removes the subject and guts it.

**The discriminator is what the assertion is ABOUT:**

| the guard asserts               | comments are    | so         |
| ------------------------------- | --------------- | ---------- |
| what a SCREEN renders           | not the subject | STRIP them |
| what the SOURCE RECORD contains | **the subject** | KEEP them  |

⚠️ **And the false-green only exists for the first kind.** A file that makes no positive claim about
rendered copy cannot have it — that file's rendered copy is owned by a separate DOM test, where a
comment cannot appear at all. **Verifier and I both reported "both directions open" on that file; only
the false-red was real, and it is deliberate there.**

**The lesson about me, not the code: I generalised a fix from one instance to a class.** My file
asserted about a screen; theirs asserts about the tree; I recommended my answer for their file
without asking what their assertions pointed at. **Same defect class, opposite correct answers.**
Related: [[a-measurement-is-scoped-to-what-it-measured]], [[true-comments-applied-out-of-scope]].

## Generalising a TRUE RED into a FALSE GREEN, on a word inside a comment. 2026-09-06, Ward Flow.

A single-file check was correctly RED on the one screen that crashed. Widening it to walk every call
site from disk was the right instinct — the reported instance and the live one were in different
files, so a check naming one screen would have agreed the class was closed. **The widened version
went GREEN.**

Two faults compounded, and both are the standard ones:

1. **It searched the whole file above the call site.** A guard deciding whether to draw something is
   in the markup immediately above it, never four hundred lines up — so the window gave every file
   hundreds of chances to look guarded.
2. **Its pattern included the bare word `none`.** The unguarded file matched it inside a JSDoc
   comment nineteen hundred characters earlier, in a note about tables.

⚠️ **The direction is what makes this worse than the usual version of this memory. A guard that never
worked is a gap; a guard that WORKED and was then broadened into silence reports the class as
closed** — and the broadening is done in good faith, by someone who has just proved the guard
catches things.

**How to apply, beyond stripping comments:**

- **Scope the window to where the property actually lives.** "Somewhere earlier in the file" is not a
  location.
- **Never put a common English word in a code-detecting pattern.** `none`, `empty`, `zero`, `hidden`
  all appear in prose about the very thing being detected — the comment explaining the defect is the
  most likely text to satisfy a guard against it.
- **Re-run the ORIGINAL failing case after widening.** The narrow version was red; the wide version
  must still be red on that same input before it is trusted on any other. I verified per file
  afterwards — capacity matched its own conditional, movements its own, the offender nothing — and
  that per-file printout is what turned a green I would have believed into a defect I could see.

> **Reasoning from a guard's SOURCE tells you its range. Only running it tells you its value.**
> (Ward Builder Three's phrasing, after making the same error in the opposite direction: reading a
> guard's assertion to decide what it was reporting, instead of running it and reading the list.)

## The reverse: a docblock can DEFEAT the guard it documents — 2026-09-06

Known direction: prose satisfies a guard, so the guard passes on a violation. The direction I hit
was the mirror, and it is easier to ship.

I wrote a guard that scans for a number and for statutory vocabulary near it. Then I wrote a
docblock **explaining the guard**, which necessarily contained the number, the word "statutory",
and the subject vocabulary — **the exact tokens both arms scan for.** Documenting a text-scanning
guard means writing, inside its own scan population, every string it looks for.

**The suite stayed green, and a green suite looks identical whether the guard still works or has
been blinded by its own explanation.** So after a docs-only edit I re-ran the MUTATIONS, not the
tests. Both arms still fired.

⚠️ **AND THE ASYMMETRY THAT NEARLY SHIPPED, WHICH IS THE bigger half.** One arm had earlier fired on
the correct disclaimer — _"this is not a statutory period"_ — which is what a careful author should
write. I fixed it by blanking comments. **But it only announced itself because that disclaimer
happened to sit in a file the guard scans.** Written one file away, the arm would have been
**unfailable on real code and green forever**, and I would have reported it as proved.

**How to apply, for any guard that scans text:**

- **A docs-only change to a scanning guard, or to anything it scans, requires the mutations re-run.**
  "No behaviour changed" is not true of a text scanner — its input changed.
- **Ask where the thing that revealed a bug happened to live.** If it revealed itself only because
  of where it sat, the guard is not proved; you got lucky about placement.

Related: [[a-commented-out-line-disarms-its-own-guard]], [[a-property-that-does-not-discriminate]],
[[a-green-mutation-only-counts-if-the-mutant-ran]].

---

# a-commented-out-line-disarms-its-own-guard

> text-scanning guards that do not strip comments are satisfied by the very line somebody commented out, and commenting code out with a note is ordinary careful practice

**A guard that scans source as text, without stripping comments, is satisfied by the line it is
watching — after somebody comments that line out.**

Proved by two-step mutation, 2026-09-04, on a Ward Flow producer guard:

    delete the real write  `triagedAt: event.triagedAt,`             6 collected, 2 failed  ✅ caught
    delete it, but leave the line commented out with a note
      `// triagedAt: event.triagedAt, -- temporarily disabled`       6 collected, 1 failed  🔴 GREEN

The field was genuinely unproduced. Only an unrelated behavioural test caught it; **the structural
guard whose own header names this as its reason for existing was fully satisfied.**

⚠️ **The trigger is what makes this class matter.** Nobody writes prose that accidentally matches a
guard. **People comment code out with a note saying why** — an ordinary, careful, well-mannered act
— and it silently disarms the check watching that code. Two earlier instances the same night were a
comment _about_ a rule; this is the rule itself, which is far commoner.

⚠️ **Two directions, and only one is loud.** A comment that BREAKS a guard is noisy and gets fixed
within the hour (it happened twice that night, once inside a comment explaining the trap). A comment
that SATISFIES one is a check that cannot fail, and nothing will ever tell you. Triage the silent
direction first; the loud one reports itself.

**How to apply.** Strip comments before matching — and **blank them in place, a space per character,
newlines kept**, never delete them: deleting shifts every line below the first comment, and a guard
naming the wrong line is worse than one naming none. Then re-run the guard's own mutation, because
**fixing a check is exactly when it becomes tautological**.

⚠️ **Record the residual hole as a characterisation TEST, not as prose.** A stripper that only
handles a line beginning with `//` still lets a trailing `x, // y` through. Pin the current
behaviour, name it a known narrowing rather than a desired property, and say that the test going red
means somebody closed the hole and should delete it. Prose decays; a pinned test cannot widen
quietly or close unnoticed. ⚠️ **"Hardened three guards" and "fixed three broken guards" are
different claims** — prove LIVE or LATENT by mutation before writing either.

**And not every raw scanner is a defect:** one guard chose text scanning deliberately, arguing a
false alarm from a comment is safer than an AST scan missing a real clinical-wording violation.
Reversing that would be a regression dressed as a repair. Related: [[checks-that-cannot-fail]],
[[the-artefact-you-search-is-not-the-artefact-that-runs]], [[a-tautology-that-regenerates]],
[[fields-with-no-producer]].

---

# a-guard-that-pins-the-old-wording

> a regression test that greps for the string the defect used to print is defeated by any rephrasing; assert the property, and note that one property-based sibling survives every mutation

**Guarding a fixed wording defect by searching for its old sentence is a blocklist of length one.**

2026-09-04: a new guard over the Ward Flow movement page closed a real gap — 59 existing DOM tests
passed before AND after six false-statement fixes, because they asserted that things RENDER, never
that what rendered is true of the record beside it. The new file renders every movement and checks
properties over the whole fixture. Good instinct, and still four of its seven assertions grep for
the literal string the defect used to print.

Three mutations I found that restore a repaired false statement and leave it **GREEN**:

- `"...and unchanged since this movement opened"` → `"...and it has stayed the same since this
movement opened."` The grep is `/has not changed|and unchanged since/`. Neither token appears.
  The false claim about the world is back on **49 of 50** pages.
- Label `"Where the patient is"` → `"Patient location"`, still rendering the origin department
  unconditionally. The grep is that literal label.
- `"Nothing was recorded as holding this up"` → `"No blocker was recorded before this movement
closed."`

⚠️ **The tell is a sibling assertion that is built differently.** One assertion in the same file
computed the expected value from source data (unit → site → service, and separately the origin's
service) and compared it to what rendered. **That one catches all three mutations.** When one test
in a file is property-based and the rest are string-based, the property-based one is not the odd
one out — it is the template.

⚠️ **Second failure in the same file: a population floor satisfied by members that never reach the
branch.** The floor counted 3 closed movements "with a recorded blocker" and passed; walking the
function, exactly **1** could reach the sentence under test — the other 2 hit an early return on an
unrelated branch. Edit that one movement and the floor still reads 3 while the property becomes
untestable in silence.

**How to apply:** ask what the assertion would say if somebody rephrased the fix. If the answer is
"nothing", it pins wording, not truth. And floor the population that REACHES the branch, not the
population that matches the filter — then put the current number in the assertion message so a drop
to zero announces itself. Related: [[floor-the-denominator-never-the-numerator]],
[[a-property-that-does-not-discriminate]], [[tests-that-assert-rendering-not-truth]],
[[compliance-without-coverage]], [[an-alias-defeats-a-name-matching-detector]].

## THE OWNER MADE THIS A STANDING RULE, 2026-09-05

His words, ahead of redesigning many pages:

> _"Please can you ensure that all testing works with the redesigns rather than fighting them since
> i am going to redesign many pages."_

**A guard that goes red on a legitimate redesign is worse than no guard, because it gets deleted —
and the honest guards are deleted alongside it in the same tidy-up.** That is the mechanism: brittle
tests do not merely annoy, they discredit the suite and take real coverage with them when somebody
finally clears the reds.

    GUARD THE CLAIM AND THE CLINICAL PROPERTY. NEVER THE RENDERING.

**KEEP** — survives any restyle, because it is about truth: a measured zero never renders as an
absence and an absence never as a figure; a sentence never claims more than the data supports; the
wrong patient cannot be selected; counts DERIVED from the model, never typed; accessibility floors
(tap size, forced colours, contrast, reduced motion); containment — no data pushed where a reader
cannot reach it; route-to-component bindings; claims checked against owner rulings; invariants.

**RETIRE OR LOOSEN** — these fight a redesign: wording pinned as a string; pinned spacing, colour,
radius, font; DOM structure; **positional `cells[n]` indices and hand-typed column-header lists**;
class names as the thing asserted.

⚠️ **THE TEST FOR WHETHER A GUARD IS A FIGHTER, and it is a control rather than a judgement: mutate
the subject so it states the SAME FACT in different words or a different shape, and require the
guard to SURVIVE.** Red on a harmless rewrite = pinning the rendering. Run it as the companion to
every positive mutation.

⚠️ **AND THE HARD CASE: some guards are SUPPOSED to be sensitive.** A pinned threshold exists to
catch a silent change. It still should — but the failure must say _"this was measured against a
table that no longer exists; re-measure it"_ rather than _"this number is wrong"_. **A guard that
works WITH a redesign does not block the change; it tells the person making it what to re-derive.**
That is the whole distinction, and it converts most fighters into keepers without losing coverage.

---

# a-guard-that-matches-spelling-inherits-a-dependency

> A guard recognising violations by spelling depends on whoever guarantees the spelling; one parsing structure does not

**A guard that recognises a violation by its SPELLING inherits a dependency on whoever
guarantees the spelling. A guard that parses structure — AST, bytes, identifiers — does not.**

Ward Verifier's formulation, 2026-09-06, after two independent hits:

- A CSS token guard could not see `var( --success-text )` — leading whitespace made the token
  read as the empty string. Zero live instances **because Prettier normalises it away.**
- A `composes:` target guard required double quotes. Single quotes are valid CSS Modules and
  the documentation's own style. **The identical non-existent target: double-quoted → red,
  single-quoted → 5 passed, silent.** Zero live instances, again because Prettier rewrites them.

**Why:** the rule retrodicts the whole sweep. Both hits matched quoted literals or raw
spacing; all six guards that cleared parse structure — a TypeScript AST, raw bytes, or bare
identifiers no formatter rewrites. The one that could have had the dependency (a hex-colour
scan, and Prettier does lowercase hex) escaped only by being case-insensitive.

**How to apply:**

- Reading a guard, ask **what dimension its pattern is sensitive to** — quote style,
  whitespace, case, ordering, line breaks — then ask **who normalises that dimension.** If a
  formatter does, the guard's clean result is the formatter's result.
- Prefer structure over spelling when writing one. Where a text scan is unavoidable, absorb
  the normalisable dimension into the pattern (`\s*`, case-insensitive, either quote).
- The upstream normaliser is usually skippable (`SKIP_FORMAT_GUARD=1`, `--no-verify`, an agent
  pushing from its own environment). Say so **in the guard's own docblock**.

Companion to [[a-clean-result-held-up-by-another-gate]]. The floor half is
[[floor-the-denominator-never-the-numerator]] — the composes guard's "more than 10" sat
against a population of 73, so 63 could vanish unnoticed.

---

# an-alias-defeats-a-name-matching-detector

> a detector keyed to a token name is defeated by any alias of that token, and the alias rename is the likely accident, not the adversarial one

A guard that matches a **name** is blind to every **synonym** of that name. Ward Flow's ground pin
tested `background: var(--surface)` on a rule literally called `.screen`. Both halves were narrow:
`--ward-canvas` **is** `var(--surface)` (and `--ward-chrome`/`--ward-subtle` alias their PsychSift
sources likewise), and 20 of 41 stylesheets have no `.screen` rule at all.

Two real screens — `ward-management-modes` (`.modeShell`) and `ward-management`
(`.patientWorkspace`) — were invisible for **both** reasons at once. Either miss alone hid them;
together nothing could have found them. On no backlog, assigned to nobody, every gate green.

⚠️ **The substitution is what a careful person does, not what a cheat does.** Repainting a root as
`var(--ward-canvas)` _is_ adopting the token layer; it reads as exemplary in the diff and changes
nothing on screen. Same shape: `color-mix(in srgb, var(--ward-token) 34%, …)` is a raw colour the
hex sweep cannot see, produced by someone being more principled, not less.

⚠️ **Within one layer, synonyms also make roles unenforceable.** `--ward-border == --ward-divider`,
`--ward-border-strong == --ward-muted`, `--ward-space-1 == --ward-radius-pixel`. Using the wrong one
renders byte-identically — no visual tell, no contrast difference, no gate — and it silently breaks
the day either token is re-pointed. A contrast test naming one of a pair tests the other _by
accident_, and that coverage vanishes with no event.

**How to apply:** resolve the alias graph before trusting any name-keyed guard, and match the
**resolved value or the whole family**, not one spelling. When a synonym is kept deliberately (to
mark a role for a future re-point), the role needs its own mechanical guard, or the name is
decoration. Pick a token for its **role**, never its value. Related:
[[a-property-that-does-not-discriminate]], [[compliance-without-coverage]],
[[a-mention-is-not-an-assertion]], [[establish-the-unit-before-counting]].

## Where it generalises, and the guard that catches it

Any aliased identifier, not just a CSS token: config keys, two feature flags pointing at one
another, two env vars read into the same default, a re-exported symbol. ⚠️ **The tell is always the
same — a check that cannot distinguish the two, plus a comment explaining why both exist.** If the
only thing separating two identifiers is prose, the separation is not enforced.

**The guard is cheap and it is shaped by the ROLE, not the value:** assert the wrong one never
appears in the shape that reveals the misuse — for `--ward-divider`, never inside a rule whose
selector contains `[data-`, because a divider is a rule between rows and never a state-varying
edge. Both known misuses (`ward-chip.module.css` lines 21 and 39) sit in `[data-level=…]` and
`[data-kind=…]` selectors. Mutate one back and require it red, or the guard is decoration.

⚠️ **And the damage is DEFERRED, which is exactly why the wrong choice feels safe when made.** It
costs nothing until someone re-points one of the pair — at which point every wrong use changes at
once and nobody can tell which of those changes was intended.

## A mapping table beats a role rule, every time

Observed 2026-09-04, within an hour of the role rule being written. A brief carried a concrete
substitution table (`--wf-border` -> `--ward-border`) plus prose saying "pick the token for the
ROLE, not the value". An implementer hit `.tallyRow`'s `border-top` — a rule between rows, so a
divider by role — and followed the TABLE. That was the correct behaviour for an implementer and a
defect in the brief.

⚠️ **If a pair are synonyms, the carve-out has to live IN THE TABLE.** A rule stated as prose
beside a concrete table loses to the table every time, because the table is actionable and the
prose is interpretation. The same holds for any generated instruction: a checklist plus a caveat
resolves to the checklist.

## A second confirmed instance, and this one is armed by the work in progress. 2026-09-04.

A ward guard decides whether a screen "covers the shared page background" with a literal substring:

```js
/background:\s*var\(--surface\)/u.test(rule);
```

⚠️ **It recognises `--surface` and nothing else.** The same stylesheets carry `--surface-chrome`,
`--surface-subtle`, `--surface-raised`, `--surface-highlight`, `--surface-inset`, `--ward-ground`,
`--ward-canvas`, `--ward-chrome`, `--ward-subtle`, plus literals (`#fff`, `Canvas`). It also matches
only `background:`, never `background-color:`.

**So a screen that paints its root with any other token is invisible to the guard and reports as
FREED — no red anywhere.**

🔴 **What makes this urgent rather than theoretical: the token-adoption programme currently running
is exactly the edit that renames `--surface` to `--ward-canvas` on a root.** The guard would go
quiet about a screen at the moment that screen changed, and the silence would arrive attached to
work everyone believed was an improvement.

**How it was found:** by asking a different question — _are these four files genuinely freed, or has
the scanner stopped recognising them?_ — and getting "genuinely freed" plus, incidentally, the exact
detection rule. ⚠️ **Ask for the rule, not just the verdict.** The verdict was correct and the rule
was the finding.

**And check the fragility does not explain the case in front of you before reporting it as the next
defect** — I confirmed all four files had no root background under ANY token name, so the rename
hazard was genuinely separate rather than a retrofitted excuse.

Related: [[the-artefact-you-search-is-not-the-artefact-that-runs]],
[[a-property-that-does-not-discriminate]], [[compliance-without-coverage]].

## A ternary defeats a `type: "X"` search — Ward Flow, 2026-09-06

Diffing the reducer's `case` labels against every `type: "X"` in the components reported SIX events
as unreachable from any screen. **Two of the six were wrong.** The urgent flag is dispatched as

    type: movement.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" : "FLAG_MOVEMENT_URGENT",

which no `type: "…"` pattern can see. **I would have reported a control somebody built precisely
because the feature "was complete and unreachable" as still missing** — the worst direction for a
reachability finding to fail in, because it sends someone to build a thing that exists.

**The fix is to search for the NAME and strip comments**, rather than to search for the syntax you
expect the name to appear in. The syntax has variants; the name does not. The guard that replaced it
carries the ternary as a positive control, so the narrowing cannot come back silently.

---

# a-mention-is-not-an-assertion

> Deriving "X is broken" from "the text names X" invents claims; my whole-token fix solved one layer and I declared victory, and review found the next one underneath

Building the clinical answer-failures panel (PR #2498, 2026-09-01) I matched ledger items to eval
cases by whether the item's text **named** the case. I found and fixed one layer of that — nested
ids, where `discharge-documentation` matched inside `quality-discharge-documentation` — proved the
fix by mutation, and reported it as solved.

**The real defect was one level down and the mutation test could not see it.** Codex review found
that `#J8SJQ9` names `quality-discharge-documentation` as the _contrast_ — the case that
"deliberately drops mustContainAny" because a source pointer is legitimate there. The panel listed
it as a broken clinical question. On a clinical surface that states the opposite of what the record
says.

**Why:** _named in_ is not _asserted about_. Whole-token matching made the match precise; it did
nothing about what the match **means**. Precision at the wrong altitude reads like rigour.

**How the fix was chosen, which is the reusable part.** The obvious repair — match only the `source`
field — was tested against the real ledger before adopting: it fixes `#J8SJQ9` and **hides both
genuinely broken questions in `#S4R2W3`**, which names them only in detail prose. A false negative
here is worse than a loose one. So the assertion moved to the altitude the data supports (the item),
and named cases became _references_, with the wording pinned by a test.

**Carry forward:**

- Before deriving a claim from a text match, ask what the mention **means** in the source, on a real
  example — not whether the match is precise.
- **A fix that survives your own mutation test has been proven against the failure you imagined.**
  It says nothing about the layer you did not think of.
- Test a candidate repair against the real corpus before adopting it; the tidy rule that fixes the
  reported case often silently deletes the others.

Related: [[check-the-conclusion-that-flatters-the-theme]], [[a-correct-diagnosis-that-stops-the-inquiry]],
[[measure-the-thing-not-a-proxy]], [[fields-with-no-producer]].

## Three instances in one night, three languages, one shape — 2026-09-06

Same defect, three times, and each time it inflated a count somebody was about to act on:

1. **A conditional test gate written inside a JS string**, handed to a counter as a fixture — made
   a peer's platform-gate tally seven when it is six.
2. **My own scanner** briefly read gates out of a copy where string contents were blanked, so a
   `gitAvailable("<sha>")` lost the SHA that WAS the question.
3. **CSS token names discussed inside CSS comments** — `--warning-border` and `--danger-border`
   written in prose explaining a decision — made a peer's residue count 70 when the live-code
   count is 68.

⚠️ **In all three the inflated number was the one that motivated work.** Nobody over-counts in a
direction that creates less to do.

**How to apply: any count over source text is wrong until comments and strings are excluded, and
say which you excluded.** Then ⚠️ **control the OTHER direction too, which is the half that gets
skipped**: after stripping, re-locate every surviving hit by offset and confirm none of them sits
in a comment either. Reporting "68 live" is a different, stronger claim than "68 matched", and the
second is what most scans actually produce. Related: [[establish-the-unit-before-counting]],
[[a-comment-can-satisfy-a-guard]], [[a-commented-out-line-disarms-its-own-guard]].

**And the finding that outranked the count:** the two halves of that residue needed different
actions. The small half had an alias to point at; the big half had none, so "finish the sweep" was
really "decide whether three tokens should exist" — a design call wearing a chore's clothes. **Ask
what the fix POINTS AT before agreeing a number is a to-do list.**

---

# inertness-is-relative-to-the-consumer

> A validator can only test the string; whether it does anything depends on the consumer — so 'is this probe empty' and 'can the check see it' can never be the same test, and the caveat belongs on the negative result

Reviewing a mutation harness on 2026-09-06. It refused an empty `--append` probe, because an empty
probe still writes a newline — the file changes, the "did the mutant land" guard is satisfied, the
gate runs, and **a verdict comes back about a file carrying no mutant.**

I was asked for the CLASS rather than the instance, and measured all eight shapes:

    (empty) · space · tab · lone newline        REFUSED
    /* probe */ · ; · @media print{}            RAN -> SURVIVED
    .p{color:var(--danger-text)}                RAN -> CAUGHT

**The whitespace class is properly closed. The rest is open BY CONSTRUCTION, and must stay open.**
The refusal is a **syntactic** test — _is this whitespace?_ The property that matters is
**semantic** — _can the gate under test see it?_ Those can never be the same test, because
**inertness is relative to the consumer, not to the string**: `@media print{}` is inert for a
forced-colours guard and a perfectly good probe for a print-styles guard. A validator that rejected
the three survivors would break the mode for the guards they are legitimate probes for — the
over-broad-guard failure, introduced by the fix for the narrow one.

🔴 **AND THE PLACEMENT OF THE CAVEAT IS THE OPERATIONAL HALF: a survival is the verdict people ACT
on.** A caught mutation ENDS an investigation; a survival STARTS one — and it starts one on a
premise the reader has not been told is conditional. So the qualifier goes where the negative result
is reported, never in a paragraph further up. Same for the other half found in that review: an
append-mode probe lands at end of file, outside every at-rule, so the mode CHOOSES THE SITE — a
guard that only inspects inside `@media (forced-colors: active)` reports SURVIVED while being
perfectly correct not to look there. **A false accusation against a working guard is the direction
that costs most.**

**How to apply:** when asked whether a check closes a class, enumerate the members and run them —
the answer came out wrong in BOTH directions from reasoning (their refusal was broader than they
claimed, the remaining hole wider). When a validator inspects an input rather than an effect, ask
what the input is FOR; if the answer is "depends what consumes it", stop adding refusals and write
the reader's rule instead. And check whether the worked example in the docs or self-test is itself a
member of the surviving class — theirs was, and an example is what people imitate.

Related: [[a-property-that-does-not-discriminate]], [[a-green-mutation-that-changed-nothing]],
[[a-shared-decision-is-not-a-behavioural-property]], [[compliance-without-coverage]].

---

# a-negated-marker-counts-as-a-marker

> An alternation of TOPIC WORDS is satisfied by a bystander clause, and by a sentence that denies the very thing the word names

**Measured 2026-09-10, Ward Flow, on `MARKER` in
`tests/ward-provenance-sentences-carry-their-own-marker.test.ts`** — the predicate deciding whether
a sentence discloses that its figure is invented. Twelve spellings, `some(...)` semantics, proved in
its own self-test on **four** strings. Against thirteen adversarial sentences: **eight slipped.**

## The two shapes, and the second is the one nobody looks for

**Bystander.** The marker word sits in a clause about a _different subject_, in the same sentence:

- _"This prototype shows that four beds are ready to admit right now."_ → passes on `prototype`
- _"The ward names are invented; there were 28 referrals this period."_ → passes on `invented`
- _"Unlike the synthetic patient names, these bed counts are current."_ → passes on `synthetic`

🔴 **Negation.** The sentence asserts **the opposite of the rule** and satisfies the guard _by
containing the word it denies_:

- _"These figures are **not** invented — they are the current state of the network."_ → passes
- _"This is **no longer** a prototype, and the eleven-hour figure is measured."_ → passes

**That is not a guard tuned too loosely. It is a guard inverted** — accepting the exact claim it
exists to forbid. A substring test has no polarity, so every negation of your keyword is a free pass.
**Check for `not <marker>` / `no longer <marker>` in any keyword predicate you own.**

## The diagnosis: a topic word is not a claim

`prototype`, `invented`, `synthetic`, `placeholder` name a **subject**. A sentence can carry any of
them while disclosing nothing about its own figure. `no live systems` / `no live integration` is a
**claim** — and it was the only spelling that admitted nothing. **That is the discriminator to reach
for: can this alternative be true of a bystander?**

The rule it breaks was already written a day earlier, about `expectSays`, and did not transfer
because it was filed as a lesson about _that_ helper: **tolerance is bought by listing more FULL
spellings, never by listing a fragment of one.** Same mechanic — `some(spelling => includes)` — so
**the weakest alternative sets the whole predicate's strength.** See [[the-suite-never-tests-the-absence]].

## Measure which alternatives are load-bearing before arguing about length

For each spelling, count the real sentences it matches **and the ones it is the SOLE match for**.
**Ten of twelve were the sole support of nothing** — deletable with the corpus still green, and
every one of them attack surface. `prototype` admitted 3 defects and carried 0 sentences.

⚠️ **But do not then just delete them, and price it before you choose.** Narrowing to the two
load-bearing spellings took defects 8→2 **and honest-prose reds 6→11** (`fabricated`, `dummy data`,
`made up`, `illustrative only`). **Neither direction is the answer; the list is the wrong
instrument** — a guard that reddens correct work gets widened until it means nothing
([[a-guard-that-blocks-its-own-purpose]]). Change the SHAPE, not the length.

## The transferable habit

**A self-test proving a predicate on four strings proves it agrees on four strings.** Two accept, two
reject is not calibration — it is the minimum that looks like calibration. Write the adversarial
corpus: bystander clause, negated marker, and the honest rewords a real person would type. It costs
one throwaway script and it is the only thing that separates a working predicate from a lucky one.

### The resolution, measured the same day — the friction/strength trade did not exist

The obvious objection to tightening a keyword predicate is that it will redden honest work. **It did
not.** Rewriting twelve bare words as verb-bound claims (`are invented`, `invented figures`,
`no live systems`) measured:

|                         | old word list | narrowed word list | **claim shapes** |
| ----------------------- | ------------- | ------------------ | ---------------- |
| honest rewords reddened | 6 / 15        | 11 / 15            | **0 / 9**        |
| defects admitted        | 8 / 13        | 2 / 13             | **0 / 18**       |

**More tolerant AND stronger at once, because the tolerance was never coming from the bare words —
it comes from the VERB list** (`is|are|was|were` + `invented|fabricated|dummy|illustrative|a
sample`), which admits every honest rewording without admitting one bystander clause. ⚠️ **So do
not accept "we need loose keywords for tolerance" as a reason to keep them. Build the claim list and
measure; the choice you were about to agonise over may not be a real choice.**

Two things shape could NOT reach, both found by running it rather than reasoning:
**a negator that lands AFTER the claim** (_"synthetic **any more**"_, _"invented **until
recently**"_) — that one needs a list, so label it as a list and pin it with cases; and
**a semicolon**, which ends a sentence and which naive splitters miss, letting the claim be true of
clause 1 while the figure sits in clause 2. Split on `;` as well as `.!?`, and **do not apply a
minimum-length filter to clauses** — it let _"four beds are free."_ escape unexamined at 19
characters. The length floor belongs on the POPULATION, not the parts.

⚠️ **And check the mutant landed before believing any verdict.** A quoted bash heredoc halves
doubled backslashes, so a `\s` written into a probe script arrives as `s` and the regex becomes
gibberish that reddens everything. It was caught only because obvious matches failed. **Write
regex-bearing scripts with a file-writing tool, never through a heredoc.** See
[[git-queries-that-answer-instead-of-erroring]], [[a-green-mutation-only-counts-if-the-mutant-ran]].

## 2026-09-18 — a comment above the flag it describes

⚠️ **The narrowest, most repeatable instance yet.** `tests/chain-mirror-parity.test.ts` decides
whether a CI gate is blocking by looking for the literal `--strict` inside the workflow block. The
change that turned the gate blocking also added a comment block explaining blocking mode — and that
comment quoted `--strict` twice. **Deleting the real flag then left every test in the file green**,
including the one whose whole job is to tie the flag to the absence of `continue-on-error`.

✅ Caught only by running the mutation, and only because the FIRST attempt at the mutation silently
failed to apply — which forced printing the occurrence count before and after. Both halves matter:
the mutation, and proving the mutant landed.

**Two fixes, and take both.** Reword the prose so it never contains the token (say "blocking mode"),
AND make the detector strip comment lines before matching. Either alone leaves the trap armed for
whoever writes the next comment.

🔴 **The generalisation: a guard that greps source is defeated by documentation of that source, and
documentation is exactly what a careful author adds next to a subtle flag.** The better the comment,
the likelier it breaks the guard. Related: [[a-declaration-is-not-an-effect]],
[[a-comment-that-quotes-the-string-it-removes]], [[supabase-cli-stalls-on-large-migrations]].
