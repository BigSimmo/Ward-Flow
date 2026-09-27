# Build contract — Ward Flow "Transport officer"

Drawing: `docs/ward-flow/mockups/transport-officer-third-edition.html` (7,060 lines)
Route measured: `src/app/mockups/ward-flow/transport/officer/page.tsx` → `OfficerScreen`
(`src/components/ward-management/officer/officer-screen.tsx`). **This screen already exists** —
this is a three-way diff, not a from-scratch build.

Note on the parent route: `src/app/mockups/ward-flow/transport/page.tsx` is a **deliberate 307
redirect** to `/mockups/ward-flow/movements` (MERGE 03, `transport/page.tsx:1-18`, owner-approved
2026-09-05). It is unrelated to this contract — `transport/officer` is a separate, nested route
that Next.js resolves independently of its parent (`transport/page.tsx:11-14`), and the brief's
"Route today" points at the officer sub-route, which is the one with a drawing.

## 0. 🔴 Does the model hold a transport officer at all — any person, name, number, shift, vehicle?

**No. Confirmed by reading the type, not by grepping for expected names.**

`TransportJob` (`ward-model.ts:561-607`) has exactly these fields: `id`, `provider`
(`TransportProvider`, `ward-model.ts:558`, one of `"Ambulance service" | "Patient transport
service" | "Ward escort"` — an **organisation**, never a person), `escortRequired: boolean`,
`formRequired?: string`, and the four stage stamps `acceptedAt`/`enRouteAt`/`collectedAt`/
`arrivedAt`, plus `cancelledAt`. **No name field. No phone/pager/extension field. No shift or
roster field. No vehicle field.** `Movement` (the record that owns a `TransportJob`) carries no
second staff concept either — its own `owner: string` field is a role/function label
(`"ED mental health team"`, `"Flow coordinator"`), not a name, and is unrelated to transport.

The one adjacent place a vehicle is even _mentioned_ in the codebase is prose, not data:
`Movement.blocker`'s own doc comment (`ward-model.ts:950-952`) names "a specialling roster, an
escort provider organising a vehicle" as an example of the kind of fact this free-text field
**cannot** structurally represent — cited as the reason `blocker` stays a hand-authored string
rather than a constrained enum. That comment is evidence there is _no_ vehicle field, not evidence
of one.

This matches the closely-related on-call/contacts screen's own finding
(`contract-on-call.md:43-55`, "the model holds NO staff concept whatsoever") almost exactly, with
one difference: on-call found a role-label convention (`Movement.owner`) elsewhere in the model;
transport has the same convention (`TransportProvider`) but it is even narrower — three fixed
organisation names, not even free text, so there is no path by which a person's name could ever
end up in this field by accident. There is nothing here to extend "toward" a real roster; a
roster does not exist in any partial form.

**Consequence for the honesty rule:** any name, phone number, shift or vehicle rendered on this
screen would be 100% invented, with no field in the model it could plausibly be read from. The
current built screen already gets this right (§2 below) — it renders no such thing, and says so.

## 1. The drawing's own admission

The drawing's engine comment (`transport-officer-third-edition.html:4727-4750`) states its ground
truth explicitly:

> "Ground truth: src/app/mockups/ward-flow/transport/officer/page.tsx and
> src/components/ward-management/officer/officer-screen.tsx... That screen shows every transport
> job not yet arrived on an open movement, never a filtered 'my jobs' list, because the model
> carries no officer identity: a transport job records an organisation, never a person."

and again in the redesign comment (`:4423-4432`):

> "THE PHONE FORM. Every job's identifier, route, stepper and facts stay visible at every width
> (spec: 'shows every job')... Only the control row changes: the active job shows the one next
> action as a loud primary control (6.13: one primary per panel), every other job shows a plain
> 'Work this job' control."

So the drawing is not a blind redraw — it names the real component, names the real constraint, and
proposes one specific redesign of the control row: collapsing the four always-visible action
buttons into one primary "next action" button plus a four-stage progress stepper, citing the
design system's "one primary per panel" rule (§6.13) and citing an existing in-app precedent,
"Movement's own destination panel" (`record-preview.tsx`).

## 2. Three-way diff

### IN BOTH

