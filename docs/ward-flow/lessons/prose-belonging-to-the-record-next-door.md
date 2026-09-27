---
name: prose-belonging-to-the-record-next-door
description: "A true, emphatic comment about the NEIGHBOURING record reads as being about yours — and the better it is written, the more confidently you misread it"
metadata:
  node_type: memory
  type: reference
  originSessionId: c186bff2-76e5-4e1f-b211-8b26b7fbdcab
  modified: 2026-09-11T00:37:10.511Z
---

Ward Flow, 2026-09-11. Diagnosing why an emergency department's "nothing here" marker was missing, a
lane grepped the seed and landed two dozen lines below the referral it was investigating, on:

> _"Neither carries a `triagedAt` and neither carries an `inDepartmentAt` … adding either one to tidy
> the record moves the patient into Referrals and empties the Expects list."_

**Read as being about the record above it, that says the screen is broken.** It is about the **two
records below** — deliberately timeless "expects" whose whole identity is that absence.

🔴 **The comment is true, well written, and about the neighbour.** It was one command from the
opposite conclusion and the opposite repair.

## Why good prose is the dangerous kind

**A vague comment invites checking. An emphatic, specific, well-argued one does not.** The quality of
the writing is what suppresses the instinct to verify which record it describes.

**What caught it:** the claim did not match the investigated record's own fields, once those fields
were actually read.

## The rule

**Open the record, not the description near it.** Same shape in three venues now:

    a comment describing a guard   is not the guard        [[a-declaration-is-not-an-effect]]
    a grep for a filename          finds its prose         [[a-grep-for-a-filename-finds-its-prose]]
    a comment beside a seed record belongs to the next one  this entry

⚠️ **In a hand-authored fixture file the hazard is worst**, because records are dense, similar, and
separated only by blank lines — and the comments explaining _why a record is unusual_ cluster exactly
where the unusual records are. See also [[comments-that-recruit]],
[[a-rationale-that-lives-away-from-the-call-site]], [[assert-only-about-code-you-opened]].
