# Ward Flow fresh full audit — 25 September 2026

**Verdict tip:** `13ce7b588be9b1610ded665a59eca2bbdf54644c`  
**Branch:** `codex/task-ward-flow-live-state-20260831` (local only; never pushed)  
**Working tree at gate time:** clean  
**This document is the fresh verdict.** The earlier same-day review
[`audit-2026-09-25-full-review.md`](audit-2026-09-25-full-review.md) was written against tip
`3e38413195` and is **historical only** — do not treat it as this audit’s answer.

Nothing in this pass fixed product code. Nothing was committed or pushed.

---

## Headline

**Do not trust several screens with a bed decision yet.**

On the tip under audit, the type check is green, but the full offline ward suite is deep red, and
many redesigned screens invent names, ages, legal status, vitals, bed pods, transport, and KPI
figures as if they came from the live model. A few engine paths can also lie about locked beds,
transport that should stay booked, and who is allowed to raise a secure referral.

Browser spot-checks could **not** be finished: the local app server (`npm run ensure`) hung or timed
out on ports 3605/3606. Every finding that would need a live look is marked
**confirmed in code; unchecked-in-browser**.

---

## Gate results (tip `13ce7b588be9b1610ded665a59eca2bbdf54644c`)

| Check | Result |
| ----- | ------ |
| TypeScript (`tsc -p tsconfig.typecheck.json --noEmit`) | **PASS** |
| Full offline ward suite (`check-ward-expected-reds`) | **FAIL** — 77 unexpected failing files; expected-reds list empty. On those files: ~172 failed / 861 passed / 1033 tests |
| ESLint (`ward-management` + `ward-flow` routes) | **FAIL** — 96 errors, 79 warnings |
| Organisation (`ward:organise:check`) | **PASS** (exit 0; 227 review findings, advisory) |
| Doc links (`check:ward-doc-links`) | **PASS** (66 `file://` warnings only) |
| Governance (`ward:governance:check`) | **PASS** (quarantine / PARKED path) |
| Browser truthfulness (`npm run ensure` + live screens) | **Not run** — server hung / timed out |

### Suite failure groups (why the reds cluster)

1. **Engine walk / `REFER_TO_UNITS` (~35+)** — movement and referral walks disagree with pinned
   expectations after recent engine changes.
2. **`getTime` runtime (~17)** — clock / date helpers throw or return bad values in tests that
   assume a Date.
3. **Seed pins (~14)** — census and ID-list tests still hold older movement/referral counts.
4. **Ruling conflicts (~13)** — behaviour diverged from recorded owner rulings; each needs restore
   *or* a later written ruling and a test update.
5. **Style / contract guards (~13)** — hex/`rgba`, tokens, table and figure contracts.
6. **Screen DOM remainder** — redesigned screens no longer match DOM contracts the tests assert.

Lint detail is summarised under P2/P3 in the fix plan; this report does not dump every warning.

### Tip note after gate time

After the gates were recorded, HEAD on this branch moved forward (journey-explorer merge and related
commits). **This verdict is only for `13ce7b…`.** Re-run gates before treating a newer tip as green
or red.

---

## How to read severity labels

| Label | Meaning |
| ----- | ------- |
| **confirmed** | Read in source at tip; often reproduced offline. Safe to treat as real. |
| **likely** | Strong code evidence; not fully exercised in an isolated script. |
| **confirmed in code; unchecked-in-browser** | Proven in source; **not** confirmed live because the local server would not start. |

---

## Findings by area

### A. Trust killers — wrong identity and invented clinical facts

These break the mission rule: *nothing is shown that the data does not hold.*

