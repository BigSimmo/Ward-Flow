---
name: a-clinical-word-that-means-two-things
description: "Ready" means a ready bed and a patient ready to leave; a guard on the word alone demanded a bed-cleaning note on two discharge screens
metadata:
  type: feedback
---

**A guard selecting screens by the rendered word `Ready` picked 11 files. Four were not bed
screens at all** — two discharge-statistics screens headed _"Ready to leave, and blocked"_, and a
discharge board using the phrase in a sentence.

⚠️ **`Ready` is a homonym in this domain: a ready BED, and a patient ready to LEAVE.** A guard on
the word alone would have demanded a bed-preparation note on screens about patients — **clinically
nonsense, and exactly the over-broad guard that gets disabled rather than obeyed.**

**The predicate that works is a conjunction:** the rendered word **AND** a bed-availability
derivation (`.available`, `availableNow`, `headlineAvailable(`, `.ready`). It excludes all four
cleanly and **needs no exemption list** — which is the tell that the predicate is right rather
than patched.

**How to apply:**

- Before selecting anything by a domain word, ask **what else that word means to a clinician.**
  Ready, held, blocked, cleared, discharged, accepted, pending — most of them carry two senses,
  one about a bed and one about a person.
- **A conjunction that needs no exemption list beats a single term plus exemptions.** An exemption
  list is a record of a predicate that does not describe the property; it also decays, because the
  next matching file is not on it. ⚠️ **Boundary distinction (predicate conjunction vs checker exemption):**
  In test scanners and AST checks, prefer an exact predicate conjunction over an allowlist or checker
  exemption list.
- Check **both directions**: the false positives it must not fire on, and the compliant-by-another-
  route cases it must not miss. Here `capacity-screen` reaches the qualifier through a derivation
  rather than the helper, and a naive marker excluded it _accidentally_ — the guard was green for
  the wrong reason.

Related: [[measure-the-thing-not-a-proxy]], [[a-property-that-does-not-discriminate]],
[[one-word-two-states]], [[an-alias-defeats-a-name-matching-detector]].
