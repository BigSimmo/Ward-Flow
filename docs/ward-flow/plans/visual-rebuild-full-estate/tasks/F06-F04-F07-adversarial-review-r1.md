# F06 + F04/F07 adversarial source review r1

Date: 2026-09-13  
Scope: read-only comparison of the F06 Network/Governance and F04/F07 referral/Add Patient
deliveries against their authoritative `before-F06/` and `before-F04-F07/` snapshots and
implementation reports. No tests, browser, server, source edits, or Git mutation.

## Verdict

No concrete source defect found in this bounded review.

Network defaults to the overview tab, keeps the placement workspace as a hidden state-preserving
tab, and reuses provider-backed pressure/flow/placement derivations and existing actions. The
overview does not feed ED selection back into network-wide figures. Governance exposes recorded
overrides and session access facts while explicitly stating that review status, gate identity,
reviewer identity, reviewer reason, and network-wide access history are absent; no fabricated
review counters or actions were found.

The referral stylesheet's new third-edition rules are gated for the intake/register roots, while
the existing shared selectors used by ReferralMatch remain available when Match is mounted inside
the register. Queue ordering, selection, refusal/cancellation detail, candidate eligibility,
override/decline controls, and disabled/unavailable states remain present. The intake preserves
its structured questions, destination validation, free-text warnings, progress, and Send behavior.

Add Patient retains the required field order, optional Gender absence state, duplicate matching,
whole-board sample, unavailable-submit explanation, ADD_PATIENT dispatch, rejection handling, and
post-create navigation. No literal-dollar interpolation or misleading numeric output was found.

## Evidence boundary

The before snapshots are the valid baselines. This is source-only evidence: semantic keyboard
activation, responsive layout, dark/forced-colors rendering, print output, and runtime state
transitions remain controller-owned verification items. Static parsing claims in the implementation
reports were not repeated here.