| # | Finding | Evidence / area | Status |
| - | ------- | --------------- | ------ |
| A1 | **Handover overlays the wrong patient** on real movements via `KNOWN_MOVEMENT_PERSONAS` (e.g. WF-005 / WF-006 / WF-021 mapped to names that are not those movements’ people). | `handover/handover-page.tsx` | confirmed in code; unchecked-in-browser |
| A2 | **Discharges / breaches** use typed tables of patients and breach rows, not derived model lists. | discharges / breach surfaces | confirmed in code; unchecked-in-browser |
| A3 | **Ward patient drawer invents vitals** (and related clinical chrome) not held on the admission. | ward drawer | confirmed in code; unchecked-in-browser |
| A4 | **Bed board invents pods / HDU layout** that the unit model does not define. | bed board | confirmed in code; unchecked-in-browser |
| A5 | **People search invents legal status, age, and sex** for hits. | search / people | confirmed in code; unchecked-in-browser |
| A6 | **Referral drawer** shows “Live Database Search” and destination wards that do not exist in the network; patient overlays invent clinical context. | `referrals/ward-referral-drawer.tsx` | confirmed in code; unchecked-in-browser |
| A7 | **Alerts** surface wrong identity for WF-021 (Luke Davies vs seed person). | alerts | confirmed in code; unchecked-in-browser |
| A8 | **Add-patient** shows fake match percentages. | add-patient flow | confirmed in code; unchecked-in-browser |
| A9 | **Patient-now** can swap / mis-attribute the “now” person relative to the movement. | patient-now | confirmed in code; unchecked-in-browser |
| A10 | **Statistics** invents figures (counts, percentages, hold times) not computed from state. | statistics screens | confirmed in code; unchecked-in-browser |
| A11 | **Delays** radar and legal-clock surfaces invent timing / legal presentation. | delays | confirmed in code; unchecked-in-browser |
| A12 | **Community** search is dead (or ornamental) while looking interactive. | community | confirmed in code; unchecked-in-browser |
| A13 | **Officer / fleet** uses a typed fleet, not transport state. | officer screen | confirmed in code; unchecked-in-browser |
| A14 | **Rail “Quick Clinical Jumps”** invent clinical destinations. | shell / rail | confirmed in code; unchecked-in-browser |
| A15 | **On-call** shows a flat “100%” (or equivalent) that is not a derived coverage figure. | on-call | confirmed in code; unchecked-in-browser |
| A16 | **Governance** typed registers look like live authority lists. | governance | confirmed in code; unchecked-in-browser |
| A17 | **Settings** “recorded queries” are decorative, not a durable query store. | settings | confirmed in code; unchecked-in-browser |
| A18 | **ED** “4h hold” (or similar) label overclaims what the ED model tracks. | ED screen | confirmed in code; unchecked-in-browser |

**Cleaner families (still code-reviewed; not live-checked):** hub, capacity, legal forms, discharges
*honest* paths, coordinator home, OOA (disclosed as out-of-area), and controls that already say
“not wired”. Legal-form audit outcome is **FIXED** — do not re-open that programme in this list.

---

### B. Engine / domain — beds, transport, identity of jobs

| # | Finding | Area | Status |
| - | ------- | ---- | ------ |
| B1 | **Locked-bed count creep (WF-006 path)** — locked / contested bed accounting can drift so the board over- or under-counts unavailable beds. | reducer / contention / capacity derivations | confirmed |
| B2 | **Invented arrival admission** — arrival handling can create or attach an admission the movement did not honestly carry. | reducer / movements | confirmed |
| B3 | **No-transport closes a booked vehicle (WF-005)** — marking no transport can clear or close a vehicle that should stay booked. | transport / movements (WF-005) | confirmed |
| B4 | **Bed release by ward counts** — releasing by ward-level counting can free the wrong bed or leave the wrong unit short. | bed release / units | confirmed |
| B5 | **Catchment crash on `"constructor"`** — catchment lookup can throw when a bad key hits Object prototype names. | catchment | confirmed |
| B6 | **Referral vs movement security gates mismatch** — who may raise a secure referral does not match who may move into secure beds. | referrals / movements / roles | confirmed |
| B7 | **Movement sex-mix lenient** — sex-mix rules on move are weaker than the clinical mix rules the seed implies. | movements / eligibility | confirmed |
| B8 | **Specialling wrong text** — specialling notices or labels do not match the ruled meaning. | specialling / notices | confirmed |
| B9 | **Invented admission `dischargeRevision` 1** — revision bookkeeping can invent a first revision without a real discharge edit. | reducer `dischargeRevisions` | confirmed |
| B10 | **Orphan events** — event types exist with no honest screen producer (or producers that never emit). | events / screens | confirmed |
| B11 | **Sheet date timezone** — legal / form sheet dates shift with local TZ vs the demo clock. | clock / forms | confirmed |
| B12 | **Age “early” behind UTC** — age banding can flip a day early relative to UTC/demo anchor. | patients / clock | confirmed |
| B13 | **Demo clock** — demo “now” and wall clock still diverge in places that affect due-soon and breach windows. | clock | confirmed |
| B14 | **Bed-hold dead helpers** — helpers exist that screens do not call; hold UX can look complete while paths are dead. | bed-hold | confirmed |
| B15 | **Coordinator worklist withdrawn arms** — withdrawn / cancelled arms still appear or fail to clear on the worklist. | coordinator worklist | confirmed |
| B16 | **Broadcast under-validated** — broadcast / notice payloads are accepted without the validation other mutations get. | notices / broadcast | confirmed |
| B17 | **AD-SCGA-06 sex/gender seed clash** — seed person AD-SCGA-06 contradicts its own sex/gender fields. | seed | confirmed |
| B18 | **Stale eligibility comment** — comment claims a rule the code no longer enforces (misleading for the next editor). | eligibility | confirmed |
| B19 | **Ward-legal-clock hard-coded Act maxima unused** — maxima are coded but not driving the clock UI/logic that staff see. | legal clock | confirmed |

