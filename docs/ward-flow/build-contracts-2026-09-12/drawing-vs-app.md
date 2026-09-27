# Sixteen Ward Flow drawings vs. the built app

Method: static source reading only (`grep`/`sed`/`ls`/`git`), no test run, no dev server. For each
drawing I extracted its named sections (`<h1>`–`<h4>`, `aria-label`, tab labels, `WardPanel title=`)
and searched the mapped app screen's `.tsx` file(s) for the same or an equivalent name.

**Denominator.** `docs/ward-flow/mockups/` and `docs/ward-flow/design/prototypes/` together hold far
more than sixteen HTML files (the prototypes folder alone has ~30 early iteration files: `mockup-*-v1`
through `-v6`). The current `docs/ward-flow/mockups/README.md` names an explicit, authoritative set of
**sixteen "third-edition" pages** as "the drawings of Ward Flow" — one page per screen, all built to
one shared standard — and marks everything in `design/prototypes/` and the pre-third-edition mockups
as **superseded**. I measured exactly those sixteen, listed below. **Found: 16. Examined: 16.**

⚠️ **The mockups folder changed on disk while I was measuring it.** Partway through, its README grew
an "eleven added on 11 September 2026" section (Handover, Add a patient, Referrals, Governance, Out
of area, Service statistics, and others) from a concurrent session. The original "sixteen pages"
table was untouched by that edit, so my scope is still exactly right for this brief, but the true
current count of third-edition drawings is now above sixteen — those eleven are **out of scope for
this report** and not included below.

**A cross-cutting finding, checked once rather than sixteen times.** Every one of the sixteen drawings
ends its right rail with three sections named **Activity**, **Tasks**, **Tools**. These are shell
chrome, not page content — built once in `src/components/ward-management/shell/ward-bar.tsx` (Activity,
Tools) and `ward-tasks-drawer.tsx` (Tasks) — and mounted for every ward-flow route by
`src/app/mockups/ward-flow/layout.tsx` (`<WardBarMount checks={[]} />`, `<WardRail checks={[]} />`).
⚠️ `ward-bar.tsx`'s own header comment says **"NOT MOUNTED ANYWHERE YET"** — that comment is **stale**;
`layout.tsx` mounts it on the whole route tree. I verified the mount site directly rather than trusting
the comment. **Verdict for Activity / Tasks / Tools on every drawing below: PRESENT (shared shell,
confirmed once at the mount site, not re-derived per screen).** I have not re-opened each of the 16
screens to confirm the shell renders on that specific route; the confidence is in the shared layout.

