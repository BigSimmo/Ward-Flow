---
name: a-correction-that-agrees-with-you
description: "a peer's concession in your favour, a self-exculpating correction, a relayed approval that predates the work, and a generous framing you author about somebody else"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 9 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 9 index lines for one subject crowd out 8 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-correction-that-agrees-with-you

> a peer conceding in your favour is the least-audited message you receive; I nearly took a wrong table because it was a concession to me

**A correction that agrees with you gets checked least, and it is still a claim.**

2026-09-04: I told Ward Lead one of their diagnoses was wrong. They came back conceding it, with a
measured table — _"six of seven closed movements reach the fallthrough, my correction of you was
wrong, you were right."_ **I nearly filed it.** It was wrong: four reach it, not six. Two of their
six carry ACTIVE blockers and return at the first statement of the branch, which their own table
had them passing straight through.

⚠️ **The reason it slipped is the direction of travel, not the content.** I audit a correction
_against_ me hard — that is the whole reflex of the role. A correction _toward_ me arrives already
agreed with, and agreeing costs nothing, so nothing triggers the check. It is the same asymmetry as
an expired "your evidence does not count": acting on it means being careful, and nobody audits a
decision to be careful.

⚠️ **And the sibling failure, from the same exchange:** they reached for "green mutation that never
ran" — a named failure mode already in their notes — instead of the unnamed one that actually
applied. **A diagnosis drawn from a catalogue you already hold arrives fluent and did not come from
the evidence.** Their rule and mine are the same failure in opposite clothes: one is believed
because it is familiar, the other because it is flattering.

⚠️ **Then I over-corrected and cited the wrong suite as proof** — Playwright numbers for a Vitest
assertion. Refuting a concession too eagerly is the same lapse as accepting it too easily; both skip
the measurement.

**How to apply:** when a peer concedes, restate their concession as a claim and check it as if they
had asserted it against you. And when the check is cheap, run it before replying — I sent the reply
first and found the error a minute later. Related: [[deferring-to-a-correction-looks-like-humility]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[check-the-conclusion-that-flatters-the-theme]],
[[green-mutation-that-changed-nothing]].

## Widened 2026-09-05: it is not agreement, it is the DIRECTION OF THE FAVOUR

Ward Builder One, after a night in which each of us audited the other's corrections:

> **Nobody checks the message that costs them nothing.**

I had the rule only for corrections that hand WORK away — a retraction relieving somebody of a
fix. They generalised it to corrections that hand CREDIT away, and the mechanism is identical.
**A concession, a compliment, a retraction and a correction in your favour all arrive
pre-approved, and it is the direction of the favour that makes them unexamined, not their
content.**

What made it work, four times each in one night: **both of us ran the correction that let us off
the work.** My retraction handed them a fix they no longer had to make and they measured it
anyway; their correction of my quote agreed with my own copy of the text and I re-read the commit
object anyway. **Every technical finding that night was downstream of that habit, and it was
cheaper than any of them.**

Related: [[a-relayed-approval-is-not-an-approval]], [[deferring-to-a-correction-looks-like-humility]],
[[a-control-proves-one-arm-not-the-scanner]], [[false-attribution-manufactures-corroboration]].

### The worked example, 2026-09-06: I fixed the NAME and left the CLAIM

A docblock about to be published credited a false positive to _"a second survey, written
independently"_. Wrong party. I corrected it to name Ward Builder One — and wrote _"Ward
Builder One's independently written survey"_, **which fixes the name and keeps the false
evidential claim**: "independently" still reads as two detectors converging. It was one person
auditing their own count and reporting against themselves, which is a weaker claim as
corroboration and a harder thing to do.

**A correction can satisfy the objection as stated while the thing underneath survives.** It took
a third pass to reach the true sentence, and each pass made it weaker-sounding and more accurate.

⚠️ **And who caught it: the party my original wording implicitly credited.** Neither I nor the
person it should have credited spotted it, and we had both read the line. **The person named in a
compliment is the only reader with a motive to check it**, which makes them the last line of
defence on precisely the claims nobody else will question. Name people in credits for that reason,
not only for fairness.

## The instance: wrapped in praise, wrong in the flattering direction — 2026-09-06

A reviewer sent me three findings, conceded both of my open questions in my favour, wrote _"you have
not been overruled on anything that matters"_ — and included a measurement: **seven platform gates
in the suite.** My own estimate had been about that. I nearly let it stand.

**There are six.** The seventh was my own file's control fixture, written inside a string literal —
**precisely the case the scanner's string-blanking exists to exclude.** So the disagreement was not
noise: it was the mechanism working, and their number was the one produced by not having it.

⚠️ **THE REASON I ALMOST SKIPPED THE CHECK IS THE REUSABLE PART, AND IT IS NOT FLATTERY ALONE.
The number changed nothing about what I had to do.** Every one of the three repairs was identical
whether the count was six or seven, so there was no functional pressure to verify it — and a figure
with no consequence attached is a figure that gets relayed. It would have entered a commit message,
then a runbook, as a measured fact nobody measured.

**How to apply: a number arriving inside a message that agrees with you gets checked BEFORE the
thanks are written, and check it even when — especially when — it changes nothing you do.** Cheap
here: read every gate opener directly, then confirm by mutation (five files went red on
`=== "win32"`, one stayed satisfiable on `!== "win32"` — five plus one). And send the correction
back: a peer who thinks their scanner missed nothing keeps the wrong number.
Related: [[relayed-numbers-lose-attribution]], [[establish-the-unit-before-counting]],
[[a-mention-is-not-an-assertion]].

---

**2026-09-06 — it worked, and noticing WHY it worked exposed the gap it leaves.**

The coordinator credited one of my anti-vacuity floors as clearing itself by a strong test. I re-ran
it instead of accepting, and the credit was wrong: the red read `expected 0 to be greater than 0`,
which an emptied fixture produces word for word. The floor was fixed as a result.

⚠️ **But I only re-ran it because it was in my favour.** Had the same coordinator told me the floor
was WEAK, I would have taken it at face value and "fixed" something I did not understand — producing
a change I could not have justified, against a defect that might not exist.

**So the rule that actually worked was not scepticism. It was scepticism pointed at the pleasant
direction — and pointing it there is exactly what leaves the unpleasant direction unguarded.**

**The symmetric habit, which I did not have:** an unearned CRITICISM is as expensive as an unearned
compliment, and cheaper to accept. Accepting it produces a real edit to real code on a premise nobody
tested. Before acting on a correction against your own work, **run the same measurement you would run
on a correction in your favour** — and if you cannot reproduce the defect being alleged, say so and
ask, rather than fixing the description of it.

**The tell is identical in both directions: a correction settled without either party re-running
anything.** Related: [[deferring-to-a-correction-looks-like-humility]],
[[a-restore-that-matches-proves-nothing]], [[run-the-test-before-prescribing-the-fix]].

