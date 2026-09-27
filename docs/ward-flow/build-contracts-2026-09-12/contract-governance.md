# BUILD CONTRACT — Governance screen

Drawing: `docs/ward-flow/mockups/governance-third-edition.html` (8,878 lines)
Route today: `/mockups/ward-flow/governance` — `src/app/mockups/ward-flow/governance/page.tsx`
No repository file was edited, created, or deleted to produce this contract. Read-only, static.

## 0. Design, or reproduction? — DESIGN. Proceed.

The drawing's own comment block says it keeps "the Live edition's content, behaviour, engine,
data, layout and rigour" and carries a new _visual identity_ (`docs/ward-flow/mockups/
governance-third-edition.html:31-36`). That is a claim about **restyling a previous edition of
this same mockup lineage**, not about reproducing the shipped React component. Nowhere in this
file does it say it was "reproduced exactly" from `GovernanceView` or from any named `src/`
component — the only "verbatim" claim found is scoped to the network/rail data
(`…:4697` "the network, verbatim from the Command third edition"), which is about the rail's unit
list, not this screen's content. Searching for `reproduced|verbatim|exactly` across the file
turned up nothing else. **The screen this drawing draws (an override-review workbench: register +
detail + decision log) is structurally unrelated to what `GovernanceView` renders today (assurance
cards + decision-audit timeline + effectiveness measures) — see §3.** This is a design for a
different concept of "Governance," not a pixel reproduction of the built screen. There is real
build work here.

## 1. What exists today

Route → `page.tsx:1-12` renders `<WardModeWorkspace mode="governance">`
(`src/components/ward-management/ward-management-modes.tsx:566-576`).

Ancestor chrome, from the shared layout every `/mockups/ward-flow/*` route gets
(`src/app/mockups/ward-flow/layout.tsx:78-90`): `WardRail` (nav) + `WardBarMount`/`WardBar`
(header bar, search, drawers) wrap **every** route, this one included.

Inside that, `WardModeWorkspace` renders its own **second, in-content header**,
`ModeHeader` (`ward-management-modes.tsx:117-171`): Ward Flow brand mark, page `<h1>`, a role
`<select>` (`flow`/etc.), "Synthetic prototype" badge, "Updated {clock}", "Scenario set on
{day} · WA" — then `RoleFocus` (`:466-474`), then `GovernanceView`.

`GovernanceView` (`ward-management-modes.tsx:264-455`) renders, in order:

1. Not-a-medical-device banner (`:289-292`, statement text `:176-186`).
2. Six assurance cards (`:293-341`): Explainable proposal, Human authority, Minimum data,
   Contestable outcome, Immutable ownership, Prototype boundary.
3. "Synthetic decision audit" — one movement's timeline (`:349-368`).
4. "Public grounding" — four external links (WA Health System Flow Centre, MHA 2014 forms,
   patient transport, WA Health AI Policy) (`:369-386`).
5. "Change audit" — cross-movement audit list with a governed empty state (`:391-417`).
6. "Effectiveness" — two computed measures (median time to acceptance, average units contacted),
   each with a minimum-sample suppression floor (`:419-460`), plus a "dropped measure" disclosure
   for removed legal-deadline tracking (`:455-460`).

Tests: `tests/ward-governance.test.ts`, `tests/ward-governance.dom.test.tsx`,
`tests/ward-governance-enumerations.dom.test.tsx`, `tests/ward-governance-thin-sample.test.ts`.

## 2. The drawing's sections, in order

Header (`…:4448-4560`): page title "Governance" + synthetic-prototype chip · universal search ·
service filter (network-wide scope note) · Activity/Tasks/Tools drawers · "New referral" (secondary)
· "Record a review" (primary).

Content (`…:4595-4652`, comment `:4408-4416`): a two-column grid.

- Left: one panel, two tabs — **"Overrides for review"** (unreviewed overrides, oldest first,
  network-wide) and **"Access record"** (who opened a record, most recent first, network-wide).
- Right, top: **"Override detail"** — facts for the one override next in the queue.
- Right, bottom: **"Decision and record"** — reviewed overrides with a recorded decision
  (Upheld / Not upheld / Referred on), newest first.

## 3. Three-way diff

### 🔴 APP ONLY (would be silently lost by a literal "make it look like the drawing" upgrade)

| Built today                                                                                                                                    | Lost if replaced                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not-a-medical-device banner + 6 assurance cards (`:289-341`)                                                                                   | The screen's entire "why this is safe" statement — explainability, human authority, minimum data, contestability, immutable ownership, prototype boundary. Drawing has no equivalent panel anywhere.                                                                                                                                                                            |
| "Synthetic decision audit" per-movement timeline (`:349-368`)                                                                                  | The one place a single movement's own decision history is shown end-to-end.                                                                                                                                                                                                                                                                                                     |
| "Public grounding" — 4 real external WA-government links (`:369-386`)                                                                          | The screen's only outbound evidentiary sourcing.                                                                                                                                                                                                                                                                                                                                |
| "Change audit" cross-movement list + governed empty state (`:391-417`), guarded by `tests/ward-governance-enumerations.dom.test.tsx`           | A truthful, exhaustively-enumerated (compiler-checked `Record`) sentence over every audit-entry kind — the exact defect class (`ward-management-modes.tsx:100-110`) this file records having fixed once already.                                                                                                                                                                |
| "Effectiveness" measures + suppression floor + dropped-measure disclosure (`:419-460`), guarded by `tests/ward-governance-thin-sample.test.ts` | The owner's 2026-08-30 ruling that a measure computed from too thin a sample must read as unknown rather than a bare number (`ward-management-modes.tsx:216-236`), and the explicit disclosure that a third measure (legal deadlines) was deliberately dropped.                                                                                                                 |
| `ModeHeader` role selector + `RoleFocus` (`:117-171`, `:466-474`)                                                                              | Role-adaptive framing text. Note: this is a **second header nested inside the shared `WardBar` shell** (`layout.tsx:78-90`) — the same duplicate-chrome shape the layout's own comment (`layout.tsx:60-72`) records as a prior incident on other screens. Whether it should survive at all, independent of this drawing, is a real open question — flagged, not resolved, here. |

### DRAWING ONLY (new content, see §4 for what each needs)

- "Overrides for review" tab (unreviewed-override register, network-wide).
- "Access record" tab (who-opened-a-record register, network-wide).
- "Override detail" panel (facts for the next override in queue, including a "Gate overridden" field).
- "Decision and record" panel (reviewed overrides + decision + reviewer + reviewer's reason).
- Header "Record a review" primary action and its menu.
- Header universal search / service filter / Activity / Tasks / Tools drawers, **as rendered by this specific page's content** — the shell components exist (`layout.tsx`), but whether `WardBar`'s primary-action/drawer content is populated for this route is unresolved (see §4).

### IN BOTH

- "Synthetic prototype" disclosure — drawing's masthead chip (`…:4463-4467`) vs. built badge
  (`:290`, `:176-186`). Wording differs (drawing: "invented, not a medical device"; built: full
  `NotAMedicalDeviceStatement` paragraph) but the underlying claim is the same and neither
  contradicts the other.
- Page title "Governance" (`…:4463` vs `ward-management-modes.tsx:135`).

## 4. Drawing-only sections: data needed, or NOT IN THE MODEL

- **"Overrides for review" tab.** Needs a `reviewed`/`decidedAt` state on an override.
  `Override` (`src/components/ward-management/ward-model.ts:508-517`) carries only `at`, `by`
  (a role, never a person), `reason` (one of five fixed `OVERRIDE_REASONS`,
  `ward-change-reasons.ts:227-233`), and `unitIds`. 🔴 **NOT IN THE MODEL** — no field distinguishes
  a reviewed override from an unreviewed one.
- **"Override detail" → "Gate overridden."** The drawing implies the override names _which
  eligibility gate_ was bypassed (e.g. a specific gate identity). The model's `reason` is a fixed
  narrative sentence ("Clinical urgency outweighs the mismatch", etc.), not a gate identifier.
  🔴 **NOT IN THE MODEL** — there is no gate-identity field to read this from.
- **"Decision and record" panel** (decision: Upheld / Not upheld / Referred on; `reviewer`;
  `reviewerReason`). 🔴 **NOT IN THE MODEL AT ALL.** No type anywhere under `src/` records a review
  decision against an override. The nearest existing thing, `OverrideRegister`
  (`src/components/ward-management/override-register.tsx:1-112`), is explicitly **read-only** — its
  own header comment (`:10-27`) says it receives an already-scoped list and "has no way to narrow
  one," let alone record a decision against one.
- **"Access record" tab, as scoped by the drawing** ("across the whole network," most-recent-first,
  showing _who_ opened a record and _which screen_). The only existing access-log module,
  `src/components/ward-management/search/access-record.ts`, is explicitly **session-only, held in
  one page's `useState`, never persisted, never cross-page** (`:1-19`), and — per a standing ruling
  — carries **no `role`/`who` field at all**, because "the role IS the route you are on" and there is
  no signed-in user to name (`:20-38`, `AccessEntry = { words, at }` — no `who`, no `screen`).
  🔴 **NOT IN THE MODEL** on two independent axes: no durable, network-wide store, and no identity
  field to populate "who."
- **Header "Record a review" primary action.** `WardPrimaryAction` is a closed five-kind union
  (`new-referral`, `record-decision`, `contact-team`, `export-figures`, `none` —
  `src/components/ward-management/ward-nav.ts:512-565`), and `/mockups/ward-flow/governance` does
  not appear in `WARD_PRIMARY_ACTIONS` at all (checked the full table, `:512-565`) — the route
  currently resolves to no primary action. "Record a review" is not one of the five kinds.
  🔴 **NOT IN THE MODEL**, and per D-16 (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md:799-838`) no
  new destination may be invented for it — the ruling's pattern for an undestined control is to
  render "Not wired in this prototype." in its own words, not to invent a working action.

## 5. Governance-screen truthfulness check

The drawing's own text makes checkable claims about what this prototype does. Checked against the
code as it stands:

- **Access record scope claim — DOES NOT HOLD.** The drawing's `renderAccess()` sets the panel's
  scope sentence to _"Every time somebody opened a person's record, most recent first, **across
  the whole network**"_ (`…:5786-5794`) and renders a `who` per row (`…:5799-5807`). This is false
  on the current architecture: the access log is session-only and per-page, not network-wide
  (§4), and there is no `who` to report — a near-identical false claim was already found and ruled
  against once, for a _different_ screen's drawing: D-4
  (`docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md:263-339`, addendum `:390-430`) found and fixed the
  exact same shape of over-claim ("every search is recorded," and separately, a `who` column that
  named nobody), and the fix is enforced by a standing property guard,
  `tests/ward-no-screen-claims-a-durable-access-record.test.ts` (not a string pin — it fails any
  sentence claiming durable/network-wide access recording without a qualifier in the same
  sentence). Built as drawn, this screen would trip that exact guard, or would need to be built
  behind the guard's blind spot — worth flagging loudly rather than building past it.
- **"Overrides for review… oldest first, across the whole network"** (`…:5745`) — the "network-wide"
  framing is at least directionally consistent with the existing `allOverrides()` derivation
  (`ward-derivations.ts:1174`), which already reads across every unit rather than one ward. No
  contradiction found, but "reviewed" status itself doesn't exist yet (§4), so the claim currently
  has nothing behind it to be true or false about.
- **Footer note, register tab** — _"Only a judgement about the patient can be overridden… A fact
  about the world cannot, and the split fails closed"_ (`…:5773-5774`). Consistent with the fixed,
  non-free-text `OVERRIDE_REASONS` list (`ward-change-reasons.ts:227-233`) — holds.
- No claim found in this drawing about "audited" or "approved" status beyond the above.

## 6. Owner decisions that bind this build

- **D-4** (`owner-decisions-2026-09-1x.md:263-339`, addendum `:390-430`) — governs the Access
  record tab directly (§5): no durable claim without an in-sentence qualifier; no `who` field
  without a real signed-in-user model, which D-2 (`:108-150`) rules out for this build.
- **D-16** (`:799-838`) — governs the header's unwired primary action: an undestined control must
  say "Not wired in this prototype." in its own words rather than have a destination invented for
  it. Applies to "Record a review."
- **The changeable-data / invented-figure rule** (`:170-178`, D-3 `:215-262`) — every invented
  figure discloses in its own sentence. The drawing's register/detail/record rows are all
  synthetic; each row-level sentence would need its own disclosure, not a single heading-level
  banner, consistent with D-3's "screen by screen, not as a sweep" ruling.
- No entry in this document rules on the override-review/decision-recording concept itself (no
  "OD"/"D-" item named "review a decision" or "governance decision record" was found) — that
  workflow appears un-ruled-on. Flagged rather than assumed.

## 7. The catcher, per changed section

- **Not-a-medical-device banner + 6 assurance cards** — `tests/ward-governance.dom.test.tsx` /
  `tests/ward-governance.test.ts` must keep asserting these render; an "upgrade" must not remove
  their `data-testid`s or copy.
- **Synthetic decision audit + Public grounding** — same two test files; no dedicated enumeration
  guard found, so a manual diff of removed elements against `ward-management-modes.tsx:349-386` is
  the fallback catcher.
- **Change audit** — `tests/ward-governance-enumerations.dom.test.tsx` (renders the panel, checks
  every audit-entry kind is named in its sentence) must stay green and must still be exercised by
  whatever replaces this panel.
- **Effectiveness measures** — `tests/ward-governance-thin-sample.test.ts` (suppression floor) must
  stay green; both `data-testid`s (`ward-governance-effectiveness-figure` /
  `-suppressed`) must keep existing.
- **Overrides-for-review / reviewed state** — no catcher exists yet because the field doesn't
  exist; a new unit test over the new "reviewed" derivation is required before this ships.
- **Access record (network-wide)** — `tests/ward-no-screen-claims-a-durable-access-record.test.ts`
  is the catcher and must be run against whatever copy this section ships with, not written around.
- **Decision-and-record panel** — no catcher exists; none can until the data model exists. New
  tests required alongside the new type.
- **Header "Record a review" wiring** — `tests/ward-nav.test.ts` pins `WARD_PRIMARY_ACTIONS`
  against the real route tree in both directions; adding a route/kind here must go through it.

## Limits of this reading

- I read the drawing's header, CSS-rule comments, and the four render functions
  (`renderRegister`/`renderAccess`/`renderDetail`/`renderRecord`) in full, but not its ~8,000
  remaining lines (styles, the rail/search/Activity/Tasks/Tools popover bodies, the synthetic data
  generator feeding `unreviewed()`/`reviewed()`/`accessRows()`). A field or claim outside those
  four functions could exist unseen.
- I did not open `docs/ward-flow/mockups/third-edition-kit/check-standard.mjs` or the "standard"
  document the drawing cites by section number (6.10, 6.11, 5.6.10, 5.7, 14.1, 14.2, 8.4) — I could
  not confirm those section numbers say what the drawing's comments claim they say.
  `docs/ward-flow/plans/2026-09-11-standard-clause-draft-every-layer-carries-the-words.md` looked
  like the closest candidate but I did not read it.
  `docs/ward-flow/plans/2026-09-1x-lane-c-drawing-facts.md` §E is cited by the code but I did not
  open it directly. Both docs were referenced by other files rather than read first-hand.
- I did not search the rest of `owner-decisions-2026-09-1x.md` past the headings grep — only D-4
  and D-16 were read in full; other D-/OD- items were identified by heading only and could bear on
  this screen in ways I have not checked.
  Ward Lead's own instruction on the file: 12 of ~19 rulings are his, not the owner's, and are
  explicitly overturnable (`owner-decisions-2026-09-1x.md:12-15`).
- I did not check whether `ModeHeader`/`RoleFocus` are shared with the `network` mode in a way that
  makes removing them from Governance alone inconsistent with that sibling screen.
- I did not run any test, gate, or the dev server — this is a static read only, as instructed.

**If a decision this brief does not cover comes up during build, stop and hand it back.**
