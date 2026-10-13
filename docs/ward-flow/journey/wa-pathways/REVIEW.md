# WA mental health pathways: detailed wireframe review

Task: `01a11902-8a33-7663-9fde-058cdaf3063b`. Owning project: Ward Flow.

Open [the revised interactive wireframe](explorer.html). It is a self-contained local HTML
diagram with no external assets, patient records or service calls. It works without the app.
The original [Journey Explorer](../ward-journey-explorer.html) is preserved.

This is a **review design**, not an operational clinical pathway or proof that Ward Flow
implements these routes. It covers statewide mental health service categories, with interfaces
to general medical care, AOD care, housing, aged care, justice and services outside WA.

## Current continuation — 13 October 2026

The master map now opens first and occupies the main viewport, with side inspection, section
jumps, an overview navigator, focused viewing, consistent zoom and keyboard controls. Original
111-box geometry/symbols and 161 paths remain. Current project evidence is shown beside the
retained source wording. The wider register now has 48 categories, 469 links, 42 references,
2,304 ordered pairs and 11 illustrative examples. This continuation adds 60 links: 27 documented
families and 33 proposals. The earlier 8 October counts and findings below are retained as history.

Read [the current design, live-project and pathway review](LIVE-AND-DESIGN-REVIEW.md) for exact
findings, source limits and verification scope. The deployed synthetic UI was reviewed read-only;
local source/test evidence is separate from deployed revision and service-acceptance proof.

## What changed

The old diagram is an engine-centred source map: referrals, bed decisions, movements,
transport, admission records and their actions. Its source snapshot includes 111 map boxes,
98 action descriptions and 11 state-machine diagrams. The connection audit statically matches
98 role-map labels and 98 distinct reducer case labels to the catalogue; this does not establish
complete guard, caller, UI or runtime behaviour. This review inspected the existing source;
the old file-protocol page could not be inspected with the browser tool's URL policy.

The broader WA model distinguishes **physical location**, **care responsibility** and
**legal status**. A contact with a triage line, consultation with a specialist, community
treatment order, temporary leave and episode closure are not interchangeable physical moves.
Clinical/support services can work in parallel. Hospital in the Home is distinct from ordinary
community care and from a Step Up/Step Down residence.

The revised controls retain the original diagram style alongside the detailed WA views:

- **Overall journey:** the original symbol-based central sequence, with stalls/endings on the
  left, diversions/parallel records on the right and the person/bed exit tracks shown separately.
  Every main step opens its original box in the master map.
- **Master map:** all 111 original boxes and 161 original connections, with their original
  positions, lane colours and SVG symbols. Fit-width, whole-map, readable-size and zoom controls
  are explicit. Search highlights without removing branches; selecting a box shows its source
  wording and neighbours. Nine source-supported continuations form a purple dashed audit overlay;
  all eight existing double-arrow return directions are now included in the neighbour list.
  The overlay can be hidden. Remaining historical defect wording is unvalidated.

The detailed WA views remain available:

1. **Care map:** search for a place/team/outcome, select it, and see all explicit incoming
   and outgoing links. A small connected example introduces the overview without implying
   that everyone follows that route.
2. **Trace a journey:** choose a starting point, add a conditional next step, open its
   interaction details, undo or reset. Nine illustrative journeys include leave/return,
   country transfers, home treatment, forensic interfaces and parallel AOD care.
3. **All connections:** search/filter the complete register, open the conditions and export
   either routes or every ordered pair. Pagination states exactly how much is visible.
4. **Review & sources:** entry families, legal decision families, exceptions, interaction
   checklists, sources and remaining gaps. A phone-sized connection opens in a native modal
   with a clear return control and keyboard focus restoration.

## Finite coverage, without an unsupported claim of perfection

The model has **40 categories, 409 explicit conditional links, 18 entry families, 10 legal
decision families, 14 exception families and eight interaction checklists**. It retains
reassessment, re-entry, self-category transfers, leave and return loops. It includes planned
discharge, shared follow-up, external handover, declined/disengaged care, unknown whereabouts
and confirmed death as distinct outcomes or circumstances.

[The route register](pathways.csv) lists each link and its conditions.
[The ordered-pair register](connections.csv) covers all **1,600 category pairs**, including
same-category pairs. Every pair has a disposition and explanation, with a pair checker in the
Review & sources view. Unconfirmed direct interfaces remain unconfirmed; they are not impossible. A route count is not a count of distinct lifelong patient journeys:
loops can repeat indefinitely.