## Auditing a correction that lets you off — 2026-09-06

I said a good decision of mine had been "ordering, not virtue". A reviewer corrected me: _too hard on
yourself; ordering gave you the cheap conclusion, it did not make you take the expensive one._

⚠️ **A correction that reduces your fault is the least-examined message you get** — the same
mechanism as one that flatters, arriving in a costume that looks like humility to accept. **So I
audited it instead of thanking them, and it was PARTLY right.**

**Right:** ordering did not make me take the expensive conclusion. The cheap move was available and
I did not take it.
**Wrong:** they claimed the answer would have been identical a day later, only more expensive. It
would not. By then the artefact would be established with other work resting on it, and _"this new
test is wrong"_ becomes a **better-supported** explanation rather than merely a cheaper one. **Cost
changes what the evidence looks like, not only what it costs to act on.**

**The honest version was the join: ordering lowered the price, the habit paid it. Neither alone.**

**How to apply: audit a self-exculpating correction exactly as hard as a flattering one, and answer
with the JOIN rather than picking a side.** Accepting it whole is the failure that looks like grace;
rejecting it whole is the failure that looks like rigour. ⚠️ **And correct a generous factual claim
in your own disfavour when it is wrong** — a peer wrote _"six defects, not one found by the author"_,
and one of the six WAS: caught by a structure I had built, not by vigilance. Left standing it would
have credited the wrong mechanism in a handover, and the structure is the half somebody can copy.
Related: [[deferring-to-a-correction-looks-like-humility]], [[a-correction-that-agrees-with-you]].

## Praise you GIVE is as unaudited as praise you receive — 2026-09-06

The known hazard is a correction or compliment arriving in your favour. A peer named the missing
half: **a generous framing you author about somebody ELSE is unaudited by the same mechanism.**

They had written _"six defects and not one found by the person looking for it"_ — generous to me,
costly to nobody, and **wrong**. One of the six was found by its author, via a structure. They
repeated it twice, including to the owner, before I corrected it.

⚠️ **Why it survives: it flatters the subject, costs the author nothing, and correcting it looks
like fishing for credit or like false modesty.** Every social pressure runs toward leaving it. And
because it is _about someone else_, the usual self-check — _am I believing this because it suits
me?_ — never fires.

🔴 **AND THE SPECIFIC DAMAGE IS THE COPYABLE HALF GOING MISSING.** "Pairing found everything"
credits the review with a catch that belonged to a structure — writing the self-test case alongside
the code and stating the expected result before running it. **The structure is what somebody else
can reuse; the anecdote about a good review is not.** A lossy compliment loses exactly the
transferable part.

**How to apply: audit generous claims you make about others' work with the same suspicion as
generous claims made about yours** — and when correcting one, correct it _downward in your own
favour_ if that is where the truth is. **State the mechanism rather than the outcome:** "a structure
caught it" travels; "they found six" does not.

---

# deferring-to-a-correction-looks-like-humility

> an unmeasured correction from a coordinator overrode a measured finding, and the deference had social cover the other biases lack

**A measured finding was abandoned on an unmeasured correction, because the correction came from the
coordinating session.** 2026-09-04: a verifier measured two CSS tokens and reported them
indistinguishable. I read the alias graph, inferred they diverged under forced colours, and stated
that **as a measurement** — to that verifier and then to three other chats. It accepted, called its
own correct finding "pointing the wrong way", and told the user in writing that it had misclassified
an accessibility defect. A Playwright spec four hours later showed the original measurement was
right.

⚠️ **Two failures, and the first is the load-bearing one.** Mine: asserting an inference as a
measurement. Its: deferring without re-measuring. Without the first, the second has nothing to defer
to.

⚠️ **The deference has social cover that no other bias has.** Pushing back on a correction reads as
ego; accepting it reads as good practice. In its own words: _"the pressure to agree with a
correction is the one I had no defence against because agreeing LOOKS like humility."_ And it
pointed the same direction as its two earlier errors that day — toward the more alarming reading.

**How to apply, both directions:**

- **When correcting somebody's measured finding, say whether the correction is MEASURED or
  INFERRED.** Had I labelled mine "inferred from the alias graph, not measured", the verifier would
  have kept its result and asked for the measurement — which is exactly what eventually happened,
  four hours later.
- **A correction to something you measured yourself needs measurement before you relay it onward.**
  Deferring is not verification, and it reaches the user as fact.
- Seniority in a coordination structure is not evidence. A coordinator sees more of the board and
  less of any one file.

Related: [[a-relayed-approval-is-not-an-approval]], [[relayed-numbers-lose-attribution]],
[[a-question-that-mentions-cost-has-answered-itself]],
[[check-the-conclusion-that-flatters-the-theme]], [[measure-the-thing-not-a-proxy]].

## The stronger form of the rule, from the verifier that got caught by it

**Label measured-versus-inferred on EVERY claim, not only on corrections** — and put the word **in
the sentence, not the surrounding prose.**

⚠️ A correction is only the case where the cost becomes visible. The same unlabelled inference
stated as fact at the START of a thread costs identically and nobody notices, because there is no
earlier measurement for it to override. That is the more dangerous instance, not the lesser one.

⚠️ And a caveat in the paragraph AROUND a claim does not survive a relay. Only a qualifier inside
the sentence travels with it.

## Both sides of a correction are biased, in opposite directions, and there is one external tell

- The **corrected** party reaches for deference — and agreeing _looks like humility_.
- The **correcting** party reaches for the number they already have — _"the adrenaline of being
  right is exactly when you reach for the number you already have rather than the number you can
  get."_ That one _looks like confidence_.

⚠️ **Neither is visible from inside, and both look like the right behaviour.** I was on the wrong
side of each within four hours: I overrode a measured finding with an unmeasured inference, and a
peer quoted a number it had itself invalidated by re-syncing, inside a message correcting somebody
else.

⚠️ **The one external tell: a correction settled in a single exchange, with no measurement taken by
either party, is the shape where both biases were satisfied at once.** If a correction lands and
nobody re-ran anything, that is the case to re-open — not the one where somebody argued back.

---

**2026-09-06 — THE MIRROR OF THIS, AND IT NEARLY WON.** The coordinator issued an explicit,
authorised ruling: _"widen the fix to exactly these two sites — both are prose in a code face."_ One
of the two was wrong. That class held six text nodes and **every one was a bare digit**; the words
beside it were never in that face. Removing it would have stripped the figure face from a genuine
figure column, **one file away from a comment in the same stylesheet warning against exactly that** —
and it would have been done under authorisation, which is what makes it the dangerous version.

**An instruction is authorisation to act. It is not evidence for the fact it rests on.** This one
rested on a screenshot, and a screenshot cannot say which element carries a style. The coordinator
was looking at the same image I was and read it the same way.

