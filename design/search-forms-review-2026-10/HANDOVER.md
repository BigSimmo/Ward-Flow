# Search and forms review: handover

_Updated 2026-10-31 - first handover for the search and forms task; Design owns._

**Status:** behaviour changes are built and pushed. The visual changes are a mock-up waiting for
Josh's approval under the [D-74 standing rule](../../docs/ward-flow/decisions.md#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026).
Nothing is merged, released or deployed.

- **Branch:** `claude/search-forms-optimization-44anqi` on `BigSimmo/Ward-Flow`, based on `main` at
  `b6aa5cdef`.
- **Pull request:** a draft PR from this branch. Do not merge it before Josh approves the mock-up
  and the open points below.
- **Mock-up:** `/mockups/ward-flow-search` on a local server. Production blocks every `/mockups` page.
- **Screenshots for review:** a private preview, https://claude.ai/artifact/JMHjjXfSWBrkRqscaXeutx.
  Josh owns it; share it from its own menu if others need it.
- All data is synthetic.

## What Josh asked for (30 October 2026)

He asked for eight things:

1. Review every search bar and every form.
2. Make every kind of search smarter.
3. Improve the design, polish and placement of each search, suited to each device.
4. Consider making the phone's main search a pop-out, as Help is, unless the #1118 mock-ups already
   do that. They do not: #1118's Search mock-up keeps search in the app bar.
5. Add Help's questions to the main search. Help's own search stays Help-only.
6. Add smart, time-saving features to every form.
7. Remove redundant or low-yield search bars.
8. Make any similar improvements.

**His answers during the task:**

- Build behaviour changes now. Visual, placement and pop-out changes go to a mock-up first (D-74).
- Remove all four proposed groups: the four low-yield bars, the Referrals "Filter queue", the
  duplicate merges, and the tiny-list filters (ED index and the Statistics ward and ED tables).
- He approved the whole plan ("Go ahead with all recommendations"), including the claim comment on
  #688 and pushes to this branch.
- He approved a scoped takeover of the main search files, building on draft PR #1116.
- He approved `git fetch --unshallow origin`. The commit hook cannot verify Ward Flow identity in a
  shallow clone.
