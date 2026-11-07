---
name: every-reviewer-can-be-down-at-once
description: All four automated reviewers can fail simultaneously on quota, so a PR reaches all-green CI with zero review coverage - and the failures look like ordinary bot chatter
metadata:
  node_type: memory
  type: project
---

On PR #2856 (2026-09-17) all five "review comments" were reviewers reporting they had NOT reviewed:

- **Codex** - "You have reached your Codex usage limits for code reviews."
- **Cursor Bugbot** - "usage limit reached" (posted twice, two request ids)
- **CodeRabbit** - skipped: "This repository does not receive automatic reviews because it has
  fewer than 10 stars."
- **Supabase** - ignored the PR (no `supabase/` changes; that one is genuinely informative)

**Why this is dangerous rather than merely annoying:** CI was 13 green / 0 failing, and the review
notification LOOKED like feedback arriving. Nothing anywhere says "this PR was reviewed by nobody".
The absence is only visible if you read five bot notices that resemble routine chatter and notice
that each is a refusal. See [[a-working-safeguard-leaves-no-trace]] and
[[broken-and-never-worked-look-identical]].

**It compounds with auto-merge.** Auto-merge was armed on that PR, so all-green would have merged it
unreviewed, and merging main auto-deploys. Quota exhaustion is not a per-PR event either - it
persists until credits are added, so EVERY PR in that window is unreviewed the same way.

**What to do:** when relaying CI as green, state review coverage separately and explicitly -
"13 checks green; zero automated review, all four reviewers were out of quota" - never let green
checks stand in for review. Also note the two Cursor _checks_ (Approval Agent, Security Agent) go
**NEUTRAL** rather than failing when the quota is gone, and NEUTRAL is not SUCCESS: that is a
candidate explanation for a PR sitting at `mergeStateStatus: BLOCKED` with nothing red.
See [[checks-that-cannot-fail]] and [[a-clean-result-from-measuring-nothing]].
