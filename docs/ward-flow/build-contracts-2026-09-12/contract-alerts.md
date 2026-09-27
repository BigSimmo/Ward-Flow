# Build contract — Alerts screen

Drawing: `docs/ward-flow/mockups/alerts-third-edition.html` (9,454 lines).
Route confirmed absent: no `src/app/mockups/ward-flow/alerts/` directory exists.

## 0. Design or reproduction?

**Design, not a reproduction — but with one narrow, true "not new" claim inside it, and it is about
visual components, not alert logic.**

The drawing's own comment (`alerts-third-edition.html:7930-7933`, inside `alertRows()`):

> "Nothing here is a new component: the panel and the register row are the standard's own,
> sections 6.3 and 6.10."

`docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md:523` (§6.3 "Panel, header, note and stated
absence") and `:569` (§6.10 "Register rows") confirm these are existing shared visual patterns
already used across the sixteen built screens — a builder reuses those component contracts rather
than inventing new CSS. That claim is about **appearance only**. Nowhere does the drawing claim its
**alert logic** (which conditions fire, what data backs them) reproduces existing code — and, per
§1 below, it does not: it invents a parallel taxonomy that overlaps only partially with what the
model actually tracks. This is a genuine new build of the alert _logic and layout_, built with
already-approved _components_.

## 1. Does any alerting surface already exist?

**Yes — two, and they are different systems. The drawing draws neither one faithfully.**

**(a) `buildActionInbox` (`src/components/ward-management/ward-derivations.ts:990-1099`) — the
real, already-wired action inbox.** Five categories via `INBOX_CATEGORIES`
(`ward-flow-reducer.ts:421`): `destination_unlawful`, `legal_timing_breached`, `bed_pull_expired`,
`destinations_declined`, `transport_awaiting_departure`. Each `InboxItem` carries `tone`
("danger"|"warning"), `title`, `detail`, `owner`, `movementId`, `kind`. It is already consumed by
`coordinator-screen.tsx`, `exception-drawer.tsx`, `delays-screen.tsx`/`delays-derivations.ts`,
`ward-bar.tsx`, `ward-chrome-header.tsx`, `ward-tasks-drawer.tsx`, `ward-tasks-panel.tsx`,
`ward-sidebar-content.tsx`. The doc comment at line 975 states the real fixture currently has
**zero** legally-breached movements (every Form 1A/3B `dueAt` was removed by a 2026-08-23 owner
correction) — so a live "Legal deadline passed" alert, though buildable, will render empty against
today's seed data, same as it does everywhere else it's already shown.

**(b) `Notice`/`NoticeKind` (`ward-model.ts:1995-2013`, `makeNotice`
`ward-flow-reducer.ts:956-999`) — the D-2 communication system, built by Ward Lead, with
**no rendering surface anywhere**.** A grep for any `.tsx` reading `state.notices` or rendering
`Notice[]` returns nothing. Seven closed `NoticeKind` members, each addressed to a role at a place
(`bed_pull_released`, `referral_declined`, `accepted_in_principle`, `referral_accepted_referrer`,
`referral_accepted_ward`, `transport_cancelled_officer`, `transport_cancelled_ward`) — none of
which match any row the drawing draws. `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` D-2 (line 106) is the binding ruling that created this: "a message exists… somebody can see the messages
addressed to them… it is built in this phase, not deferred." **This screen is the natural, unbuilt
home for (b), and the drawing does not render it at all.**

**(c) Three routes already redirect here-adjacent**: `escalation/page.tsx`, `exceptions/page.tsx`,
`queue/page.tsx` all redirect to `/mockups/ward-flow/delays` (Merge 01, owner-approved 2026-09-05,
folded "the priority queue, the exceptions inbox and the escalation board" into `DelaysScreen`).
Alerts is a fourth, distinct concept from that merge — it is addressed to a role across _all_
movements/referrals, not "why is this person still waiting" — but a reviewer should know Delays
already owns escalation/exception/queue framing before approving a fifth home for the same words.

## 2. The drawing's sections, in order

1. Header/rail/search chrome (shared shell, same as all sixteen screens — no new work).
2. **"Needs you"** (`#mineHeading`, line 4557) — actionable rows for the viewer's own role, worst
   danger/warn first, ending with one always-present non-actionable "Handover sheet due" row.
3. **"For other roles"** (`#othersHeading`, line 4565) — visible-but-not-yours rows: overrides,
   referrals awaiting triage.
4. **"What is invented and what is real"** (`#footHeading`, line 4574) — the standard disclosure
   footer already used elsewhere (D-3 "invented-figures notice").

## 3. Per-section data and model mapping

**"Needs you" — two real conditions, one invented one:**

- _Legal deadline passed_ → drawing's `WF.isBreached(m)` is a **mockup-only helper**, not a real
  export (confirmed: no `isBreached` anywhere under `src/`). Real equivalent exists:
  `movement.legalForm?.dueAt` + `clockState(dueAt, now) === "breached"`
  (`ward-derivations.ts:1020-1022`, feeding `INBOX_CATEGORIES.legal_timing_breached`). Buildable —
  but will show **zero** rows against the current seed (§1a).
- _Every ward asked has declined_ → `movement.declines.length >= PARALLEL_REFERRAL_CAP` (3) with no
  accepted unit and nothing referred. Matches real `heavilyDeclined`
  (`ward-derivations.ts:1064`, feeding `destinations_declined`). Buildable, and non-empty today.
- _Handover sheet due_ → 🔴 **NOT IN THE MODEL.** No `handoverAt`/next-shift-boundary field exists
  anywhere (`grep` for `handoverAt`/`nextHandover` across the model returns nothing). The drawing's
  `HANDOVER` value is a client-side constant, not derived from a record. See §4.

**"For other roles":**

- _Override recorded_ → real `Movement.overrides: Override[]` exists (`ward-model.ts:508-521`) with
  `at`, `by` (a **role**, e.g. "Flow coordinator" — never a person), `reason` (one of exactly five
  fixed `OVERRIDE_REASONS` strings, `ward-change-reasons.ts:227`), `unitIds: string[]` (the units
  actually referred, plural). The drawing's `WF.OVERRIDES` is a flat mockup-only list with fields
  `o.movement`, `o.unit` (singular), `o.gate`, and a quoted free-text `reasonQ` — **none of
  `movement`, `unit`, or `gate` exist on the real `Override` type.** See §4.
- _Referral awaiting triage_ → `referral.triagedAt === undefined` maps directly to the real
  `Referral.triagedAt?: Instant` (`ward-model.ts:1872`) and the real `isPresent` helper's
  `(inDepartmentAt ?? triagedAt) !== undefined` logic (`ward-referrals.ts:263`). Buildable as
  drawn, using the real field.

**"What is invented and what is real" footer** — same pattern as every other built screen's D-3
invented-figures disclosure; no new data needed, just the standard boilerplate.

## 4. 🔴 What cannot be built honestly

1. **"Gate overridden: `<gate name>`."** The real `Override` type has no field naming which
   eligibility gate (`authorisation`/`cohort`/`security`/`sex_designation`/`forensic`/`sex_mix`/
   `acuity` — `ward-eligibility.ts`) was failing when the override was made. It records **who**,
   **when**, **which fixed reason**, and **which units** — never **which gate**. Rendering a gate
   name here would be inventing a fact the model does not keep. **Name it; do not design a
   replacement wording — the owner decides whether to add a `gate` field to `Override` or whether
   the row drops that clause.**
2. **The quoted free-text override reason (`reasonQ`, rendered in quote marks as if typed).** The
   real `reason` is one of exactly five fixed operational sentences from `OVERRIDE_REASONS`, never
   free text ("never free text, and never an 'other, please specify'" — `ward-model.ts:514`).
   Rendering it in quote-mark styling implies a person typed it live; it is a picklist selection.
   Buildable, but the _presentation_ as a personal quote is not honest and should be corrected to
   plain prose, not quoted.
3. **"Handover sheet due" as a timed, clearable alert.** No field records a shift-handover
   deadline anywhere in the model. This alert has no condition and no timestamp behind it at all —
   it is pure UI decoration in the drawing (always present, "info: true", never clears). This is
   exactly the pattern the brief warns about: an alert with no timestamp and no recorded condition.
   **Unbuildable as a real alert; buildable only as a static reminder line with no data behind it,
   which the owner should approve or reject explicitly.**
4. **`who` addressees ("Bed coordinator", "Triage", "Governance lead") do not match the real role
   vocabulary.** `WardFlowRole` (`ward-flow-roles.ts:23`) is exactly `coordinator | ed | ward |
officer | demo | community`, with `WARD_FLOW_ROLE_LABELS` mapping `coordinator` → "Flow
   coordinator" (not "Bed coordinator"). "Triage" and "Governance lead" correspond to **no role at
   all** in this application. Every `who` label must be corrected to a real `WardFlowRole` label or
   the row cannot say who it is addressed to.
5. **The "distinguish unresolved from unlooked-at" test the brief asks for, generally fails.**
   Neither `InboxItem` nor `Override` nor `Referral` carries an "acknowledged"/"seen" timestamp
   distinct from the underlying fact becoming true or false. `Notice.readAt` (§1b) is the _one_
   field in the whole model built for exactly this distinction, and this drawing does not use the
   Notice system at all — it renders live derived facts, which is honest for "still true right now"
   but cannot honestly claim "still unresolved" versus "true again since nobody looked."

## 5. Owner decisions that bind this screen

- **D-2 (line 106, `owner-decisions-2026-09-1x.md`)** — binding: a communication/message layer
  "must be built," addressed to "a role at a place," seen "when the viewer is in that role," no
  new user/account concept. This screen, if it is to be the alerting surface the owner asked for,
  should render `state.notices` filtered to the active role — which it currently does not attempt.
- **D-3 (line ~193)** — the 12px text floor and the invented-figures notice apply to this screen
  like every other; the footer section already carries the right disclosure pattern.
- **Absence-and-zero rule** (quoted at line ~1919): _"Absence and zero (rule 2): 'none', never a
  bare '0'."_ — and the escalated-count precedent at `delays-screen.tsx:488` / _"Nobody has been
  escalated today. That is a count, not a gap"_ — governs how an empty "Needs you" or "For other
  roles" list must be worded: a stated count of zero over a named population, never a bare "0" and
  never phrasing that reads as "no data."
- No owner text was found using the words "notice," "alert," or "escalation" that specifically
  approves this drawing's taxonomy (Handover sheet due, gate-named overrides) — the search covered
  the whole `owner-decisions-2026-09-1x.md` file; nothing narrower rules those in or out beyond
  what §4 already states.

## 6. The catcher, per section

- **"Needs you," legal-deadline row**: a unit test asserting a movement with
  `legalForm.dueAt` in the past appears with `tone: "danger"` and the same count as
  `buildActionInbox(...).filter(i => i.kind === "legal_timing_breached").length` — a numeric
  reconciliation identical in shape to `reconcileAlerts()` already sketched in the drawing
  (line ~8055).
- **"Needs you," declined row**: a test asserting the count of rows equals
  `movements.filter(m => m.declines.length >= PARALLEL_REFERRAL_CAP && !m.acceptedUnitId &&
m.referredUnitIds.length === 0).length`.
- **"For other roles," overrides**: a test asserting every rendered override row's `reason` text
  is a member of `OVERRIDE_REASONS` verbatim (fails red the moment a gate name or free text leaks
  in) and that no row renders a `gate` field that does not exist on `Override`.
- **"For other roles," referral triage**: a test asserting row count equals
  `referrals.filter(r => r.triagedAt === undefined).length`.
- **Footer**: reuse whatever static-contract test already pins the invented-figures sentence
  elsewhere (D-3) — same wording, same test shape, new screen.
- **"Handover sheet due"**: 🔴 **no catcher can be named**, because no field exists for the
  test to check against. That absence of a catcher is itself the reason this row is a
  stop-and-hand-back, not a build item (§4.3).

## Limits of this reading

- I did not read the full 9,454-line drawing file end to end — I targeted its comments, section
  headings, and the `alertRows()`/`alertRowHtml()`/`reconcileAlerts()` functions, which is where
  the alert-specific logic lives; shared shell/chrome markup (header, rail, search, activity/tasks
  popovers) was skimmed only enough to confirm it is the same shared chrome every other screen
  drawing already carries.
- I did not open every one of the eight `.tsx` files that already consume `buildActionInbox` — I
  confirmed the export and its consumer list by grep, not by reading each rendering.
- I did not check whether any _other_ drawing among the sixteen already claims to render
  `state.notices` — only that no built `.tsx` file does. If another not-yet-built drawing also
  targets the Notice system, that overlap is not something this reading surfaced.
- I did not run any test, gate, or the app itself — static reading only, per the constraint.
- Line numbers cited for `alerts-third-edition.html` and the model files were read directly and
  are exact at the time of this reading; they will drift if either file is edited before a builder
  starts.