- Skip `officer/officer-screen.tsx` (held for #1115) and `help/whats-new.json` (held by the Help owner).

## What was built (commits on the branch, oldest first)

### 1. PR #1116 merged in (`415467001`)

#1116 is "Improve Smart Search matching and keyboard behaviour", head `bc6bfb22`. It is merged
unchanged, so its every-word matching for places, pages, forms and tasks, and its keyboard fixes,
are kept. Its 114 focused tests passed after the merge.

### 2. Help, contacts and suburbs in the main search (`1a9104c6a`)

**Help answers in the header search and the phone Menu search:**

- Up to three Help answers show for a query of three or more letters.
- A how, where, why or what question puts Help first.
- Choosing an answer runs Show me when the desk has one, goes to the screen where the job is done,
  or opens the answer in Help.
- A clinical question gets Help's fixed `CLINICAL_REPLY` and no answers.
- The existing refusals still run first.
- Help's own search is unchanged.

**How the Help answers are kept role-blind:**

- The header search stays role-blind (its owner ruling). The desk-aware part lives in the caller,
  `ward-global-search-help.tsx`, which the lazy wrapper now loads, so it adds nothing to the phone
  first load.
- Nothing under `help/*` was edited (that is #1119's area). The new code imports only
  `searchHelp` and `CLINICAL_REPLY` from `help/ward-help-search-index.ts`, the open/ask/Show-me events
  from `help/ward-help-events.ts`, `useTourRole` from `help/ward-help-store.ts` and `howToHref`
  from `help/ward-help-ask.tsx`.

**Contacts:** on-call directory entries match role or place words, or a number typed with spaces or
brackets. A row shows the number to ring now, using the board clock.

**Suburb or postcode:**

- A whole suburb, alias or 4-digit postcode names the catchment clinic and service.
- A contested or unreviewed suburb says so ("Contested / split · check in the suburb lookup") and
  names no single clinic.
- A part-word never matches.

**Shared matcher, `search/search-text.ts`:**

- Text is folded as `findPatients` folds it.
- Every typed word must match, in any order.
- Numbers match on their digits.
- Near spellings are allowed only for places, screens and contacts, never for people or UMRNs. They
  apply only when nothing matched exactly and no person, movement or referral matched.

**Other changes in this commit:**

- Movements in the header search now match every word.
- The catchment lookup logic moved out of the Tools component into `tools/ward-catchment-query.ts`,
  so search loads no React for it.
- Quick commands no longer repeat "+15m" and "?" in their labels, and the list lines up with its
  heading.

### 3. Removals Josh approved (`1056ecfc5`)

| Removed                                                                                 | Where                                     | What replaces it                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Community team page sample-patient search, its hero popover, phone chip and "/" binding | `community/community-screen*.tsx`         | The header search (same engine); "/" now reaches it                   |
| Patient record History and Documents free-text filters                                  | `patients/patient-dossier-tabs.tsx`       | The kind chips and order, which stay                                  |
| Executive phone menu "Filter pages"                                                     | `shell/ward-executive-chrome.tsx`         | The page search directly under it                                     |
| Capacity matrix typed filter                                                            | `statistics/hospital-capacity-matrix.tsx` | Nothing. The component has no route; it is reported here, not deleted |
| Referrals "Filter queue"                                                                | `referrals/referral-board.tsx`            | The header search; the highlight chips stay                           |
| All EDs keyword box                                                                     | `ed/ed-index.tsx`                         | The header search; the service and status filters stay                |
| Statistics ward and ED table filters                                                    | `statistics/statistics-screen.tsx`        | Sort and Show all                                                     |

Tests that drove a removed box now assert that it is gone. The community dossier's
"Not recorded in Ward Flow" checks moved to `tests/ward-community-transport.dom.test.tsx`, which
opens the dossier.

### 4. One matcher for page search boxes; postcodes in suburb lookups (`989992129`)

- **Shared matcher.** These boxes now use the shared matcher: Movements, Out of area, Waiting, Hub,
  the ward bed finder, Activity, the referral form's patient search and `/wards`.
  - "OQuinn" now finds O'Quinn, and "UM 100001" finds the UMRN.
  - The referral form also reads "Family, Given".
- **Contacts.** On-call and the Tools sheet's Contacts share `entryMatchesQuery`.
- **Postcodes.** The Community and ward suburb lookups accept a 4-digit postcode through
  `catchmentLookupsFor`, as the Tools lookup does.
- **Placeholders now say what is actually searched.**
  - `/community` really searches postcodes.
  - `/wards` no longer offers "suburb", because no suburb is recorded for a ward.
- **Clear buttons.** The phone-visible Community and Teams boxes now have one.

### 5. Form time savers (`5b278de46`)

- **Add a patient:**
  - On a larger screen the cursor starts in the first empty identity field.
  - A UMRN is written as one word in capitals, whatever was typed or pasted. The referral form's
    new-patient UMRN does the same.
- **Referrer contact:** the browser's autofill offers the referrer's own name, email, phone, role
  and service. These are staff details only. Enter moves to the next field.
- **ED row forms:** they open with the cursor in the first field.
- **Discharge care sections:**
  - Opening a section puts the cursor in its first field.
  - Leaving with typed but unrecorded details asks first. This is held in memory only, with no
    storage.

### 6. Mock-up (`dbdfd20c0`)

`src/app/mockups/ward-flow-search/page.tsx` and `src/components/search-redesign/` are built from the
app's own components, engine and synthetic data. The page has four sections:

1. **Main search as a pop-out.**
   - On a phone it is a full-height sheet, as Help opens, with the field pinned at the top and tap
     suggestions before typing.
   - On a tablet or computer it is a centred pop-out, with matched words marked and kind chips (All,
     People, Places, Contacts, Help).
2. **One page search box:** the kit field (magnifier, clear button, "/" hint) with a count line,
   pinned on a phone.
3. **Forms:** time buttons (Now, +15m, +30m, +1h, from the board clock, never a legal expiry) and
   one-tap answers for short fixed lists.
4. **The merges still to decide** (below).

The mock-up is registered in `mockups/README.md`. The site map and route-count facts are regenerated.

## Evidence

**Fresh, on this branch:**

- **Focused vitest runs:**
  - Search group: 34 files, 507 tests.
  - Removal areas: 131 files, 1,335 tests (2 skipped).
  - Matcher adoption: 75 files, 745 tests.
  - ED and discharge: 80 files, 806 tests.
  - Plus new files `ward-search-text.test.ts`, `ward-global-search-help.dom.test.tsx` and
    `ward-add-patient-time-savers.dom.test.tsx`.
  - All passed.
- **Checks:**
  - Full `tsc` typecheck passed.
  - ESLint with no warnings passed on every changed file.
  - Commit hooks passed on each commit, with no bypass.
  - `check:knip`, `check:mockups`, `sitemap:check`, `docs:facts`, `docs:check-links` and
    `check:diff-integrity` (177 to 206 test cases) all passed.
- **Browser:** local, system Chromium.
  - Header search with Help and suburb rows at 1440, 1024, 768 and 390 px.
  - Mock-up page and pop-out at 1440, 768 and 390 px, light and dark.
  - No page errors and no sideways scroll.

**Run but unfinished when this was written:** `npm run verify:pr-local -- --base origin/main`.

- The first run stopped at `typecheck:backend`, because the backend packages were not installed in
  the container. They were installed and the gate re-run.
- The PR description records its result.

**Not run:**

- Playwright suites, including `ui-ward-search.spec.ts`.
- The production build and the phone script-budget measurement.
- Hosted CI.
- Physical iPhone or Safari.

## Not done, and why

- **Two screen merges are in the mock-up only, because they change layouts:**
  - Statistics "Open a unit" on Compare should become the main page's finder (#1118 also moves it).
  - One "Find a ward" picker for Ask more wards and the patient record's transit panel.
  - The three suburb lookups now share one engine and all take postcodes, but they still look
    different.
- **The officer search box is unchanged.** `officer-screen.tsx` is held for #1115.
- **There is no What's new line.** `whats-new.json` is held by the Help owner. Proposed line for that
  owner: "Search finds Help answers, on-call contacts and a suburb's team, and forgives small typos."
- **Prefill from the record:**
  - The discharge clinician and service were not added; the care forms have no stay field to read them from.
  - Carrying suburb and sex from Add a patient was not needed: the referral form already reads sex
    from the record.
  - Legal status is never prefilled (D-69).
- **Transit operations got no leave warning.** Its forms are short selects.
- **No new tests for:**
  - the ED row form focus;
  - the discharge leave warning;
  - the ward bed finder;
  - Switch team.
  - Their existing suites pass.

## For other owners

- **Help owner (#1119):**
  - `help/ward-help-content.ts` line 140 says All EDs offers "Search by ED, hospital or service". That
    box is gone; the header search now does it.
  - If #1119 moves `howToHref` (it adds `help/ward-help-href.ts`), update the import in
    `ward-global-search-help.tsx` when merging.
- **Ward PR campaign (#1116 integration):**
  - This branch already contains #1116 unchanged, under Josh's takeover (claim on #688).
  - Integrate one or the other, not both.
- **#1118 mock-ups:**
  - `ward-redesign/pop-search` forks `ward-global-search.tsx`, which this branch changed (Help group,
    kind chips, `findHelp` and `onHelpResult` props).
  - Re-fork if that mock-up is built.

## Questions for Josh

1. Approve the main search pop-out (section 1 of the mock-up) for phone, tablet and computer?
   Recommendation: yes for phone; on a computer, keep today's popover and add the marked words.
2. Approve one page search box look (section 2)? Recommendation: yes.
3. Approve time buttons and one-tap answers in forms (section 3)? Recommendation: yes, form by form,
   starting with the ED expected arrival and the discharge care dates.
4. Approve the two remaining screen merges and one suburb lookup card (section 4)? Recommendation: yes,
   after #1118's Statistics Compare decision.
5. Should Help answers show in the header search for every query of three or more letters, or only
   for questions? Recommendation: every query, as built; they sit last unless the query is a question.

## Resuming in a new session

1. **Check out the branch.**
   - Confirm both `origin` URLs name `BigSimmo/Ward-Flow`.
   - If the clone is shallow, `git fetch --unshallow origin` needs Josh's yes.
2. **Install Node.**
   - Node 24.15 or later is required.
   - In a cloud container, unpack it to `/opt/node24` and put `/opt/node24/bin` first on `PATH`.
   - Then run `npm ci --include=dev` and `npm --prefix backend/ward-flow ci`.
3. **Re-create the claim log.**
   - It lives in a scratch folder: a `## Active sign-outs` section listing this branch's files, with
     `repo=BigSimmo/Ward-Flow`.
   - Mark the six taken-over search files `(approved takeover by Josh: …)`.
   - Pass the log as `WARD_SIGNOUT_FILE` on each commit and push.
4. **Run the server:** `npm run ensure`, then open `/mockups/ward-flow-search`.
5. **Next:** apply Josh's answers to the questions above, then build the approved parts into the
   real screens.