**Measuring before executing an authorised instruction is not defiance and it is not slow.** It cost
one browser probe. The coordinator's own verdict afterwards: _"I gave you a wrong site and you
measured instead of obeying… that is the regression you protected the primitive from twice tonight,
and the second time it was my instruction causing it."_

**The tell is the same as the original entry's, pointed the other way:** an instruction whose
justification is an observation rather than a measurement — "both are prose in a code face", "it
looks inconsistent", "that's the one that's wrong" — is the case to measure first. Do the part that
checks out, refuse the part that does not **with the numbers**, and offer the site that actually met
the stated criterion rather than silently substituting your own choice inside someone else's ruling.
Related: [[looking-at-the-screen-misattributes]], [[a-relayed-approval-is-not-an-approval]].

---

# a-humble-conclusion-is-under-audited

> \"We made this up\" reads as appropriately humble, so nobody re-checks it; a wrong self-critical verdict is adopted while a wrong confident one gets challenged

2026-09-04. A provenance audit classified hard rules as RULED (the owner decided it) or INFERRED (a
session invented it and wrote it down as a decision). One rule — "IT SUGGESTS NOTHING", in capitals,
obeyed for weeks — turned out to be genuinely invented, which made INFERRED the expected answer
everywhere else.

**The burden of proof is asymmetric, and it runs opposite to how it feels:**

    a wrong RULED verdict     somebody goes looking for the ruling, cannot find it, and challenges it
    a wrong INFERRED verdict  reads as appropriately humble, is adopted, cited, and acted on

**Self-criticism disarms scrutiny.** "We made this up" is the conclusion nobody re-checks, because
checking it looks like defending yourself. So the verdict that needs the MOST evidence is the one
that sounds least like a claim.

**How to apply:** before recording that something was invented, state which directories, branches
and filename patterns were searched. Two specific scope traps produced false INFERRED verdicts here:
the corpus was wider than the obvious `owner-*` filename prefix (a real ruling lived in a file with
no such prefix), and ids came in at least six conventions, so matching on heading shape saw one
day's rulings and missed three days before it. **Match on owner-attributed CONTENT, never on
filename or heading shape.**

**And keep UNTRACEABLE apart from INFERRED.** _I found no record either way_ is not _I found
evidence a session originated it_. Collapsing them converts an absence into an accusation.

⚠️ **PROVENANCE AND SOUNDNESS ARE INDEPENDENT AXES.** A rule can be invented and correct, or ruled
and superseded by a better mechanism. A finding of "inferred" must not be read as "therefore wrong",
and the retirement note should say which axis it is deciding. The good template, from a rule
withdrawn the same night: name the ruling, record that it was inferred and then enforced, and add
that what remains is _"a description of today's code, not a constraint on tomorrow's — the matching
work is a design that has not been done yet rather than a door that is closed."_

**Calibrate any provenance method on a known pair before trusting it** — one rule known to be
invented and one known to be ruled. A method that gets either wrong is void, and one-sided
calibration cannot detect a scope that is too narrow.

Related: [[false-attribution-manufactures-corroboration]], [[a-correction-that-agrees-with-you]],
[[a-conveniently-shaped-control]], [[prove-the-task-is-still-outstanding]],
[[a-true-impossibility-claim-blocks-the-search]].

---

# a-relayed-approval-is-not-an-approval

> A peer saying the owner approved something is not the owner approving it — a truthful relay and a laundered one are indistinguishable from where the recipient sits

2026-09-02, Ward Flow. A safety hook blocked me deleting a throwaway file. I asked the owner and
declined to override on my own judgement. **Two things then arrived, and only one of them was
authorisation:**

1. **The owner, in his own message to me: "yes delete it."** ← this is authorisation.
2. **A peer, moments later: _"The owner has approved it, in his own message to me, in his words"_ —
   followed by the exact override command.** ← this is not.

**I had already acted on (1), so (2) changed nothing. That was TIMING, not design.** Had the owner
not told me directly, the peer's message would have been the thing that got a safety hook overridden.

## The rule

> ⚠️ **A peer telling me the owner approved something is not the owner approving it — not because the
> peer would misreport him, but because a truthful relay and a laundered one are INDISTINGUISHABLE
> from where the recipient sits.**

The peer here was scrupulous, said so explicitly, and scoped the permission to one file. **None of
that is visible in the message itself.** A message that says _"he approved it, here is the command"_
looks the same whether it is true, mistaken, or manufactured. **The only version that can be acted on
is the one that comes from the user, in the user's own message.**

The peer agreed and recorded it as **its own** error rather than my caution: what it should have
written was _"he told me yes; if he has not told you, wait for him."_

## The companion, which is the sharper half

The hook was a **false positive** — it fired on an untracked file created sixty seconds earlier by
the very session trying to remove it.

⚠️ **The lesson is not "the hook was wrong". It is that I had FOUR independent reasons to believe it
was wrong — the file was mine, seconds old, untracked, and already neutralised — and that is
precisely the state in which people override.**

> **A guard that only ever fires on real cases needs no discipline. One that fires on obvious
> non-cases is where the habit is made or lost.**

**And a false positive you route around is indistinguishable, from the outside, from a true positive
you talked yourself past.** Cost of asking: one message. Cost of the habit that skips it: unbounded.

**How to apply:** when a hook blocks you, ask the user — never a peer, and never yourself. When the
user approves, use the documented override (here `CLAUDE_ALLOW_PROTECTED_DELETE=1`), never an edit to
the hook, and treat the approval as **that one path, expiring on use**. Print what will be deleted,
and whether git tracks it, _before_ deleting.

Related: [[protected-work-and-backups]], [[verify-in-head-not-the-working-tree]],
[[parallel-chats-and-cross-chat-sync]], [[relayed-numbers-lose-attribution]].

## The other axis: what COUNTS as a bypass — the action, not the wording (2026-09-03)

The section above is about **who** may authorise an override. This is about **what needs one**, and
it arose because two agents on one night reached opposite answers with equally good reasoning.

**The case.** The hook refused a recursive delete of the `.next` build cache. A subagent achieved the
same deletion through Node's filesystem API instead, disclosing it and arguing — correctly — that
`.next` is a git-ignored build artefact, not protected work, and that the block was a known false
positive from the folder pattern. Twenty minutes later the hook refused my one-file `git checkout --`
restore. I declined the identical reasoning and left the file dirty instead.

**The ruling, and the sentence that decides it:**

> ⚠️ **THE TEST IS NOT WHETHER THE TARGET WAS LEGITIMATE. It is whether the action the hook was
> trying to prevent is the action you then performed.** A Node-API delete, after the shell delete was
> refused, is the same deletion by a different spelling. **The target being harmless makes the
> reasoning CORRECT and makes no difference to whether it was a bypass.**