| Element                                                                                                                                    | App                                                                   | Drawing                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Honesty banner: no officer identity in the model, shows every job                                                                          | `officer-screen.tsx:233-241`, `data-testid="ward-officer-governance"` | `qNote` text, `:5234-5235`, byte-for-byte the same sentence                                                         |
| Refusals surface (persistent, not a toast, newest first)                                                                                   | `officer-screen.tsx:261-275`, `data-testid="ward-officer-refusals"`   | `#refusalsPanelEl`/`#refusalsBody`, `:4695-4702`, `:5255-5283`                                                      |
| Per-job fields: id, elapsed, origin department, destination unit/"no accepted destination", provider, escort required, transport form      | `officer-screen.tsx:311-343`                                          | `jobCardHtml`, `:5185-5230`                                                                                         |
| "No transport job... every job on record has arrived" empty state                                                                          | `officer-screen.tsx:277-280`                                          | `emptyReason()`, `:5138-5149` (worded slightly differently, same fact)                                              |
| Real WA site/unit names for origin and destination                                                                                         | `ward-sites.ts` via `edById`/`units.find`                             | drawing's own comment, `:4746-4747`: "Hospital sites, units and health services are the repository's real WA names" |
| `TRANSPORT_PROVIDERS`'s three real provider values, nothing invented beyond them                                                           | `ward-model.ts:558`                                                   | drawing's own comment, `:4747-4749`: "Providers are the model's own three"                                          |
| The four blocked-reason predicates' own wording ("already accepted", "cannot go en route before...", "no physically empty bed remains...") | `officer-screen.tsx:73-141`                                           | `nextAction()`, `:4975-4986`, explicitly said to mirror them "in the same order"                                    |

### DRAWING ONLY

| Element                                                                                                                                   | Drawing                                                 | Built?                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Four-stage visual stepper per job card (`role="img"`, done/now/todo bars, visible stage line)                                             | `stepperHtml`, `:5165-5184`                             | **YES** — built this task, see §3                                             |
| Single primary "next action" button replacing the four-button row, with the completed stages folded into the stepper                      | `jobCardHtml`, `:5201-5227`, cites §6.13                | **NO** — see §4, this conflicts with a pinned test and a design-lock decision |
| Full desktop shell chrome: rail, universal header, service filter, search, Activity/Tasks/Tools drawers, "New" menu, laptop-locked layout | `:2285-2303` shell CSS block, `:5975-7060` shell script | **NO** — see §4, conflicts with a locked owner decision                       |
| Task-drawer filters (awaiting acceptance / accepted / en route / collected / blocked, each a job-list filter with a count)                | `TASKS`, `:5011-5063`                                   | **NO** — depends on the shell's Tasks drawer, not built (see §4)              |
| Service (health-service) scoping of the job list                                                                                          | `state.svc`, `inSvc()`, `:4949-4957`                    | **NO** — depends on the shell's service selector, not built                   |
| A reconciliation/tally page ("Jobs by stage" table, summed against the total)                                                             | `PAGES.movement`, `:5369-5404`                          | **NO** — depends on the shell's tally surface, not built                      |
| A local search box over job id/origin/destination, with an explicit refusal sentence for a risk/acuity/best-match query                   | `refusalOnSearch`, `:5003-5009`                         | **NO** — depends on the shell's search, not built; see note below             |

### APP ONLY — 🔴 the dangerous list, and what happened to each

| Element                                                                                                                                                                                              | Where                                    | Kept?                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The four always-visible, individually-gated action buttons (Accepted / En route / Collected / Arrived), each with its own `aria-disabled`, `title`, and `aria-describedby` sr-only reason            | `officer-screen.tsx:346-452`             | **YES, KEPT, untouched.** See §4 — this is pinned by a committed Playwright test titled "gives the officer four actions and nothing else" (`tests/ui-ward-roles.spec.ts:207-228`), which asserts `job.getByRole("button")` has count **exactly 4**. The drawing's own one-primary-button redesign would break that test outright. Not built. |
| `isOfficerJob`'s three-condition filter (transport exists, not arrived, not closed) and its own governance comment explaining why stage is deliberately ignored                                      | `officer-screen.tsx:182-186`, `:194-211` | **YES, KEPT, untouched.**                                                                                                                                                                                                                                                                                                                    |
| `officer` as its own standalone `WARD_NAV` entry, outside `WardModeWorkspace`/the rail-driven mode system entirely                                                                                   | `ward-nav.ts:269`                        | **YES, KEPT.** Confirms this screen has never been, and is not becoming, a rail-shell page — see §4.                                                                                                                                                                                                                                         |
| `OFFICER_ACTION_REJECTION_LABELS`, scoping the refusal surface to exactly the four events this screen dispatches (a deliberate anti-token, anti-referral-id filter)                                  | `officer-screen.tsx:41-46`               | **YES, KEPT.**                                                                                                                                                                                                                                                                                                                               |
| Exported `acceptedBlockedReason`/`enRouteBlockedReason`/`collectedBlockedReason`/`arrivedBlockedReason`, driven end-to-end against the reducer by `tests/ward-officer-blocked-reason-parity.test.ts` | `officer-screen.tsx:73-141`              | **YES, KEPT, untouched** — the new stepper reads these same four values rather than recomputing anything, so the parity test's guarantee still covers what the stepper displays.                                                                                                                                                             |
| The phone-pinned action bar (`position: fixed`, safe-area inset, no non-zero `bottom` gap)                                                                                                           | `officer.module.css:228-268`             | **YES, KEPT, untouched.**                                                                                                                                                                                                                                                                                                                    |

