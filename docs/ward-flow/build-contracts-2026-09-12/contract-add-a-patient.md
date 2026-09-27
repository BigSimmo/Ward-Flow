# BUILD CONTRACT — Ward Flow Add a patient (third-edition drawing)

Drawing: `docs/ward-flow/mockups/add-a-patient-third-edition.html`
Built screen: `src/components/ward-management/patients/add-patient.tsx` (+
`add-patient.module.css`), route `/mockups/ward-flow/people/new`
(`WARD_ADD_PERSON_HREF`, `ward-nav.ts:358`), page wrapper
`src/app/mockups/ward-flow/people/new/page.tsx`.
Existing test: `tests/ward-add-patient.dom.test.tsx` (23 cases before this change).

---

## 0. The four questions the brief demands answered before any code — answered first

**1. What act does this drawing dispatch?** Creating a new **person identity record** — record
number, date of birth, given name, family name (and, in the drawing, Sex/Gender) — that links to
**nothing**: no referral, no movement, no bed. The drawing's own copy states this four times in
four different sections (`add-a-patient-third-edition.html:4754`, `:4826-4827`, `:4874-4876`,
`:4903`). This is exactly `ADD_PATIENT` (`ward-flow-events.ts:346-353`, case at
`ward-flow-reducer.ts:1054-1081`), already dispatched by the built `AddPatientForm`
(`add-patient.tsx:292-300`).

**2. Is it the same act as `raise-a-referral-third-edition.html`?** **No.** That drawing (and its
built counterpart, `referral-intake.tsx`) dispatches `RECEIVE_REFERRAL`
(`referral-intake.tsx:1287-1308`) — a payload of `source`, `destinations`, `urgency`, `homeRegion`,
`ageBand`, `transportNeeded`, optionally a `patientId` pointer. Nothing about a referral names an
identity; nothing about `ADD_PATIENT` names a destination. The add-a-patient drawing's own header
menu makes the boundary explicit: "New referral… Opens the Raise a referral screen with the source
prefilled. Not wired in this prototype" (`add-a-patient-third-edition.html:4726-4739`), and its
"what happens next" panel says raising a referral is "the next, **separate** action" once the
person exists (`:4874-4876`). The two screens cross-reference each other by name and neither
absorbs the other.

**3. Is it the same act as the existing referral board's entry point?** **No.** The referral board
(`referral-board.tsx`) manages the referral **queue and matching act** (`ACCEPT_REFERRAL` /
`DECLINE_REFERRAL`, dispatched from `referral-match.tsx:243-255`) for referrals that already exist.
It has no identity-creation act at all — a referral's `patientId` is optional and, when raised
without one, points at nobody (`referral-intake.tsx:1295-1297`'s own comment). Nothing on this
screen or the referral board writes a `Patient` record.

**4. Does a route already exist?** **Yes**, and it is not a stub — it is a mature, previously-built
screen. `/mockups/ward-flow/people/new` renders `AddPatientForm`, reached today only from
`patient-search.tsx`'s empty state (`WARD_ADD_PERSON_HREF`, `patient-search.tsx:664`,
`patient-typeahead.tsx:419`) and proven reachable by `tests/route-reachability.test.ts` (per
`add-patient.tsx:116`'s own comment — not independently re-verified in this reading, per §3's own
enumerate-don't-grep instruction I still had to rely on that file's word for the reachability
proof; see Limits). **Route enumeration performed**, not grepped for the name I expected: read
`ward-nav.ts` in full for `WARD_NAV`, `WARD_VIEWS`, and `WARD_PRIMARY_ACTIONS`. Two findings from
that enumeration matter directly to this contract:

- `WARD_ADD_PERSON_HREF` (`/mockups/ward-flow/people/new`) is **not a member of `WARD_NAV`**
  (Ward Flow's own section list) — reachable only via the search empty-state link, by design (no
  standalone nav entry), same discipline the referrals contract records for the intake form
  (`contract-referrals.md` §1, surface C).