**Do not re-open:** legal-form audit — already fixed.

---

### C. Docs, tooling, and housekeeping

| # | Finding | Status |
| - | ------- | ------ |
| C1 | **README / STATUS tip still cite `8d1c7c1e00`** (~75 commits behind the tip under audit). | confirmed |
| C2 | **Expected-reds empty is true** — suite claims “no known reds” while 77 files fail. | confirmed |
| C3 | **Stray root scratch** files still present outside the docs tree. | confirmed |
| C4 | **Two skipped `ui-ward` specs** — browser journeys not exercising those paths. | confirmed |
| C5 | **Governance drafts quote Act sections** against D5 / R2–3 posture (owner parked formal legal advice). | confirmed |
| C6 | **OPEN-QUESTIONS community cancel** entry is stale relative to current behaviour. | confirmed |
| C7 | **STATUS mojibake** (broken characters) in places. | confirmed |
| C8 | **SCREEN-VERIFICATION stale** — looking programme not refreshed to this tip. | confirmed |

Organisation check’s 227 findings are advisory; they do not block folds by themselves.

---

## What was not covered

- **Live browser truthfulness** on handover, ward board/drawer, search, statistics, referrals, and
  alerts — blocked by `npm run ensure` hang/timeout. No claim that screens look like their drawings.
- **Full Screen Definition-of-Done looking** across ~34 screens (`SCREEN-VERIFICATION.md`) — separate
  programme; this audit did not re-open it.
- **PsychSift / Supabase / Railway / production** — out of scope.
- **Mobile, dark mode, and forced-colors** — not run (no live app).
- **Re-measurement of commits after `13ce7b…`** (journey-explorer merge and later) — not in this
  verdict.
- **Every ESLint warning line-by-line** — summarised only; see ranked P2/P3.
- **Provider-backed or hosted checks** — none run.

---

## Historical pointer

[`audit-2026-09-25-full-review.md`](audit-2026-09-25-full-review.md) audited tip `3e38413195` earlier
on 25 September. It remains useful as a diary of that tip and of concurrent writers that day. **This
file is the fresh full audit and the ranked fix plan to follow.** Where the two disagree, prefer this
document for tip `13ce7b…`.

---

## Ranked fix plan (P0–P3)

Order is for a bed coordinator’s trust: **stop lying first**, then stabilise the suite, then polish.
No implementation in this audit.

### P0 — Wrong identity or invented clinical facts; capacity / legal / transport lies on screen

| ID | Fix | File / area | Outcome when fixed |
| -- | --- | ----------- | ------------------ |
| P0-1 | Remove or gate `KNOWN_MOVEMENT_PERSONAS`; always render person fields from the movement/admission | `handover/handover-page.tsx` | Handover shows the correct name and UMRN for every real movement |
| P0-2 | Stop typed discharge/breach tables; bind to derived lists or mark “demo copy” | discharges / breaches screens | No invented discharged patients or breach rows |
| P0-3 | Strip invented vitals from ward drawer; show only model fields or honest empty | ward drawer | Clinicians cannot mistake fake vitals for observations |
| P0-4 | Remove invented pods/HDU on bed board; render unit beds from model | bed board | Board layout matches real bed inventory |
| P0-5 | Search results: legal / age / sex only from patient/admission records | search / people | Search cannot invent protected attributes |
| P0-6 | Referral drawer: remove “Live Database Search”, fake wards, and invented clinical overlays | `referrals/ward-referral-drawer.tsx` | Referral UI only offers real network units and real patient facts |
| P0-7 | Alerts identity for WF-021 (and any other persona overlay) | alerts | Alert text matches seed person |
| P0-8 | Remove fake match % on add-patient | add-patient | Match UI cannot overclaim certainty |
| P0-9 | Patient-now: bind to the selected movement’s person only | patient-now | “Now” never swaps patients |
| P0-10 | Statistics: only derived figures, or label mock KPIs as non-operational | statistics | Coordinators do not plan from invented numbers |
| P0-11 | Delays radar / legal-clock: no invented timings; wire to clock + model or disclose | delays | Delay urgency matches engine time |
| P0-12 | Officer fleet from transport state; community search honest dead or wired | officer; community | No fake fleet; no fake community search |
| P0-13 | Rail Quick Clinical Jumps; on-call coverage %; governance registers; settings recorded queries; ED 4h hold label | rail; on-call; governance; settings; ED | Shell and support screens stop overclaiming |

