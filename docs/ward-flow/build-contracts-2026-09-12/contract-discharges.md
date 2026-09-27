# Build contract — Discharges

Read-only research. No repository file touched. Worktree: `D:\Worktrees\Database\ward-lead`.

## 1. What exists today

- Route: `src/app/mockups/ward-flow/discharges/page.tsx` — renders `<DischargeBoard />`, wrapped by the shared `src/app/mockups/ward-flow/layout.tsx` (provides `WardFlowProvider`, `WardRail`, `WardBarMount` — the header/search/Activity/Tasks/Tools/service-selector chrome for every ward-flow route, not owned by this screen).
- Screen component: `src/components/ward-management/discharges/discharge-board.tsx` (366 lines) — `DischargeBoard` + exported `groupDischarges` + exported `DischargeGroupSection`.
- Styles: `src/components/ward-management/discharges/discharges.module.css`.
- Tests: `tests/ui-ward-discharges.spec.ts` (Playwright, two tests — one is a capacity-board lifecycle journey that never visits `/mockups/ward-flow/discharges`; the other, from line 294, does and pins column contract + no-horizontal-clip at 641–820px), `tests/ward-discharge-board.dom.test.tsx`, `tests/ward-discharge-column-contract.dom.test.tsx`, `tests/ward-discharge-blocked-emphasis.dom.test.tsx`, `tests/ward-board-discharge.dom.test.tsx`, `tests/ward-discharge-dates.test.ts`.

Built screen renders, in order (`discharge-board.tsx:169-209`):

1. Governance banner (`data-testid="ward-discharge-governance"`, line 176-183).
2. Page header: `<h1>Discharges</h1>` + subtitle "Every bed release across the network, blocked ones first." (line 185-188).
3. Four group sections in fixed `GROUP_ORDER` — Blocked, Confirmed, Expected, Discharged today (line 55, 190-192) — each a `<WardTable>` **and** a `<ul className={cardList}>` card rendering of the same rows (line 284-361), CSS-switched at `max-width: 40rem` (`discharges.module.css:229-241`, comment: _"Phone: cards, never a squeezed table (D9)"_).
4. Footer: `excludedBeyondToday` / `completedBeforeToday` counts (line 194-205).

## 2. Drawing's sections, in order

`docs/ward-flow/mockups/discharges-third-edition.html` (11,851 lines total — see limits below).

1. Header (shared third-edition shell): title "Discharges" + "Synthetic prototype" chip (tooltip only carries the governance sentence, line 4442), universal search, Service menu, Activity/Tasks/Tools drawers, "New referral" menu (line 4437-4520).
2. `#qFilter` — a filter bar under the header, shown only when a service is chosen; explicitly stated as decorative for this page (comment, line ~4413-4418: the four groups "stay network wide" regardless).
3. Panel "Blocked" (`#grpBlocked`, line 4537) — table: Unit, Health service, Expected, Stage, Blocker, Freshness.
4. Panel "Confirmed" (line 4546) — same columns minus Blocker.
5. Panel "Expected" (line 4555).
6. Panel "Discharged today" (line 4564).
7. "Outside the four groups" footer section (line 4574) — excluded/completed counts, worded sentence explaining why both exist.

Everything past line ~4620 (through 11,851) is the shared third-edition JS "kit" (candidate shortlist, eligibility gates, referral placement, ward detail drawer, MOVEMENTS/REFERRALS fixtures) copied into this file along with every other third-edition mockup. **It is dead on this page**: there is no `id="slPanel"` (or any shortlist-panel element) anywhere in the Discharges DOM, and the file's own comment states it outright — _"This board shows bed releases, and a bed release carries nothing that could identify who is leaving, so \[a movement id\] is not shown here"_ (`selectMovement`, ~line 8853) and the earlier comment at line ~4608: _"There is no queue, no shortlist and no candidate list on this screen... the shared shell's per-movement UI is not drawn here."_ Not a real "section" of this drawing — ignore for the diff.

## 3. The three-way diff

### APP ONLY (would be lost by a naive rebuild) — flagged first

