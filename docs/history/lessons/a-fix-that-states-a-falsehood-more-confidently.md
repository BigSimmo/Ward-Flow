---
name: a-fix-that-states-a-falsehood-more-confidently
description: "a repair can replace an obviously-broken false statement with a fluent, specific, authoritative one — and the fluent version is the one people act on"
metadata:
  type: feedback
---

**The dangerous output of a wording repair is not a remaining error. It is a NEW error that now
reads as authoritative.**

2026-09-04, reviewing six clinical wording fixes on the Ward Flow movement page. The old defect: a
route passed the sentinel `"WF-"` for a wrong-shaped id, so `/movements/PT-004` rendered _No
synthetic movement matches "WF-"_. Obvious nonsense — a reader sees it, distrusts it, looks
elsewhere. **That distrust was doing safety work nobody had budgeted for.**

The repair quoted the real id and explained the shape, and added: _"a person is not a movement, and
their record is not reachable from here."_ MEASURED at the same ref:
`/mockups/ward-flow/people/[patientId]` renders that person by name, and the patient search links
straight to it. **The sentence is false, and unlike the gibberish it replaced, it is believed** — so
it turns a coordinator away from the exact screen they wanted.

⚠️ **Fluency is the risk multiplier.** Grade the repaired sentence on the same scale as the defect:
_if this is wrong, who acts on it and what do they do?_ Gibberish is self-limiting. A specific,
confident, well-punctuated claim is not.

⚠️ **A negative claim about reachability, existence or absence is the shape to distrust**, because
verifying it means searching everywhere rather than looking at one record. "There is no such thing"
and "this cannot be reached" are the two that got written without anybody checking.

**How to apply:** when a fix ADDS a sentence, verify the added sentence with the same effort spent
proving the original was wrong — and for any claim of the form _X does not exist / is not reachable
/ has not happened_, go and look for X before shipping it. Related:
[[tests-that-assert-rendering-not-truth]], [[fields-with-no-producer]],
[[an-absence-promoted-to-a-headline]], [[unreachable-over-which-paths]].