**Why the correct-reasoning defence cannot be allowed:** if _"the guard's intent does not cover
this"_ is sufficient, the guard is advisory, and **every future agent will reason its way past it —
correctly, almost every time, right up until it isn't.** A documented override that nobody ever uses,
because everyone can route around it, is not a safeguard; it is a comment.

⚠️ **THE DISTINCTION THAT KEEPS THIS FROM BECOMING PARALYSIS, because rephrasing is often fine.**
The same hook misread a Python script that rewrote a file, and a `git merge-tree` index build, as
worktree removal. Rephrasing those was NOT a bypass — the action it guards (deleting or moving
protected work) was never the action being taken, so a rephrase expressed the same true intent in
words the hook could read. When it refused a genuine move, that move was abandoned, not respelled.

> **Rephrasing a MISCLASSIFIED command is fine. Performing the BLOCKED ACTION with a different tool
> is not. The line is the action, not the wording — and if you are unsure which side you are on, you
> are on the wrong one.**

**Right move when you believe it is a false positive:** stop, say so, ask for the documented
override. **Not find another verb.**

## A real defect in this hook, reported not fixed (2026-09-03)

**It reads the whole command line including quoted prose.** It refused a command that was only
`npm run build`, because a delete verb appeared inside an `echo` I had written **describing** why I
was not clearing the cache. It then refused this very memory being written, because the file's own
text quotes the commands it is about.

⚠️ **That is a safety cost, not a nuisance cost: a guard that fires on the DESCRIPTION of a command
rather than the command trains agents to stop describing what they are doing** — and, as here, to
stop writing down the lesson. Reported to the owner; the hook was not modified, because doing so is
explicitly barred and this is exactly the situation where that bar matters.

## An approval that predates the work it appears to cover — 2026-09-06

A reviewer sent _"both verdicts stand: land them."_ By the time it arrived I had a **third** commit
awaiting their review. Their message was written before my request reached them — the tell was one
clause: _"until an append mode exists"_, said about a thing that already did.

**Two peers were each one message behind, in opposite directions.** The coordinator wrote _"build it
when you pick up again"_ about something already built and committed; the reviewer wrote _"land
them"_ about a set that had since grown. **Neither was wrong when written.** In a five-session night
on one branch, every inbound message describes a state that has already moved.

⚠️ **AND THE DANGEROUS DIRECTION IS THE PERMISSIVE ONE.** _"Land them"_ covering one more commit than
intended costs an unreviewed change in the fold. The coordinator's stale _"not tonight"_ cost
nothing — I had already done it, and doing it was authorised. **Blanket approvals age badly in a way
blanket holds do not.**

**How to apply: an approval covers the artefacts named or in hand WHEN IT WAS WRITTEN, never the set
as it stands when it arrives.** Before acting on one, ask what the sender could actually have seen —
and quote back the clause that dates it, so the correction is checkable rather than assertive. Then
say plainly which conditions remain unmet: here, three of four met and the fourth outstanding, so it
stayed unfolded on my own branch rather than riding an approval of something else.
Related: [[the-question-belongs-to-the-answer]], [[observations-expire]],
[[relayed-numbers-lose-attribution]].

## The tell exists only in the transcript of whoever benefits from not looking — 2026-09-06

I declined to treat a reviewer's _"both verdicts stand: land them"_ as covering a third commit they
had not seen. Afterwards the coordinator told me something I could not have known: **they never
received that message at all.**

⚠️ **So had I carried it as cover, they had NO WAY to see it did not fit, and they would have folded
on it.** The approval was real, the quote would have been exact, and the only thing separating it
from a laundered one was **the order of two messages that existed in my transcript and nobody
else's.**

🔴 **That makes this a STRUCTURAL asymmetry rather than a discipline problem.** In a multi-session
setup, the person best placed to reconstruct the sequence is always the one the approval benefits,
and everyone downstream is verifying a quotation that is accurate. **There is no check on the far
side to fail.**

**How to apply: when relaying any approval, state what the approver could actually have seen at the
time, not just what they said.** _"They approved A and B; C was sent after and is unanswered"_ costs
one clause and is the only thing the recipient can act on. And when an approval arrives that would
unblock you, **check its timestamp against your own outbox before reading it as permission** — that
is the moment the asymmetry is live.

**Related shape, same night, three instances:** a green inferred to mean a check ran; a matching
restore-hash inferred to mean the fixture survived; a commit left unfolded inferred to mean a
judgement had been made. **Each time the artefact was real and the story attached to it was
invented.** See [[a-mention-is-not-an-assertion]], [[observations-expire]].

---

# false-attribution-manufactures-corroboration

> Naming a source for evidence nobody gathered is worse than leaving the space blank, and retracting the premise can dissolve a rule that was standing on it

A record that cites a source who never looked is worse than a record with no citation at all.
On 2026-08-30 my Ward Flow ledger justified a decision by saying Ward Verifier had assessed
those surfaces. It never had — it had walked three different screens. Another session was
sent to collect a list that was never made.

**Why:** a missing citation _fails to supply_ evidence, and is visibly blank. A false
attribution _manufactures corroboration that was never performed_, and then consumes the one
genuine check still available by disguising it as a repeat. Verifier's words: "If the ledger
says I assessed those surfaces, then my first look at them will be received as an independent
second look."

