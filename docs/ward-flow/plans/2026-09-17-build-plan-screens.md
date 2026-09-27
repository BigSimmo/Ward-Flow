# Build plan — screens, service chooser and wording (owner answers 32 UI, 38, 41, 43, 44, 45, 51, 52, 54, 55, 56)

> **FOLDED on 17–21 September 2026 into `codex/task-ward-flow-live-state-20260831` (commit `a7c7288668` / `6c33169b03`).**
> Kept for historical reference. For deferred items and active status, see `docs/ward-flow/STATUS.md`.

Read-only Opus planner, 17 Sept 2026. Base: `ward/audit-fixes-20260916` at **`2a1370b008`** (y2, y3, z5, z6,
z7, z9 folded; y4 and y7 not). The line moved three times while this was written (`27c78f40a1` →
`b774f65932` → `2a1370b008`). **Every line number belongs to `2a1370b008`. Re-derive before editing.**

Other plans:

- Items 1–12: `2026-09-17-build-plan-legal-clinical.md`.
- Items 14–37 and 48: `2026-09-17-build-plan-referrals-transport.md` (untracked when read).
- Items 39, 46, 47 and 49 wait for the owner (§9).

Standing rules:

- The drawing leads on design; the engine leads on behaviour.
- Tap targets use `var(--ward-tap)`. Tokens, never hex.
- An unwired control says exactly "Not wired in this prototype.".
- No edge bars, no top highlights.
- Only the controller edits the task ledger, MANIFEST.json, CONTACT-SHEET.html, screen-verification.json and
  SCREEN-VERIFICATION.md.

## 1. Current facts

### 44 and 52 — the service chooser

**Today** (`shell/ward-bar.tsx`):

- `service` is component-local state (:281).
- Options come from `HEALTH_SERVICES` (`ward-model.ts:48`): North Metro, South Metro, East Metro, WACHS, Private.
- `selectService` (:385-402) announces "Service set to X." and calls `onServiceChange`. Nothing passes that
  callback (`WardBarMount`, :1010-1013).
- The panel says "not wired in this prototype" (:521, :550-553).
- Escape says "…Service filtering is not wired in this prototype." (:450-454).

**What carries a service.** Only `Site.service` (`ward-model.ts:531`). No model addition is needed; every
join already exists.

- Units and EDs reach it through `siteCode` (`ward-sites.ts:750-766`).
- A movement has `originEdId` (:892), `referredUnitIds` (:1019) and `acceptedUnitId` (:1020).
- A referral has `originSiteCode` (:2052), each addressing's `acceptedUnitId` (:1778), or an ED destination
  `edId`.
- Its `homeRegion` (:1973) is one of ten `HOME_REGIONS` (:1530). **That is not a service.** Community teams are
  per region (`ward-teams.ts:5-14`).
- Admissions, releases and leave beds carry `unitId`.

**Existing joins.**

- `movementHealthService` (`ward-derivations.ts:203`): origin ED only.
- The handover service case (`handover/handover-page.tsx:153-166`): origin ED, accepted ward, or any ward
  referred to. Also `urgentMovementsOutsideScope` (:203) and an "Outside this filter" section.
- `search/search-filters.ts`: **latent defect.** `homeRegion === service` (:92) can never be true, and
  `ServiceFilter` (:7) omits Private.

**Q-2** (`owner-decisions-2026-09-1x.md:48`): _"catchment is INFORMATION, never a filter. No bed is hidden or
excluded by where someone lives."_ `priority-queue.tsx:146-148` reads this as "never filter referrals by
location".

**Drawings.**

- Command scopes the queue, strip, exceptions, rail and drawers (`command-third-edition.html:4459-4465`,
  :9603-9621). It scopes movements by origin ED (:9571) and referrals by `homeService`. The drawing's own note at
  :5722 calls `homeService` invented, and Q-2 forbids it.
- Capacity scopes its ward list, not the mismatch band (:7755).
- Movements scopes its list, not its figures (:8479-8487).
- Bed board, ward and statistics overview only print a sentence (:7451-7475, :7846-7856, :5709-5722).

**Item 52.** The rail left out the colour-only `.svcStripe` on purpose (`shell/ward-rail.tsx:70-80`). Brand is at
:411-417. Tokens `--svc-east/north/south/wachs` exist (`src/app/ward-flow-shell-tokens.module.css:128-131`).
There is no `--svc-private`.

**Population sites:**

- Command: `coordinator-screen.tsx:196-205`, `pressure-strip.tsx:37-38`
- Capacity: `capacity-screen.tsx:162-196` (map :320, Ready bar :347-354)
- Delays: `delays-screen.tsx:87,120`
- Movements: `movements-screen.tsx:221,335,357`
- Referrals: `referral-board.tsx:258,261`
- Board: `ward-board.tsx:1069` · Ward: `ward-screen.tsx:951-953` · Statistics: `statistics-screen.tsx:183`

