# Lane C — Patient search, Patient, Search hub, Raise a referral — implementation plan

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking. A fresh Sonnet implementer per task, an Opus task
> reviewer, and one Opus whole-screen review before any SHA is handed to Ward Lead.

**Goal:** Rebuild Lane C's four screens — Patient search, Patient, Search hub and Raise a
referral — on the third edition, against the owner's rulings rather than against the drawings,
without editing a single shared file.

**Architecture:** Every screen keeps its existing route and its existing derivations, and gains the
third edition's structure, wording and states. Figures are derived on every render; no screen holds
data of its own. Verdicts come from the existing standalone `eligibility()` export, not from the
shared console. Three pieces of the master plan's §4 cannot be built inside this lane and are handed
back in §0 rather than attempted.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Vitest and Testing Library for
DOM tests, Playwright for the two browser specs, CSS modules with ward tokens.

**Spec:**

- `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md` §4.9–§4.12, §3.2, §3.3, §5.0
  — on branch `claude/wardflow-design-review-43df97` at `e9c6900e3e`. **`cat` will not find it;**
  `git show e9c6900e3e:<path>` will.
- `docs/ward-flow/owner-decisions-2026-09-1x.md` — the thirteen questions, D-1, D-2.
- `docs/ward-flow/owner-decisions-2026-09-09.md` §7, §8, §9 — activity wording, sex and gender.
- 🔴 `docs/ward-flow/plans/2026-09-1x-lane-c-drawing-facts.md` — **the companion, and it overrides
  this plan's §4-derived prose wherever they differ.** Panel names, tab names and the reconciliation
  sentence copied from the drawings; the twelve rules inside the referral drawing; the four open
  questions inside it; and two guards that do not exist. **Read it before writing any assertion
  about a name.**
- `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` §6.7, §6.11, §6.13, §8.1–§8.7 — read only;
  Ward Mockups owns that directory.
- The four drawings — `patient-search-third-edition.html`, `patient-now-third-edition.html`,
  `search-hub-third-edition.html`, `raise-a-referral-third-edition.html`. ⚠️ **Read them from the
  line, and only after Ward Lead's Ward Mockups fold has landed** — before that fold the line
  carried a superseded shell, so a drawing read too early describes chrome that no longer exists.
  Read only; never edited from this lane.

**Branch:** `ward/lane-c-search-patient-referral-20260910`, cut from
`codex/task-ward-flow-live-state-20260831` at `8c5aebc938d0ceffead901866e23d26efd3a781b`.

---

## 0 · What this lane CANNOT build, handed back rather than attempted

Three items in the master plan's §4 sections cannot be built by Lane C. Each is written here with
what was measured, so Ward Lead rules rather than a builder guessing.

### 0.1 🔴 The gender field does not exist, and creating it is outside this lane

**Measured at `8c5aebc938`:**

    ward-patients.ts     the `sexOrGender?: string` field on `Patient` — ONE merged free-text field
    ward-patients.ts     `PATIENT_FIELDS` — the runtime shape guard, which lists `sexOrGender`
    ward-model.ts        the `sex: Sex` field on `Movement`
    ward-model.ts        the `psychiatric_ward` arm of `ReferralDestination`, which carries `sex`
                         alongside `secureBedNeeded`, `involuntaryBedNeeded`, `highAcuityNursingNeeded`
    ward-eligibility.ts  the `sex_designation` and `sex_mix` gates inside `eligibility()`, which
                         read `movement.sex` through `sexDesignationAccepts`

⚠️ **The referral's own ward arm carries `sex`, not gender.** So "gender decides the bed" is not one
field rename: it reaches the request the referrer writes, the movement, and both gates. That is the
clearest single reason this cannot be a lane's change.

The owner's ruling splits `sexOrGender` into `sex` and `gender`, and moves bed matching onto
`gender`. Delivering it touches `ward-patients.ts` (the type and `PATIENT_FIELDS`),
`ward-patients-seed.ts` (**a seed — forbidden to this lane**), `ward-flow-reducer.ts`
(`ADD_PATIENT` — **forbidden**), `ward-model.ts` (**forbidden**) and `ward-eligibility.ts` (the two
gates). **None of that is Lane C's to edit.**

**Split, and who owns each half:**

| Half                                                                                     | Owner              |
| ---------------------------------------------------------------------------------------- | ------------------ |
| `Patient.gender: "Female" \| "Male" \| undefined`, seed, reducer, gate moved onto it     | Ward Lead, Phase 1 |
| Showing gender on the Patient screen and letting the referral form complete it, in words | Lane C — Task 17   |

**Task 17 is written and is NOT started until the model half lands.** It is the last task for that
reason. Whether `Unit.sexMix` stays `Record<Sex, number>` or becomes a gender mix is a deliberate
decision and is handed back with this, not chosen here.

### 0.2 🔴 §4.10's History and Community tabs redden a deliberate FD-23 guard

**Measured:** the guard in `tests/ward-person-screen.dom.test.tsx` titled —
_"⚠️ NEVER SHOWS WHERE ELSE THIS PERSON HAS BEEN REFERRED — FD-23, asserted as an absence"_. Its own
comment says it is written **to fail on the CAPABILITY, not on today's emptiness**: any ward, ED or
team place name taken from ward state appearing on the person's screen fails it.

The doc comment on `Referral.patientId` in `ward-model.ts` — the one headed _"WHICH PERSON THIS REFERRAL IS ABOUT — A POINTER, NEVER A COPY"_ — says the same thing from the model side. `Referral.patientId` exists, and
_"NOTHING READS IT YET. Whether a ward may see where else a person has been referred is `FD-23`, and
the mechanism for that does not exist."_

The master plan's §4.10 task 4 builds a **History** tab over every movement reachable through the
person's referrals, and a **Community** tab naming the team on the referral. Both render exactly what
that guard forbids. The plan's answer — the Coordinator / Ward toggle in its task 5 — is a display
control, not the FD-23 mechanism, and a builder that adds it will meet a red guard and be tempted to
relax it.

**Handed back. Not built. Task 11 builds the Now, Details and Documents tabs only,** and states the
other two as absences in words. If Ward Lead rules the mechanism into Phase 1, Task 11 gains them in
a follow-up. Nobody weakens that guard to make a tab appear.

### 0.3 The facade does not exist yet — three tasks consume it

**Measured:** no `ward-facade.ts`, no `shell/` directory, and `movementVerdict`, `raiseReferralHref`
and `patientHref` return **zero** matches across `src/`. Tasks 2, 3 and 14 name the facade in their
`Consumes` block and are ordered after the tasks that do not.

⚠️ **One master-plan claim here is wrong and it unblocks a task.** §4.10 task 1 says Ward Lead must
export the verdict derivation through the facade _"because the workspace file is shared"_. It is
already a standalone export: `eligibility(movement, unit, now)` and `candidateReason(verdict)` live
in `src/components/ward-management/ward-eligibility.ts`, and `ward-management-console.tsx`
**imports** it rather than owning it — one `import { eligibility } from ".../ward-eligibility"` near
the top of the console's import block, and no other importer anywhere in `src/`. Lane C imports the
same module and edits no console. Task 9 does exactly that.

### 0.4 🔴 A line number is not an anchor — find everything by name

**A line number is not merely imprecise, it is a different number in every tree.** One assertion in
the ED suite was measured at **1687** by the master plan's research pass, **1649** by Ward Builder
Two on its branch and **1698** by Ward Lead on the line. **Three true answers and no error between
them** (Ward Lead, 2026-09-10).

**So every citation in this plan is an anchor by NAME** — a symbol, an exported constant, a test's
title, a doc comment's opening words. Where a number survives it is describing a measurement taken
in this worktree at `8c5aebc938` and is written as such, never as a place to navigate to. **If you
are searching for something this plan names and the line does not hold it, the plan is not stale —
your tree is a different tree. Search for the name.**

Two more traps from other lanes, recorded here because they will reach this one:

- ⚠️ **`git merge-tree` names the FILE once, not each hunk.** It reported _"one conflict"_ on a
  drawing that was **three separate decisions**, twice in one day. **"One conflict" never means "one
  decision."** _(Ward Mockups, relayed by Ward Lead.)_