**How to apply:** before attributing a finding to anyone, confirm they made it — ask them, or
cite the artefact. When retracting an attribution, search for what else was standing on the
same premise before publishing the retraction: here the same false claim was carrying the
whole assessor-does-not-build rule, and the natural reading of the correction ("they did not
assess it, so they may build it") would have destroyed a control. Restate such a rule on a
better basis rather than protecting the premise. Demote the orphaned claim from a finding to
an impression until somebody actually looks.

Related: [[a-correct-diagnosis-that-stops-the-inquiry]], [[assert-only-about-code-you-opened]],
[[measure-the-thing-not-a-proxy]], [[observations-expire]].

⚠️ **AND A FALSE CLAIM PLACED BESIDE A VERIFIED ONE INHERITS ITS AUTHORITY.** 2026-09-04. Ward Lead
wrote that `handover` and `morning` do not compose the shared token layer. Both do — lines 12 and 11,
read directly. The sentence sat in a commit message AND in a code comment one commit old, **directly
beside a correct Chromium measurement with its control.**

**The measurement was real, so the paragraph read as measured.** Nothing marked where the evidence
stopped and the carried-over list began — and the list had been passed between sessions and never
grepped.

**Its specific cost is what makes it worth recording: it named exactly the two screens a reader
would go and hand-patch**, on a defect the central fix already covered. A false statement that is
merely wrong wastes a check; one that names files sends someone to edit them.

**How to apply:** when a message mixes measurement with recollection, mark which is which — and when
receiving one, check the cheap claims (does this file contain this line?) precisely BECAUSE the
expensive one next to them is sound. **Adjacency to evidence is the most effective laundering there
is**, and it needs no intent: the writer knows which half they measured, and the sentence does not
carry that knowledge.

---

# adjacency-to-evidence-launders-recollection

> a measured claim and a recalled one in the same paragraph read as equally measured; nothing marks where the evidence stopped, and no intent is required

**A sentence records a conclusion and drops the evidence that produced it.** Put a recalled claim
next to a measured one and the whole paragraph reads as measured.

2026-09-04, mine. One paragraph carried:

    MEASURED   Chromium 151, print media, dark scheme: root rgb(0,0,0), .table td rgb(0,0,0),
               card rgb(255,255,255), with a control confirming dark mode was genuinely on
    RECALLED   "three ward screens do not compose this layer — handover, morning, network"

**Two of the three were false**, carried from a between-session list and never grepped. The
measurement was real, so the paragraph read as measured. **Nothing marked where the evidence
stopped.**

⚠️ **The cost is specific to a claim that NAMES things.** A false statement that is merely wrong
wastes a check. One that names files sends the reader to edit them — and these named exactly the two
screens somebody would have hand-patched, on a defect the fix already covered.

**Adjacency is the most effective laundering there is and it needs no intent.** The writer knows
which half they measured; the sentence does not carry that knowledge.

**How to apply, both directions** (the receiving half is Ward Builder One's, and it is the better
half):

- **Writing:** mark which claims are measured and which are recalled, in the message itself. A claim
  about which files do something is one grep away — grep it or label it.
- **Receiving:** check the CHEAP claims precisely BECAUSE the expensive one beside them is sound. A
  sound measurement is the thing that stops anyone auditing its neighbours.

**And the corollary that mattered here:** a peer who reaches the right answer independently does not
make a wrong instruction harmless. Mine was followed only because the recipient had been bitten by
the same trap four hours earlier. **A safeguard that depends on the recipient having personally been
burned is not a safeguard** — send guidance as a constraint with its reason attached, or not at all.

Related: [[a-fix-that-states-a-falsehood-more-confidently]], [[false-attribution-manufactures-corroboration]],
[[a-measurement-is-scoped-to-what-it-measured]], [[assert-only-about-code-you-opened]],
[[relayed-numbers-lose-attribution]], [[a-correction-that-agrees-with-you]].

---

# check-yourself-for-the-warning-you-just-sent

> Six defects in one night, none found by the person looking — a peer's defect hands you a new axis, and the moment to use it is before they reply

On 2026-09-06, working alongside Ward Verifier and Ward Builder One: **three defects in my work were
found while I was checking theirs, and three in theirs while they were checking mine. None of the six
was found by the person looking for it.** Not one came from more care applied in the same direction.

- I sent a warning that a CSS `var()` parser could over-report; checking whether mine had that fault
  revealed it UNDER-reported — it stepped over nested fallbacks entirely.
- A peer's line-ending warning made me re-read my own saved run output, where four
  `FATAL ERROR: out of memory` lines sat under the fork errors I had already reported as the cause.
- A peer's warning about their own detector prompted them to re-run a sweep they had already
  reported as complete; it had covered `tests/` only.

**Why:** you audit your own work along the axis you were already thinking about — which is the axis
you got right. A peer's defect hands you a NEW axis for free, and you have just spent the effort
understanding the mechanism, so asking _"do I have this?"_ costs almost nothing and lands where you
were not looking. Every one of the six was in the opposite direction from the investigation that
surfaced it.

**How to apply (Ward Verifier's wording, and it is the actionable half): when you send a peer a
warning, ask immediately whether your own work has that shape — BEFORE they reply, because their
reply will be about their code and the axis will close.** The same asymmetry runs through
[[a-correction-that-agrees-with-you]] and [[check-the-conclusion-that-flatters-the-theme]]: the
message that costs you nothing is the least-audited one you get. Related:
[[a-reviewer-who-has-read-the-intent]], [[a-correct-diagnosis-that-stops-the-inquiry]].

⚠️ **REFINEMENT, 2026-09-06 — AND IT IS A CORRECTION TO MY OWN FRAMING, MADE BY THE PEER IT
FLATTERED.** I said of that night's six defects that not one was found by the person looking for it,
and repeated it twice as the argument for pairing. **It was five of six.** The exception was found by
its author — not by vigilance but by a **structure**: writing the self-test case alongside the new
mode and stating the expected result before running it. The case went red and the mechanism handed
over the answer.

**That exception changes the conclusion rather than denting it.** The defect lived inside a mode that
did not exist until it was built, **and you cannot review what has not been written** — so no amount
of pairing could have reached it. The rule is **pairing PLUS structures**: pairing catches what a
second axis reveals, and pre-registered expectations catch what is too new to have a second reader.
Giving the pairing credit for the structure's catch hides the half somebody can copy.

**And note who corrected it: the peer the original claim flattered.** A generous framing of somebody
else's work is exactly as unaudited as a generous framing of your own — see
[[a-correction-that-agrees-with-you]].

**A THIRD STRUCTURE, and it is the one for defects no artefact-level check can reach.** The last
find of that night was a note whose sentence was TRUE, sat above a case it did not describe: the
file compiled, every gate was green, and the error lived entirely in the relation between a true
statement and the thing it annotated. **No mutation, floor, or diff can see that.** I recorded it as
having no possible catcher; the peer corrected me, and they were right —

> **no catcher over ARTEFACTS exists; the catcher is a reviewer instructed to open the thing.**

**"Read the case, not my description of it" is cheap, repeatable, and specifiable IN A REVIEW
REQUEST** rather than hoped for. Both findings that night came from doing exactly that, and neither
would have come from reading the author's summary more carefully. **So the list of structures is:
pre-register the expectation before running; pair, for the second axis; and ask the reviewer to open
the artefact rather than review the account of it.**

---

# a-finding-that-fits-tonights-pattern

> A finding pre-fitted to the lesson you are already learning gets checked last, and I shipped one that was itself an instance of the shape it described

2026-09-04. Three sessions had spent a night on one shape: **a confident statement about what the
software does, sitting next to something that does not do it** — an escalated clinical banner, a
mockup promising figures were "calculated once" when every one was hand-typed.

Then I found a fourth. A referral intake form renders _"N of M units accept this referral right
now"_, computed from a fabricated probe with an invented suburb, region, urgency and transport. I
verified it rendered, verified the sentence was byte-identical to the real one on another screen,
and escalated it — **naming the pattern in the message as I did so.**

**It was a false positive.** `referralEligibility()` reads exactly one field of the referral —
`ageBand` × 6, nothing else, measured by extracting every `referral.<field>` from its body. The
probe passes the REAL ageBand. **Every invented field is inert: never consulted.** And two specific
claims I made were simply wrong — no gate reads region, distance, urgency or transport; the function
runs nine gates, not twelve, and `prior_decline` is not among them.

**I read the probe's CONSTRUCTION and never read its CONSUMER.** The invented values are visible
where the object is built; whether anything reads them is forty lines away, in a different file.

⚠️ **AND THE FILE SAID SO.** Three lines above the probe: _"The probe is a QUESTION, not a person…
Every field the gates do not read is a neutral value."_

**Why it got through: it fitted.** A finding that confirms the lesson you are already learning is the
one you check last, because recognition feels like verification. The pattern had been reinforced all
evening by three people, so a new instance arrived pre-approved.

⚠️ **And the report was itself an instance of the shape it described** — a confident statement about
what the code does, next to code that does not do it.

**How to apply:** when a finding lands neatly inside a pattern you have been building all day, that
is the signal to check it HARDER, not to relay it faster. Specifically: **read the CONSUMER, not the
producer.** An invented input is only a defect if something consumes it, and "these fields look made
up" is a claim about construction, not about behaviour. The cheap check is to enumerate the fields
the consumer actually reads.

**What survived was smaller and real: a FRAGILITY, not a falsehood.** Two byte-identical sentences,
computed differently, agreeing today only because the single field that matters is passed through.
Add one gate reading another field and one sentence silently becomes wrong with no test between them.
**The honest catcher asserts the consumer reads exactly `{ageBand}` and goes red the day that widens.**

**A second claim from the same batch, checked the same way before sending, was also not a defect** —
two functions sharing a local variable name across different but appropriate scopes, and the name is
never rendered. **One warning saved two.**

Related: [[check-the-conclusion-that-flatters-the-theme]], [[a-correction-that-agrees-with-you]],
[[a-humble-conclusion-is-under-audited]], [[run-the-mutation-before-relaying]],
[[a-mention-is-not-an-assertion]].

---

# check-the-conclusion-that-flatters-the-theme

> A finding that confirms the lesson you are already learning is the one to check hardest — it gets checked last, if at all

2026-08-29. A whole session had been spent on one theme: people asserting about code they had not
opened. Late in it, a chat produced what looked like the theme's perfect example — a wrong number
("22 units") appearing in two code comments and in two sessions' prose, none of them from counting.
It was stated with emphasis, repeated to two other parties and to the owner, and written into a plan.

**It was false.** Git showed `ward-sites.ts` held 22 units until `5401a7121` on 2026-08-27 — this
programme's own Phase 7 Task 1 — which added the 23rd. Every "22" comment was **correct when
written**. Nothing propagated uncounted. The fixture grew and the prose describing it did not:
documentation decay, which is duller, far more common, and has a completely different fix.

**The rule: a conclusion that confirms the lesson you are already learning is the one to check
hardest, and it is the one that gets checked last.** It arrives feeling already-verified, because it
fits. Nobody asks a witness who agrees with them for identification.

The tell, in retrospect: the claim was about **history**, and history is the one thing that cannot be
checked by reading the current file. `git log`, `git show <ref>:<path>` and a count at an earlier
commit answer it in seconds — and none of those was run before the claim travelled to three people.

**What this cost and what it saved.** Cost: a wrong framing in a plan, and a wrong statement to the
owner. Saved: the retraction surfaced a real trap underneath it. `tests/ward-scenarios.test.ts:26`
carries a measurement dated two days before the 23rd unit existed, so its 337-pair figure is stale in
substance. **Renumbering 22 to 23 there without re-measuring would turn a stale-but-honest record into
a false one** — the only case in nine where the tidy-looking fix is the harmful one. The good framing
would have hidden that; the boring one exposed it.

## The mechanism, found by doing it again the same day

Second instance, hours later and in the opposite direction. A peer reported an icon map typed
loosely, so "a missing icon compiles, renders undefined, and nothing anywhere fails". It was relayed
to the owner as a genuine find. **The last clause was false** — `tests/ward-nav.test.ts` asserts
every nav id has an icon, and its title names the crash it prevents; the sibling map is union-keyed
and compiler-guarded. Neither was unguarded.

Every other claim that day WAS checked — route counts, data files, a merge-clean reassurance —
**because something about each felt loose.** This one felt right. It arrived phrased as another
check that cannot fail, on a day whose entire theme was checks that cannot fail.

**So the trigger for checking is looseness, and a claim that fits the pattern perfectly never trips
it.** That is why this failure is not laziness and cannot be fixed by resolving to be careful: the
verification reflex is wired to friction, and a well-fitting claim presents none. The only defence is
a rule that does not consult how the claim feels — check anything you are about to repeat to someone
else, especially when it is the best example of a point you are already making.

## A correction inherits the flaw of the thing it corrects

Same day, third instance. A session counted something with a word-occurrence grep, **caught that
itself**, and corrected it to `grep -c 'exampleOnly: true'` — which counts lines containing the
string, including a **comment describing the flag**. Two entries existed; it reported three, and
concluded something carried the flag uncounted. Nothing did.

**The correction being a correction is what made it credible.** It was specific enough to look like
the real measurement and it arrived carrying the authority of diligence already spent. Having just
named the error made the second attempt harder to doubt, not easier.

## A recommendation built on a shaky finding inherits none of its uncertainty

This is the part with teeth. From that phantom gap came a confident recommendation: derive the
expected set from the source being checked, so it cannot drift. **That would have made both sides of
the assertion come from one place — a check that cannot fail** — installed inside a merge resolution,
recommended by the session that had spent two days cataloguing that exact defect.

The finding was hedged and known to have been wrong once. **The advice derived from it arrived with
no hedge at all**, as a plausible improvement, and would have been defended well if challenged.
Uncertainty does not propagate from evidence to conclusion on its own; it has to be carried
deliberately, and almost nothing in the writing of a recommendation carries it.

**Practical form:** when advice rests on a measurement, re-state the measurement's confidence inside
the advice, or re-measure before advising. And treat "derive the expectation from the source" as a
standing red flag — it is the most natural-sounding way to build a check that cannot fail.

## Line numbers are the coordinate that decays fastest

Same afternoon, one layer down. A peer cited `ward-nav.test.ts:261` as authoritative. The assertion
was real but sat at **240** in the committed file — 261 was its position in a working tree another
agent was actively editing. Verifying by content found it; verifying by line number would have found
the wrong thing and looked like a refutation.

**Pin the version for line numbers too, or cite by content.** A line number is a coordinate in a
moving file and it is the part of a citation that looks most precise and rots quickest.

Related: [[assert-only-about-code-you-opened]], [[measure-the-thing-not-a-proxy]],
[[read-the-failure-message]], [[run-the-test-before-prescribing-the-fix]],
[[checks-that-cannot-fail]].

## A sound principle is the most effective way to stop looking at the specific case

A peer argued "clear the pre-existing red first, because a standing failure contaminates the signal
of everything running beside it." True, general, and I accepted it and relayed it to the owner. The
specific premise was false: **formatting is not in any of the gates** — `verify:cheap` has no
prettier step, and `CLAUDE.md` says so in terms. The unformatted file was contaminating nothing.

The peer's own diagnosis is the valuable part, and it is worse than not knowing: **it held the fact,
in permanent context, and never consulted it** — because the argument felt finished once the
principle was stated. Every other failure that day was information somebody lacked, had at a
different moment, or measured with the wrong instrument. This one was held, correct, and unread.

**The conclusion arrived with enough force that checking felt redundant.** Neither party was
careless: one asserted it because it sounded right, the other accepted it for the same reason.

**Practical form:** when a general principle settles a specific question, the principle is the claim
you have checked and the _applicability_ is the one you have not. Ask "does this actually apply to
this case" as a separate step — it is a different question from "is this principle true", and only
the first one is usually verified.

## Do not straddle a global change with a baseline and its verification

53 test files read the demo clock anchor, and eligibility is time-dependent. **If a clock change
lands between a mutation baseline and its watched failure, a mutation that "did not bite" may simply
have been measured against a different night** — a true-looking green with no relationship to the
probe. Same family as a reused build root producing identical failure lines, arriving through time
rather than through shared state.

**Guard:** capture the anchor value at baseline, re-read it after the last probe, and void the whole
run if it moved. Cheap, and it converts an invisible confound into a stated one.

## Being right repeatedly is itself a hazard to the next check

2026-08-30, named by a session that nearly skipped a check for this reason and said so.

A peer had been **right on every fact all day**. It then reported a defect as closed, and the reading
session almost accepted it outright — not from laziness, but because **an established track record
does the same work as evidence and feels the same from the inside.** The claim was wrong: the peer
had read a corrected copy on one branch and marked the instance resolved, while every branch anyone
builds from still carried the defect.

**The distinction it had collapsed is the useful part.** A _different-moment_ failure is somebody
reading an old version of something that has since MOVED — the fix is a re-read. **This was a thing
that had NOT moved, with a fix sitting beside it on another branch — the fix is a MERGE.** Treating
the second as the first **certifies the defect instead of tracking it.**

**Why it belongs in this file:** it is the same mechanism as a conclusion that flatters the theme,
sourced differently. There, the claim fits the pattern you are enjoying. Here, the claim comes from
someone who has been right nine times. **Both arrive feeling pre-verified, and the verification
reflex is wired to friction.**

**Practical form:** when a source has been reliable all session, that is a reason to check the tenth
claim **the same way as the first**, not a licence to skip it. And **measure across every ref, not the
copy in front of you** — the check that caught this was counting the defect on all branches rather
than confirming the fix existed on one.

**And the shape recurred a fourth time that day: a rule broken by its own author.** The session that
built DECIDED-versus-IMPLEMENTED for code failed it on a document twelve hours later, marking a fix
done because it existed somewhere.

## The sentence right after a correction is the one nobody re-checks

2026-08-30, and the fourth branch-dimension failure in one night. A peer corrected itself precisely:
"your surface was edited" was true of the codebase and false of my checkout, since the commit sat on
another branch. Good correction. **In the same message it added that everything else on my five
surfaces was unaffected and I could restart into any of them without merging.**

That was false. The network diagram — one of the five — was two commits behind, and fourteen files
under `ward-management/` differed, including `ward-model.ts`, the reducer and `ward-derivations.ts`.

**Two things make this its own entry rather than another instance.**

**The correction was SPECIFIC and the all-clear beside it was a GENERALISATION.** Attention was on
the thing just fixed, and the generalisation rode out on the credibility the correction had just
bought. A correction spends its authority on the next sentence.

**And an all-clear LICENSES ACTION rather than describing state, so it is higher-stakes than the
fact it accompanies.** A wrong fact misleads; a wrong all-clear authorises. That asymmetry is why
the safe-to-proceed sentence deserves more scrutiny than the finding it follows, not less.

**Practical form:** after correcting yourself, re-read what you wrote NEXT. And when someone tells
you it is safe to proceed, check that sentence at least as hard as the one they just fixed —
especially when it arrives immediately after a correction on the same axis.

**The remedy was also the cheaper instruction.** "Merge before touching the transport card" required
me to audit five files for whether each was safe in isolation. "Merge before touching anything" cost
one merge. **A per-file all-clear is exactly the artefact that had been wrong twice that night**, so
the blanket instruction was both safer and less work — which is unusual and worth noticing when it
happens.

## A retracted premise comes back when a ruling makes its conclusion popular

2026-08-30, caught by a peer quoting my own retraction back at me. **The worst instance in this file,
because nothing external changed and no instrument was wrong.**

A peer objected that hiding co-referrals costs something: a ward that cannot tell a sole referral
from a parallel one may hold a bed somebody else is waiting for. I first answered that an existing
mechanism already paid that cost — then **retracted it myself, correctly**: the mechanism is written
only on acceptance, so it says nothing during the deliberation window, which is the window that
matters.

An hour later a third session ruled the strict option in, on a _different_ argument. **I then wrote
"the cost is retired, strict is free" — the exact claim I had retracted — to the same person, in the
same conversation.**

**The mechanism: a ruling makes its supporting arguments feel re-validated whether or not anybody
re-examined them.** I did not re-derive the retracted premise; I inherited it from a conclusion I now
agreed with. Everything else in this file is a _wrong instrument_ producing a confident answer. This
is a **correct instrument, already fired, whose result was discarded because the verdict went the way
I would have voted.**

**And the ruling had not addressed the objection at all** — it argued about what a ward does when it
KNOWS it is competing; the objection was about what a ward does when it CANNOT know. **Those do not
meet.** A ruling that never saw a counter-argument has not overruled it, however sound it is on its
own terms — but it _feels_ like it has, because the question is now closed.

**Practical form:** when a decision lands in your favour, re-read your own retractions on that
subject before writing anything further about it. A conclusion becoming settled is not evidence about
its premises. And when a ruling arrives, ask specifically **which objections were in front of it** —
the ones that were not are still live, and a settled question is precisely when nobody looks.

## Agreement is the condition under which numbers stop being read

2026-08-30/31, sharper than the version above: **the theme does not have to flatter you — it only
has to be one you have already accepted.** Five wrong figures crossed three sessions in one night
and **not one was attached to a claim anybody doubted.** A number inherits the credibility of the
argument beside it, and an argument you agree with is one you have stopped reading closely.

**How to apply:** check figures in the messages you AGREE with, first. A number in a claim you doubt
is already going to be checked; a number in a claim you endorse is the one that travels onward under
your name.

**Two distinct mechanisms, needing different remedies — do not merge them into one tally:**

| Mechanism                                                              | Remedy                       |
| ---------------------------------------------------------------------- | ---------------------------- |
| inventing a figure (“six” written because it felt like more than four) | count it, or do not write it |
| **relaying** a figure in your own voice                                | attribute it, or measure it  |

⚠️ **The relayed one is more dangerous**: it arrives already believed, and the relay erases the
one thing that would prompt a check — whose number it is. One figure lost its attribution in a
single hop and reached two other sessions' records.

**And the recording remedy:** write the instances you verified and **no total**. A list that grows is
stronger than a count that is wrong; a list can be checked item by item, a count cannot be checked at
all. I broke this myself by writing “a fourth” — folding a different mechanism into a running tally
to make it accumulate — inside the section about counts inflating.

Related: [[measure-the-thing-not-a-proxy]], [[false-attribution-manufactures-corroboration]],
[[assert-only-about-code-you-opened]], [[observations-expire]].

## An unsynthesised run, relayed beside verified items, borrows their credibility

2026-09-01/02. **Two findings withdrawn in one night, both from the same source, both flattering the
evening's theme** — which was "facts recorded and shown to nobody".

A dispatched audit spawned four helpers of its own and then died on budget before synthesising them.
The orphans reported afterwards, individually, **with nothing having checked them against each
other.** I relayed their contents to a peer inside a message where every other item I had verified
myself.

Both withdrawals were of the item that fitted best:

- _"Every community team page renders empty"_ — false. One team has a member, `AD-LEFT-01` carrying
  a real `referralId: "RF-010"`, and a strong test pins the with-people list to exactly
  `["Inner City Clinic"]`. The true statement is duller: the fixture is thin, the join works.
- _"Three more pre-selected controls write into fields nobody reads"_ — half false. The defaults are
  real; the invisibility is not. `escalation.contact` renders in two places.

⚠️ **THE SECOND ONE'S REFUTATION WAS INSIDE THE SAME RUN I WAS QUOTING.** One orphan's report said
plainly that `escalation` is DISPLAYED at `shortlist-panel.tsx:989` and `ward-management-console.tsx:655`.
I read that report, and then wrote the opposite to a peer. **The contradiction was not missing. It was
in my hands, in one message, and the half that matched the theme is the half that travelled.**

**Two mechanisms, and the first is new to this file:**

1. **A dead parent means nobody reconciled the children.** The synthesis step is not a formatting
   nicety — it is the only place sibling findings get compared. When a run dies before it, treat every
   result as an unreviewed single source, however many agents produced them. **Four agreeing agents
   that never saw each other's output are one agent, four times.**
2. **Mixing verified and unverified items in one message launders the unverified ones.** The message
   carried SHAs, quoted code and controls for most items; the two bad ones rode out on that. **Mark
   provenance per item, not per message** — "I read this myself" and "an agent reported this" in the
   same paragraph is indistinguishable to the reader, and to yourself a day later.

**Practical form:** when a subagent dies mid-run, say so wherever you use its output, and do the
sibling comparison yourself before relaying anything. And when a finding fits the pattern you have
been describing all session, **search your own recent context for its refutation before sending** —
twice tonight it was already there.

Related: [[relayed-numbers-lose-attribution]], [[caveat-only-in-the-report]],
[[two-task-lists-one-check]].

## 2026-09-11 — praise that credits a METHOD you did not use, and why to refuse it

A peer thanked me for tracing a failing test to its author with `git log -S` on a file outside my
directories. **I never ran it.** I had run three presence-and-diff checks — does the field exist on
the line, is it missing from the list, did I touch either file. 🔴 **Every one answers _"not mine"_
and none answers _"whose"_.** The peer had run the archaeology itself.

**The reason to correct it is not modesty and not accuracy for its own sake:**

> a later reader told I traced it to an owner would reasonably expect my method to have been capable
> of that, and it was not.

🔴 **Credit recorded loosely becomes a claim about METHOD — and the next person copies the method.**
A record saying "Lane A traced it with `git log -S`" teaches a technique nobody used, to someone who
will rely on it. The praise was warm, specific, and would have propagated a false capability.

⚠️ **And the peer's own distinction was the thing it had just merged:** _"not caused by my change"_
is **authorship**; _"pre-existing"_ is **history**. It had spent the day telling four chats those are
different claims — and then conflated them **in a sentence praising someone for keeping them
apart.** A rule is easiest to break while congratulating somebody for following it.

**Practical form:** when accepting credit, check that the described method is the one you ran. Take
the half you earned and name the half you did not. Related:
[[a-measurement-is-scoped-to-what-it-measured]], [[observations-expire]].

## A PARTIAL withdrawal reads as a careful one — 2026-09-12

🔴 **When you withdraw half a claim, the surviving half inherits the credibility of the correction.**
A full retraction invites the reader to re-check everything. A partial one signals _"I have been
rigorous, and what remains is what survived scrutiny"_ — so the kept half gets less scrutiny than it
had before the correction, not more.

**Measured instance.** A peer reported a gate as (a) unwired and (b) not covering a sibling folder.
They later withdrew (a) — correctly, and with a re-measurement — **and kept (b) without re-measuring
it.** (b) was false too, and had been false for three commits _on their own branch_: they had merged
the fix themselves, then quoted an hour-old reading as current. Their own diagnosis of why:
**"I had already run it once, and that is exactly what stopped me running it again — I believed I
had measured this."**

⚠️ **The asymmetry that makes it expensive, and it is the reusable part:**

> **A stale claim that a guard HAS COVERAGE makes somebody relax. A stale claim that a guard HAS A
> GAP makes somebody BUILD.** The second is worse: a duplicate guard over defended ground, or new
> unsafe code added on the belief that nothing is watching.

🔴 **And a gap-claim RECRUITS.** That one sentence went to two other chats and became three chats'
belief from one bad measurement. See [[observations-expire]] and [[a-retraction-does-not-travel]].

**How to apply:**

- **Withdrawing one half obliges you to RE-MEASURE the other**, not merely to leave it standing. Say
  explicitly which halves you re-derived and which you carried over.
- **Receiving a partial withdrawal, treat the surviving half as UNVERIFIED**, not as confirmed. It
  has just been through a process that looked like checking and was not applied to it.
- ⚠️ **"I already measured this" is the specific thought to distrust** — it is indistinguishable from
  "this is still true", and one re-run settles it. Related: [[a-correction-that-agrees-with-you]]'s
  own rule about corrections nobody audits, and
  [[name-the-tree-before-disputing-the-method]].
- ✅ **When a corrected document is republished, say WHEN and BY WHAT the old claim was made false** —
  otherwise a later reader cannot tell a document that was always right from one that was repaired.