- `WARD_ADD_PERSON_HREF` is **absent from `WARD_PRIMARY_ACTIONS`** (`ward-nav.ts:512-604`), the
  pinned, sixteen-route contract for the _original_ third-edition batch
  (`docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md`). That list's own header
  comment states it is not every route and that everything outside it — named examples given —
  keeps using the legacy `roleAction()`. `resolveWardPrimaryAction` returns `undefined` for an
  absent route, and `WardBar` renders **no** primary-action button for `undefined`, identically to
  an explicit `{ kind: "none" }` entry (`ward-bar.tsx:86-87`, `:569`). The net effect today already
  matches the drawing's own stated intent — "the one primary [is] Add the patient, in the identity
  panel" (`add-a-patient-third-edition.html:4723-4725`), i.e. **not** the header's New referral —
  so this is not a visible defect. It is reported under §6 as a shared-file item only because
  `WARD_PRIMARY_ACTIONS` is the pinned contract file (`ward-nav.ts:507-511`: "a route dropped… a
  route added twice… all redden") and `THIRD_EDITION_MOCKUP_ROUTES` was not read in this session to
  confirm whether this route belongs in that pinned set at all — adding an entry without that check
  could as easily break `tests/ward-nav.test.ts` as fix anything. **Not edited. Handed back to the
  controller as an open question, not a defect.**

**Conclusion: this is a different act from both referral drawings, built only where it can state a
concrete difference (§0 above), consistent with §2's instruction. Proceeding to build (an upgrade
of an existing screen, not a new one) is correct.**

---

## 1. The three-way diff

### IN BOTH (drawing and the built screen already agree)

| Item                                                                                                                                           | Drawing                                           | App                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Record number, given name, family name, date of birth — four required text fields, nothing else                                                | `add-a-patient-third-edition.html:4762-4776`      | `add-patient.tsx:52-57`, `PatientDraft`                                   |
| Submit disabled until every field answered, reason stated by field name, `aria-disabled` (not native `disabled`) so the reason stays reachable | `:4801-4812`, `renderAvailability()` `:6088-6106` | `add-patient.tsx:283-310`, `:531-568`                                     |
| Live duplicate check, never gated on submit, three states (unchecked / none / matches)                                                         | `:4836-4865`, `renderDuplicate()` `:6044-6084`    | `add-patient.tsx:162-235`, `duplicateCandidates` (`ward-patients.ts:385`) |
| Duplicate check never blocks Add the patient                                                                                                   | `:4855-4863` (states three outcomes, no gate)     | `add-patient.tsx` — `answered` is independent of `foundSomething`         |
| Synthetic-prototype badge / "not a medical device" framing                                                                                     | `:4655-4659`                                      | `add-patient.module.css` `.governanceBanner`, `add-patient.tsx:315-322`   |
| Page title "Add a patient" and the one-line description that adding creates no referral/movement/bed                                           | `:4654`, `:4753-4756`                             | `add-patient.tsx:325-329`                                                 |

### DRAWING ONLY (the drawing contributes something the app lacks)

| #   | Item                                                                                                                               | Drawing evidence                           | In the model?                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Gender field** (Female / Male / Not yet recorded)                                                                                | `:4784-4795`                               | **Yes, already.** `ADD_PATIENT.gender?: Gender` (`ward-flow-events.ts:349`), reducer validates against `GENDERS` and stores it only when supplied (`ward-flow-reducer.ts:1063-1080`). The built form simply never rendered a control for an already-modelled, already-optional field. **Built in this change.**                                                                      |
| D2  | **Sex field** (Female / Male, drawn as required)                                                                                   | `:4777-4783`                               | **No.** `Patient.sex?: string` exists (`ward-patients.ts:112-117`) but is **free text**, not a two-value enum, and **no event writes it** — `ADD_PATIENT` has no `sex` parameter at all (confirmed: the only `sex:` in `ward-flow-events.ts` is `RECEIVE_REFERRAL`'s own `Sex` field, a different, ward-bed-matching concept entirely, `ward-model.ts:137`). **Not built — see §2.** |
| D3  | "Where they are coming from, and who is asking" panel: ED / community-team source chips, one sentence naming who may add a patient | `:4817-4834`                               | Yes — restates `EVENT_ROLE.ADD_PATIENT: ["ed", "community", "coordinator"]` (`ward-flow-events.ts:1405`) in plain words, already true of the running system. **Built.**                                                                                                                                                                                                              |
| D4  | "What happens next" panel: adding opens the person's own screen; referring is the next, separate step                              | `:4867-4879`                               | Yes — already the built screen's actual behaviour (`add-patient.tsx:258-281`, navigates to `/people/<id>`). **Built**, as a static restatement of real behaviour, not a new capability.                                                                                                                                                                                              |
| D5  | "Already on the board" side panel: five people, a running count                                                                    | `:4883-4897`, `renderBoard()` `:6110-6134` | Partially. The drawing's own `renderBoard()` sorts its **synthetic `MOVEMENTS`** fixture by `waited` ascending and labels the result "added most recently" (`:4891-4893`). See §2 — **built, but reworded**, because the real `Patient[]` array cannot honestly support that specific claim.                                                                                         |
| D6  | Secondary "New referral" menu in the screen's own header (ED / community, "not wired")                                             | `:4722-4741`                               | This is shared-shell territory (`WardBar`'s `primaryAction`), not this screen's own markup — see §0 finding 4 and §6. **Not built here.**                                                                                                                                                                                                                                            |