### 43, 32, 38

- **43.** `shell/ward-bar.tsx:673-682`: "Record a decision", "Contact a team" and "Export the figures"
  (`ward-nav.ts:601-632`) only call `announceToWardShell`, so screen readers alone hear "not wired". The drawings
  draw menus (`movement-third-edition.html:5735-5742`, `community-team…:5082-5090`,
  `statistics-third-edition.html:5083-5095`).
- **32, release-time defect.** `ward-screen.tsx:155-162` `parseTimeInputToInstant` returns 0–1439, a minute of
  **demo day zero**. It feeds "Expected free" (:759, input :1291-1305) and "Expected return" (:891, input
  :1655-1667). After `ADVANCE_CLOCK` passes midnight, a later-today time lands in the past and reads "due now".
  `releaseBand` (`ward-bed-availability.ts:75`) already has a "tomorrow" band. Its pending branch compares
  calendar days (:89-91), not a rolling 24 hours.
- **32, reports defect.** `statistics-screen.tsx:168-171` counts every occupied or pulled admission as
  "Admissions today" and every departed one as "Discharges today" (labels :235, :240), with no day bound.
  `Admission` has `arrivedAt` and `leftAt` (`ward-admissions.ts:280` on).
- **32, live "today" labels:** `ward-morning-rollup.ts:46-47`, `flow-diagram.tsx:558-559`,
  `ward-management-network.tsx:95-96`, `ward-board.tsx:1476`, `ward-screen.tsx:2755-2759`,
  `capacity-screen.tsx:388-410,1237`.
- **38.** `ward-role-switcher.tsx:94-117` lists the focused patient's accepted or referred wards on **every**
  route. :145-149 builds "Change view — N wards this patient was referred to". It is mounted in Tools
  (`shell/ward-bar.tsx:929`). Audit STILL-03 flags this. `tests/ward-role-switcher-signpost.dom.test.tsx` pins
  it. The role comes from `wardChromeRole` (`ward-chrome-role.ts:27-38`).

### 41, 45, 51, 54

- **41.** z9 moved the browser case to `tests/ui-ward-capacity-morning-moved.spec.ts`; `4ce6cf00b3` deleted
  `ui-ward-morning.spec.ts`. What remains is in §6.
- **45.** `community/community-screen.tsx:455-461` has h1 "Community team", h2 the team name, and subtitle
  "Referrals and bed-flow status." Nothing names the viewer. Design standard §14 row 6 says "The bed coordinator
  and triage". The role is already `coordinator` (`ward-chrome-role.ts:37`).
- **51.** `board.module.css:3417-3420` gives one column at 70rem or less; :3453-3532 gives two tiles and two
  figure columns at 40rem or less. **I found no CSS dropping a column or field, and could not find what the
  question pointed at.**
- **54, drawn order** (`ward-third-edition.html:5735-6024`): This ward · Ward figures, right now · Worth your
  attention · Coming in · Beds on the way out · Awaiting your answer · Today's return · Every bed on this ward ·
  The record for today · Where to refer.
- **54, app order** (`ward-screen.tsx`): This ward :953 · hero :1039 · Ward figures :1099 · Worth your attention
  :1729 · Awaiting your answer :1765 · Today's return :2196 · Coming in :2525 · Going out :2748 ·
  `SuburbTeamPanel` :2781 · Print the handover sheet :2796 · Withdrawn :2838 · Overrides :2919.
- **54, notes.** The note at :2818-2822 expects a fold into "The record for today". I did not identify "the
  print-only panel".

### 55 — wording lists, against `owner-wording-page-2026-09-02.md` (the 17 Sept chat lists are not in the repo)

- **Unchanged:**
  - #1 overrides (`ward-change-reasons.ts:268-274`)
  - #3 ward declines a referral (`ward-referrals.ts:917-956`)
  - #4 board declines (`ward-management-console.tsx:118-126`)
  - #5 blockers (`ward-change-reasons.ts:95`)
  - #7 made ready (`ward-change-reasons.ts:277`)
  - #9 escalation contacts (`ward-change-reasons.ts:68-75`)
  - #10 and #11 (`ward-change-reasons.ts:408-411`)
  - #13 providers (`ward-model.ts:627`)
