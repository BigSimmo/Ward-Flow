# Tier 1–4 improvements: implementation index

Audience: implementers and owner. Status: approved implementation plan, not a release verdict.
Owner: this task. Baseline: `559f225892b27b6c42bd7e9a6fa81f3ef81e62ec`.
Source: the owner-supplied stress-tested PDF and the decisions in this task.

## Decisions

- Recover opaque command identities only. Never persist command bodies or shared form drafts.
- Warn honestly when unsent content cannot survive reload; never repeat unknown actions automatically.
- Stale means five minutes since the last successful refresh, including on TV.
- Ask before voluntary sign-out with waiting changes; forced session expiry remains immediate.
- Return only to an authorised screen after sign-in, without queries or record addresses.
- Use existing alert ownership and access scope. Keep authorised act-now alerts visible.
- Preserve historical documents. Licence enforcement awaits review of the actual inventory.
- Josh owns operational alerts; email is the intended channel. Downtime wording is a draft.
- Native screen-reader and live-service acceptance are separate from local automated evidence.
- Do not edit `ward-screen.tsx` or `shortlist-panel.tsx` or raise script budgets.
- The original local-only stage was extended by the owner on 5 November to a feature-branch
  publication and draft PR into `main`. Release and deployment remain separate.

## Delivery sequence and acceptance

| Stage | PDF IDs                    | Deliverable and acceptance                                                                  |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 0     | AUD, Z2, O1                | Reconcile actual source, keyboard and Undo gaps; retain historical links.                   |
| 1     | N1                         | Separate demo seeds from shared runtime imports; measure all phone routes.                  |
| 2     | A1, B1, U1                 | Ordered metadata-only receipt recovery; actor/workspace isolation and real reply contracts. |
| 3     | C1, C2, A2, X1, Q1         | One accessible recovery/freshness surface, bounded polling and safe session return.         |
| 4     | B2, E2                     | Precise own-command review and guarded, confirmed Activity Undo.                            |
| 5     | D1, V1, R1, L1             | Panel isolation, scrubbed opt-in diagnostics and validated API boundaries.                  |
| 6     | G1, J1, L3, N2             | Print, Perth time, keyboard and tap-area corrections with focused evidence.                 |
| 7     | H1, H2                     | Role defaults and in-app digest using existing scoped data.                                 |
| 8     | Z1, O2, P2, K1             | Ratchets, safer switches, licence inventory and offline migration-policy checks.            |
| 9     | F1, M1, N3                 | Four registered journeys, outcome assertions, screenshots and advisory slow-phone baseline. |
| 10    | W1, Y1, T1, P1, R2, I0, V2 | Operational drafts, local rollback rehearsal, PR guidance and owner setup/acceptance.       |

Use [the evidence record](../evidence/2026-11-04-tier-improvements.md) for actual status.
An implementation, passing local checks, owner acceptance, hosted CI and release are distinct states.

## Explicit exclusions and missing information

I1 handover implementation, item 91 monthly exports and item 97 integrations remain held.
The PDF refers to Tier 4 items 19–23 and 25 without descriptions: the owner deferred them on
5 November 2026. They remain unassessed, not completed. NVDA, VoiceOver, physical devices, telemetry activation, uptime-token setup,
alert delivery, hosted PostgreSQL and release need their own observed acceptance.

## Historical context

The [historical remaining-work document](../../history/ward-flow-remaining-work.md) and
[historical task ledger](../../ward-flow-task-ledger.md) remain preserved. They are leads,
not a current defect list. Existing provider, persistence and clinical rules remain authoritative.
