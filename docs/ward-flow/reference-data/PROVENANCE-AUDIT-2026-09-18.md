# Sources register — provenance audit, 2026-09-18

Audit of `sources.json` (111 records). **No source was re-crawled for this audit** apart from one
link check, named below. This records what the register can and cannot tell you about its own
freshness.

## The headline finding

**You cannot ask this register "which sources are stale?" and get one answer.** Three provenance
schemas are layered in it, they cover different records, and the figure quoted in
`WARD-FLOW-MASTER-COMPLETE-2026-09-17.md` — _"47 sources inherited_not_freshly_rechecked"_ —
matches none of them as a field.

| Asked this way                                                  | Answer                                 |
| --------------------------------------------------------------- | -------------------------------------- |
| `this_pass_status === "inherited_not_independently_rechecked"`  | **24**                                 |
| `this_pass_status` present at all                               | **77** (53 re-observed + 24 inherited) |
| `this_pass_status` absent entirely                              | **34**                                 |
| string `inherited_not_freshly_rechecked` anywhere in the record | **47**                                 |
| that string as a _top-level field value_                        | **0**                                  |

The 47 is a substring match against **nested review history**, not a status. Zero records carry it
as a field. So the master document's "47 sources inherited_not_freshly_rechecked" is true as a
grep and false as a description of the register's state, and a reader who queries the obvious field
gets 24 instead.

⚠️ **The 34 with no `this_pass_status` are the ones that should worry you most.** They are not
recorded as fresh _or_ stale — their freshness is simply unrecorded. They use a different schema
(`verification_status_2026_09_17`, `freshly_checked_fields`, `retrieved_on_2026_09_17`,
`review_observation_2026_09_17`). Example: `N-OA-CATCH`, the undated NMHS older-adult suburb table
that 112 catchment rows rest on.

⚠️ **A field name with a date baked into it can never be current.** `verification_status_2026_09_17`
was accurate for one day. The next review pass must either invent
`verification_status_2026_09_18`, leaving two fields that disagree, or overwrite a field whose name
says it describes the 17th. Neither is safe. The date belongs in the value, not the key.

## The one thing verified and fixed here

`E-CENSUS` — the EMHS consultant-psychiatrist recruitment profile — **returns HTTP 404.** Checked
2026-09-18 by direct GET following redirects. Its record now carries `link_check_2026_09_18` and
`primary_status: "RETIRED_AS_PRIMARY"`.

> 🔴 **IT IS A SOFT 404, WHICH IS WHY NOBODY CAUGHT IT SOONER.** The dead URL still returns roughly
> 99 KB of HTML, and the body still matches `/consultant psychiatrist/i`. Any link check that reads
> the page for expected words calls it alive. **Only the HTTP status discriminates.** If the
> remaining 110 sources are ever link-checked, check the status code, not the content.

Its 2026-09-12 re-observation is left in place. That is a record of what somebody read then, and it
is not evidence the page is reachable now — the two are different claims and the record now says
so. Every capacity figure resting on this source still needs a living primary: the EMHS chain
(Bentley adult 50, Armadale 33, Mount Lawley 12, TCU 40, RPH total 26, network 166).

## What was NOT done, and why

**The three schemas were not normalised.** Doing it means assigning a freshness status to 111
records, and the only honest status for most of them is one I would be inventing — I did not gather
this research and have not re-checked the sources. Normalising would convert an obvious mess into a
tidy register that reads as verified. The mess is currently the honest signal.

**The other 110 links were not checked.** One GET is a routine hygiene step; 110 is a crawl, and the
soft-404 finding above means a crawl needs designing (status codes, not keywords) rather than
firing off.

**No source was re-crawled.** Everything here is an audit of the register's own structure.

## Recommended, in order

1. Retire the date-suffixed field names in favour of one `freshness` object per source, carrying
   `status`, `checked_on` and `method`. One field, one question, one answer.
2. Link-check all 111 by **HTTP status**, and record the status per source. Budget for soft 404s.
3. Give the 34 unstatused records a status, or say in the pack README that the register covers
   77 of 111 and which 34 it does not.
4. Stop quoting "47" until it means something. Quote 24, or quote 34, and say which question it
   answers.