- **Changed:**
  - **#2 urgent reasons** grew from 6 to 8 (`ward-change-reasons.ts:364`, :399-407). The referrals plan's Q1
    takes it to ten.
  - **#6 waiting-on** gained "Awaiting legal or Mental Health Act process" and "Awaiting transport"
    (`ward-model.ts:1199-1229`).
  - **#8 has two vocabularies for one act.** `PULL_RELEASE_REASONS` (`ward-admissions.ts:238-247`) is unused.
    Beside it, `RELEASE_PULL_REASONS` reads "No longer coming · Bed needed elsewhere · Ward withdrew the bed ·
    Pull made in error" (`ward-change-reasons.ts:23`, :415-418).
  - **#12** "Patient not ready" is now "Not yet ready" (:421).
  - **#14 and #18** are now "Withdrawn — another unit accepted this patient." and "Withdrawn by the referrer."
    (:260-266).
- **New:**
  - `STOP_TRANSPORT_REASONS` (:52)
  - community declines (`ward-model.ts:1505`, labels `ward-referrals.ts:977-981`)
- **ED "Another reason — needs follow-up".** It uses the same `DECLINE_REASON_LABELS`: `ED_DECLINE_REASONS`
  (`ward-model.ts:1464`), the ED picker (`ed-screen.tsx:1693-1695`), `referral-match.tsx:296,723`, and the
  notice (`ward-flow-reducer.ts:4520-4533`). No test covers the ED path.

### 56 — referral histories

- **24** seeded `RF-` referrals: nine Midland rows (`ward-movements.ts:1515-1634`, built :1644-1670) and 15
  literals from :1674.
- `history` is one flat string, capped at 2000 (`ward-model.ts:2101`, :1910).
- Queued ids are pinned (`tests/ward-referral-model.test.ts:1289`, `tests/ui-ward-referrals.spec.ts:362`).
- The legal plan also edits this seed (gender).

## 2. Service chooser — design (item 44)

**Membership.** One pure module, `ward-service-scope.ts`.

- A unit or ED belongs to its site's service.
- A movement belongs to each service among its origin ED, accepted ward and every ward referred to. This is the
  handover join, now shared.
- A referral belongs to each service among its origin site, accepted wards and ED destinations. **Never its home
  region.** Community-team destinations add none.
- An unresolvable item is "no recorded service" and is **always shown**.

**Never hidden:**

- **S1.** The bed shortlist and eligibility candidates (Q-2).
- **S2.** Every scoped movement list states the urgent movements outside the service. "Urgent" is handover's
  `movementIsUrgent`: flagged, or a legal deadline has passed.
- **S3.** Whole-network figures stay whole-network and say so.
- **S4.** Pages about one named place (board, ward, ED, team, statistics sub-pages) are never scoped. They say
  how the chosen service relates to them.

**Per screen:**

- **Command:** the patients queue and pressure strip are scoped. The flow diagram stays whole-network with a foot
  sentence. The shortlist is never scoped. The referrals tab follows referral membership (Q1). S2 applies.
- **Capacity:** the map groups and ward table are scoped. Ready now is scoped, with the network figure in words.
  The mismatch band stays whole-network.
- **Delays:** scoped, plus S2.
- **Movements:** the list is scoped. Figures and the 48-hour chart are not, and a sentence says so. S2 applies.
- **Referrals:** scoped (Q1), with the outside count stated.
- **Bed board, ward page and all seven statistics screens:** a sentence only.
- **Search:** never scoped. A lookup must never say "not found" because of a filter.
- **Rail counts and drawers:** stay whole-network (Q3), and the rail names the service in words.

**Where the choice lives.**

- A module browser store, `shell/ward-service-store.ts`, using `createBrowserStore`. This is
  `useAppearanceStore`'s pattern (`shell/ward-bar.tsx:218`). Server snapshot `null`.
- The bar, rail and screens read it. **No provider edit**, which keeps it clear of unfolded y4.
- It is saved in `sessionStorage` under `ward-flow-service`, **only as an exact `HEALTH_SERVICES` member**.
  Anything else reads as All services. If storage throws, it falls back to memory. D-11-safe: a fixed id, never
  typed text.
- Not in the URL: rail links would drop it silently.
- Demo reset leaves it alone.

### §2 amendment — Ward Lead's decisions D-a to D-f, 2026-09-17

An Opus adversarial review (R1, veto: does any scoped screen hide safety-relevant information?)
found two P1 safety gaps and several P2s in the design above once S1/S2 and the D1/D2 screen lanes
had landed. Ward Lead reviewed R1's findings and ruled the six decisions below, which AMEND this
§2 — they bind wherever they narrow, sharpen, or add to what §2 says, and §2's own text is otherwise
unchanged. Implemented on branch `ward/s-scope-safety-20260917`.

