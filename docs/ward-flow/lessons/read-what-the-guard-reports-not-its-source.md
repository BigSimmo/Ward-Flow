---
name: read-what-the-guard-reports-not-its-source
description: I opened a failing guard's assertion, reasoned about what it COULD report, and contradicted a peer twice — its printed list had one entry and they were right
metadata:
  type: feedback
---

A peer said the deliberate red was one parked owner question in a named file. I contradicted them
twice, with evidence: the file passes 5/5, contains no `it.fails`, and the guard's source collects a
LIST of orphaned tests — so, I argued, the red is a backlog, not an owner question.

Every one of those facts was true. **The printed list had exactly one entry and it was their file.**
`diff-integrity.json` documented it in terms: one case still points at the dead mode ON PURPOSE, so
the guard keeps reporting it, because whether those figures belong on the replacement screen is a
question the owner has not been asked.

**Why:** I read what the guard CAN report — its assertion, its design — instead of running it and
reading what it DID report. And "the file passes" misled me, because the parked case is GREEN; it is
a different guard that goes red about it. _The file is not failing_ and _the file is not the red_ are
different claims.

**How to apply:** when a guard is red, the first artefact is its printed failure list — not its
source, not the state of the files it names. This project states that rule constantly and I had
quoted it at someone else the same night about a stale guard. Also: before contradicting a peer
twice, check whether the disagreement is about the same object — theirs was "what causes the red",
mine was "what the red asserts". See [[a-stale-guard-answers-honestly]],
[[a-finding-asserted-past-its-base]], [[deferring-to-a-correction-looks-like-humility]],
[[a-correction-that-agrees-with-you]].