1. **Phone card layout for all four groups.** `discharges.module.css:229-241` swaps every group's `<WardTable>` for a `<ul class="cardList">` below 640px ("a table is right at a desk and wrong in a corridor"). The drawing has no `.cardList` anywhere (`grep` returned nothing) — its tables rely only on a horizontal-scroll wrapper (`.tableWrap`, mockup line 2325+) and a `pointer:coarse` affordance. **Lost if rebuilt to the drawing as-is:** every ward-flow coordinator on a phone loses the card view and gets a squeezed/scrolling table instead — the exact anti-pattern D9 was written to rule out.
2. **The specific governance sentence.** Built banner (line 178-182): _"This board is not a medical device. It shows only what a ward has recorded — a release expected, confirmed or discharged, and whether it is currently blocked — and it never adds an expected or unreleased bed into the Ready figure."_ The drawing only carries the generic shared-chip tooltip ("Not a medical device and not clinical decision support") — it never states the screen-specific clinical-safety fact that an expected/unreleased bed never inflates the Ready figure. **Lost if rebuilt to the drawing:** a screen-specific clinical-governance claim disappears, replaced by the generic prototype disclaimer everyone already sees on every screen.
3. **The page subtitle.** "Every bed release across the network, blocked ones first." (line 187) has no counterpart text anywhere in the drawing's markup. Minor, but it's the one sentence stating the sort rationale to a first-time reader.

### DRAWING ONLY (drawing has it, app doesn't)

None found. Everything in the drawing's real (non-dead-kit) markup — the four panels, their six/five-column tables, the empty-state sentences, and the two footer counts — has a direct counterpart in `discharge-board.tsx`, and the drawing's own comment (mockup line ~8453) says so explicitly: _"The built screen's own logic (discharge-board.tsx, groupDischarges) reproduced here."_

### IN BOTH (wording differences noted)

- Four groups, same order, same grouping rule (blocker flag read before stage), same band-based sort — `groupDischarges` (`discharge-board.tsx:93-156`) vs `groupDischarges` (mockup line ~8557).
- Blocker column present only in Blocked, absent from the other three (Ward Lead ruling E16) — matches on both sides (built: `showsBlocker`, line 270; mockup: `showsBlocker`, line ~8744).
- Footer counts and the "why two populations" framing — matches (`discharge-board.tsx:194-205` vs mockup `renderGroups`, line ~8815).
- **Wording difference, worth a decision before build:** built empty-state text uses an em dash — `"None — no release is currently blocked."` (`discharge-board.tsx:280`, `EMPTY_REASON` line 65-70). The drawing's `EMPTY_SENTENCE` (mockup line ~8483-8489) uses a period instead — `"None. No release is currently blocked."` — with an explicit comment: _"no dash is used as punctuation anywhere on this page (2026-09-11 correction)."_ This reads as a deliberate wording correction made in the drawing that the built screen has not received. Flag it; do not silently pick one.
- Header/search/service-menu/Activity/Tasks/Tools/New-referral chrome — provided by the shared layout (`WardRail` + `WardBarMount`, `src/app/mockups/ward-flow/layout.tsx:97-112`, backed by `src/components/ward-management/shell/ward-bar.tsx`), not by `discharge-board.tsx` itself. Comments on `ward-bar.tsx` describe it as built to the same third-edition shell the drawing's own header reproduces. Not screen-specific, so not a defect of this screen's contract either way — but a rebuild must not duplicate this chrome inside `DischargeBoard`.
- Service selector does not filter the four groups on either side — the mockup says so in words (line ~4413-4418: groups "stay network wide"), and `DischargeBoard` takes no service/filter prop at all — consistent.

## 4. Data needed for drawing-only sections

None — section 3 found no drawing-only sections, so there is nothing new to source from the model. For completeness: every field the drawing's table/footer use — `unitId`, `state`, `expectedAt`, `blocker`, `confirmedAt`, `confirmedBy` — has a live counterpart on `BedRelease` in `src/components/ward-management/ward-model.ts:1121-1180`. One model field, `waitingOn` (`ward-model.ts:1140`, `BedReleaseWaitingOn | null`), is present in the mockup's synthetic data array (e.g. mockup line 8620) but is **not rendered anywhere** on either the drawing's or the built board's actual UI — it is validated (mockup line 9119-9122) but never displayed as a column or section on this screen, so it is not part of the diff.