- 🔴 **`arrivedAt` is TWO fields, absent in two different ways — verified here by reading both.**
  `Admission.arrivedAt` is `Instant | null` (`ward-admissions.ts`); `TransportJob.arrivedAt` is
  `Instant | undefined` (`ward-model.ts`). **A guard written `=== null` silently passes every
  `undefined`, and one written `=== undefined` silently passes every `null`. Neither goes red.**
  They share a name, so a reader who has checked one believes they have checked both. Use a
  nullish check (`== null`) or check the field you actually hold, and never generalise from one to
  the other. ⚠️ `ward-model.ts` carries a further warning nearby: a THIRD `arrivedAt` was deleted in
  Phase 8 and its name deliberately not reused, so a third meaning is not lurking — but the file
  says so precisely because somebody nearly reintroduced one.
- ⚠️ **Nullable timestamps.** `pulledAt`, `arrivedAt` and `leftAt` on `ward-admissions.ts` are each
  `Instant | null` — **verified here by reading that file, not taken on relay.** The Patient screen
  shows a person's current movement, so Tasks 9 and 10 may render all three. **A null one is shown
  and marked absent, never dropped**, and `arrivedAt` in particular is null for a bed that is
  genuinely gone — that file's own comment warns that a check requiring `arrivedAt` reads a pulled
  bed as empty when it is not.

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the
owner's rulings and the standard.

- **Tokens only.** No hex, no `color-mix`, no shadow inside a panel, **no coloured bar on any edge,
  no top highlight**, nothing under 12px in HTML (SVG text at least 10.5px), **one primary action per
  panel**.
- **Words before colour.** Every state carries text; colour only reinforces a word already present.
- **Absence and zero.** A missing value is **shown and marked absent, never dropped**. A count of
  things waiting reads _none_ in italic where there are none; a measured quantity keeps its nought as
  a figure. _"Renders as absent"_ means **shown and marked**, not **disappears**.
- **Invented and real.** The activity sentence is **_"Invented figures, reconciled with each
  other"_** (owner, 2026-09-10 evening, `owner-decisions-2026-09-09.md` §7). ⚠️ **This SUPERSEDES
  _"Synthetic snapshot at &lt;time&gt;, figures reconcile"_, which the master plan still prints in
  §3.3 and in §5.0 item 6.** Never _"Live"_. A sentence must be true read alone.
- **Derived, never typed.** Every count, tile, line and tag is computed from state on every render. A
  literal figure in JSX is a defect.
- **Vocabulary:** **discharged**, never _released_. **Available**, never _Unoccupied_. A community
  patient is a team's by the explicit team on the referral, never by home area. A team sees the
  decline reason **for its own referrals only** (`FD-23`). The six urgency reasons are the
  orchestrator's placeholders _"for now"_, never the owner's language. _Legal authority_ reads
  **Yours**; wait bands are **8 and 24 hours**.
- **Acuity.** The system **never** computes it. The referring clinician marks it at referral and the
  control **starts unanswered** — `false` is not a default. Q-1: the mark is **shown as a word**,
  **never a sort key**.
- **Catchment (Q-2).** Information on Raise a referral, **never a filter**. No destination may be
  hidden or excluded by where the patient lives. This does not license computing or displaying a
  catchment relationship the model does not already hold.
- **Gender (owner §8–§9).** Two fields. `gender` is **Female or Male** plus a distinct **not yet
  recorded** state. **Gender decides the bed.** **NO override path on that gate** — do not add "place
  anyway with a reason" because nine other gates have one. **Never default an unrecorded gender to
  the recorded sex.** Two values cannot describe a non-binary person and the form must still be
  submittable for one, so **no wording may imply the field is always populated**.
- **Escape never clears the service selector; drawers are modal.** Keyboard reach and visible focus on
  every control.
- **Eight widths, two themes, forced colours, print:** 1920, 1600, 1440, 1280, 1200, 1100, 390, 320.
  **Sample at least one width in the 641–1000px band.**
- **The changeable-data rule:** nothing may be built that only works for the seed.
- **Q-12:** keep every panel the app has that the drawings do not. **Drop nothing.** List every one
  kept — Task 18 is that list.
- **Never `git add -A`.** Explicit paths. Prettier on touched files before every commit.
  `npm run format` is **not trusted**; check `ls node_modules/.bin | wc -l` first (147 here at
  `8c5aebc938`).
- **If you reach a decision this plan does not cover, stop and hand it back — do not choose.**

### Commands that lie here — use these forms

| Never                       | Why                                                             | Instead                              |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------ |
| piping a test run to `tail` | returns **tail's** exit code; a 56-failure run reported 0       | run it bare, read the summary        |
| `--reporter=basic`          | does not exist here: **zero tests, exit 0**, empty failure list | omit it                              |
| piping a grep to `head`     | silently truncates                                              | count first with `grep -c`           |
| relying on vitest for types | **vitest does not typecheck**                                   | `npx tsc --noEmit` separately        |
| `npm run format`            | exits 0 with prettier absent                                    | `npx prettier --write <exact paths>` |
| finding a plan item by line | plan line numbers have already drifted 1–4 lines                | find it by name                      |

---

## File Structure

Lane C owns these and edits nothing else.

| File                                                             | Responsibility                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/components/ward-management/search/patient-search.tsx`       | Patient search screen (668 lines today)                       |
| `src/components/ward-management/search/search-refusals.ts`       | **new** — the §8.6 sentences and the predicate that picks one |
| `src/components/ward-management/search/access-record.ts`         | **new** — session-only search list, no persistence            |
| `src/components/ward-management/search/record-preview.tsx`       | Selected-person panel and its summaries (305 lines)           |
| `src/components/ward-management/search/search.module.css`        | Patient search styling                                        |
| `src/components/ward-management/hub/hub-screen.tsx`              | Search hub screen (924 lines)                                 |
| `src/components/ward-management/hub/hub-derivations.ts`          | Hub entries, counts, ready-by-service, network beds (407)     |
| `src/components/ward-management/hub/hub.module.css`              | Hub styling                                                   |
| `src/components/ward-management/patients/person-screen.tsx`      | The **Patient** screen (297 lines)                            |
| `src/components/ward-management/patients/patient-journey.ts`     | **new** — journey rows from a movement's own change lists     |
| `src/components/ward-management/patients/handover-summary.ts`    | **new** — the copied text, from the same derivations          |
| `src/components/ward-management/patients/person.module.css`      | Patient styling                                               |
| `src/components/ward-management/referrals/referral-intake.tsx`   | Raise a referral (1,931 lines)                                |
| `src/components/ward-management/referrals/referral-duplicate.ts` | **new** — the duplicate sentence and its predicate            |
| `src/components/ward-management/referrals/referrals.module.css`  | Referral styling                                              |

**Why the four new modules.** Each holds a rule that must be identical in the screen and in its test,
and each screen file is already large enough that a reviewer cannot hold it at once. A rule restated
inline in a 1,900-line component is a rule that drifts from its own test.

---

## Tasks

Ordered so nothing waits on the facade until it must. Tasks 1–3 (Search hub) are the least blocked
and go first.

---

### Task 1: Search hub — third edition and the activity sentence

**Files:**

- Modify: `src/components/ward-management/hub/hub-screen.tsx`
- Modify: `src/components/ward-management/hub/hub.module.css`
- Test: `tests/ward-hub-screen.dom.test.tsx` (exists), `tests/ward-hub-derivations.test.ts` (exists)

**Interfaces:**

- Consumes: `hubEntries`, `hubCounts`, `readyByService`, `networkBeds`, `needsAttention`,
  `groupedResults`, `unauthorisedWards` from `hub/hub-derivations.ts` — all exist, all unchanged.
- Produces: nothing new. The derivation module's exports stay exactly as they are.

**Catcher:** `tests/ward-hub-screen.dom.test.tsx`, plus a new case in it pinning the activity
sentence. `tests/ward-provenance-sentences-carry-their-own-marker.test.ts` must stay green — its
`MARKER` predicate matches `invented figures`, so the new sentence passes it. ⚠️ Read that predicate
rather than assuming: the OLD sentence led with _"Synthetic snapshot"_ and `snapshot` is **not** in
the predicate's noun list.

- [ ] **Step 1: Write the failing test**

Append to `tests/ward-hub-screen.dom.test.tsx`:

```tsx
it("carries the owner's activity sentence", () => {
  renderHub();
  // ⚠️ A SUBSTRING, AND DELIBERATELY SO — see the ruling conflict recorded above this task. The
  // owner's words are "Invented figures, reconciled with each other"; the errata's §B adds ", as
  // at <time>". This assertion is TRUE UNDER BOTH and so does not silently pick one. It is not a
  // check that cannot fail: it reddens if the sentence is missing, or reads "Live", or keeps the
  // retired wording.
  expect(screen.getByText(/Invented figures, reconciled with each other/i)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/\bLive\b/);
});