### APP ONLY (🔴 the dangerous list — already in the app, absent from the drawing; every one of these must survive)

| #   | Item                                                                                                                                                                                                                                                                                                                                                                    | Where                                                                             | Kept?                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| A1  | **Exact-duplicate tiers**: record-number collision (flat, never hedged), same-name-same-DOB, same-name-DOB-unconfirmed, deduplicated by identity across all three tiers                                                                                                                                                                                                 | `add-patient.tsx:230-235`, tests at `tests/ward-add-patient.dom.test.tsx:367-467` | **KEPT** — untouched                              |
| A2  | The "date of birth differs" false-statement guard (never claims dates differ when DOB is blank)                                                                                                                                                                                                                                                                         | `add-patient.tsx` via `duplicateCandidates`; test `:410-431`                      | **KEPT**                                          |
| A3  | Near-spelling never applied to record numbers (a record number one keystroke off is a _different_ patient, never "did you mean")                                                                                                                                                                                                                                        | test `:433-444`                                                                   | **KEPT**                                          |
| A4  | The `?name=` prefill from `patient-search.tsx`'s empty state, applied exactly once, never fighting the clinician's own edits                                                                                                                                                                                                                                            | `add-patient.tsx:239-256`, tests `:159-222`                                       | **KEPT**                                          |
| A5  | New-id-by-identity-diff after `ADD_PATIENT` (never predicted, never by array length) and navigation to the new person's own screen                                                                                                                                                                                                                                      | `add-patient.tsx:258-281`                                                         | **KEPT**                                          |
| A6  | Rejection path: if the reducer refuses the event, a stated rejection message, no silent no-op                                                                                                                                                                                                                                                                           | `add-patient.tsx:264`                                                             | **KEPT**                                          |
| A7  | The `role: "coordinator"` dispatch judgement call, and its documented reasoning                                                                                                                                                                                                                                                                                         | `add-patient.tsx:28-41`                                                           | **KEPT** — not touched, not relitigated here      |
| A8  | Print/forced-colours/dark-mode CSS contracts in `add-patient.module.css`                                                                                                                                                                                                                                                                                                | whole file                                                                        | **KEPT** — no rule removed or renamed             |
| A9  | Skip-to-form link on the drawing's `<body>` header — actually **absent from the built screen too**; noted here because it is worth flagging rather than silently deciding it does not matter: the drawing carries `<a class="skip" href="#form">Skip to the form</a>` (`:4647`) that the layout's shared shell may already provide app-wide (not verified — see Limits) | n/a                                                                               | Not this screen's file to add; flagged, not built |

---

## 2. What cannot be built honestly

