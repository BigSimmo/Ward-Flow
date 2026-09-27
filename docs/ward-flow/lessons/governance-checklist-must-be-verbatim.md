---
name: governance-checklist-must-be-verbatim
description: PR governance checklist lines are compared with string equality; appending a justification to the checked line silently fails the merge-blocking PR policy check
metadata:
  node_type: memory
  type: feedback
---

`scripts/pr-policy.mjs` decides a Clinical Governance Preflight item is satisfied with
`checkedEntries.some((entry) => entry === item)` — **string equality**, not "contains".

So a line like

    - [x] Service-role keys and private document access remain server-only — no Supabase client is constructed here

does **not** count. Adding the evidence to the checkbox line is the natural, careful-looking thing
to do, and it fails the merge-blocking `PR policy` check on 5 of 7 items while looking complete to a
human reader. It cost a CI cycle on PR #2498 on 2026-09-01, despite AGENTS.md already warning that
"paraphrasing silently fails" — the warning did not name _this_ shape of paraphrase.

**How to write it:** the seven checkbox lines carry the required text and nothing else; the evidence
goes in a numbered list underneath. Build them from the script's own export rather than by typing:

```js
const m = await import("./scripts/pr-policy.mjs");
m.requiredClinicalGovernanceItems; // the exact strings
m.collectSatisfiedGovernanceItems(body); // how many the parser actually counts
m.evaluatePullRequestPolicy({ title, body, files });
```

**Always evaluate the body offline before opening the PR, and again against the LIVE body after
`gh pr edit`** — the second check is the one that proves what GitHub stored, not what you wrote.
Related: [[assert-only-about-code-you-opened]], [[verify-in-head-not-the-working-tree]].

## The second shape: deleting the checklist instead of paraphrasing it (2026-09-17, PR #2856)

Same gate, opposite mistake. I judged a two-file tooling PR non-clinical and replaced the whole
section with "Not applicable -- this change touches no clinical surface." `PR policy` went red with
the same 7-box error, because **`classifyPullRequestFiles` decides clinical risk from PATHS, not
from your reading of the diff**, and it flags any script that generates a clinical dataset:

    scripts/build-cross-mode-differentials-index.mjs -> clinicalRisk: TRUE

It matches because it builds the differentials index clinicians read -- the `data/` rule's
rationale applied to the generator. A "scripts only, low risk" brief does not make a PR non-clinical.

**Never argue the section away. Run the classifier before writing the body:**

```js
(await import("./scripts/pr-policy.mjs")).classifyPullRequestFiles(changedFiles);
```

Then, having ticked the boxes, say in prose WHY each is honestly true. Here the honest reason was a
measured one: the regenerated index was byte-identical to the committed baseline, so no clinical
content moved at all. A tickable box needs that kind of evidence, not a shrug.

**And validate the finished body offline before it ever reaches GitHub** --
`evaluatePullRequestPolicy({title, body, files})` returned `ok: false` twice locally (once for the
missing checklist, once for a trailing justification on item 7, the ORIGINAL shape above), which
cost two seconds each instead of two CI cycles. This memory existed and I still made the paraphrase
error on the retry; the local call is what caught it, not the memory.
