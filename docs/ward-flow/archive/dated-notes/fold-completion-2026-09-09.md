# The fold is complete — every ward branch's unique content is superseded, not missing

**Ward Lead, 2026-09-09**, after the owner's instruction to _"continue the folding of all content
safely"_. Measured against master line `8db94de5e5`, which now contains all of `origin/main`.

---

## The answer

**There is no ward content left to fold.** Eight ward-related branches were checked. Every file that
exists on one of them and not on the master line is either already superseded by a renamed
replacement, deliberately deleted by an earlier commit, or an unrelated generated artefact.

---

## Why the "ahead" counts are not evidence

| Branch                                  | reads ahead | actually behind | ward files unique to it    |
| --------------------------------------- | ----------- | --------------- | -------------------------- |
| `claude/Wardquestions`                  | 222         | 3042            | 1 — superseded             |
| `codex/ward-management-design`          | 127         | 3226            | 14 — superseded route tree |
| `claude/Ward-design`                    | 118         | 3042            | 0                          |
| `claude/ward-flow-phase-5-p8rwcm`       | 24          | 3177            | 0                          |
| `claude/ward-flow-untangle-72b296`      | 17          | 3020            | 0                          |
| `claude/ward-flow-phase-5-docs`         | 17          | 3184            | 0                          |
| `claude/ward-verifier-audit-2026-09-04` | 2           | 2079            | 0                          |
| `ward-flow/publish-2026-09-06`          | 3           | 2677            | 0                          |

⚠️ **A whole-tree diff against these branches reports between 204,347 and 1,210,932 deletions.**
Every one of those is staleness, not content — a merge applies only what a branch added since its
own merge base. **The deletion count is the trip-wire, never the verdict.** It is why the two
branches on the never-fold list read "ahead": their unique files are drained issue-inbox records and
regenerated therapy-compass hashes, and not one ward file among them.

## The two that looked like real content, and were not

**`codex/ward-management-design`** (tip 2026-08-24, sixteen days stale) carries fourteen files under
`src/app/ward-management/**` — capacity, constellation, ed, exceptions, governance, movements,
network, queue, transport, ward. The master line has every one of those screens under
`src/app/mockups/ward-flow/**`, **plus handover, delays, discharges, referrals, statistics, search,
community, out-of-area, escalation, morning and hub.** The branch is the old route location. Folding
it would resurrect a dead tree beside the live one.

**`claude/Wardquestions`** carries one unique ward file,
`src/app/mockups/ward-flow/patients/[patientId]/page.tsx`. It is 13 lines against the master line's
50-line `people/[patientId]/page.tsx`, nothing on the master line references the old path, and
commit `e810ef5895` removed it **by name**: _"remove the old /patients/[patientId] route now that it
lives at /movements/[movementId]"_.

🔴 **That is the shape to remember: a branch is not behind because nobody folded it. It can be
behind because somebody read it, took what was worth taking, and deleted the rest on purpose.**
Folding on "not an ancestor" alone would have undone that decision silently, and no gate would have
gone red — the route would simply have come back.

## What this closes

The eleven ward documents that the ownership registry says live only on `claude/Wardquestions` —
including `docs/archive/ward-flow-orchestrator-handover.md` — **are already on the master line.** That
pointer is now stale in the direction that costs nothing (it sends people somewhere the file also
is), but it should be corrected when someone next edits that registry.

## What was NOT checked, and is not claimed

Branches with no ward content — caring-contacts, rag, care-plan, developer-hub and the rest. They
were excluded by name, not measured. **This document says nothing about whether they hold unfolded
work.**