- **Sex, as a required Female/Male field (D2).** `ADD_PATIENT` carries no `sex` parameter, and
  `Patient.sex` is free text with no fixed two-value vocabulary anywhere it is actually read
  (`ward-patients.ts:112-117`'s own comment: "Free text rather than a fixed enum, deliberately… a
  closed list picked without clinical input would be a second decision riding on this one's back").
  Adding a required two-value Sex control that dispatches nothing, or that silently writes into
  `Patient.sex` a value the field's own contract says must stay free text, would be exactly the
  "invented plausible value" the honesty rule forbids. The **honest fix requires extending
  `ADD_PATIENT`'s payload and the reducer case** — both in `ward-flow-events.ts` and
  `ward-flow-reducer.ts`, files this brief's §1 treats as shared/central rather than mine to edit
  unilaterally (every screen that ever dispatches an event reads these). **Not built. Flagged to
  the controller in §6**, with the exact shape named so nobody has to re-derive it.

- **"Already on the board", captioned "added most recently" (D5), as the drawing words it.**
  `Patient[]` is seeded once from `wardPatients` (`ward-patients-seed.ts:46`), whose own top comment
  states the ordering exists to pair related names for search demonstration ("`Halloway` beside
  `Hallowin`…"), not to encode a "when this person arrived" timeline. The last five elements of that
  array are five fixture rows an author placed there for an unrelated reason, not five people who
  were in fact added most recently — captioning them that way would be rendering a sentence the
  seed data cannot support (the exact §5 trap named in the common brief). This is doubly true
  because `ADD_PATIENT` appends to the _end_ of the same array (`ward-flow-reducer.ts:1081`), so a
  literal "last five, most recent" reading is only ever true once five patients have actually been
  added in the running session — false the rest of the time, which is most of the time in this
  synthetic corpus. **Built with the claim removed rather than the panel removed**: this contract's
  implementation shows five people from the board **in alphabetical order** (a real, checkable
  ordering nothing invents), captioned as illustrative — "for reference," never "most recently
  added" — while keeping the one true, valuable sentence the drawing states alongside it: the
  duplicate check reads the _whole_ board, in every service, not only the five shown.

- **D6, the header's secondary "New referral" menu.** Per §0 finding 4, this is `WardBar`'s
  territory (a shared shell component reading a shared, pinned route table), not a markup element
  this screen's own file renders. Building it inside `add-patient.tsx` would create a second,
  screen-owned "New referral" affordance sitting beside whatever the shared shell already does or
  does not render for this route — exactly the "two composers" class of defect
  `docs/search-chrome-behaviour.md`'s "one owner" rule exists to prevent, generalised to the header
  action rather than the search composer. **Not built.** Flagged, not decided, in §6.

---

## 3. Owner rulings and prior findings that bind this screen

- **PD-1** (`ward-patients.ts` top comment) — a `Patient`'s identity is exactly four required
  fields; the nine R-2026-09-04-A fields, including `sex` and `gender`, are optional. The Gender
  control added in this change stays optional in the dispatch (omitted, never sent as
  `undefined`), matching this ruling and the existing `ADD_PATIENT` reducer's own
  spread-in-only-when-supplied discipline (`ward-flow-reducer.ts:1077-1080`).
- **Owner ruling 2026-09-09/2026-09-10** (`ward-patients.ts:108-131`) — `sex` and `gender` are
  separate facts; `gender` is fixed two-value and drives bed matching; "not yet recorded" is a real,
  intentional state for `gender`, never defaulted from `sex`. The Gender control built here offers
  exactly three choices — Female, Male, Not yet recorded — mapping the third to omitting the field
  entirely, never to a stored sentinel string.
- **The referrals contract's own extra catcher** (`contract-referrals.md` §7, last item) — the
  general form of "assert the two acts stay two acts" applies here too, in the opposite direction:
  this screen must keep failing to look like a referral. §5 below adds the matching test for this
  screen: `ADD_PATIENT`'s dispatch payload is asserted to carry no `source`, `destinations` or
  `urgency` field, so a future edit that starts collecting referral-shaped answers here cannot pass
  silently.

## 4. What was built

1. **Gender control** added to the existing form (`<select>`, matching `referral-intake.tsx`'s own
   `.fieldCard`/`.select` idiom rather than the drawing's segmented-button idiom, so the two
   front-door forms a clinician fills back-to-back keep reading as one product per this file's own
   top-comment precedent). Three options: "Not yet recorded" (default, omits the field), "Female",
   "Male". Dispatched as `gender` only when not the "not yet recorded" sentinel.
2. **"Where they are coming from, and who is asking"** panel — static copy plus two labelled
   chips (Emergency department · ED, Community team · CMHT), restating the real permitted-role set.
3. **"What happens next"** panel — static copy restating the screen's real, already-built
   navigation behaviour.
4. **"Already on the board"** panel — five patients from the live `patients` array, alphabetical by
   family name then given name, with a stated total count and the "whole board is checked, not only
   these five" sentence. No recency claim.
5. **Test additions** in `tests/ward-add-patient.dom.test.tsx`: the four new sections render by
   name/testid, the Gender control's three states dispatch correctly (including the omit-when-not-
   recorded case), the alphabetical board list renders real patients with a real count, and the
   referral-shape negative assertion from §3.

## 5. Catchers

- Every new section asserted present **by name** (heading text or accessible name), per the common
  brief §6.
- Gender: a test for each of the three choices — Female recorded, Male recorded, "Not yet recorded"
  **omits** the key entirely (not `undefined`) — read off the dispatched event via the same
  `useWardFlow`-echo technique the file's existing `PatientCount` helper already uses, extended to
  echo the gender of the newly added patient.
- Already-on-the-board: asserts the rendered five names equal the first five of `patients` sorted
  alphabetically (family, then given) — a mutation to a different sort silently reverting to array
  order, or to the drawing's disallowed "most recent" framing, reddens this.
- The referral-shape negative: dispatch is asserted to be exactly `{ type: "ADD_PATIENT", role,
now, umrn, givenName, familyName, dateOfBirth, gender? }` — no `source`, `destinations`,
  `urgency`, or `patientId` key ever appears on it.
- Made to fail once on purpose (per common brief §6) — see the verification report for the exact
  string changed and reverted.

## 6. Shared-file items handed back to the controller (not edited here)

1. **`ADD_PATIENT`'s payload has no `sex` field**, and the drawing wants one. If the owner wants
   Sex captured at creation, the event (`ward-flow-events.ts:346-353`) needs a new optional
   `sex?: string` parameter and the reducer case (`ward-flow-reducer.ts:1054-1081`) needs one line
   spreading it in only when supplied, matching the existing `gender` discipline exactly. Not done
   here because both files are shared across every screen that dispatches any event.
2. **`WARD_PRIMARY_ACTIONS` (`ward-nav.ts:512-604`) has no entry for `WARD_ADD_PERSON_HREF`.**
   Today's behaviour (no primary-action button in the header) already matches the drawing's stated
   intent, so this is a question, not a defect: should this route join the pinned sixteen-route
   table with `{ kind: "none" }` (the same treatment `WARD_REFERRAL_INTAKE_HREF` already gets), for
   explicitness and so `tests/ward-nav.test.ts` starts asserting it stays that way? Only the
   controller (or whoever owns `THIRD_EDITION_MOCKUP_ROUTES`) can say whether this route belongs in
   that pinned set at all without re-deriving that list from scratch.
3. **D6, the header's secondary "New referral" menu** — not built, not decided; see §2's third
   bullet. If the owner wants it, it is a `WardBar`/`ward-nav.ts` change, not an `add-patient.tsx`
   one.

## Limits of this reading

- I read `add-patient.tsx`, `add-patient.module.css`, and the full existing test file, but did not
  independently re-run `tests/route-reachability.test.ts` to re-prove the search-empty-state link
  resolves — I relied on that file's own comment naming it as the proof.
- I did not open `docs/search-chrome-behaviour.md` in full; I inferred the "one owner" principle's
  relevance to D6 from `AGENTS.md`'s own summary of that rule rather than the full document.
- I did not check whether the drawing's `<a class="skip" href="#form">` is already provided by the
  shared layout/shell for every ward-flow route (it plausibly is, since skip-links are usually a
  layout-level concern) — flagged in the APP-ONLY table (A9) rather than assumed either way.
- I did not read `THIRD_EDITION_MOCKUP_ROUTES`'s own definition or the 2026-09-10 master plan
  document, so §6 item 2 is reported as an open question rather than a recommendation either way.
- I did not run the app or take a screenshot; this is a static read plus the unit/DOM test suite
  named in §7, per the verification commands this brief permits.
- I did not check every one of the drawing's ~8,957 lines line-by-line — the shared shell/rail/
  search-chrome engine beneath the screen-specific logic (shared with every other third-edition
  mockup, per its own comments) was skimmed for structure, not read in full, since that engine is
  provided by the real app's shared `WardBar`/`WardRail`/`ward-nav.ts`, not by this file.

If a decision arose here that this brief does not cover, it is listed in §6 rather than guessed.
