# Tier improvements: operational acceptance draft

Audience: Josh and prototype demonstrators. Status: draft for owner review, not an approved hospital procedure.
Owner: Josh. Source: the approved [implementation plan](2026-11-04-tier-improvements.md),
checked-in runbooks and source at `559f22589`. All exercises use synthetic data.

## Downtime, return and reconciliation — W1

1. Treat a lost connection, failed save or five-minute stale indication as a reason to check the
   current state. A working page is not proof that a write was accepted.
2. Josh coordinates a prototype outage. For an operational hospital deployment, the organisation
   must supply its own named escalation contacts, authority, paper process and approval first.
3. Keep the page open while changes wait. Retry uses the same command identity. After reload,
   receipt checks can confirm a sent change, but cannot restore unsent content.
4. In an agreed synthetic exercise, record intended changes in the downtime pack, with exercise
   time, action and responsibility. Do not put real records into the prototype or its issue tracker.
5. On recovery, confirm access, the latest successful refresh and each uncertain receipt. Compare
   intended actions with the current board. Do not blindly replay a downtime list or overwrite a
   later decision. Escalate a missing, expired, partial or conflicting outcome to the exercise owner.
6. Josh confirms reconciliation and the end of the exercise. The hospital version needs locally
   reviewed wording and a real call tree; this draft supplies neither authority nor clinical assurance.

## Release and rollback — Y1

The existing [operations runbook](../OPERATIONS-RUNBOOK.md) owns the reviewed-revert procedure.
Before any authorised release, record the exact repository, candidate, tests, phone budgets,
staff note, schema compatibility, smoke-test result and rollback owner. A migration rollback needs
its own consequence review; reverting application code does not revert a database.

Rehearse locally only: create a disposable branch from a named commit, apply a harmless synthetic
change, commit it, revert that commit with a new commit and compare the resulting tree with its base.
Keep both commits as evidence. Do not reset shared history, push the rehearsal or redeploy staging.
The local rehearsal in [the evidence record](../evidence/2026-11-04-tier-improvements.md#local-reviewed-revert-exercise--y1)
completed with an identical resulting tree; hosted rollback remains unverified.

`main` is the candidate source; `live` is the release branch. The daily workflow, not a direct push,
moves `live`. A local build, green CI, merge, branch movement and observed deployment are separate
proof states. Do not start a release or rollback without the corresponding authority.

## Environment names — T1

| Name                                     | Meaning                                                         | Evidence still needed                                             |
| ---------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Local task server                        | Synthetic development process and its project-identity endpoint | Current checkout and returned identity                            |
| Candidate `main`                         | Integrated source awaiting the release process                  | Exact commit and required checks                                  |
| Released `live`                          | Source selected by the daily release workflow                   | Release identity and observed application                         |
| Provider service containing “production” | A configured service name, not an assurance category            | Verified account, resource, branch, active and pending deployment |

Keep existing provider names; no rename or settings change is commissioned here.

## Alert ownership and uptime — R2, V2

| Signal                              | Owner / intended channel                            | First response                                           | Acceptance                                                   |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Shared backend/database unavailable | Josh / email through the configured monitoring path | Check exact service, dependency and incident times       | Authenticated monitor result and observed alert delivery     |
| Application server exception        | Josh / email through Sentry rules                   | Correlate request ID, class, release and source          | Scrubbed synthetic event plus receipt by owner               |
| Browser exception, when opted in    | Josh / email through Sentry rules                   | Inspect class and safe built-asset coordinates           | Both reporting switches, rate limit and synthetic delivery   |
| Release-gate or flaky test failure  | Josh / repository checks                            | Reproduce on the same head and fix or record the blocker | Passing applicable gate; no retries or quarantine to hide it |

Josh configures the same `WARD_FLOW_UPTIME_TOKEN` in the Ward Flow backend environment and
the `BigSimmo/Ward-Flow` repository's Actions secret through their approved secret interfaces;
never paste its value into chat, documents or logs. Confirm the exact backend and account first.
The monitor sends it as `x-ward-flow-uptime-token` to `/healthz`. Acceptance requires an observed
`database: ok` answer. A missing database answer means the token is absent or mismatched: the
workflow reports an unknown result and can finish green without checking the database.
Record the authenticated database answer and separate observed test-email receipt. A configured
token or green run alone proves neither. Test alerts, provider reads and workflow runs require
applicable authority and any spending admission. No delivery is activated by this document.

## Licence review — P2

The pinned lockfile inventory flags 16 production/optional package entries for owner review:
Sharp/libvips platform binaries include LGPL expressions, `caniuse-lite` declares CC-BY-4.0,
and backend `web-push` declares MPL-2.0. Platform variants are separate lock entries.
`npm run check:licences` is advisory in CI; `--enforce` refuses these entries. No exception has
been silently approved. Review distribution obligations and pin any explicit exception with its
reason before enabling enforcement. Development-only packages are outside this production inventory.

## Handover design only — I0

Reuse the [existing handover design](../../history/plans-2026/2026-11-01-handover-redesign.md). A future build must name the
authorised author, receiving desk, source revision, recorded time, item identity, storage lifetime,
correction history and explicit sign-off meaning. The current role/access engine remains the
authority for visibility and actions; a sign-off cannot stand in for a clinical decision.

Typed notes need their own privacy/storage review before implementation. Do not add them to
browser recovery, diagnostic events, URLs or the digest. Agree whether sign-off is per item or per
handover and what a later correction does before commissioning I1. This task delivers the design
questions and constraints, not a new notes schema or handover feature.

## Owner acceptance checklist

- [ ] Review the downtime wording, reconciliation and hospital-process boundary.
- [ ] Review actual licence exceptions before enabling enforcement.
- [ ] Confirm contacts, reporting configuration and synthetic alert delivery through authorised tools.
- [ ] Complete NVDA, VoiceOver and physical-device acceptance.
- Deferred by the owner on 5 November 2026: unnamed Tier 4 items 19–23 and 25 need descriptions before assessment.
- [x] Draft PR publication authorised on 5 November 2026; automatic Railway PR environments confirmed disabled.
- [ ] Authorise release separately after remaining acceptance.