**WA pathway family** means a public WA source explicitly describes that type of pathway.
It does not guarantee local service availability, acceptance or eligibility. **Design
connection** means an inferred/proposed interface requiring local confirmation; it may cite
service-category context without claiming that the cited document authorises the exact link.
No combination of drawn edges is a clinical recommendation or legal authority.

See [the connection audit](CONNECTION-AUDIT.md) for the 116 added WA links, nine added
master connections, unresolved interfaces and evidence limits. Downloadable registers include
[added links](connection-audit.csv) and [master connections](master-connections.csv).

## Research basis and outstanding operational detail

The 30-reference source register in [data.mjs](data.mjs) and the wireframe preserves direct
official links, findings, access date and limitations. It includes WA Health, MHC, WACHS,
CAHS, NMHS, SMHS, the Chief Psychiatrist, WA legislation, MHT and MIRT. The review date is
8 October 2026. Some sources were accessible only as official search-index excerpts; these
are explicitly identified. Historical documents and current-index pages are not presented
as a full current policy audit.

Decisive examples:

- [MHC Step Up/Step Down](https://www.mhc.wa.gov.au/our-initiatives/our-projects/step-up-step-down-services)
  distinguishes community support to avoid hospital from support after hospital.
- [SMHS Hospital in the Home](https://smhs.health.wa.gov.au/Our-services/Mental-health/Peel-and-Rockingham-Kwinana/Mental-Health-Hospital-in-the-Home)
  supports a distinct admitted treatment setting at home.
- [WACHS interhospital transfer policy](https://www.wacountry.health.wa.gov.au/~/media/WACHS/Documents/About-us/Policies/Assessment-and-Management-of-Interhospital-Patient-Transfers-Policy.pdf?thn=0)
  separates specialist assessment, accepting service, patient-flow and transfer coordination.
- [NMHS forensic services](https://www.nmhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health/Forensics)
  covers inpatient, rehabilitation, community, diversion and custody-based care.
- [Missing/AWOL policy](https://www.health.wa.gov.au/About-us/Policy-frameworks/Mental-Health/Mandatory-requirements/Mental-Health-Consumers-Who-Are-Missing-or-Absent-Without-Leave-Policy)
  supports keeping absence and its response separate from a planned discharge.

**Unresolved:** full current statewide bed-access/escalation policy, HSP/direct-admission rules,
current complete statutory/forms detail, private contracts, forensic authorisations,
site-specific age/catchment rules, current activity coding, cross-border agreements and local
housing/emergency plans. The wireframe records these gaps rather than inventing statutory
durations, automatic recall powers, bed-release times or operational service availability.
It does not assume announced services are already open. A facility-by-facility pathway audit
would need the current service-owner documents, not a universal grid inferred from public pages.

## Rebuild and local checks

Run from the isolated Ward Flow checkout:

```text
node docs/ward-flow/journey/wa-pathways/verify.mjs
node docs/ward-flow/journey/wa-pathways/build.mjs
node docs/ward-flow/journey/wa-pathways/build.mjs --check
```

The structural verifier checks unique IDs, known endpoints/sources/interaction types,
conditions on every edge, inbound/onward coverage, nine valid example sequences and 16
required transition families. It does not establish clinical correctness. Generation includes
an input SHA-256, branch, original-source counts and the base revision.

For a temporary loopback-only preview of the new artefacts:

```text
node docs/ward-flow/journey/wa-pathways/preview.mjs
```

It chooses a free port, prints its URL, exposes a task/project identity endpoint, permits
only the newly authored diagram and CSV files, and stops after 45 minutes. It never serves
arbitrary workspace files. The normal `npm run ensure` command was attempted in this isolated
checkout and failed because Next dependencies are absent. No packages were installed.

Base: `ce1f865ba1cdd2983245b5ca072a230977f14000` (cached `origin/main`).
Worktree: `D:/Worktrees/WardFlow/wa-mental-health-wireframe-20261008`.
Branch: `codex/wa-mental-health-wireframe-20261008`. Both remotes identify
`BigSimmo/Ward-Flow`. The original checkout's unrelated dirty work is preserved.

Local visual/interaction evidence and final source hashes are retained in the same task's
private checkpoint and evidence folder. Notion reconciliation was not performed. No app
integration, publication, hosted CI, merge, deployment, backend action or live-patient use
was requested or performed.