## 3. What was built this task

**One addition, fully additive, no shared file touched:**

A four-stage transport-leg stepper (`officer-screen.tsx`: `OFFICER_LEG_STEPS`, `officerLeg`,
`nextActionVerb`, and the render-loop block computing `leg`/`legIndex`/`stepBlockedReason`/
`stepStatusText`; `officer.module.css`: `.stepper`/`.stageBar`/`.stageLine`), rendered on **every**
job card (active or not), between the job's header line and its facts list.

- It reads `transportLeg(transport)` (`ward-derivations.ts:491-499`) — a value the screen already
  computed and rendered as inline text (`officer-screen.tsx:314`, unchanged) — and reuses the
  **same** `acceptedBlocked`/`enRouteBlocked`/`collectedBlocked`/`arrivedBlocked` values the
  existing four buttons already compute, picking whichever one corresponds to the job's current
  leg. It introduces no second, independently-computed guard.
- It mirrors an **existing, already-built, already-tested** in-app pattern exactly:
  `record-preview.tsx:270-306` / `search.module.css:696-744` (`role="img"` bar carrying the full
  sentence, a visible `.stageLine` repeating it in text, per design-system §6.11's rule that a
  progress bar is never the sole carrier of the stage it shows). This is the same pattern the
  drawing itself points at ("reusing the stepper... exactly as [it renders] on Movement's own
  destination panel," `:5158-5163`) — so building it means conforming to an app-wide convention
  already in force, not inventing a new one.
- It invents no data: every value it displays (`leg`, the next verb, whether that next action is
  blocked, and why) is derived from the real `Movement`/`TransportJob` already on screen.
- Verified additive, not replacing anything: `stepper.querySelectorAll("span")` and
  `within(stepper).queryAllByRole("button")` in the new test confirm the stepper contributes zero
  buttons, so the pinned "four actions and nothing else" count is untouched.

## 4. 🔴 What was found to be wrong / in conflict, and NOT built

Two pieces of the drawing directly conflict with decisions already in force in this codebase, not
merely omissions:

1. **The single-primary-button redesign contradicts a real, currently-green, committed test.**
   `tests/ui-ward-roles.spec.ts:207-228` ("gives the officer four actions and nothing else")
   asserts the active job card renders **exactly four** buttons, each ≥48px tall, "pinned and
   reachable without scrolling" — worded as a deliberate design choice, not an incidental count.
   Collapsing to one primary button plus a stepper (as the drawing proposes and as its own comment
   frames as "the redesign the phone form needed," `:4429`) would fail that test outright. Per the
   common brief §3 ("APP ONLY... must SURVIVE") and §7 (I must not run Playwright, but must not
   knowingly break a committed one either), I did not make this change. **This is a genuine
   drawing-vs-app disagreement, not a build gap** — flagged for the owner/controller rather than
   resolved by picking a side.

2. **The full shell wrap (rail, header, search, Activity/Tasks/Tools drawers, service filter,
   tally page) contradicts a locked owner decision.** `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md:29-31`,
   status LOCKED 2026-09-05:

   > "`transport/officer` survives untouched... It is a different person doing four things on a
   > phone; folding it in would ruin the one screen that must work one-handed."

   `ward-nav.ts:269` confirms this is still current: `officer` is its own standalone nav entry,
   never routed through `WardModeWorkspace`/the rail-driven mode system the other sixteen
   third-edition screens use. Building the drawing's shell wrap would mean editing the rail and
   shared registries — explicitly forbidden by the common brief §1 ("STOP, do not edit it, and
   hand back the exact edit required") — **and** would reopen a decision the owner has already
   locked shut for the opposite reason the drawing assumes. Not built, and not something a
   screen-scoped agent should build even if the shared-file constraint were lifted, without the
   owner first being asked whether the 2026-09-05 lock still holds against this later drawing.

Because the full shell is unbuilt, everything that depends on it (service scoping, task-drawer
filters, local search, the reconciliation/tally page) is also unbuilt — not because each is
individually unbuildable, but because building any of them as a **local, duplicated** re-implementation
inside this one phone screen (rather than via the real shared shell) would violate the "one owner"
principle the search-chrome rules apply elsewhere in this app, and would need the owner's
resolution of finding 1 first in any case.

## 5. What cannot be built honestly

Nothing new. The existing screen's honesty posture (§2, "IN BOTH") already covers the only hazard
this screen carries — inventing an officer identity — and both the app and the drawing agree on
how to handle it: state plainly that none exists and show every job instead of a filtered one. The
stepper added this task introduces no new figure that could be wrong; every value it shows is one
the screen already computed and already trusted enough to gate a real button on.

## 6. Which owner decisions bind it

- **The 2026-09-05 design lock** (`docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md:29-31`) —
  binding, and in tension with the drawing's shell wrap. See §4.2.
- **The changeable-data rule** (implicit here rather than newly triggered): nothing on this screen
  is changeable/invented data requiring a disclosure marker, because nothing invented is rendered.
- No owner ruling specifically names "transport officer" beyond the design lock above (searched
  `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` for "officer"/"transport" — no hits; the design
  lock document is a separate file under `docs/superpowers/specs/`).

## 7. The catcher

`tests/ward-officer-stepper.dom.test.tsx` (new), driven against the real seed (`WF-005`:
`transport.acceptedAt` set, no later stamp, per `ward-movements.ts:211-217` — a real fixture value,
not invented for the test):

1. The stepper's `aria-label` names the real stage and real next action in one sentence
   ("Transport stage: Accepted, next en route").
2. The same fact is separately readable as ordinary visible page text (the stepper's own next
   sibling `<p>`, not merely present in the DOM near it) — satisfying §6.11 and this project's own
   sr-only-disclosure trap (named for a different screen in the shared brief, checked here too:
   the stepper's stage line has no `sr-only`/screen-reader-only class, `officer.module.css`
   `.stageLine` carries no such rule).
3. Each of the four bars carries the correct `data-s` (`done`/`now`/`todo`) in stepper order.
4. The stepper contributes zero buttons (`within(stepper).queryAllByRole("button")` is empty),
   proving it cannot be the thing that broke the pinned four-button count.
5. Every job card in the list gets its own stepper (`steppers.length === jobCards.length`) — the
   "shows every job" rule extended to the new element, not just the old ones.

Made to fail once on purpose (mutated the expected `aria-label` string to a wrong verb, confirmed
red, reverted, confirmed green) per the common brief §6.

## Limits of this reading

- I read `ward-model.ts`'s `TransportJob`/`TransportProvider`/`Movement.blocker` sections and
  `ward-derivations.ts`'s `stageCopy`/`transportLeg` in full; I did not read `ward-flow-reducer.ts`
  or `ward-flow-events.ts` beyond the four event-type names already exported from
  `officer-screen.tsx`'s own imports.
- I read the drawing's screen-specific script (`:4723-5974`) and its screen-specific CSS comment
  block (`:4406-4432`) in full, and skimmed the shared shell CSS/script sections only far enough
  to identify them as the Command-shell copy the file's own comments say they are (`:2285-2303`,
  `:5977-5998`) — I did not read the full ~3,700-line shell CSS/script blocks line by line.
- I did not open `docs/ward-flow/build-contracts-2026-09-12/drawing-vs-app.md` /
  `drawing-staleness.md` beyond grepping them for "officer"/"transport" (no substantive hits,
  confirming this screen was not among the sixteen those documents already measured).
- I ran only `tests/ward-officer-stepper.dom.test.tsx` (my own new file) plus, for my own
  confidence rather than as the required catcher, five pre-existing vitest files that import
  `OfficerScreen` or drive its exported predicates (`ward-governance-enumerations.dom.test.tsx`,
  `ward-management-role.dom.test.tsx`, `ward-officer-blocked-reason-parity.test.ts`,
  `ward-legal-figure-guard.test.ts`, `ward-landmarks.test.ts`) — all 83 tests across those five
  passed unchanged. I did not run `tests/ui-ward-roles.spec.ts` (Playwright, forbidden by the
  common brief) — its "four actions and nothing else" assertion is reasoned about from reading the
  test source, not from an actual run, and is the basis for §4.1's refusal to build the
  single-button redesign.
- I did not check whether a _different_, later owner decision after 2026-09-05 has revisited the
  design lock's "survives untouched" ruling for the officer screen specifically — only that
  `ward-nav.ts`'s current content still matches it and that a full-text search of the owner
  decisions doc found no such revisiting entry.
- No code was run to produce a screenshot or visual check; verification is `tsc` + the vitest
  files named above, read per their own printed summary lines.