### P1 — Engine defects that corrupt beds, jobs, or crash the prototype

| ID | Fix | File / area | Outcome when fixed |
| -- | --- | ----------- | ------------------ |
| P1-1 | Locked-bed count creep (WF-006) | reducer / contention / capacity | Locked and free bed counts stay consistent |
| P1-2 | Invented arrival admission | reducer / movements | Arrivals never invent an admission |
| P1-3 | No-transport must not close a booked vehicle (WF-005) | transport / movements | Booked vehicles survive “no transport” |
| P1-4 | Bed release by ward counts | bed release / units | Release frees the correct bed on the correct ward |
| P1-5 | Catchment crash on `"constructor"` | catchment | Bad keys fail closed without throwing |
| P1-6 | Align referral vs movement security gates | referrals / movements / roles | Secure raise and secure move use one rule |
| P1-7 | Tighten movement sex-mix to ruled strength | movements / eligibility | Mix rules match clinical intent |
| P1-8 | Specialling copy matches ruling | specialling / notices | Staff read the correct specialling meaning |
| P1-9 | `dischargeRevision` invents “1” | reducer `dischargeRevisions` | Revisions only advance on real discharge edits |
| P1-10 | Coordinator worklist withdrawn arms | coordinator worklist | Withdrawn work disappears from active list |
| P1-11 | Broadcast validation | notices / broadcast | Broadcasts reject under-specified payloads |
| P1-12 | Fix AD-SCGA-06 sex/gender seed clash | seed | Seed person is internally consistent |

### P2 — Suite green, rulings, style/token, docs tip honesty

| ID | Fix | File / area | Outcome when fixed |
| -- | --- | ----------- | ------------------ |
| P2-1 | Resolve engine walk / `REFER_TO_UNITS` failures (~35+) | reducer + affected `tests/ward-*` | Largest red cluster closes or is owned in expected-reds with reason |
| P2-2 | Fix `getTime` runtime failures (~17) | clock / date helpers + tests | Date-based tests stop throwing |
| P2-3 | Update seed pins (~14) or shrink seed deliberately | seed + census/ID tests | Counts and IDs match one story |
| P2-4 | Ruling conflicts (~13): restore ruled behaviour **or** record later ruling and update tests | `OWNER-RULINGS.md` + failing ruling tests | No silent rule drift |
| P2-5 | Style/contract guards (~13) and screen DOM remainder | redesigned screens + CSS | Token/figure/DOM contracts pass |
| P2-6 | Clear or populate expected-reds honestly; stop claiming suite green | `expected-reds` + STATUS | Status matches measured reds |
| P2-7 | Advance README/STATUS tip SHA; fix STATUS mojibake; refresh SCREEN-VERIFICATION; retire stale OPEN-QUESTIONS community cancel | docs | Docs describe this tip |
| P2-8 | Reduce ESLint errors (96) on ward surfaces — Link vs `<a>`, `any`, etc. | ward-management + mockup routes | Lint no longer blocks local discipline |
| P2-9 | Orphan events: wire producers or delete dead types | events | Every event type has an honest path |
| P2-10 | Sheet date TZ + age early-behind-UTC | clock / forms / patients | Dates and ages stable against demo anchor |

### P3 — Polish and demo-only edges

| ID | Fix | File / area | Outcome when fixed |
| -- | --- | ----------- | ------------------ |
| P3-1 | Demo clock remaining edges | clock | Due-soon / breach windows match demo “now” everywhere |
| P3-2 | Bed-hold dead helpers: wire or remove | bed-hold | No dead hold paths looking complete |
| P3-3 | Stale eligibility comment | eligibility | Comments match code |
| P3-4 | Ward-legal-clock Act maxima: wire or remove | legal clock | Maxima either drive UI or are gone |
| P3-5 | Remaining ESLint warnings (79); organisation advisory batch | lint / organise | Noise down for the next editor |
| P3-6 | Stray root scratch cleanup; un-skip or justify two `ui-ward` specs | repo root; Playwright | Housekeeping matches HOW-WE-WORK |
| P3-7 | Governance drafts vs D5/R2–3 Act quoting | governance docs | Drafts do not overclaim Act text before parked advice |

---

## Recommended next move for the owner

1. Treat **P0** as the only work that must land before showing Ward Flow to a coordinator as a
   weekday tool.
2. Treat **P1** as the next engine pass (beds and transport lies even when the UI is honest).
3. Do **not** declare the suite green until **P2-6** is done.
4. Re-run `npm run ensure` on a quiet machine before any “looks like the drawing” claims.
5. Keep the earlier 25 Sept review file as history; use **this** file as the working backlog.

---

*End of fresh full audit. Product code unchanged. No commit. No push.*