⚠️ Per the brief's own warning: any drawing-only section proposing change-over-time would be a strong candidate for "not in the model" given roughly five departed admissions network-wide and ~18 wards with no discharge history at all — moot here since no such section exists on this screen.

## 5. Owner decisions binding this screen

`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md:169` — **"The third bed stage is _discharged_, never _released_" (2026-08-30).** Both the built screen (`bedReleaseStateLabels`, imported from `ward-derivations.ts`) and the drawing's own `STAGE_LABELS = { expected: "Expected", confirmed: "Confirmed", discharged: "Discharged" }` (mockup line ~8476) use "Discharged." No contradiction found. I did not open every other rule in that ~2,300-line document; I searched specifically for "discharged"/"released" and read the surrounding context of each hit (lines 169, 322, 671, 1333, 2175, 2265, 2333) — none of the others bear on this screen's sections.

## 6. Catchers per changed section

- **Phone card layout (APP ONLY item 1).** Add/keep a Playwright check at a viewport below 640px asserting `[data-testid^="ward-discharge-cards-"]` is visible and `[data-testid^="ward-discharge-table-"]`'s wrapper (`.tableScroll`) is not — `tests/ui-ward-discharges.spec.ts` currently only checks 641-820px (line 351: `for (const width of [641, 700, 760, 820])`), so nothing today would go red if the card list were simply deleted. This is the one gap I'd close before any rebuild.
- **Governance sentence (APP ONLY item 2).** A DOM test asserting `getByTestId("ward-discharge-governance")` contains the exact "never adds an expected or unreleased bed into the Ready figure" clause, not just the generic prototype-chip tooltip text.
- **Page subtitle (APP ONLY item 3).** A DOM/Playwright assertion on the subtitle text under the `<h1>`.
- **Four-group order and grouping rule.** Already covered: `tests/ward-discharge-board.dom.test.tsx` and `groupDischarges` unit coverage (`tests/ward-board-discharge.dom.test.tsx`) pin `GROUP_ORDER` and the flag-before-stage rule.
- **Column contract (Blocker only in Blocked).** Already covered: `tests/ward-discharge-column-contract.dom.test.tsx` and the `DISCHARGE_COLUMNS`/`DISCHARGE_COLUMNS_NO_BLOCKER` assertion in `tests/ui-ward-discharges.spec.ts:344-350`.
- **Empty-state wording (dash vs. period).** Whichever wording the owner confirms, add/keep a text-exact assertion on `EMPTY_REASON`/`grpBlockedNote`-equivalent strings — currently nothing pins the punctuation itself, only the DOM test's rendered text.
- **Blocked-group elevation only while non-empty.** Already covered: `tests/ward-discharge-blocked-emphasis.dom.test.tsx`.

## The limits of my reading

- I read the drawing's real markup and its `RELEASES`/rendering functions in full for the Discharges-specific logic, but did not read all ~11,850 lines line-by-line; I sampled the shared-kit JS (shortlist/candidates/eligibility/referral sections) enough to confirm it is unreachable dead code on this page via its own comments and the absence of `slPanel` in the DOM, not by executing the page.
- I did not run the app, the Playwright suite, or any DOM test — static reading only, per the brief.
- I did not open `ward-derivations.ts`, `ward-admissions.ts`, or `ward-referrals.ts` in full; I confirmed the one field question (`waitingOn`) directly against `ward-model.ts` and the mockup's own data/validation code, which was sufficient since no drawing-only section required a broader model search.
- I read `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` only at the "discharged"/"released" hits and their immediate context, not cover to cover; a ruling elsewhere in that document that happens to bear on this screen without using either word would not have surfaced.
- I did not verify the shared shell (`WardBar`/`WardRail`) pixel-for-pixel against the drawing's header — I confirmed its existence, its mount point, and that comments on it claim third-edition-shell parity, but did not diff its search/service/drawer behaviour item-by-item, since header chrome is shared across all ward-flow routes and not owned by this screen's contract.