- **D-a — one shared definition of "urgent outside the chosen service".** §2's own S2 line ("every
  scoped movement list states the urgent movements outside the service") relied on
  `movementIsUrgent` (flagged, or a legal deadline BREACHED) — the same rule `handover-page.tsx`
  uses for its own, different, handover-readiness question. R1's P1 finding: a movement whose legal
  form was only RUNNING OUT, or one that had been escalated with no legal form at all, read as not
  urgent and could sit outside a chosen service while the scope bar's own line still read zero.
  `ward-service-scope.ts` now exports `movementIsUrgentForServiceSafety` — flagged urgent, OR a
  delay cause `delays-derivations.ts` lists in `SEVERE_CAUSES`, OR escalated — and
  `urgentMovementsOutsideService` (what every scope bar's count is built from) is repointed at it.
  `movementIsUrgent` itself is untouched and still mirrors `handover-page.tsx` exactly; the two are
  now deliberately different questions. The zero-case scope-bar sentence states the definition:
  "Nothing flagged urgent, running out of time, without a bed anywhere, or escalated is outside
  {S}."
- **D-b — safety registers stay whole-network even when a service is chosen.** On Delays: the
  escalations register and "Worth your attention" (and, within it, every severe-cause group) are
  computed off the WHOLE population, never the service-scoped one, so a genuinely escalated or
  severe-cause patient outside the chosen service is never silently dropped from either. Rows
  outside the service instead carry a visible "Outside {S}" marker. The same applies to Movements'
  own "Worth your attention" band, which was already whole-network by construction and only gained
  the marker.
- **D-c — narrowed absence sentences say "in {S}".** Every absence sentence on Delays whose
  population D1 narrows — "Nobody is waiting in any emergency department right now", "Nobody who
  was on this screen this morning has left it yet", the "Nobody is hidden" blurb, and the
  provenance panel's own narrowed counts — names the chosen service while narrowed. Sentences over a
  population D-b keeps whole-network (e.g. "Nobody has been escalated today.") are unchanged.
- **D-d — an outside jump link opens the drawer, not a scroll to nowhere.** On Movements, a jump
  affordance ("Find WF-xxx in worklist", a stage-summary link) that targets a movement the chosen
  service has scoped out of the worklist opens that movement's own drawer instead of scrolling to a
  row that is not there, and announces: "{id} is outside {S}. Show all services to see it in the
  list."
- **D-e — the Service panel note names only the screens that actually scope.** §3's own hand-written
  sentence ("Command, Capacity, Delays, Movements and Referrals narrow their lists to it") was
  already wrong the day it was written — neither Command nor Referrals read the service choice in
  this codebase. The note now draws its screen list from one export, `SERVICE_SCOPED_SCREENS`
  (`ward-service-scope.ts`), and drops "and each says so", a second claim the panel has no way to
  keep true of every screen it names. Today that list is `["Capacity", "Delays", "Movements"]` —
  Capacity's own scoping landed on the ward fix line after this branch's base and is not present in
  this worktree; it is named on the ward controller's own instruction and reconciled against
  Capacity's actual landed code at the fold.
- **D-f — on Movements, the scope bar moves to the top of the page**, and the "not these figures"
  sentence moves to sit on or above the whole-network panels it is disclaiming (The day, Today's
  traffic, ...), never on the narrowed worklist panel further down, where the caveat would be read
  too late to matter.

Membership rules (§2's own three bullets under "Membership") are unchanged by D-a to D-f — in
particular, whether a declining ward's service counts remains an open owner question, not decided
here.

## 3. Exact on-screen wording

**Service panel**

- Head: "Service". Hint: "scopes the lists". Options: "{n} open" or "none open".
- Note: "One service, or all of them. Command, Capacity, Delays, Movements and Referrals narrow their lists to
  it. The bed shortlist, whole-network figures, the rail counts and the drawers do not, and each says so."
- Escape: "Nothing more to clear. The service stays {S}. Choose All services in the selector to widen the lists."
- Choosing: unchanged ("Service set to {S}." / "Service set to all.").

**Scope bar** (only while a service is chosen)

- "Showing {shown} of {total} {noun}, in {S}." with a "Show all services" button.
- "{n} with no recorded service {is|are} included."
- S2: "{n} urgent {movement|movements} outside {S}: a legal deadline has passed or the patient is flagged
  urgent." When there are none: "Nothing urgent is outside {S}."

**Command**

- Flow foot: "Showing the whole network. The queue is scoped to {S}."
- Shortlist: "Beds are never narrowed by service. Every ward in the network is considered."
- Strip foot: "{n} departments outside {S} are not shown."

**Capacity**

- Mismatch: "Across the whole network, not only {S}."
- Ready: caption "{n} beds ready in {S}", then "Across the whole network: {m} beds ready." With zero ready: "None
  ready in {S}." and no bar, because `WardBar` throws on an all-zero bar.

**Movements** — "The Service selector scopes the list below to {S}, not these figures."

**Referrals** — "Narrowed by the sending hospital and the accepting ward or department, never by where the person
lives."

**Bed board**

- Same service: "The Service selector is set to {S}, which is this ward's own service."
- Other service: "The Service selector is set to {S}. This ward is in {own}. The board always shows this one
  ward."

**Ward** — "This ward is one unit in {own}, so its own figures below do not change with the service."

**Statistics** — "Set to {S}. This page is the whole network's own, so these figures already include {S}." plus
the link "Open {S} statistics" (`serviceStatisticsHref`, `shell/ward-facade.ts:324`).

**Rail (52)**

- Open: a swatch dot plus "Service: {S}".
- Closed: the swatch plus North, East, South, WACHS or Private.
- A dot, not a bar. Private uses `var(--muted)`.

**Top bar (43)** — a menu headed "{label}" with the body "Not wired in this prototype.". The announcement is
unchanged.

**Release times (32)**

- Legend "Day"; radios "Today" and "Tomorrow" (Today is the default; Tomorrow is the next calendar day).
- Release hint: "That time has already passed today, so this bed will show as due now."
- Leave hint: "That time has already passed today, so this bed will show as due back now."

**Reports (32)** — keep "Admissions today" and "Discharges today". Add the caption "{weekday d Month}, midnight
to midnight, across all wards", and count `arrivedAt`/`leftAt` within that calendar day.

**Change view (38)** — off a coordinator route:

- Trigger: "Change view", no count.
- Ward group: "Open the coordinator view to see which wards this patient was referred to."

**Community (45)** — subtitle: "The bed coordinator's view of this team's referrals and bed flow."

**Z1** (only after the engine rolls 24 hours)

- "Confirmed, next 24 hours" · "Expected, next 24 hours"
- "Beds freeing in the next 24 hours"
- "No ward reports a bed freeing in the next 24 hours."
- "Beds freeing in the next 24 hours are not tracked here."

## 4. Tasks

Every brief ends _"If you reach a decision this brief does not cover, stop and hand it back."_

- Write the failing test first. The catcher is that test plus the file's existing suite.
- Tier is Sonnet unless a veto is written.
- **"Token" means only one lane edits that file at a time.**

### Lane S — shell (serial). Holds the `ward-bar.tsx` token.

Agree order with the referrals plan's Q2 (notices, `ward-bar.tsx:353-760`, after y4).

**A1 (S) — item 43**

- Owns `ward-bar.tsx` :625-682 and its CSS.
- Test (in `tests/ward-shell-third-edition.dom.test.tsx`): on `/movements`, `/community/<team>` and
  `/statistics`, clicking shows the visible text exactly "Not wired in this prototype.". Escape closes it and
  focus returns.
- Add the popover to `ui-ward-chrome-header.spec.ts:182`.

**S1 (M) — membership module**

- Owns new `ward-service-scope.ts`, new `tests/ward-service-scope.test.ts`, and `handover-page.tsx` :118-166,
  re-pointed. That file is shared with the referrals plan's :882 task, so take turns.
- Tests: every rule; an unresolvable ED reads as "no recorded service"; **mutating a seeded `homeRegion` never
  changes membership**; `shown + outside = total` for every service over the real seed; anti-vacuity (each service
  has at least one open movement outside it); urgent-outside equals `urgentMovementsOutsideScope`.
  `tests/ward-handover*.test.ts*` stay green.

**S2 (M) — store, bar and scope bar**

- Owns new `shell/ward-service-store.ts`, new `shell/ward-service-scope-bar.tsx` plus its CSS, `ward-bar.tsx`
  :244-257 and :281-555, new `tests/ward-service-store.dom.test.tsx`, and assertion 2's Escape sentence.
- Tests: storage holds exactly the member; garbage reads as All services; a storage throw still works; remount
  restores the choice; no other key is written; the panel has no "not wired"; option counts equal S1's; "Show all
  services" clears and announces; `resetServiceScopeForTests()` exists.

**A3 (S) — item 52**

- Owns `shell/ward-rail.tsx` plus its CSS.
- Test: the visible "Service: South Metro" when open, "South" when closed, nothing under All services.
- Rewrite the :70-80 comment.

**R1 — review of S1, S2 and B1–H1 before their last fold**

- **Opus. Veto: the output is an opinion — does any scoped screen hide safety-relevant information?**

### Screen lanes (after S2; file-disjoint from each other)

**B1 (M) — Command**

- Owns `coordinator-screen.tsx`, `pressure-strip.tsx`, the foot of `flow-diagram.tsx`, `coordinator.module.css`,
  and `priority-queue.tsx`. Start **after** the referrals plan's Q1 releases `priority-queue.tsx:57`. Not
  `shortlist-panel.tsx`, which the legal plan owns; its sentence goes in `coordinator-screen.tsx`.
- Test (`tests/ward-coordinator-service-scope.dom.test.tsx`): rows are members; scope bar and S2 lines are exact;
  **shortlist candidates are identical with and without a service**; the foot is exact; the strip shows only
  in-service EDs.

**C1 (M) — Capacity**

- Owns `capacity-screen.tsx`, its CSS and `bed-map.tsx`.
- Test: map and table are scoped; the mismatch table is identical with and without a service; the Ready caption,
  network line and zero-ready sentence are exact.

**D1 (S) — Delays**

- Test: scoped rows, S2 line, and marks still work under a service.

**D2 (M) — Movements**

- Test: the list is scoped; headline figures and horizon lanes are identical with and without a service; the
  sentence and S2 are exact. Parallel-safe with D1.

**E1 (S) — Referrals**

- Owns `referral-board.tsx`, taking turns with the referrals plan's "Start the bed journey" task.
- Test: scoped by membership; the outside count is stated; a `homeRegion` mutation changes nothing.
- **Build to Q1's recommendation; drop it if he says no.**

**G1 (S) — item 51**

- Measure first with new `tests/ui-ward-board-narrow.spec.ts` at 375, 390 and 820: the tile count equals the 1440
  count; all ten band figures are present; `body.scrollWidth <= innerWidth`; anything wider than its panel sits in
  an `overflow-x: auto` wrapper with "This part scrolls sideways. Some of it is off screen." If already green,
  record "nothing dropped" and stop.

**G2 (S) — board sentence**, after G1

- Test: both branches, and the board markup is identical with and without a service.

**H1 (S) — statistics sentence**

- Owns `statistics-screen.tsx` and `statistics-overview-screen.tsx`.
- Test: figures identical; sentence and link exact.

**H2 (S) — reports**, after H1

- Owns `statistics-screen.tsx` :168-171 and :231-242.
- Test (fails today): an arrival yesterday is not counted and one today is; the same for `leftAt`.
- Check `statistics-claims-register.ts` locators first.

### Lane F — ward page (serial)

Holds the `ward-screen.tsx` token, after the legal plan's :572-652 task and the referrals plan's T4b.

**F1 (M) — item 32 chooser**

- Owns both forms, new `ward/release-day.ts`, and new tests `ward-release-day.test.ts` and
  `ward-release-day-chooser.dom.test.tsx`.
- Test (fails today): with the clock on day 1 at 10:00, Today 14:00 gives 1×1440+840 and Tomorrow 09:00 gives
  2×1440+540. The leave form behaves the same. Hints are exact.

**F2 (M) — item 54 panels**

- First, a mapping table from app section to drawn panel. **If any section has no nearest drawn panel, hand it
  back.** Leave "Print the handover sheet" in place.
- Test: visible `h2` order equals the drawing; every existing section's content is still present (Q-12); the
  landmark-name test stays green.

**F3 (S) — ward sentence** — DOM test.

### Other lanes

**I1 (S) — item 38**

- Owns `ward-role-switcher.tsx` and `tests/ward-role-switcher-signpost.dom.test.tsx`. Rewrite that test
  **deliberately**; its header records that answer 38 supersedes the 3 Sept signpost ruling.
- Test, on `/ward/<id>` with the patient referred to three wards: the accessible name is exactly "Change view"; no
  count and no `data-referred-ward-count`; no other ward name appears; the sentence is exact. The coordinator
  route keeps the count. Mutation: removing the role check turns it red.

**M1 (S) — item 45**

- Owns `community-screen.tsx` :461, taking turns with the referrals plan's :1485 labels task.
- Test: the exact subtitle, and `wardChromeRole(".../community/x") === "coordinator"`.

**J1 (S) — item 55**

- New `tests/ward-wording-lists.test.ts` pins §1's lists verbatim, **except `URGENT_MARK_REASONS`**, which the
  referrals plan's Q1 changes.
- It also checks that an ED-addressed `DECLINE_REFERRAL` with `another_reason` shows "Another reason — needs
  follow-up" on the ED picker, in referral-match and in the notice.
- Test-only; if red, hand it back. Do not merge the two pull-release lists.

**K1 (S) — item 56 census**

- New `tests/ward-seed-referral-census.test.ts` pins, from `seedWardFlowState()`: referrals by source and state,
  queued ids, per-team counts, `wardNavCounts` referrals and statistics referral figures. It is green when written
  and is the catcher for K3.

**K2 (M) — item 56 rewrite**

- Owns `ward-movements.ts`, **`history:` strings only**, after the legal plan's seed-gender task.
- Test (`tests/ward-referral-history-honesty.test.ts`): at most 2000 characters; no `/\b(RF|WF|AD|PT)-\d+/`, no
  URL, no "section"; the pronoun matches the linked patient's recorded gender; no suburb other than the
  referral's own. K1 stays green. Sonnet drafts. **Opus reviews. Veto: the output is clinical narrative judged for realism.**

**K3 (M) — item 56 additions (waits for Q2)**

- An appended block of already-decided referrals, none queued.
- No `patientId` or `acceptedUnitId` without a matching record.
- K1 is updated in the same commit, with the figure diff in the message.

**L1 (S) — item 41**

- Sonnet prepares the §6 edits. **Ward Lead deletes**, with the owner's yes routed via the Verifier, in one commit
  after a verified backup.

**P1 (S) — service journey**, after B1, C1 and D1

- New `tests/ui-ward-service-scope.spec.ts`: choose South Metro on Command; through the rail to Delays and
  Capacity, with the scope bar on each; reload keeps it; "Show all services"; no sideways page scroll at 390.
- **Run by name: ward journeys run in neither loop.**

**Z1 (S) — live 24-hour labels**

- Last. It waits for the engine half of item 32 (see Risk 2), and for B1, C1, F and G.
- Owns the Z1 sites in §1. Test: the §3 strings.

## 5. Lanes (no file shared between concurrently running lanes)

- **S:** A1 → S1 → S2 → A3 → R1
- **B:** B1
- **C:** C1
- **D:** D1 and D2
- **E:** E1
- **G:** G1 → G2
- **H:** H1 → H2
- **F:** F1 → F2 → F3
- **I:** I1 · **M:** M1 · **J:** J1 · **L:** L1
- **K:** K1 → K2 → K3
- **P:** P1 · **Z:** Z1

**Start now:** I, J, K1, L, G1, and M1 once the referrals :1485 task clears. **After S2:** B, C, D, E, H and F3.

**Tokens shared with other plans:**

- `ward-bar.tsx`: referrals Q2
- `handover-page.tsx`: referrals, at :882
- `priority-queue.tsx`: referrals Q1
- `referral-board.tsx`: referrals, "Start the bed journey"
- `community-screen.tsx`: referrals, at :1485
- `ward-screen.tsx`: legal plan, and referrals T4b
- `ward-movements.ts`: legal plan, gender seeds

## 6. Morning retirement (item 41)

**Delete** (protected; back up and verify the bundle first):

- the route: `src/app/mockups/ward-flow/morning/page.tsx`;
- in `src/components/ward-management/morning/`: `morning-page.tsx`, `morning-tour.tsx`, `morning.module.css`,
  `morning-tour.module.css`;
- `tests/ward-morning-page.dom.test.tsx`, `tests/ward-morning-tour.dom.test.tsx`,
  `tests/ward-morning-tour-paused.dom.test.tsx` (all `describe.skip`);
- `tests/ward-morning-print.test.ts`, which is **live**: seven describes over `morning.module.css`.

**Keep:**

- `ward-morning-rollup.ts`, imported at `ward-board.tsx:39`, `ward-nav-counts.ts:3`, `ward-chrome-header.tsx:13`
  and `ward-standing-strip.tsx:15`;
- `tests/ward-morning-rollup.test.ts`, `tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx`,
  `tests/ui-ward-capacity-morning-moved.spec.ts`;
- all docs.

**Edit in the same commit:**

- `ward-nav.ts:176` (the `"morning"` id) and :460-466 (the stub entry)
- `tests/ward-nav.test.ts:256,1341` · `tests/ward-landmarks.test.ts:145` ·
  `tests/ward-component-reachability.test.ts:142-147`
- `scripts/check-ward-data.mjs:51,817-839`: the tour-id check goes, recorded as a deliberate guard removal;
  also `tests/ward-data-checker.test.ts:421-432,545-548,575`
- `scripts/check-docs-links.mjs:117-122`
- `scripts/design-system-contract-baseline.json:193`
- `scripts/ward-flow/text-size-floor-baseline.json:18-19`
- a `diff-integrity.json` entry for the removed live cases
- regenerate `SCREEN-MAP.md`

**Catcher:**

- the ward suite, where "files handed in" equals "files that ran";
- `check:diff-integrity`;
- `node scripts/check-ward-data.mjs`.

## 7. Pinned-figure tests K3 will likely move (named by grep, not all opened)

- **Queue ids:** `ward-referral-model.test.ts:1289`, `ui-ward-referrals.spec.ts:362`
- **Community:** `ward-community-hub.dom.test.tsx` (215-261, 1065), `ward-community-figures.dom.test.tsx:68`
- **Statistics:** `ward-statistics-community-figures.test.ts`, `ward-statistics-claims.test.ts` (plus
  `statistics-claims-register.ts`), `ward-statistics-derivations.test.ts`
- **Referral counts:** `ward-referral-withdrawn-counts.test.ts`, `ward-referral-no-bed-breakdown.test.ts`,
  `ward-referral-awaiting-answer.test.ts`, `ward-referral-visibility.test.ts`
- **Screens and search:** `ward-delays-derivations.test.ts`, `ward-ed-psychiatry-hub.dom.test.tsx`,
  `ward-ed-screen.dom.test.tsx`, `ward-patient-search.dom.test.tsx`, `ward-search-preview.dom.test.tsx`,
  `ward-role-switch-architecture.test.ts`
- **Figure markers:** `ward-invented-figures.test.ts`, `ward-announced-figures-carry-their-marker.test.ts`
- **Recorded acceptance:** the "nine-row Midland" community acceptance in SCREEN-VERIFICATION.

## 8. Risks

1. **The line moves.** It moved three times during planning.
2. **The engine half of item 32 has no owner.** The referrals plan skips item 32, and this plan was asked for the
   UI only. Nobody makes `releaseBand`'s pending branch (`ward-bed-availability.ts:89-91`) count a rolling 24
   hours. Z1 waits on it. Ward Lead should route one Sonnet task, with the catcher "a release 23 hours ahead that
   crosses midnight counts as freeing on a live screen".
3. **Shared files with other plans** (§5 list). Take turns; never run two lanes on one file.
4. **A scoped screen hides something safety-relevant.** Mitigated by S1–S4, the shortlist-identical test and R1.
5. **A scope that silently does nothing passes every membership test.** Counterweights: S1's anti-vacuity check
   and the identical-with-and-without tests.
6. **A reloaded, still-filtered page gets read as the whole network.** The scope bar and rail word mitigate it;
   P1 proves they survive a reload.
7. **Service names differ between drawing and engine.** The drawing has "WA Country" and no Private. Keep the
   engine's names and record the deviation.
8. **Visual acceptance goes stale** on Command, Capacity, Delays, Movements, Referrals, Board, Ward and Statistics.
   They need a fresh look at 390, 820 and 1440, light and dark. No gate sees layout.
9. **The Morning retirement removes a live test file and one data-checker check.** Both need a record.
10. **Items 51 and 54 rest on thin evidence.** G1 measures first; F2 hands back.
11. **Defects found in passing:**
    - `search-filters.ts:92` and :7 (a separate S task);
    - `statistics-screen.tsx:168-171` (H2);
    - the two pull-release vocabularies.

## 9. Owner questions (one recommendation each)

- **Q1 — referrals and the Service selector.** Q-2 says home area is never a filter, and the code reads it as
  "never filter referrals by location." _Recommendation:_ narrow referral lists by the sending hospital's and the
  accepting ward's or department's service only. Never by home area; always show how many are outside.
- **Q2 — new example referrals.** They move counts on Referrals, Community and Statistics. _Recommendation:_
  rewrite the existing 24 histories now (no figure moves). Then add six referrals, all already decided and none
  waiting, and accept one reviewed change to those counts.
- **Q3 — rail counts and the Activity and Tasks drawers.** The drawing narrows them. _Recommendation:_ keep them
  whole-network so a breach elsewhere is never hidden, with the rail naming the chosen service in words.

**Needed before planning 39, 46, 47 and 49:**

- **39:** two served 1440 screenshots, labelled A and B: approved Settings (`git show
1ef9ed3975:docs/ward-flow/mockups/settings-third-edition.html`) and the current file (rebuilt in `ae908cdd1b`,
  `6ad62eb63c`, `f0e5ea88f9`). `settings-perfected-third-edition.html` is reference only. Then his pick.
- **46:** a served screenshot of the Command drawing's "Statewide flow" panel. It carries its own ward list
  (`command-third-edition.html:4747`). Circle the ward labels, give the count of wards drawn against the app's 23,
  and state the original question in one sentence.
- **47:** the drawing's name, plus served captures of its rail "Search" row beside one that has the statistics
  link. The rail is script-built, so reading the file is not enough.
- **49:** a screenshot of `/ward/[unitId]`'s box, `ward-screen.tsx:2322-2330`. It is the **free-text** field
  "Anything limiting who can come in right now", which the persistence default-deny treats as typed text.
  Restate the earlier recommendation: a fixed list he supplies.