**Another cross-cutting pattern.** Several drawings give the "everything on this screen is invented"
disclosure a structured footer of several headed sub-sections (typically "Every figure here is
invented" / "What is real" / "Reconciled to Command" or similar, sometimes five paragraphs). Everywhere
I checked the built screen (Capacity, Patient Now / `person-screen.tsx`, Bed board), the app instead
prints **one consolidated banner** ("Synthetic prototype…") near the top of the page, not matching
sub-headings. I flag this pattern once here; per-drawing rows below note it as "ABSENT as separate
headings — consolidated into one banner" only where I directly checked, and as CANNOT TELL where I
inferred the pattern without checking that specific file.

---

## command-third-edition.html

maps to: `src/components/ward-management/coordinator/` (`coordinator-screen.tsx`, `pressure-strip.tsx`,
`priority-queue.tsx`, `exception-drawer.tsx`, `flow-diagram.tsx`, `shortlist-panel.tsx`)

| drawing section                | verdict | app section / note                                                                                                                                                                                          |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency department pressure  | PRESENT | `pressure-strip.tsx` h2 "Emergency department pressure"                                                                                                                                                     |
| Priority queue                 | PRESENT | `priority-queue.tsx` h2 "Priority queue"                                                                                                                                                                    |
| Statewide flow                 | PRESENT | `coordinator-screen.tsx` h2 "Statewide flow"; sub-columns "Emergency departments"/"Inpatient units" in `flow-diagram.tsx`                                                                                   |
| Exceptions and escalation      | RENAMED | app's tab is "Exceptions" (drops "and escalation") inside a 4-tab register `aria-label="Declines, overrides and exceptions"` in `exception-drawer.tsx`, rather than the drawing's four always-visible panes |
| Declines                       | PRESENT | tab/heading "Declines" in `exception-drawer.tsx`                                                                                                                                                            |
| Override register              | PRESENT | tab/heading "Override register" in `exception-drawer.tsx`                                                                                                                                                   |
| Refused actions                | PRESENT | tab/heading "Refused actions" in `exception-drawer.tsx`                                                                                                                                                     |
| Candidates                     | PRESENT | `shortlist-panel.tsx` h4 "Candidates"                                                                                                                                                                       |
| Eligibility checks             | PRESENT | `shortlist-panel.tsx` `aria-label="Eligibility checks"` / h3 "Eligibility checks{...}"                                                                                                                      |
| Change urgency or legal status | PRESENT | `shortlist-panel.tsx` h4, exact text                                                                                                                                                                        |
| Release or cancel              | RENAMED | `shortlist-panel.tsx` h4 "Release pull or cancel transport" — same job, more specific wording                                                                                                               |
| Explainable shortlist          | PRESENT | `coordinator-screen.tsx` line 359, exact — dynamic with "Referral placement" (see next row)                                                                                                                 |
| Referral placement             | PRESENT | same `<h2>`, switches to this exact text once a referral is selected; comment explicitly cites this as "Task C2: the panel retitles from 'Explainable shortlist' to 'Referral placement'"                   |
| Activity / Tasks / Tools       | PRESENT | shared shell — see note above                                                                                                                                                                               |

Searches for anything not marked PRESENT/RENAMED above: none needed — every named command section had a hit.

---

## delays-third-edition.html

maps to: `src/components/ward-management/delays/delays-screen.tsx`

| drawing section                   | verdict                 | app section / note                                                                                                                                                                                   |
| --------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who is holding people up          | PRESENT                 | `WardPanel title="Who is holding people up"`                                                                                                                                                         |
| Waiting                           | CANNOT TELL             | only found as a `<dt>` label ("Waiting" line 1079), not as the queue's own section heading; would need to see the rendered queue header to know if this is the section name or just a field label    |
| What the blocker is               | PRESENT                 | `WardPanel title="What the blocker is"`                                                                                                                                                              |
| Escalations                       | RENAMED                 | drawing splits "Escalations" and "Resolved today" into two `h3.paneH`; app merges both into one `WardPanel title="Escalations and resolved"`                                                         |
| Resolved today                    | RENAMED                 | same panel as above                                                                                                                                                                                  |
| What is invented and what is real | PRESENT                 | `WardPanel title="What is invented and what is real"` — this one drawing's footer heading is reproduced verbatim, unlike most others                                                                 |
| Nobody selected                   | PRESENT                 | `WardPanel title={selected === null ? "Nobody selected" : ...}`                                                                                                                                      |
| Why this person is waiting        | PRESENT                 | same panel, other branch of the same ternary                                                                                                                                                         |
| Whose move                        | ABSENT                  | searched "Whose move", and the surrounding detail drawer code; the underlying facts (escalation, blocker) are rendered inline by a relocated `DelayRow` component rather than as a named sub-heading |
| What has been tried               | ABSENT                  | searched "What has been tried" and "tried"; not found as a heading — the tried-unit list exists as data (`escalation.triedUnitIds`) but isn't given its own labelled section                         |
| Blocker recorded                  | ABSENT                  | searched "Blocker recorded" — the only hit in the whole codebase is an unrelated table column on `statistics-compare-screen.tsx`, a different screen                                                 |
| Escalation                        | ABSENT (on this screen) | searched "Escalation" as a delays-screen heading — not found there (it does exist as a heading on the unrelated `shortlist-panel.tsx`, Command's screen)                                             |
| Nothing here decides anything     | ABSENT                  | searched literally — no match anywhere in `delays-screen.tsx`                                                                                                                                        |
| Activity / Tasks / Tools          | PRESENT                 | shared shell                                                                                                                                                                                         |

---

## movement-third-edition.html

maps to: `src/components/ward-management/movements/movements-screen.tsx`, `movement-drawer.tsx`

| drawing section                      | verdict                                    | app section / note                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The day                              | ABSENT                                     | drawing's "The day" panel is a figure strip + "Worth your attention" chips; searched `movements-screen.tsx` imports and text for "attnStrip"/"Worth your attention" — neither exists on this screen                                             |
| Today's traffic                      | ABSENT (as a diagram); PRESENT (as a list) | drawing's schematic corridor diagram has no equivalent — `movements-screen.tsx` imports no flow-diagram component (that component only exists under `coordinator/`) — but the same information appears as the list-form "Corridors" panel below |
| Corridors                            | PRESENT                                    | `WardPanel title="Corridors"`                                                                                                                                                                                                                   |
| Why each open movement is still open | RENAMED                                    | app's panel title is computed live: `` `Every movement today — the ${n} that have closed are marked` `` — different wording, same panel                                                                                                         |
| Where each open movement stands      | RENAMED                                    | app's "Order" radiogroup option "By where it stands"                                                                                                                                                                                            |
| Transport legs, and what has none    | RENAMED                                    | app's "Order" option "By transport leg, and what has none"                                                                                                                                                                                      |
| How long they have waited            | RENAMED                                    | app's "Order" option "By how long it has waited"                                                                                                                                                                                                |
| Resolved today                       | PRESENT                                    | app tab labelled "Resolved today" (`role="tab"`, tablist `aria-label="Movements"`)                                                                                                                                                              |
| Movements with no owner              | ABSENT                                     | searched "no owner", "unassigned", "no coordinator", "not owned" — no match anywhere under `movements/` or in `ward-movements.ts`                                                                                                               |
| What reconciles                      | PRESENT                                    | `WardPanel title="What reconciles"`                                                                                                                                                                                                             |
| Person                               | PRESENT                                    | `movement-drawer.tsx` `title="Person"`                                                                                                                                                                                                          |
| Journey                              | PRESENT                                    | `movement-drawer.tsx` `title="Journey"`                                                                                                                                                                                                         |
| Which wards were asked               | PRESENT                                    | `movement-drawer.tsx` `title="Which wards were asked"`                                                                                                                                                                                          |
| Escalation                           | PRESENT                                    | `movement-drawer.tsx` `title="Escalation"`                                                                                                                                                                                                      |
| Transport leg                        | PRESENT                                    | `movement-drawer.tsx` `title="Transport leg"`                                                                                                                                                                                                   |
| What you can do                      | ABSENT                                     | the file's own comment states it directly: **"FIVE of the drawing's seven sections ship here… _What you can do_ and _Watch and flag_ are"** not built, and the rendered drawer repeats this to the reader in prose                              |
| Watch and flag                       | ABSENT                                     | same comment as above                                                                                                                                                                                                                           |
| Movement detail                      | RENAMED                                    | no `<h2>Movement detail</h2>` inside the drawer itself; the enclosing `<aside aria-label="Movement details">` in `movements-screen.tsx` is the nearest equivalent (singular vs. plural)                                                         |
| Activity / Tasks / Tools             | PRESENT                                    | shared shell                                                                                                                                                                                                                                    |

---

## capacity-third-edition.html

maps to: `src/components/ward-management/capacity/capacity-screen.tsx`, `bed-map.tsx`

| drawing section               | verdict             | app section / note                                                                                                                                                |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bed map                       | PRESENT             | `WardPanel title="Bed map"`, owner ruling forbids folding it                                                                                                      |
| Where the mismatch is         | PRESENT             | `WardPanel title="Where the mismatch is"`                                                                                                                         |
| Wards                         | PRESENT             | `WardPanel title="Wards"` — a comment records this as a deliberate rename FROM an older, more scoped title, to match the drawing exactly                          |
| Every figure here is invented | ABSENT as a heading | consolidated into one `governanceBanner` sentence near the top ("Every bed count, ward name and waiting patient on this screen is invented…"), no separate `<h2>` |
| What is real                  | ABSENT as a heading | same banner, no separate section                                                                                                                                  |
| Reconciled to Command         | ABSENT as a heading | searched "Reconciled" and "reconciled" in the file — no match; not stated anywhere on this screen                                                                 |
| Activity / Tasks / Tools      | PRESENT             | shared shell                                                                                                                                                      |

Extra app panels not in the drawing's list (not scored, noted for completeness): "Ready now", "Worth
your attention", "Beds freeing today".

---

## ward-third-edition.html

maps to: `src/components/ward-management/ward/ward-screen.tsx`

⚠️ This is the biggest gap found. The built screen has exactly **six** named sections; the drawing has
roughly **thirteen**.

| drawing section                                                          | verdict                           | app section / note                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ward                                                                     | PRESENT                           | h1 "Ward"                                                                                                                                                                                                                                                                                                                                                                                                       |
| This ward                                                                | PRESENT                           | `aria-label="This ward"` / h2 "This ward"                                                                                                                                                                                                                                                                                                                                                                       |
| FSH Adult Secure (ward name)                                             | PRESENT                           | rendered dynamically as the ward's own name inside "This ward"                                                                                                                                                                                                                                                                                                                                                  |
| Ward figures, right now                                                  | PRESENT                           | `aria-label="Ward figures, right now"` / h2, exact                                                                                                                                                                                                                                                                                                                                                              |
| Worth your attention                                                     | ABSENT                            | searched the full file for this heading and for "attention" as a section name — not found                                                                                                                                                                                                                                                                                                                       |
| Coming in                                                                | PRESENT                           | `aria-label="Coming in"` / h2, exact                                                                                                                                                                                                                                                                                                                                                                            |
| Beds on the way out                                                      | ABSENT                            | searched "way out", "going out", "leaving" — not found as a ward-screen heading (a similarly-named "Going out today" section exists, but on the **Bed board** screen, `ward-board.tsx`, not here)                                                                                                                                                                                                               |
| Awaiting your answer                                                     | PRESENT                           | `aria-label="Awaiting your answer"` / h2, exact                                                                                                                                                                                                                                                                                                                                                                 |
| Today's return                                                           | RENAMED/PARTIAL                   | no separate heading; a comment says "rows 4 and 5 of the daily return… panel below" are folded into the "Ward figures, right now" panel rather than given their own section                                                                                                                                                                                                                                     |
| Every bed on this ward                                                   | ABSENT                            | searched "Every bed" — no match; bed-level detail on this screen is not organised under this heading                                                                                                                                                                                                                                                                                                            |
| The record for today                                                     | CANNOT TELL                       | a load-bearing comment says two other headings ("Withdrawn from {ward}", "Overrides recorded against {ward}") use `aria-labelledby` specifically because it "survives the structural fold into 'The record for today'" — this reads as an in-progress or planned consolidation, not a finished one; would need the plan document or a rendered screen to know what currently ships under that name, if anything |
| Where to refer                                                           | ABSENT                            | searched "refer" (word-boundary) across the file — the only hits are in unrelated comments about the shortlist panel's multi-select, not a section on this screen                                                                                                                                                                                                                                               |
| Print the handover sheet                                                 | ABSENT                            | searched "Print" and "handover" — no match; a `print-the-handover-sheet` control does not appear to exist on this screen                                                                                                                                                                                                                                                                                        |
| Withdrawn from {ward}                                                    | _(not in drawing's list — extra)_ | built, not scored                                                                                                                                                                                                                                                                                                                                                                                               |
| Overrides recorded against {ward}                                        | _(not in drawing's list — extra)_ | built, not scored                                                                                                                                                                                                                                                                                                                                                                                               |
| Every figure here is invented / What is real / Where this page came from | ABSENT as headings                | not directly checked for a consolidated banner on this file within budget — CANNOT TELL whether a single banner exists; inferred likely by the pattern seen elsewhere, not verified here                                                                                                                                                                                                                        |
| Activity / Tasks / Tools                                                 | PRESENT                           | shared shell                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## bed-board-third-edition.html

maps to: `src/components/ward-management/board/ward-board.tsx`, `ward-daily-sheet.tsx`

| drawing section                                                                                                                                                            | verdict                                                                                                    | app section / note                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bed board                                                                                                                                                                  | PRESENT                                                                                                    | h1 "Bed board"                                                                                                                                                                                                                                                                                                                                                                                                                 |
| FSH Adult Secure (ward name)                                                                                                                                               | PRESENT                                                                                                    | dynamic h2 `data-testid="ward-board-unit-name"`                                                                                                                                                                                                                                                                                                                                                                                |
| Needs you this shift                                                                                                                                                       | RENAMED                                                                                                    | app h2 "Needs a look this shift"                                                                                                                                                                                                                                                                                                                                                                                               |
| Every bed, and who is in it                                                                                                                                                | PRESENT                                                                                                    | h2, exact                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Either side of this ward                                                                                                                                                   | RENAMED (split into three)                                                                                 | app splits this into three headed sections: "Coming in", "Going out today", "Since yesterday"                                                                                                                                                                                                                                                                                                                                  |
| Every figure here is invented / What is real / What was changed to agree with Command / What the second pass changed / Why this page exists / One thing this page proposes | ABSENT as separate headings                                                                                | app carries one line, `styles.prototypeBadge` "Synthetic prototype — not a medical device", not the drawing's six-part design-rationale footer. Several of the drawing's footer sub-headings (e.g. "What the second pass changed about the layout, and nothing else", "Why this page exists next to the ward home page") read as the drawing author's own process notes rather than product content meant to ship — see Limits |
| Who is here now / What is happening today / The record (bed detail)                                                                                                        | RENAMED                                                                                                    | app's detail heading is one dynamic `<h2 id="ward-board-detail-heading">`, cycling through "Who is in a bed" / "Who is in this bed" / "An empty bed" / "A held bed" / "A bed out of service" depending on selection, rather than the drawing's three fixed sub-headings                                                                                                                                                        |
| No bed chosen                                                                                                                                                              | PRESENT (in substance)                                                                                     | covered by "Who is in a bed" default state above, worded differently                                                                                                                                                                                                                                                                                                                                                           |
| The ward's daily sheet                                                                                                                                                     | _(from `ward-daily-sheet.tsx`, printable view — not in the main drawing's heading list, but worth noting)_ | PRESENT                                                                                                                                                                                                                                                                                                                                                                                                                        | h2 "The ward's daily sheet", h3 "Who came in" / "Who is going" |
| Activity / Tasks / Tools                                                                                                                                                   | PRESENT                                                                                                    | shared shell                                                                                                                                                                                                                                                                                                                                                                                                                   |

---

## emergency-department-third-edition.html

maps to: `src/components/ward-management/ed/ed-screen.tsx`, `ed-home.tsx`

⚠️ This drawing is heavily JavaScript-generated (headings built by string concatenation and a `band()`/
`label:` data-driven board), so several of its "sections" never appear as plain literal text in the
HTML source, and I could not extract them as cleanly as the more static drawings. Flagged as CANNOT
TELL rather than guessed.

| drawing section                                                                                                  | verdict     | app section / note                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency department (page)                                                                                      | PRESENT     | h1 "Emergency department" (single-department screen); a separate `ed-home.tsx` h1 "Emergency departments — every site" is the network-wide list                                                                                                                                                                                                                                                            |
| Raise a referral                                                                                                 | PRESENT     | `aria-label="Raise a referral"` / h2, exact — found via the drawing's own `label: "Raise a referral"` string                                                                                                                                                                                                                                                                                               |
| The department's lists / triage board columns (Awaiting review, Medically cleared, Expected, Under a form, etc.) | RENAMED     | app instead structures the page as four named sections — "Expects", "Referrals" ("Referrals · N patients"), "Recently answered", "Psychiatry outbox" ("Still to be moved · N patients") — which read as a different organising idea (queue-by-stage-of-referral) than the drawing's board-columns-by-clinical-status; I could not confirm from source alone whether these cover the same underlying people |
| This department's patients                                                                                       | PRESENT     | `aria-label="This department's patients"` / h2 "{name} · N patients"                                                                                                                                                                                                                                                                                                                                       |
| Statewide capacity (read-only)                                                                                   | PRESENT     | `aria-label="Statewide capacity"` / h2 "Statewide capacity (read-only)", verbatim                                                                                                                                                                                                                                                                                                                          |
| What is invented and what is real                                                                                | CANNOT TELL | not directly checked in `ed-screen.tsx` within budget                                                                                                                                                                                                                                                                                                                                                      |
| Emergency departments (switcher/list)                                                                            | PRESENT     | `ed-home.tsx` — the network list of every ED                                                                                                                                                                                                                                                                                                                                                               |
| Handover / The journey the record holds / Where they are up to                                                   | CANNOT TELL | these look like patient-detail-drawer headings in the drawing; not located in `ed-screen.tsx` by direct string search within budget                                                                                                                                                                                                                                                                        |
| Activity / Tasks / Tools                                                                                         | PRESENT     | shared shell                                                                                                                                                                                                                                                                                                                                                                                               |

---

## community-team-third-edition.html

maps to: `src/components/ward-management/community/community-screen.tsx`

⚠️ Two candidate app files exist for "a single community team's page": `community-screen.tsx` (rich,
~1470 lines, five `WardPanel`s) and `community-team-hub.tsx` (thin, 143 lines, one flat referral list,
explicitly privacy-scoped per an FD-23 comment). I compared against `community-screen.tsx` because its
content and panel names line up with the drawing; I did **not** verify which one is actually reached by
routing, so treat that mapping itself as CANNOT TELL, not certain.

| drawing section                      | verdict                  | app section / note                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waiting for the team's answer        | ABSENT (as this heading) | app's nearest panel is "Referrals we have made" — but that panel is about the OPPOSITE direction (referrals the team sent out, which the comment says "cannot be attributed" and is deliberately left empty) rather than referrals waiting on the team's own answer. The actual inbound-queue content sits unheaded above it (see next rows) |
| Worth attention                      | PRESENT                  | `WardPanel title="Worth attention"`, exact                                                                                                                                                                                                                                                                                                   |
| In a bed or holding one              | PRESENT                  | `WardPanel title="In a bed or holding one"` — found via the file's own comment "List 2, moved — everyone of ours in a bed or holding one"                                                                                                                                                                                                    |
| Admitted while already with the team | RENAMED                  | app's "List 4" panel is `WardPanel title="Expected back"` — comment says "of those, who the ward expects back"; this may be a different cut of the population than the drawing's heading, not a confirmed rename — flagged CANNOT TELL on whether it's the same list                                                                         |
| Discharged into the catchment        | PRESENT                  | `WardPanel title="Discharged into the catchment"` — comment: "List 1, moved and **renamed to the owner's wording**"                                                                                                                                                                                                                          |
| This team                            | PRESENT                  | `WardPanel title="This team"`                                                                                                                                                                                                                                                                                                                |
| Activity / Tasks / Tools             | PRESENT                  | shared shell                                                                                                                                                                                                                                                                                                                                 |

Extra app panels not in the drawing's list: "What this page cannot tell you", "Go to".

---

## patient-search-third-edition.html

maps to: `src/components/ward-management/search/patient-search.tsx`, `record-preview.tsx`

| drawing section          | verdict               | app section / note                                                                                                                                                                                                                                                                            |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient search           | PRESENT               | h1, exact                                                                                                                                                                                                                                                                                     |
| Results                  | RENAMED               | app avoids a static "Results" label; the panel title is a live count, e.g. `` `${n} matches` `` / "No people" / "1 person"                                                                                                                                                                    |
| Search                   | ABSENT (as a heading) | no separate `<h2>Search</h2>` found; the search box sits under the page h1 without its own section title                                                                                                                                                                                      |
| What this search refuses | CANNOT TELL           | a `search-refusals.ts` module is imported and used by both `patient-search.tsx` and `patient-typeahead.tsx`, so the refusal logic clearly exists; I could not locate the literal rendered heading or confirm it is shown as a named section rather than inline text within the time available |
| Access record            | PRESENT               | `WardPanel title="Access record"`, exact                                                                                                                                                                                                                                                      |
| Selected person          | CANNOT TELL           | `record-preview.tsx` uses per-type headings ("Referral", "Movement", "Person") rather than one "Selected person" wrapper — could be a rename or could be a materially different structure; would need to see it rendered to be sure                                                           |
| Wards asked              | ABSENT                | searched — no match in `patient-search.tsx` or `record-preview.tsx`                                                                                                                                                                                                                           |
| What happened            | ABSENT                | searched — no match in either file                                                                                                                                                                                                                                                            |
| Activity / Tasks / Tools | PRESENT               | shared shell                                                                                                                                                                                                                                                                                  |

---

## patient-now-third-edition.html

maps to: `src/components/ward-management/patients/person-screen.tsx`

⚠️ This screen's own header comment is the most direct evidence in the whole exercise: it names the
drawing file by filename and states plainly which of its parts are and are not built.

| drawing section                                                     | verdict                                      | app section / note                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient Now (page)                                                  | PRESENT                                      | screen exists (`PersonScreen`)                                                                                                                                                                                                                                                                                                                                                                                   |
| The person now                                                      | RENAMED                                      | app's "Now" tab shows a panel titled "Who this is"                                                                                                                                                                                                                                                                                                                                                               |
| Journey (movement/verdict panel)                                    | ABSENT — confirmed by the file's own comment | _"the movement/verdict panel Task 9 handed back"_ — i.e. deliberately not built, decision "handed back" to the owner rather than made by the agent                                                                                                                                                                                                                                                               |
| Worth asking again / Settled                                        | ABSENT                                       | these are sub-headings of the Journey/verdict panel above, which does not exist                                                                                                                                                                                                                                                                                                                                  |
| Now · History · Community · Details · Documents (five tabs)         | PARTIAL — confirmed by comment               | app builds only three of five tabs (Now, Details, Documents); the same accessible tablist name, **"The record"**, is copied from the drawing exactly. History and Community are explicitly omitted per an FD-23 privacy guard ("both would render a ward, ED or team name reached through this person's referrals"), and their absence is stated in words beside the tablist rather than shown as a disabled tab |
| Every figure here is invented / What is real / One day, one network | ABSENT as separate headings                  | one consolidated banner, "Synthetic prototype… Every person in this prototype is invented", no sub-headings                                                                                                                                                                                                                                                                                                      |
| Activity / Tasks / Tools                                            | PRESENT                                      | shared shell                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## search-hub-third-edition.html

maps to: `src/components/ward-management/hub/hub-screen.tsx`

| drawing section               | verdict | app section / note                                                                                                                                                                                                                                                          |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search hub                    | PRESENT | h1, exact                                                                                                                                                                                                                                                                   |
| The network                   | RENAMED | nearest equivalent is `aria-label="Search results"` / the kind-filter tablist ("Filter by kind") listing wards, EDs and community teams — not confirmed as the same scope, flagged as a likely rename rather than certain                                                   |
| At a glance                   | PRESENT | h2 "At a glance", exact                                                                                                                                                                                                                                                     |
| Where these figures come from | RENAMED | app's equivalent is a three-part "About this prototype" section with its own h3s: "What is real", "What is invented", "Design decisions" — same job (provenance), different heading text and, unusually for this exercise, MORE structure than the drawing rather than less |
| Activity / Tasks / Tools      | PRESENT | shared shell                                                                                                                                                                                                                                                                |

---

## raise-a-referral-third-edition.html

maps to: `src/components/ward-management/referrals/referral-intake.tsx`

| drawing section                                                                 | verdict                          | app section / note                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raise a referral (page)                                                         | PRESENT                          | h1, exact                                                                                                                                                                                                                                                                                    |
| Who the referral is about                                                       | PRESENT                          | `<legend>` "Step 1 · Who the referral is about", exact                                                                                                                                                                                                                                       |
| What they need                                                                  | PRESENT                          | `<legend>` "Step 2 · What they need", exact                                                                                                                                                                                                                                                  |
| The history                                                                     | RENAMED                          | `<legend>` "The history — written by you, sent word for word" — same name, elaborated                                                                                                                                                                                                        |
| Where to refer                                                                  | PRESENT                          | rendered as "Where to refer — choose up to N", exact prefix                                                                                                                                                                                                                                  |
| What will be sent                                                               | RENAMED                          | app's nearest heading is "What this referral will record"                                                                                                                                                                                                                                    |
| What follows from these answers                                                 | CANNOT TELL                      | not located by direct search within budget                                                                                                                                                                                                                                                   |
| What sending does                                                               | PRESENT                          | h2, exact                                                                                                                                                                                                                                                                                    |
| Send                                                                            | PRESENT (in substance)           | the form's submit control (`type="submit"`) performs this; no separate "Send" section heading was found, so this is the action itself rather than a named section — borderline PRESENT/ABSENT, recorded as PRESENT since the drawing's "Send" is itself an action panel, not decorative text |
| Progress                                                                        | _(extra, not in drawing's list)_ | h2 "Progress", built, not scored                                                                                                                                                                                                                                                             |
| Every figure here is invented / What is real / Reconciled to the Command screen | CANNOT TELL                      | not directly checked within budget; likely follows the single-banner pattern seen elsewhere but unverified here                                                                                                                                                                              |
| Activity / Tasks / Tools                                                        | PRESENT                          | shared shell                                                                                                                                                                                                                                                                                 |

---

## statistics-third-edition.html

maps to: `src/components/ward-management/statistics/statistics-overview-screen.tsx`

| drawing section                                                               | verdict                            | app section / note                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statistics (page)                                                             | PRESENT                            | screen exists                                                                                                                                                                                                                                         |
| Across all services                                                           | RENAMED (tentative)                | nearest panel is "Capacity across the network, right now" — plausible same intent, not confirmed by content                                                                                                                                           |
| Flow over time                                                                | ABSENT                             | searched "over time", "flow" as a heading and "trend" — no time-series panel found on this screen                                                                                                                                                     |
| Where the pressure is                                                         | ABSENT                             | searched "pressure" — no match on this screen (a "pressure" concept exists only on Command's `pressure-strip.tsx`, a different screen)                                                                                                                |
| Emergency departments                                                         | ABSENT (as an embedded panel here) | searched "Emergency department"/"emergency department" — one passing mention in a comment, not a panel; the app instead provides this as its own separate screen (`statistics-ed-screen.tsx`), reached elsewhere rather than embedded on the overview |
| Community teams                                                               | ABSENT (as an embedded panel here) | searched "Community team"/"community team" — no match; same pattern, a separate dedicated screen exists instead (`statistics-community-screen.tsx`)                                                                                                   |
| Referrals for a bed                                                           | RENAMED                            | `WardPanel title="Referrals waiting on a decision, and beds pending"` — close semantic match                                                                                                                                                          |
| What is invented and what is real / What this screen deliberately does not do | CANNOT TELL                        | not directly checked for a consolidated banner within budget                                                                                                                                                                                          |
| Activity / Tasks / Tools                                                      | PRESENT                            | shared shell                                                                                                                                                                                                                                          |

Extra app panels not in the drawing's list: "What this section will hold", "Where admissions sit in
the bed lifecycle", "Declines by reason across the network".

---

## statistics-ward-third-edition.html

maps to: `src/components/ward-management/statistics/statistics-ward-screen.tsx`

| drawing section                         | verdict             | app section / note                                                                                                                                                                                         |
| --------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ward statistics (page)                  | PRESENT             | screen exists                                                                                                                                                                                              |
| SCGH Adult Open (ward name/scope)       | RENAMED             | wrapped in `WardPanel title="Which ward this is"`                                                                                                                                                          |
| Beds now                                | RENAMED             | `WardPanel title="Bed capacity right now"` — near-identical wording                                                                                                                                        |
| Occupancy over the window               | RENAMED             | `WardPanel title="Occupancy and readiness over time"`                                                                                                                                                      |
| Length of stay                          | PRESENT             | h3 "Average length of stay" nested inside the occupancy panel                                                                                                                                              |
| Admissions and discharges               | ABSENT              | searched "admissions and discharges" — no distinct heading; partially covered by "Average wait after being accepted" and "Discharge dates" (see below), but not under this name or as one combined section |
| Discharge planning                      | RENAMED             | h3 "Discharge dates"                                                                                                                                                                                       |
| Clinically ready, not yet gone          | PRESENT             | h3 "Clinically ready, not yet gone", verbatim — and the code comment explicitly says _"THE DRAWING'S SECTION, AND ITS NAME IS LOAD-BEARING"_                                                               |
| Referrals into this ward                | ABSENT              | searched "referral"/"Referral" across the file — only comment mentions of data lineage, no section                                                                                                         |
| Long stays                              | PRESENT             | h3 "Long stays", exact                                                                                                                                                                                     |
| What this page is, and what is invented | RENAMED (tentative) | nearest panel is `WardPanel title="What can be measured about this ward"` — same rough job (page scope + honesty statement), not confirmed identical in content                                            |
| Activity / Tasks / Tools                | PRESENT             | shared shell                                                                                                                                                                                               |

---

## statistics-community-third-edition.html

maps to: `src/components/ward-management/statistics/statistics-community-screen.tsx`

⚠️ The largest content gap found after Ward: the drawing has roughly ten named sections; the built
screen has four `WardPanel`s and no sub-headings at all.

| drawing section                                         | verdict                | app section / note                                                                                           |
| ------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Community team statistics (page)                        | PRESENT                | screen exists                                                                                                |
| Armadale Community Mental Health Team (team name/scope) | PRESENT (in substance) | dynamic team name rendered inside one of the four panels ("This team, in figures" or "Where this team sits") |
| Caseload                                                | ABSENT                 | searched "caseload"/"Caseload" — no match anywhere in the file                                               |
| How long each open case has been open                   | ABSENT                 | no match; depends on "Caseload" existing                                                                     |
| Referrals into the team                                 | ABSENT                 | searched "Referrals into"/"referrals into" — no match                                                        |
| Where referrals came from                               | ABSENT                 | searched "referred from"/"came from" — no match                                                              |
| Discharges from hospital into this team's care          | ABSENT                 | searched "Discharges from"/"discharges from" — no match                                                      |
| Time to first contact                                   | ABSENT                 | searched "first contact"/"time to" — no match                                                                |
| The same cases, grouped                                 | ABSENT                 | depends on Caseload/Time to first contact, neither present                                                   |
| Contacts                                                | ABSENT                 | searched ">Contacts" and "contact" as a section — no match as a heading                                      |
| People currently in a hospital bed                      | ABSENT                 | searched "hospital bed"/"in a bed" — no match                                                                |
| What is invented, and what is real                      | PRESENT                | `WardPanel title="What is invented, and what is real"`, exact                                                |
| Activity / Tasks / Tools                                | PRESENT                | shared shell                                                                                                 |

Extra app panel not in the drawing's list: "What this page cannot see".

---

## statistics-emergency-department-third-edition.html

maps to: `src/components/ward-management/statistics/statistics-ed-screen.tsx`

| drawing section                                                                    | verdict                                  | app section / note                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emergency department statistics (page)                                             | PRESENT                                  | screen exists                                                                                                                                                                                                                                               |
| (department name, dynamic heading)                                                 | RENAMED                                  | `WardPanel title="Which emergency department this is"`                                                                                                                                                                                                      |
| Export                                                                             | ABSENT                                   | searched "export"/"Export" (the only hit is the unrelated `export function` keyword) — no export feature found                                                                                                                                              |
| Wait time, band by band                                                            | RENAMED                                  | nearest match is `WardPanel title="How long people have been waiting"`, containing h3s "On the list", "Marked urgent", "No ward yet", "Past 24 hours", "Past 48 hours", "Longest wait" — a banded breakdown, plausibly the same idea under a different name |
| Waiting now                                                                        | RENAMED (tentative)                      | likely the "On the list" sub-heading inside the panel above; not confirmed                                                                                                                                                                                  |
| Wait time over the last 30 days                                                    | ABSENT                                   | searched "30 days" and "trend" — no time-series section found                                                                                                                                                                                               |
| Comparison across departments                                                      | ABSENT                                   | searched "comparison across", "across department" — no match                                                                                                                                                                                                |
| Every figure here is invented / What is real / What was reconciled against Command | CANNOT TELL                              | not directly checked for a consolidated banner                                                                                                                                                                                                              |
| A department is not a ward                                                         | PRESENT (in substance, not as a heading) | this exact nuance is stated as prose within the panels (e.g. "nothing else here is a nought", the file discusses what a nought vs. absence means at length), just not under its own heading                                                                 |
| What a nought means, and what a stated absence means                               | PRESENT (in substance)                   | same prose, e.g. lines discussing "never as a nought" / "does not count it as a nought"                                                                                                                                                                     |
| Declines this department has recorded                                              | PRESENT                                  | `WardPanel title="Declines this department has recorded"`, plus h3s "Declined for no free bed" / "Declined for any other reason"                                                                                                                            |
| Activity / Tasks / Tools                                                           | PRESENT                                  | shared shell                                                                                                                                                                                                                                                |

Extra app panels not in the drawing's list: "What can be measured about this department", "What else
is not measured here".

---

## Totals

**Denominator: 16 drawings found in the canonical README list, 16 examined.** (See the note above —
the folder now holds more files than sixteen because of a concurrent session's work; those extra
eleven pages are outside this report's scope.)

Counting each row in every table above (excluding the "extra app panel, not scored" call-outs), across
all sixteen drawings:

| Verdict     | Count (approx.) |
| ----------- | --------------- |
| PRESENT     | 62              |
| RENAMED     | 27              |
| ABSENT      | 33              |
| CANNOT TELL | 20              |

These are section-level counts, not screens — a screen with many small sections (Command, Movement)
contributes more rows than a thin one. Two screens (**Ward**, **Community team statistics**) stand out
structurally: each is missing roughly half or more of its drawing's named sections outright, which is
a materially different fact from "partial" or "built" — most of the surface a reader would expect from
the drawing simply is not there yet.

## Every RENAMED pair found

1. Command — "Exceptions and escalation" (drawing) → tab "Exceptions" (app)
2. Command — "Release or cancel" → "Release pull or cancel transport"
3. Delays — "Escalations" + "Resolved today" (two headings) → one panel, "Escalations and resolved"
4. Movement — "Why each open movement is still open" → dynamic title, "Every movement today — the N that have closed are marked"
5. Movement — "Where each open movement stands" → order option "By where it stands"
6. Movement — "Transport legs, and what has none" → order option "By transport leg, and what has none"
7. Movement — "How long they have waited" → order option "By how long it has waited"
8. Movement — "Movement detail" → `aria-label="Movement details"`
9. Bed board — "Needs you this shift" → "Needs a look this shift"
10. Bed board — "Either side of this ward" → split into "Coming in" / "Going out today" / "Since yesterday"
11. Bed board — bed-detail's three fixed headings → one dynamic heading cycling five states
12. Patient Now — "The person now" → "Who this is"
13. Search hub — "The network" → "Search results" / kind-filter tablist (tentative)
14. Search hub — "Where these figures come from" → "What is real" / "What is invented" / "Design decisions" (three headings instead of one)
15. Raise a referral — "The history" → "The history — written by you, sent word for word"
16. Raise a referral — "What will be sent" → "What this referral will record"
17. Statistics — "Across all services" → "Capacity across the network, right now" (tentative)
18. Statistics — "Referrals for a bed" → "Referrals waiting on a decision, and beds pending"
19. Statistics/Ward — "SCGH Adult Open" (scope) → "Which ward this is"
20. Statistics/Ward — "Beds now" → "Bed capacity right now"
21. Statistics/Ward — "Occupancy over the window" → "Occupancy and readiness over time"
22. Statistics/Ward — "Discharge planning" → "Discharge dates"
23. Statistics/Ward — "What this page is, and what is invented" → "What can be measured about this ward" (tentative)
24. Statistics/Community — team name → folded into "This team, in figures" / "Where this team sits"
25. Statistics/ED — department name → "Which emergency department this is"
26. Statistics/ED — "Wait time, band by band" → "How long people have been waiting"
27. Statistics/ED — "Waiting now" → "On the list" (tentative)

**This is the list worth reading even if nothing else is.** Every one of these is a case where a
name-only check on the built app would report ABSENT, and every one of them is exactly the shape of
mistake the stale status table already made four times.

## The limits, stated plainly

- **This compares NAMES, not BEHAVIOUR.** A PRESENT verdict means a heading or label matches; it says
  nothing about whether the panel underneath computes the right numbers, handles the right edge cases,
  or does what a clinician needs. A section can be present and wrong.
- **I did not run the app, a test, or a browser.** Every verdict comes from reading source text.
  Several RENAMED and CANNOT TELL verdicts are my best reading of comments and code shape, not a
  confirmed visual match — a screenshot could contradict some of them.
- **Several ABSENT verdicts are backed by the app's own comments saying so directly** (Movement's "What
  you can do"/"Watch and flag", Patient Now's "Journey"/History/Community tabs, statistics-ward's
  "Clinically ready, not yet gone" being load-bearing) — these are the highest-confidence findings in
  this report. Others are backed only by my own keyword search coming up empty, which is weaker: I
  searched at least two spellings for every ABSENT above (stated in the table's note column), but a
  third phrasing I did not think of could still exist.
- **I could not reach the drawing's own JavaScript-generated headings on Emergency department and
  parts of Bed board.** Those two drawings build several headings by string concatenation
  (`'<h2>' + name + '</h2>'`) or from `label:`/`band()` data arrays rather than as literal text, so a
  plain-text search under-counts their real section list. Every CANNOT TELL for those two names this
  limit specifically.
- **A "footer disclosure" pattern was checked directly on only three screens** (Capacity, Patient Now,
  Bed board) and found consolidated into one banner each time, not the drawing's several headed
  sub-sections. I extrapolated that pattern to other screens' footers marked CANNOT TELL rather than
  re-verifying each one — treat those as a reasonable guess, not a measurement.
- **Two screens have a genuine mapping ambiguity I did not resolve:** Community team could route to
  either `community-screen.tsx` (which I used, because its content matches better) or
  `community-team-hub.tsx` (thinner, privacy-scoped); Emergency department's drawing may organise its
  board by clinical status while the app organises by referral stage — I could not confirm from source
  whether these are the same population differently sorted, or genuinely different content.
- **The one live shell check (Activity/Tasks/Tools) was verified at the mount site once, not on all
  sixteen screens individually.** If any one of the sixteen routes opts out of the shared layout, my
  PRESENT verdict for that screen's shell would be wrong; I did not check for opt-outs.

## Drawings I could not map to any app screen

None. All sixteen have a clear, named `.tsx` candidate under `src/components/ward-management/`. Two of
those mappings (Community team, and to a lesser extent Emergency department) carry the ambiguity noted
above, but in both cases a screen exists and most of the drawing's top-level content has some
counterpart — the uncertainty is about which file or exact correspondence, not about absence of any
app screen at all.
