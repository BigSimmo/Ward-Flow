---
name: fixing-the-fault-removed-what-the-fallback-carried
description: "A degraded fallback can be serving a BETTER property than the correct path, so repairing the fault silently removes it — the regression arrives disguised as a fix"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-18T10:05:19.164Z
---

When a system is failing over to a fallback, check what the fallback is carrying that the
primary path is not. Repairing the primary can take that property away, and the loss is
invisible because every metric improves.

**Measured 2026-09-17.** `read_site_content_public_records` averaged 8,656 ms, so every services
search blew its budget and `readCatalogueWithSeedFallback` answered from the in-bundle catalogue.
The migration fixed the read (8,656 ms → ~80 ms). The moment it completed, `degraded` went false
and search began answering from the **published** release — the 2026-08-24 freeze, 227 services —
which predates 17 records added since. SARC stopped being the top hit for "sexual assault";
StandBy stopped being the top hit for "suicide"; "1800respect" returned nothing.

**The fallback was fresher than the source of truth**, because the bundle is rebuilt from the
repository on every deploy and the published release is frozen until someone publishes. So the
catalogue was _only_ complete while the database was broken.

**How to apply:** before shipping a fix that stops a fallback firing, diff what the fallback
returns against what the repaired path will return. Ask "what is true today only because this is
broken?" Here that question was asked before merge and the answer was crisis and suicide-postvention
services — which changed the merge from routine to something to schedule and follow immediately
with a stopgap.

Two general shapes:

- **A property that depends on a fault is not a property.** Those records were findable by luck;
  nothing held that state in place, and an incidental speed-up would have removed them at a random
  moment with nothing reporting it. That argues for fixing, then restoring deliberately — not for
  leaving the fault.
- **The metrics all improve.** Latency down, error rate down, `degraded` cleared. Nothing in the
  dashboards says content disappeared. Only a content-level before/after comparison shows it.

Related: [[adding-data-makes-an-unchanged-screen-lie]], [[an-absence-promoted-to-a-headline]],
[[a-working-safeguard-leaves-no-trace]], [[half-a-fix-can-be-worse-than-none]].
