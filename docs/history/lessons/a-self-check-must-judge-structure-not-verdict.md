---
name: a-self-check-must-judge-structure-not-verdict
description: 'An anti-vacuity check keyed to the verdict ("nothing passed, so I must be broken") cannot tell a broken measurement from a real all-negative result; key it to identity fields instead'
metadata:
  node_type: memory
  type: feedback
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-18T10:05:33.063Z
---

An anti-vacuity guard has to discriminate on something that is true _regardless of the answer_.
Keying it to the answer itself gives a check that cries wolf on a correct extreme result and stays
silent on a subtly broken one.

**2026-09-18.** A read-only report measured how many catalogue records would need owner review
before publication. I added a self-check: if `adoptableCount === 0`, refuse to print the review
count, because "nothing is adoptable" is what a broken comparison looks like. It fired. But zero
adoptable was **correct** — every record genuinely had drifted since the freeze — so the script
refused to report a real finding and told the owner the measurement was broken.

**The right discriminator was structural.** The compared snapshot has identity fields
(`version`, `producerClass`, `domain`, `sourceRole`, `access`, `sourceLineage`) and content fields
(`contentHash`, `governanceHash`, `publicationVersion`). Identity fields must match whatever the
content says — they describe how the record is _built_, not what it holds. Once the check keyed on
those, the answer was unambiguous: identity matched 0/219 differing, content differed 219/219 →
real drift, comparison sound, report it.

**How to apply:** when writing "this result is too clean/too empty to believe", ask what would still
be true if the extreme answer were genuine. Assert on that. If you cannot name such an invariant,
the check is measuring your expectations rather than the mechanism.

**Second lesson from the same script, and it nearly published a false diagnosis.** The field-level
diagnosis cast a `RegistryCorpusEntry` straight to `SiteContentRecord`. A corpus entry has no
`logicalId`, so the field read `undefined` and "differed" in 219/219 — for groups I had matched
_by logical id_. An impossible result is the tell. Project through the production function
(`registryEntryToSiteContentRecord`), never a cast, when the whole point is comparing two
projections.

Related: [[a-control-must-test-the-premise-not-the-measurement]],
[[a-clean-result-from-measuring-nothing]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[a-cast-plus-a-runner-that-does-not-typecheck]], [[checks-that-cannot-fail]].