it("carries no form of the retired snapshot wording", () => {
  renderHub();
  // ⚠️ THIS ASSERTION PASSES VACUOUSLY TODAY AND THE STEP BELOW SAYS SO. Nothing in `src/` carries
  // either form of the old sentence (measured; errata §B says the same). It is written anyway
  // because the guard's value is entirely in the future: it is what reddens if somebody restores
  // the retired wording from a drawing. Do not report it as evidence the change landed — the
  // assertion above is that evidence.
  expect(document.body.textContent).not.toMatch(/Synthetic snapshot at/i);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-hub-screen.dom.test.tsx
```

Expected: FAIL — the sentence is not on the page.

- [ ] **Step 3: Restyle on the third edition and change the sentence**

Keep every panel and every derivation. Change structure only where the standard's §6.3 (panel,
header, note, stated absence) and §6.15 (table) differ from what is there. Remove any edge bar or top
highlight the second edition left behind (Q-11).

🔴 **ADD the activity sentence. There is nothing to replace.** Measured in this worktree: **no file
under `src/` carries either form of the retired sentence**, and the hub carries a different
disclosure of its own — a `Synthetic prototype` badge above _"Every bed, wait and referral figure
below is invented…"_. **That existing disclosure is kept** (Q-12: drop nothing) and the activity
sentence is added beside it, not instead of it.

⚠️ **The exact string is NOT settled, so this task does not settle it.** Ward Lead's message gives
the owner's words — _"Invented figures, reconciled with each other"_ — and Ward Lead's own errata §B
gives _"Invented figures, reconciled with each other, as at &lt;time&gt;"_. The owner's verbatim
ruling in `owner-decisions-2026-09-09.md` §7 has **no** time clause. **Render the owner's words and
hand the trailing clause back to Ward Lead** rather than inventing a clock the ruling does not
mention. The test above is a substring assertion for exactly this reason and stays true either way.

- [ ] **Step 4: Run it green, and run the neighbours**

```bash
npx vitest run tests/ward-hub-screen.dom.test.tsx tests/ward-hub-derivations.test.ts tests/ward-hub-bar-colours.test.ts tests/ward-provenance-sentences-carry-their-own-marker.test.ts
```

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Prettier and commit**

```bash
npx prettier --write src/components/ward-management/hub/hub-screen.tsx src/components/ward-management/hub/hub.module.css tests/ward-hub-screen.dom.test.tsx
```

```bash
git commit -- src/components/ward-management/hub/hub-screen.tsx src/components/ward-management/hub/hub.module.css tests/ward-hub-screen.dom.test.tsx -m "feat(ward-flow): Search hub on the third edition, with the owner's activity sentence"
```

**Not built:** pins or recently-viewed beyond `hub-browser-memory.ts` — Q-12 says keep what exists;
Task 18 lists it.

**Report:** proven by test / proven by looking / not proven.

---

### Task 2: Search hub — two links on every row

**Files:**

- Modify: `src/components/ward-management/hub/hub-screen.tsx`
- Test: `tests/ward-hub-screen.dom.test.tsx`, `tests/ward-links-never-point-at-redirect-stubs.test.ts`
  (exists)

**Interfaces:**

- Consumes: `HubEntry` (`kind: "ward" | "ed" | "community"`) from `hub/hub-derivations.ts`; the
  facade's href builders **once Phase 1 lands** — until then the route table in `ward-nav.ts`, read
  only.
- Produces: nothing.

**Catcher:** a DOM test asserting **every** row carries both links, counted against the row count
rather than spot-checked. A spot check passes while one kind is missing both.

- [ ] **Step 1: Write the failing test**

```tsx
it("gives every row both its place link and its statistics link", () => {
  renderHub();
  const rows = screen.getAllByRole("row").filter((row) => within(row).queryAllByRole("link").length > 0);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const hrefs = within(row)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.some((h) => /\/(wards|ed|community)\//.test(h))).toBe(true);
    expect(hrefs.some((h) => h.includes("/statistics"))).toBe(true);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-hub-screen.dom.test.tsx
```

- [ ] **Step 3: Add the second link per row**

Ward rows link to Ward and to that ward's statistics page; ED rows to Emergency department and its
statistics; community rows to the team **index only where the drawing says so** and to the team
statistics page. Every href is built from the route table, never typed.

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-hub-screen.dom.test.tsx tests/ward-links-never-point-at-redirect-stubs.test.ts
```

⚠️ `tests/ward-specs-never-navigate-into-redirect-stubs.test.ts` is **green (13 of 13) and its report
describes a deliberate red that was discharged.** It is not broken. Do not "fix" it. Run it by name —
`test:focused` cannot select it, because it reads files with `readFileSync`.

- [ ] **Step 5: Prettier and commit** — same shape as Task 1.

**Not built:** any link to a route the route table does not already carry.

**Report:** three lines.

---

### Task 3: Search hub — one search on the page

**Files:**

- Modify: `src/components/ward-management/hub/hub-screen.tsx`
- Test: `tests/ward-hub-route.test.ts`

**Interfaces:**

- Consumes: `searchHub(entries, query, kind)` from `hub/hub-derivations.ts`; the shell's route table
  (Phase 1) for suppressing the bar search on this route.
- Produces: nothing.

⚠️ **Blocked half.** The shell does not exist (`shell/` is absent at `8c5aebc938`). The **hub's own
search stays and is the one search**; the assertion that the bar's search is suppressed on this route
is Ward Lead's shell test, not this lane's. Build the half that is ours and name the other.

**Catcher:** a DOM test asserting exactly one search control on the route — the hub's.

- [ ] **Step 1: Write the test**

```tsx
it("carries exactly one search control, the hub's own", () => {
  renderHub();
  expect(screen.getAllByRole("searchbox")).toHaveLength(1);
});
```

- [ ] **Step 2: Run it.** It may already pass. **If it passes, say so and do not invent a change.**
      Record it as already-satisfied in the report; the master plan's task assumed a second control
      that may not be there.

- [ ] **Step 3: If it fails, remove the second scope control** — standard §2 never-list: no second
      scope control — keeping the hub's.

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-hub-route.test.ts tests/ward-hub-screen.dom.test.tsx
```

- [ ] **Step 5: Prettier and commit.**

**Not built:** the shell's route-table suppression — Ward Lead, Phase 1.

**Report:** three lines, including "already satisfied" if that is what was measured.

---

### Task 4: Patient search — kinds tabs and facets

**Files:**

- Modify: `src/components/ward-management/search/patient-search.tsx`
- Modify: `src/components/ward-management/search/search.module.css`
- Test: `tests/ward-patient-search.dom.test.tsx` (exists), `tests/ward-patient-search.test.ts`
  (exists)

**Interfaces:**

- Consumes: the existing derivations inside `patient-search.tsx`; its exports today are
  `PatientSearchPage`, `PeopleSection` and `ResultsSection`.
- Produces: nothing new exported.

**Catcher:** a DOM test asserting **each facet's count equals the number of rows that facet shows**,
computed from state in the test, never a literal.

- [ ] **Step 1: Write the failing test**

```tsx
it("each facet count equals the rows that facet returns", async () => {
  renderSearch();
  const tabs = screen.getAllByRole("tab");
  expect(tabs.length).toBeGreaterThan(1);
  for (const tab of tabs) {
    const declared = Number((tab.textContent ?? "").replace(/\D+/g, ""));
    await userEvent.click(tab);
    // A tab count is a promise about what clicking it shows. A tab that says 4 and shows 3 is the
    // defect this asserts, and it is invisible to a spot check on one tab.
    expect(screen.queryAllByRole("row").length).toBe(declared);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-patient-search.dom.test.tsx
```

- [ ] **Step 3: Add the kinds tabs and the §6.7 filter bar** over the existing derivations. Counts are
      derived on every render. Zero reads _none_ in a state cell; a tab count with no items loses its
      ring (§8.2).

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-patient-search.dom.test.tsx tests/ward-patient-search.test.ts tests/ward-search-preview.dom.test.tsx tests/ward-patient-typeahead.dom.test.tsx
```

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Prettier and commit.**

**Not built:** any facet over a field the model does not hold.

**Report:** three lines.

---

### Task 5: Patient search — what this search refuses

**Files:**

- Create: `src/components/ward-management/search/search-refusals.ts`
- Modify: `src/components/ward-management/search/patient-search.tsx`
- Test: `tests/ward-search-refusals.test.ts` (**new**), `tests/ward-patient-search.dom.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:

```ts
export type SearchRefusal = { kind: "score" | "closed"; sentence: string };
export function refusalFor(query: string): SearchRefusal | undefined;
export const NOTHING_FOUND: (query: string) => string;
export const RESULTS_FOOTER: string;
```

**Catcher:** `tests/ward-search-refusals.test.ts` pins the sentences **verbatim**, character for
character, against the standard §8.6. The mockup's three bespoke sentences are a **mockup defect**
and are routed to Ward Mockups, never copied.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { NOTHING_FOUND, RESULTS_FOOTER, refusalFor } from "@/components/ward-management/search/search-refusals";

describe("what search refuses, in the standard's own words", () => {
  // ⚠️ VERBATIM FROM `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` §8.6. These are fixed
  // sentences, not copy to improve. A reworded refusal is a different promise, and nothing else in
  // the repository would go red if somebody improved one.
  it("refuses a score or a best match with the fixed sentence", () => {
    for (const word of ["risk", "acuity", "score", "scores", "best match"]) {
      expect(refusalFor(word)?.sentence).toBe(
        "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
      );
    }
  });

  it("refuses closed, arrived and discharged with the other fixed sentence", () => {
    for (const word of ["closed", "arrived", "discharged"]) {
      expect(refusalFor(word)?.sentence).toBe(
        "Closed and arrived movements are not searchable here. They are in the Movement screen's register.",
      );
    }
  });

  it("says nothing-found in the standard's words, with the query in it", () => {
    expect(NOTHING_FOUND("wenna")).toBe(
      "Nothing matches ‘wenna’. Search finds patients by name or identifier, movements, departments, wards, owners and tools.",
    );
  });

  it("carries the fixed results footer", () => {
    expect(RESULTS_FOOTER).toBe(
      "Names are invented. Search never returns a risk score, an acuity score or a best match.",
    );
  });

  it("refuses nothing for an ordinary search", () => {
    expect(refusalFor("Larkspur")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-search-refusals.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `search-refusals.ts`**

```ts
/**
 * THE SENTENCES SEARCH REFUSES WITH, AND WHY THEY ARE CONSTANTS.
 *
 * A refusal is a promise about what this system will never do — return a risk score, an acuity
 * score or a best match about a person. Standard §8.4: no verdict about a person is ever drawn.
 * The wording is fixed in §8.6 and is pinned verbatim by `tests/ward-search-refusals.test.ts`,
 * because a reworded refusal is a different promise and nothing else would go red.
 *
 * ⚠️ The Patient search DRAWING carries three bespoke refusal sentences that are not these. That
 * is a mockup defect and is routed to Ward Mockups. It is not copied here.
 */
export type SearchRefusal = { kind: "score" | "closed"; sentence: string };

const SCORE_WORDS = /\b(risk|acuity|scores?|best\s+match)\b/iu;
const CLOSED_WORDS = /\b(closed|arrived|discharged)\b/iu;

export function refusalFor(query: string): SearchRefusal | undefined {
  if (SCORE_WORDS.test(query)) {
    return {
      kind: "score",
      sentence:
        "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
    };
  }
  if (CLOSED_WORDS.test(query)) {
    return {
      kind: "closed",
      sentence: "Closed and arrived movements are not searchable here. They are in the Movement screen's register.",
    };
  }
  return undefined;
}

export const NOTHING_FOUND = (query: string): string =>
  `Nothing matches ‘${query}’. Search finds patients by name or identifier, movements, departments, wards, owners and tools.`;

export const RESULTS_FOOTER = "Names are invented. Search never returns a risk score, an acuity score or a best match.";
```

- [ ] **Step 4: Run it green, then wire the panel**

Show the refusal in the popover **and** in the filter bar, speak it to the live region, and return
**nothing**. §8.6: _"It is never an empty list."_ Add a DOM case asserting a refused query renders the
sentence and **no result rows**.

- [ ] **Step 5: Run green, prettier, commit**

```bash
npx vitest run tests/ward-search-refusals.test.ts tests/ward-patient-search.dom.test.tsx
```

```bash
npx tsc --noEmit
```

```bash
npx prettier --write src/components/ward-management/search/search-refusals.ts src/components/ward-management/search/patient-search.tsx tests/ward-search-refusals.test.ts
```

```bash
git commit -- src/components/ward-management/search/search-refusals.ts src/components/ward-management/search/patient-search.tsx tests/ward-search-refusals.test.ts -m "feat(ward-flow): Patient search refuses in the standard's fixed sentences"
```

**Not built:** the drawing's three bespoke sentences — routed to Ward Mockups.

**Report:** three lines.

---

### Task 6: Patient search — the selected person panel

**Files:**

- Modify: `src/components/ward-management/search/record-preview.tsx`
- Modify: `src/components/ward-management/search/patient-search.tsx`
- Test: `tests/ward-search-preview.dom.test.tsx` (exists)

**Interfaces:**

- Consumes: `PreviewSelection`, `buildMovementSummary(movement, units, now)`,
  `buildReferralSummary(referral)`, `RecordPreview` — all existing exports of `record-preview.tsx`.
- Produces: nothing new.

**Catcher:** `tests/ward-search-preview.dom.test.tsx` plus a link test proving **Open the movement**
lands on `/mockups/ward-flow/movements/<id>` with the identifier intact.

- [ ] **Step 1: Write the failing test**

```tsx
it("offers one primary action, Open the movement, and it keeps the identifier", () => {
  const { movement } = renderPreviewForPersonWithMovement();
  expect(screen.getByRole("link", { name: /open the movement/i })).toHaveAttribute(
    "href",
    `/mockups/ward-flow/movements/${movement.id}`,
  );
  // One primary action per panel — standard §2 never-list.
  expect(screen.getAllByRole("link", { name: /open the/i })).toHaveLength(1);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Add the stage stepper (§6.11) and the primary in-panel action.** The stepper reads the
      movement's own stage. A person with no movement shows the panel with words and no stepper — an
      absence **shown and marked**, never a disappearing panel.

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-search-preview.dom.test.tsx tests/ward-links-never-point-at-redirect-stubs.test.ts
```

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Prettier and commit.**

**Not built:** any verdict about the person (§8.4).

**Report:** three lines.

---

### Task 7: Patient search — the access record

**Files:**

- Create: `src/components/ward-management/search/access-record.ts`
- Modify: `src/components/ward-management/search/patient-search.tsx`
- Test: `tests/ward-search-access-record.test.ts` (**new**), `tests/ward-patient-search.dom.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:

```ts
export type AccessEntry = { role: string; words: string; at: number };
export function recordSearch(list: readonly AccessEntry[], entry: AccessEntry): AccessEntry[];
export const ACCESS_RECORD_NOTE: string;
```

**Catcher:** a DOM test proving **three searches produce three rows and a reload produces none**. The
reload half is the whole point: a persisted access record would be a record of who looked at whom,
which is a privacy surface nobody authorised.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { ACCESS_RECORD_NOTE, recordSearch } from "@/components/ward-management/search/access-record";

describe("the access record", () => {
  it("keeps one entry per search, newest first", () => {
    let list = recordSearch([], { role: "Bed coordinator", words: "wenna", at: 1 });
    list = recordSearch(list, { role: "Bed coordinator", words: "bram", at: 2 });
    expect(list.map((e) => e.words)).toEqual(["bram", "wenna"]);
  });

  it("says in words that it is kept for this session only", () => {
    expect(ACCESS_RECORD_NOTE).toBe("Kept for this session only, not a record of anything real");
  });

  it("touches no storage at all", () => {
    // ⚠️ THE DECIDING ASSERTION. A persisted access record is a record of who looked at whom.
    // Nobody authorised that, and it would survive a reload where the note promises it does not.
    const before = { local: localStorage.length, session: sessionStorage.length };
    recordSearch([], { role: "Coordinator on call", words: "kestrel", at: 3 });
    expect({ local: localStorage.length, session: sessionStorage.length }).toEqual(before);
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write `access-record.ts`** — a pure function over an array. The screen holds the array
      in component state and nowhere else.

- [ ] **Step 4: Add the DOM half** — three searches, three rows; unmount and remount, zero rows. Label
      the panel with `ACCESS_RECORD_NOTE`.

- [ ] **Step 5: Run green, typecheck, prettier, commit.**

**Not built:** persistence of any kind.

**Report:** three lines.

---

### Task 8: Patient — the screen is called **Patient** (D-1)

**Files:**

- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Modify: `src/app/mockups/ward-flow/people/[patientId]/page.tsx`
- Test: `tests/ward-person-screen.dom.test.tsx` (exists), `tests/ward-patient-page.dom.test.tsx`
  (exists)

**Interfaces:**

- Consumes: `patientDisplayName` from `ward-patients.ts`.
- Produces: nothing.

⚠️ **What D-1 binds and what it does not.** It binds the title the screen renders, the label in every
navigation list, the accessible name, and the words other screens use to link here. It does **NOT**
rename `patientId`, `patientHref`, `ward-patients-seed.ts` or the `patients/` directory — _"not
implied and not authorised"_. The drawing's filename stays `patient-now-third-edition.html`; its
markup says "Patient Now" **5 times** (counted at `8c5aebc938`) and that is routed to Ward Mockups,
never edited here.

⚠️ **One decision this task does NOT take.** Today `person-screen.tsx` renders the **person's
name** as the `<h1>`, with _"This person's own record."_ beneath. Whether the `<h1>` becomes the word
"Patient" with the name beneath, or the name stays the heading and "Patient" is the page's name
everywhere else, is a judgement D-1 does not settle. **Build the reading that changes least — the
name stays the `<h1>`, "Patient" becomes the document title, the accessible name and every link's
words — and hand the other reading to Ward Lead in the report.**

**Catcher:** a DOM test asserting the page's name is "Patient" and that "Patient Now" appears nowhere
in the rendered output.

- [ ] **Step 1: Write the failing test**

```tsx
it("is called Patient, and never Patient Now", () => {
  renderPerson();
  expect(document.title).toMatch(/^Patient\b/);
  // D-1, his words: "call this page Patient". The drawing still says "Patient Now"; that is Ward
  // Mockups' file to change and this assertion is about the SCREEN, not the drawing.
  expect(document.body.textContent).not.toMatch(/Patient Now/);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Set the title, the accessible name and the link words.** Count every occurrence in
      `src/` first, and do not truncate the count:

```bash
grep -rn "Patient Now" src/ | grep -c .
```

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-person-screen.dom.test.tsx tests/ward-patient-page.dom.test.tsx tests/ward-patient-placement-fields.dom.test.tsx
```

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Prettier and commit.**

**Not built:** any identifier rename; any edit to `docs/ward-flow/mockups/**`.

**Report:** three lines, plus the `<h1>` reading handed to Ward Lead.

---

### Task 9: Patient — the person now, and the verdict

**Files:**

- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Test: `tests/ward-patient-now.dom.test.tsx` (**new**)

**Interfaces:**

- Consumes: `eligibility(movement, unit, now)` and `candidateReason(verdict)` from
  `src/components/ward-management/ward-eligibility.ts` — **standalone exports; the console imports the
  same module at line 30 and is never touched.** Also `unitCapacity` and `capacityBreakdown` (both
  exist), `patientAgeYears`, `patientDisplayName`.
- Produces: nothing new exported.

**Catcher:** `tests/ward-patient-now.dom.test.tsx` renders a seeded person **with** and **without** a
movement. The without case is the one that matters: every panel renders with words and no verdict.

- [ ] **Step 1: Write the failing test**

```tsx
it("renders every panel in words for a person with no movement, and shows no verdict", () => {
  renderPerson(personWithNoMovement.id);
  // Absence is SHOWN AND MARKED, never dropped — standard §8.2. A panel that disappears when a
  // person has no movement is the defect; a reader cannot tell it from a page that failed to load.
  expect(screen.getByText(/no current movement/i)).toBeInTheDocument();
  expect(screen.queryByTestId("eligibility-verdict")).not.toBeInTheDocument();
});

it("shows the verdict for a person who has one, derived and not typed", () => {
  const { movement, unit } = renderPersonWithMovement();
  const expected = candidateReason(eligibility(movement, unit, NOW_ANCHOR));
  expect(screen.getByTestId("eligibility-verdict")).toHaveTextContent(expected);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Build the panel.** Identity from `Patient`; the nine optional fields render as
      **stated absences** when unset — the words are _not yet recorded_, never a blank. The current
      movement is found through `referrals.patientId` to `movement.referralId`.

⚠️ **`pulledAt`, `arrivedAt` and `leftAt` are each `Instant | null`** (§0.4). If this panel renders
any of the three, a null one is **shown and marked absent, never dropped** — and never treated as
"has not happened", because `arrivedAt` is null for a bed that has genuinely been pulled. Add a case
to the DOM test for a movement whose `arrivedAt` is null; a fixture where all three are set proves
nothing about the branch that matters.

The verdict and gates
come from `eligibility()`.

⚠️ **The two fields that are NOT settled for display** — Aboriginal or Torres Strait Islander status,
and interpreter or preferred language — stay exactly as `person-screen.tsx` already handles them. The
placement rule from R-2026-09-04-A stands: not adjacent to each other, and neither directly above a
past-psychiatric-history panel. `tests/ward-patient-sensitive-adjacency-css.test.ts` guards it.

⚠️ **Acuity is shown as a WORD and never used as a sort key** (Q-1).

- [ ] **Step 4: Run green**

```bash
npx vitest run tests/ward-patient-now.dom.test.tsx tests/ward-person-screen.dom.test.tsx tests/ward-patient-sensitive-adjacency-css.test.ts
```

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Prettier and commit.**

**Not built:** gender as its own field — **Task 17, blocked on §0.1.** Today the record holds one
merged `sexOrGender` free-text field, and rendering it under the label "gender" would state a
falsehood.

**Report:** three lines.

---

### Task 10: Patient — the Journey

**Files:**

- Create: `src/components/ward-management/patients/patient-journey.ts`
- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Test: `tests/ward-patient-journey.test.ts` (**new**), `tests/ward-patient-now.dom.test.tsx`

**Interfaces:**

- Consumes: a `Movement`'s `stageChanges`, `statusChanges`, `declines`, `transport`.
- Produces:

```ts
export type JourneyRow = { at: number; words: string };
export function patientJourney(movement: Movement, now: Instant): JourneyRow[];
```

**Catcher:** a unit test asserting time order over a movement whose four change lists are
**deliberately out of order in the fixture**. A journey built by concatenation passes an in-order
fixture and fails this one.

- [ ] **Step 1: Write the failing test**

```ts
it("puts every kind of change in one time order, not four concatenated lists", () => {
  // stage at t1 and t3, decline at t2, transport at t4 — so a concatenated journey comes back
  // [t1, t3, t2, t4] and only an interleaved fixture can tell the two apart.
  const movement = movementWithInterleavedChanges();
  expect(patientJourney(movement, NOW_ANCHOR).map((r) => r.at)).toEqual([t1, t2, t3, t4]);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write `patient-journey.ts`** — merge the four lists, sort by time, format waits
      through **one** formatter. A wait reads `25h 10m` everywhere (§8.7).

- [ ] **Step 4: Run green and typecheck.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** any journey row the model cannot supply.

**Report:** three lines.

---

### Task 11: Patient — the tabs that FD-23 allows

**Files:**

- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Test: `tests/ward-patient-now.dom.test.tsx`, `tests/ward-person-screen.dom.test.tsx`

**Interfaces:**

- Consumes: `patientJourney` (Task 10), the `Patient` fields.
- Produces: nothing.

🔴 **Three tabs, not five. See §0.2.** Now, Details and Documents are built. **History and Community
are NOT**, because both render place names derived from this person's referrals, and
the guard in `tests/ward-person-screen.dom.test.tsx` titled _"NEVER SHOWS WHERE ELSE THIS PERSON HAS BEEN REFERRED"_ asserts that absence **on the capability**, for FD-23. The
master plan's §4.10 task 4 builds them and does not mention the guard.

**Catcher:** the existing FD-23 guard stays **green**, and a new DOM case asserts each built tab's
empty wording.

- [ ] **Step 1: Write the failing test**

```tsx
it("states what the Documents tab holds, rather than inventing a list", async () => {
  renderPerson();
  await userEvent.click(screen.getByRole("tab", { name: /documents/i }));
  expect(screen.getByText("No documents are held in this prototype")).toBeInTheDocument();
});

it("names the two tabs it does not build, and says why in words", () => {
  renderPerson();
  // Absence is stated, never blank (§8.2). A missing tab reads as an unfinished screen; a stated
  // one reads as the decision it is. FD-23 — see this plan §0.2.
  expect(screen.getByText(/where else this person has been referred is not shown here/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Build Now, Details and Documents**, and state the other two as an absence in words.
      **Do not name a ward, ED or team taken from ward state anywhere on this screen** — that is
      exactly what the guard fails on.

- [ ] **Step 4: Run green — and the FD-23 guard is the one that matters**

```bash
npx vitest run tests/ward-person-screen.dom.test.tsx tests/ward-patient-now.dom.test.tsx
```

⚠️ **If the FD-23 guard goes red, stop.** Do not relax it, do not narrow it, do not add an exception.
Hand it back to Ward Lead — a red there means the screen gained the capability the ruling forbids.

- [ ] **Step 5: Prettier and commit.**

**Not built:** the History tab; the Community tab. Both handed back in §0.2.

**Report:** three lines, naming the two unbuilt tabs.

---

### Task 12: Patient — copy handover, and the Coordinator / Ward toggle

**Files:**

- Create: `src/components/ward-management/patients/handover-summary.ts`
- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Test: `tests/ward-patient-now.dom.test.tsx`

**Interfaces:**

- Consumes: the same derivations the panels render; `patientJourney` and `JourneyRow` from Task 10.
- Produces:

```ts
export type HandoverView = "coordinator" | "ward";
export function handoverSummary(input: { patient: Patient; journey: JourneyRow[]; view: HandoverView }): string;
```

**Catcher:** a DOM test asserting the **copied text equals the rendered summary**. A summary built by
a second traversal drifts from the screen and nothing goes red — that is the defect.

- [ ] **Step 1: Write the failing test**

```tsx
it("copies exactly what the screen shows, from the same derivation", async () => {
  renderPerson();
  const rendered = screen.getByTestId("handover-summary").textContent ?? "";
  await userEvent.click(screen.getByRole("button", { name: /copy handover summary/i }));
  expect(await navigator.clipboard.readText()).toBe(rendered);
});

it("the ward view omits what a ward may not see", async () => {
  renderPerson();
  await userEvent.click(screen.getByRole("radio", { name: /ward/i }));
  // FD-23 from the display side. Nothing on this screen carries a referral history today (Task 11),
  // so this asserts the toggle does not ADD it back through the summary.
  expect(screen.getByTestId("handover-summary").textContent).not.toMatch(/referred to/i);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write `handover-summary.ts` and wire both controls.** Keyboard reachable, with visible
      focus.

- [ ] **Step 4: Run green and typecheck.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** anything the ward view would need FD-23's mechanism to hide.

**Report:** three lines.

---

### Task 13: Raise a referral — third edition, validation untouched

**Files:**

- Modify: `src/components/ward-management/referrals/referral-intake.tsx`
- Modify: `src/components/ward-management/referrals/referrals.module.css`
- Test: `tests/ward-referral-screens.dom.test.tsx`, `tests/ward-referral-matching.test.ts`,
  `tests/ward-seed-reaches-every-branch.test.ts`,
  `tests/ward-referral-control-labels.dom.test.tsx` — all exist

**Interfaces:**

- Consumes: `UNANSWERED_VALUE`, `UNANSWERED_OPTION_LABEL`, `REQUIRED_FIELD_NAMES`,
  `answeredProgress`, `referralSummaryRows`, `wardAndCommunityBothChosen` — existing exports of
  `referral-intake.tsx`.
- Produces: nothing new.

**Catcher:** the four existing suites above, re-derived. **The validation does not change.**

- [ ] **Step 1: Run the four suites and record them green BEFORE touching anything**

```bash
npx vitest run tests/ward-referral-screens.dom.test.tsx tests/ward-referral-matching.test.ts tests/ward-seed-reaches-every-branch.test.ts tests/ward-referral-control-labels.dom.test.tsx
```

A restyle that breaks a suite which was already red is unattributable. Record the baseline.

- [ ] **Step 2: Restyle to the drawing's per-question state and §6.13 controls.** Send stays
      disabled until valid **and says why**. Every acuity and toggle control **starts unanswered** —
      `UNANSWERED_VALUE` already exists and `false` is never a default.

🔴 **CORRECTED 2026-09-11 — THIS STEP SAID "§6.11 stepper" AND §6.11 DOES NOT APPLY TO THIS SCREEN.**
Measured, not recalled: the intake drawing `raise-a-referral-third-edition.html` contains **no**
`stepper`, `step`, `stageLine` or `destBadge` class — zero occurrences of any of the four. §6.11's
stepper is the **placement lifecycle** — seven stages, _placement requested → destination review →
accepted awaiting bed → bed pulled → handover ready → moving → arrived_ — and it belongs to the
shortlist column (§6.12 builds its head from it), not to an intake form.

⚠️ **Building it here would have been a category error with a clinical edge, not a styling slip.** A
lifecycle stepper on an unsent draft would paint the referrer's half-filled form as sitting at
_"placement requested"_ — **a claim that a request exists which has not been made.** The form's
progress and a referral's progress are different quantities, and the only reason the two got merged
in this plan is that both are drawn as a row of small marks.

**What the drawing actually uses**, and what this step builds: a per-question `.rrState` reading
**`Outstanding`** or **`Answered`** beside each `.rrLab`, over `.rrAsk` / `.rrPicks` / `.rrPick`.
Both words are **renderings of a truth the form already holds** — `fieldIsUnanswered` decides it
today for the rail — so this adds no claim the engine cannot back. **Derive both from that same
function**; a second predicate is how a question comes to read Answered in one place and Outstanding
in the other.

**§6.13 still applies and is ALREADY BUILT — do not "add" it.** Send already carries
`aria-disabled="true"` with an inert handler rather than the native `disabled`, and an
`aria-describedby` pointing at the reason (`referral-intake.tsx:1821-1841`), which is exactly
§6.13's _"`aria-disabled` rather than the disabled attribute so the reason stays reachable"_. The
label is already **`Send referral`**. Leave all four alone; the remaining work in §6.13 is the rest
state, hover, pressed and focus tokens.

- [ ] **Step 3: Catchment reads as INFORMATION (Q-2).** No destination is hidden or excluded by where
      the patient lives. If any existing code narrows the destination list by home area, **stop and
      hand it back** — that is a ruling change, not a restyle.

- [ ] **Step 3b: 🔴 A referral is addressed to the ward SYSTEM, never to a named ward.**

**Verified here by reading `ward-model.ts`, not taken on relay.** The `psychiatric_ward` arm of
`ReferralDestination` carries **only request facts** — `sex`, `secureBedNeeded`,
`involuntaryBedNeeded`, `highAcuityNursingNeeded`. There is **no unit id on it.** A ward's identity
attaches only at `acceptedUnitId`, which lives on `ReferralAddressing` — the record of what a
destination **answered** — and whose own comment reads _"The unit that accepted."_

**So do not build, restyle or label any control that appears to address a named ward.** A ward
picker on this form would imply an addressing the model does not hold, and the form would compile,
render and pass every existing suite while promising something the engine cannot record.

Add the guard in the same commit:

```ts
it("offers no way to address a referral to a named ward", () => {
  renderIntake();
  // The model has no unit id on the psychiatric_ward destination arm. A control that looked like
  // one would be a promise the engine cannot keep, and nothing else in the repository would notice.
  expect(screen.queryByLabelText(/which ward|choose a ward|ward name/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Run the four suites green, then the browser spec**

```bash
npx vitest run tests/ward-referral-screens.dom.test.tsx tests/ward-referral-matching.test.ts tests/ward-seed-reaches-every-branch.test.ts tests/ward-referral-control-labels.dom.test.tsx
```

```bash
npx tsc --noEmit
```

```bash
npm run ensure
```

```bash
npx playwright test tests/ui-ward-referrals.spec.ts
```

⚠️ **I-15 — the approved-referral columns.** The size and the cause were **BOTH retracted**: it is
**ONE column clipped by about 17px, at 641px only**, and the causal story was false. The owner
**deferred** the fix. **A diagnosis is not permission.** Re-run the spec and **report the result by
name**. Whether narrow widths drop and stack, or scroll sideways and visibly show it, **is the
owner's unanswered question and nobody picks one as part of a repair.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** any validation change; any control that addresses a named ward; any answer to the
narrow-width question.

**Report:** three lines, plus the I-15 spec result by name.

---

### Task 14: Raise a referral — read the query contract

**Files:**

- Modify: `src/components/ward-management/referrals/referral-intake.tsx`
- Test: `tests/ward-referral-query-prefill.dom.test.tsx` (**new**)

**Interfaces:**

- Consumes: the query contract
  `/referrals/new?patientId=&source=ed|community|gp&originEdId=&teamId=`, written by lanes A and B
  through the facade's `raiseReferralHref({...})`. **Lane C READS it.** A route string typed into a
  screen is a defect.
- Produces: nothing.

**Measured at `8c5aebc938`:** `readPatientId` in `referral-intake.tsx` reads **only** `patientId`, and `ReferralIntakeForm` calls `useSearchParams` for nothing else. `source`,
`originEdId` and `teamId` are **not read**, so the task is outstanding.
The case in `tests/ward-person-screen.dom.test.tsx` titled _"builds the referral link with the patientId key, so the intake can read it back"_ already proves that key round-trips.

**Catcher:** one DOM case **per source**, because a prefill that works for `ed` and silently does
nothing for `community` passes any single-source test.

- [ ] **Step 1: Write the failing test**

```tsx
it.each([
  ["ed", { originEdId: "ED-01" }],
  ["community", { teamId: "CT-07" }],
  ["gp", {}],
])("prefills from source=%s", (source, extra) => {
  renderIntakeWithQuery({ patientId: someone.id, source, ...extra });
  expect(screen.getByLabelText(/source/i)).toHaveValue(source);
  for (const value of Object.values(extra)) {
    expect(screen.getByDisplayValue(value)).toBeInTheDocument();
  }
});

it("ignores a query value the contract does not name, rather than trusting it", () => {
  renderIntakeWithQuery({ patientId: someone.id, source: "not-a-source" });
  // An unrecognised source must leave the control UNANSWERED, never map onto a default. A default
  // here is a definite clinical answer nobody gave — the defect `UNANSWERED_VALUE` exists for.
  expect(screen.getByLabelText(/source/i)).toHaveValue(UNANSWERED_VALUE);
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Read the three params through `useSearchParams`** — the same hook `readPatientId`
      uses, and for the reason its own comment gives at line 825: a hand-rolled store put the
      **previous** person's id into a referral naming the wrong human being.

- [ ] **Step 4: Run green and typecheck.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** `raiseReferralHref` — that is the facade's, Phase 1.

**Report:** three lines.

---

### Task 15: Raise a referral — the duplicate sentence

**Files:**

- Create: `src/components/ward-management/referrals/referral-duplicate.ts`
- Modify: `src/components/ward-management/referrals/referral-intake.tsx`
- Test: `tests/ward-referral-duplicate.test.ts` (**new**)

**Interfaces:**

- Consumes: `Referral.patientId` (optional, on `Referral` in `ward-model.ts`), `Movement`, `referralState` from
  `ward-referrals.ts`.
- Produces:

```ts
export function duplicateSentence(input: {
  patientId: PatientId;
  referrals: Referral[];
  movements: Movement[];
}): string | undefined;
```

**Catcher:** a DOM test with and without a duplicate, **proved by mutation** — flip the predicate and
watch it redden.

⚠️ **Never a "did you mean" about a record number.** The sentence states what already exists for
**this** `patientId`; it never guesses at identity.

- [ ] **Step 1: Write the failing test**

```ts
it("says what is already open for this person, and is true read alone", () => {
  expect(
    duplicateSentence({
      patientId: someone.id,
      referrals: [openReferralFor(someone)],
      movements: [],
    }),
  ).toBe("A referral for this person is already open.");
});

it("says nothing when nothing is open", () => {
  expect(duplicateSentence({ patientId: someone.id, referrals: [], movements: [] })).toBeUndefined();
});

it("does not fire on a referral that names nobody", () => {
  // `patientId` is OPTIONAL on a referral. A predicate written as `r.patientId !== id` fires on
  // every referral that carries nobody, which is most of them.
  expect(
    duplicateSentence({
      patientId: someone.id,
      referrals: [referralWithNoPatient()],
      movements: [],
    }),
  ).toBeUndefined();
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write `referral-duplicate.ts`**, matching on `patientId` equality and on open state
      only, and render the sentence **inline in The person**.

- [ ] **Step 4: Prove the catcher by mutation**

Commit first. `git checkout --` discards an uncommitted fix in the same file, and does nothing at all
to an untracked one.

```bash
git commit -- src/components/ward-management/referrals/referral-duplicate.ts tests/ward-referral-duplicate.test.ts -m "test(ward-flow): the referral duplicate sentence, before the mutation"
```

Invert the open-state check by hand, then:

```bash
npx vitest run tests/ward-referral-duplicate.test.ts
```

Expected: **RED**. Restore the file, and confirm it is green again.

- [ ] **Step 5: Wire it, run green, prettier, commit.**

**Not built:** any identity guess.

**Report:** three lines, including the mutation result.

---

### Task 16: Raise a referral — prove the history field is already the ruling

**Files:**

- Test: `tests/ward-referral-history-is-one-optional-field.test.ts` (**new**)
- Modify: `src/components/ward-management/referrals/referral-intake.tsx` — **only if** the measured
  state disagrees with the ruling.

**Interfaces:**

- Consumes: `HISTORY_FIELDS`, `overLimitHistoryFields`, `writtenHistoryCount` — existing exports.
- Produces: nothing.

🔴 **Measured at `8c5aebc938`, and this changes the task.** `HISTORY_FIELDS` in `referral-intake.tsx` already
holds **exactly one** history field, `key: "history"`, `required: false`. Q-13's ruling is **already
built**. `ward-eligibility.ts` and `ward-referrals.ts` contain **no** read of `.history`.

**So this task does not build the ruling. It builds the guard that keeps it**, because the drawing
still shows three blocks with one required and Ward Mockups has not yet redrawn — a later builder
reading the drawing will add two fields back and nothing today would go red.

- [ ] **Step 1: Write the guard**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORY_FIELDS } from "@/components/ward-management/referrals/referral-intake";

describe("the referral's history — one field, optional, last", () => {
  it("is exactly one field and it is not required", () => {
    // Owner ruling 2026-08-30, upheld as Q-13 on 2026-09-10: ONE story field, optional, last,
    // never feeding eligibility. The DRAWING still shows three blocks with one required, and Ward
    // Mockups has not yet redrawn it. A builder reading the drawing will add them back; this is
    // what goes red when they do.
    expect(HISTORY_FIELDS).toHaveLength(1);
    expect(HISTORY_FIELDS[0].key).toBe("history");
    expect(HISTORY_FIELDS[0].required).toBe(false);
  });

  it("is never read by anything that decides eligibility", () => {
    // Read as text rather than imported: the point is that no such code EXISTS, and a test that
    // imported a function to check its output could only prove the branch it happened to call.
    for (const path of [
      "src/components/ward-management/ward-eligibility.ts",
      "src/components/ward-management/ward-referrals.ts",
    ]) {
      expect(readFileSync(path, "utf8")).not.toMatch(/\.history\b/);
    }
  });
});
```

⚠️ This test uses `readFileSync`, so **`test:focused` cannot select it**. Run it by name.

- [ ] **Step 2: Run it.** Expected: **PASS immediately.** That is the correct outcome and it is the
      point — the ruling is already built, and now it is held.

```bash
npx vitest run tests/ward-referral-history-is-one-optional-field.test.ts
```

- [ ] **Step 3: Confirm the field is LAST in the rendered order.** If it is not, move it. If it is,
      record that and change nothing.

- [ ] **Step 4: Run green and typecheck.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** three history fields — Q-13 ruled them out; Ward Mockups redraws.

**Report:** three lines, saying plainly that the ruling was already satisfied.

---

### Task 17: 🔴 BLOCKED — gender on the Patient screen and the referral form

**Do not start this task until §0.1's model half has landed on the line.** Verify by command, not by
a message:

```bash
grep -n "gender" src/components/ward-management/ward-patients.ts | grep -c .
```

Zero means still blocked.

**Files:**

- Modify: `src/components/ward-management/patients/person-screen.tsx`
- Modify: `src/components/ward-management/referrals/referral-intake.tsx`
- Test: `tests/ward-gender-not-yet-recorded.dom.test.tsx` (**new**)

**Interfaces:**

- Consumes: `Patient.gender: "Female" | "Male" | undefined` — **does not exist yet.**
- Produces: nothing.

**Catcher:** a DOM test for the **unrecorded** case on both screens. That case is the whole ruling:
_"A patient with no gender recorded is not placed by the gender gate."_

- [ ] **Step 1: Write the failing test**

```tsx
it("shows gender as its own field, and never fills it in from sex", () => {
  renderPersonWith({ sex: "Male", gender: undefined });
  expect(screen.getByTestId("gender-field")).toHaveTextContent(/not yet recorded/i);
  // 🔴 THE DECIDING ASSERTION. Defaulting an unrecorded gender to the recorded sex silently
  // re-merges the two fields this ruling exists to separate, in the one case where the difference
  // matters most, and nothing else would go red. Owner, 2026-09-10.
  expect(screen.getByTestId("gender-field")).not.toHaveTextContent(/male/i);
});

it("lets the clinician complete gender at referral, and stays submittable when they do not", () => {
  renderIntakeForPatientWithNoGender();
  expect(screen.getByLabelText(/gender/i)).toHaveValue(UNANSWERED_VALUE);
  // Two values cannot describe a non-binary person, and the form must still be submittable for
  // one. Owner, 2026-09-10, recorded rather than argued.
  expect(screen.getByRole("button", { name: /send referral/i })).toBeEnabled();
});

it("offers no override on the gender gate", () => {
  renderShortlistRefusedOnGender();
  // NO OVERRIDE PATH. He did not create one, and the reasoning removes the need. Nine other gates
  // have one; that is not a reason.
  expect(screen.queryByRole("button", { name: /place anyway/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Render gender as its own field** on the Patient screen, and offer it on the form
      **prefilled from the profile when the profile holds it**, unanswered when it does not. Never
      silently blank; never defaulted.

⚠️ **Wording.** No sentence may imply the field is always populated. _"Gender: not yet recorded"_ is
the model. _"Gender: —"_ and _"Gender: unknown"_ are not.

- [ ] **Step 4: Run green and typecheck.**

- [ ] **Step 5: Prettier and commit.**

**Not built:** the gender gate itself; `Unit.sexMix` becoming a gender mix — **handed back**, §0.1.

**Report:** three lines. If still blocked, the report says **blocked** and names the command that
proved it.

---

### Task 18: The Q-12 inventory — every panel this lane keeps that its drawings do not

**Files:**

- Create: `docs/ward-flow/lane-c-panels-kept-2026-09-1x.md`

**Interfaces:** none.

**Catcher:** none — this is a report, and it says so. Q-12's principle is settled and **not
re-openable: nothing is dropped.** The list is not settled, and Ward Lead puts the assembled list to
the owner **once**, at the end of Phase 2.

- [ ] **Step 1: For each of the four screens, list every panel the app carries that the drawing does
      not.** Known already at `8c5aebc938`: the hub's **Design decisions** footer (four claims in the
      drawing that failed a data check and are **already corrected in the app** — keep the
      corrections, route the four claims to Ward Mockups); `hub-browser-memory.ts`'s recently-viewed
      memory; the intake's origin-site validation, which is **ahead of the drawing**.

- [ ] **Step 2: For each, say kept-as-is, folded into a drawn panel, or moved to the Activity
      drawer.** A lane that silently drops a panel has broken the ruling; so has one that silently
      keeps a panel without listing it.

- [ ] **Step 3: Prettier and commit.**

**Report:** the list, with nothing claimed as owner-approved.

---

## Definition of done for each screen (master plan §5.0, with one correction)

Quote the proving line for every item:

1. Renders inside the shared shell on its existing route with no rail or header of its own.
2. Every panel, action and state the mockup draws is present, or its absence is recorded as an owner
   question by number.
3. Every figure derived; a grep of the screen's JSX for a numeric literal in text position returns
   only ordinals and dates.
4. Every link resolves through the facade's href builders onto a real route with the identifier
   intact (`ward-links-never-point-at-redirect-stubs` green).
5. The DOM test asserts the words of every state, and was proved a catcher by **one mutation**.
6. ⚠️ **CORRECTED.** The master plan says the reconciliation line reads _"Synthetic snapshot at
   &lt;clock&gt;, figures reconcile"_. **The owner superseded that on 2026-09-10 evening.** It reads
   **_"Invented figures, reconciled with each other"_**, and goes red when a figure is made to
   disagree.
7. Keyboard reach and visible focus on every control; the live region announces each change; nothing
   under 12px; tokens only; no edge bar or top highlight.
8. Looked at, by a person, at **390, 820 and 1440** in both themes, screenshots in the report — and at
   least one width in the **641–1000px** band.
9. `node scripts/run-ward-tests.mjs` and `node scripts/check-ward-expected-reds.mjs` green in this
   worktree; prettier clean on touched files; one SHA handed to Ward Lead with an artefact grep.
10. The report ends with the three lines: proven by test, proven by looking, not proven.

---

## Self-review

**Spec coverage.** §4.9 maps to Tasks 4–7. §4.10 maps to Tasks 8–12, with History and Community
handed back (§0.2). §4.11 maps to Tasks 1–3. §4.12 maps to Tasks 13–17, with gender handed back until
the model lands (§0.1). §3.2's six lines are on every task. §3.3 is the Global Constraints section,
with the activity sentence corrected to the owner's. §5.0 is above, with item 6 corrected. Q-12 is
Task 18.

**Placeholders.** None. Every code step carries the code. Where a task may already be satisfied
(Tasks 3 and 16), the step says so and forbids inventing a change to look busy.

**Type consistency.** `refusalFor`, `NOTHING_FOUND` and `RESULTS_FOOTER` (Task 5) are used only in
Task 5. `patientJourney` returning `JourneyRow[]` (Task 10) is consumed by `handoverSummary` (Task 12)
under that name. `duplicateSentence` (Task 15) returns `string | undefined` and is rendered as one
sentence. `eligibility(movement, unit, now)` and `candidateReason(verdict)` are the real signatures at
the real signatures exported by `ward-eligibility.ts`, not the master plan's proposed `movementVerdict`.

---

## What must be said back to Ward Lead

- Branch and SHA.
- **Three hand-backs:** §0.1 the gender model, §0.2 the FD-23 tabs, §0.3 the facade.
- **Three master-plan claims that measured wrong:** the verdict derivation is not trapped in the
  shared console; the activity sentence in §3.3 and §5.0 is the superseded one; Q-13's one history
  field is already built.
- The Task 8 `<h1>` reading, for confirmation.
- The I-15 spec result by name, with **no** answer to the narrow-width question.
