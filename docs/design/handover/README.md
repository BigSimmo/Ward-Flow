# Ward Flow handover: start here

_Updated 10 November 2026. This file replaces `/mnt/project-files/ward-flow/HANDOVER.md` (Q381, Josh, 3 November 2026), which now only points here._

This is the one handover entry for the Ward Flow redesign and the **source of truth for owner question numbers (Q numbers)**. Record each new question and its answer in the [question log](#question-log) below, in the same PR as the work or in a small docs PR.

**Next free question number: Q394.** Q382 to Q389 are reserved for the threads started on 3 November 2026.

## Read first

1. [AGENTS.md](../../../AGENTS.md), before any change.
2. [Roadmap](../../ward-flow/roadmap.md) for what comes next, and [STATUS.md](../../ward-flow/STATUS.md) for decision state and the "Waiting on Josh" list.
3. The design system of record, [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) (Q327), and the master design artifact (https://claude.ai/artifact/91BETDiimnJVbyeCb2sxcK, source in `/mnt/project-files/ward-flow/mockups/master/`). Copy the shell from the newest master screens, never from main.
4. Mock-up links: `/mnt/project-files/ward-flow/mockups/LINKS.md`. The old `ARTIFACTS.md` links do not open.
5. The screen handover file in this folder for the screen you are working on. Each one is dated history from 1 November 2026; recheck GitHub before trusting a PR state in it.

## State on 3 November 2026

- Every approved screen from the 1 November table is built and merged. Main was at `cd66be7a` (#1332) when this file was written.
- Approved designs: all original screens, Help, Statistics/Weekly, Patients, the new sign-in page, the Alerts redesign (without Q179), the master sidebar on every page, the Home flow and the Tools overhaul. Not approved: Team search.
- Codex drafts #1262 and #1269 stay open as drafts for Josh.
- Releases: the daily 6 am Perth release, or on demand when Josh says "release now". Merging is not going live.

## How to build

Port the mock-up's components and tokens as they are; don't rebuild them. Compare each screen with its mock-up and with the master's Ward and Home pages at 390, 820, 1280 and 1440, light and dark.

## Rules in short

- Build only approved designs, mock-up first. Synthetic data only.
- Mark a PR ready once CI is green and it matches the mock-up. Auto-merge counts as Josh's yes. Each thread arms auto-merge on its own PRs, re-arms it after a switch-off, fixes their merge conflicts and merges its own green PR by hand if GitHub won't arm it (Josh, 3 Nov). Never turn auto-merge off or merge another thread's PR.
- To hold a PR, add the `hold` label (Q373); never write an auto-merge note. Base every PR on `main`; never stack PRs.
- Your branch and its open PR are your claim (Q374); check open PRs for overlap before editing.
- Hosted CI is the full gate. No repeat test runs.
- House rules: 12px minimum text, 40px controls on phones (48px Accept, Pull and Decline), desktop tabs 30px (Q231), no coloured side edges, minimal warnings, patient names surname first as recorded with UMRN (Q331), times as typed.
- Questions: numbered, one recommendation each, recorded below.
- Writing to Josh: plain warm English, answer first, numbered actions, post only finished links and questions.

## Screen handover files (1 November 2026, history)

| Screen     | File                                                                           | 1 November PRs      |
| ---------- | ------------------------------------------------------------------------------ | ------------------- |
| Ward       | [ward.md](../../history/design-2026-11/handover/ward.md)                       | #1212               |
| Transport  | [transport.md](../../history/design-2026-11/handover/transport.md)             | #1221               |
| Movements  | [movements.md](../../history/design-2026-11/handover/movements.md)             | #1222               |
| ED         | [ed.md](../../history/design-2026-11/handover/ed.md)                           | #1223, #1231        |
| Alerts     | [alerts.md](../../history/design-2026-11/handover/alerts.md)                   | #1225, #1230, #1233 |
| Forms      | [forms.md](../../history/design-2026-11/handover/forms.md)                     | #1228               |
| Handover   | [handover-screen.md](../../history/design-2026-11/handover/handover-screen.md) | #1232               |
| Community  | [community.md](../../history/design-2026-11/handover/community.md)             | #1227               |
| Discharges | [discharges.md](../../history/design-2026-11/handover/discharges.md)           | #1229               |
| Pop-ups    | [popups.md](../../history/design-2026-11/handover/popups.md)                   | #1226               |

## Question log

Carried over from `HANDOVER.md` on 3 November 2026, with the later blocks from the project notes. Early entries are short; the thread named in each block holds the detail. "Yes" means Josh answered yes to the recommendation.

**Numbers before Q120 are not kept here.** Code, tests and a few docs cite Q29, Q31, Q36, Q40, Q58, Q61 to Q63, Q66 to Q69, Q75, Q77, Q84, Q92 to Q94, Q96, Q97, Q99, Q102 to Q107, Q111, Q112, Q117 and Q118. They were asked in earlier threads, before this log started, and some numbers were reused by more than one thread. Their answers were not copied here and are not rebuilt (D-121). Where a ruling matters, read [decisions.md](../../ward-flow/decisions.md) (Q61 and Q97 are cited there) or the [4 September review](../../history/lessons/ward-flow-owner-rulings-2026-09-04-review.md) (Q31, Q62, Q68 and Q69). Source and tests prove what is built.

### Q120 to Q163 (1 November 2026)

- Q120 (ED): the Form dropdown never defaults a written time to now; blank shows "Written time not entered". Yes.
- Q122 (Pop-ups, #1226): tally time line reads "Synthetic state · demo time 10:42". Yes.
- Q123 (Pop-ups): bar drawer search box removed, category chips stay. Yes.
- Q124: not recorded in HANDOVER.md.
- Q125 (Community): a team accepts its own referrals as itself on its page. Yes.
- Q126 (Community): caseload records come from seeded synthetic demo data for now. Yes.
- Q127 (Transport, #1221): Needs transport for ED, ward and community desks too. Yes, follow-up PR.
- Q128 (ED, #1231): leave "Clear the form" out; put Decline back inside the opened referral. Recommended; answer not recorded in HANDOVER.md.
- Q129: auto-merge off on #1230 until the Pull the bed sheet bug was fixed (alerts.md). Q129 and Q130 were also used for repeats of Q125 and Q126 in the #1234 handover comment.
- Q131: hold "Find client or clinician" until Team search is approved. Replaced by Q190 (yes, shipped in #1265).
- Q132 (Community): seed the mock-up figures for Midland only. Yes.
- Q133 (Forms, #1228): keep main's newer no-tabs Forms panel. Yes.
- Q134: keep outside commits that match the mock-up; revert any that don't with revert commits. Yes.
- Q138 (Help build): delete the replaced old Help pieces under the dead-code override. Recommended yes.
- Q139 (Statistics/Weekly): deepen the shallow clone so the push guard and dead-code check can run. Recommended yes.
- Q140 (Statistics/Weekly): delete the old Weekly layout pieces under one owner-approved dead-code run. Recommended yes.
- Q141 (Patients, #1244): remove the old `patient-dossier-tabs.tsx`. Yes, done in #1244.
- Q142 (Community, #1234): rule the Midland demo folder as labelled demo data for shown times. Yes.
- Q144 (Master design; first posted as Q142): rebuild the master from main. Yes.
- Q145 (Master design; first posted as Q143): keep approved mock-ups for open-PR screens. Yes.
- Q148 (Alerts, #1245): change the broadcast extension from 2h to 30 minutes everywhere. Recommended yes.
- Q149 (Alerts, #1245): build "Add units" on a live broadcast in a follow-up PR. Recommended yes.
- Q151 (Community): design a phone layout before the build. Yes, see Q155.
- Q152 (Forms): Josh said yes, then reversed it: keep "within 1h" beside typed legal-form times. No change.
- Q153 (all phone screens): drop the repeated eyebrow and keep one hero action on phones. Yes, with every fix in the phone audit (https://claude.ai/artifact/4MG7i9Tqjc7ggSzRuimxgk).
- Q154 (Transport, #1235): merge #1235; a follow-up gives ED, ward and community the Transport page for their own journeys. Yes.
- Q155 (Community): approve the phone layout https://claude.ai/artifact/TnE3a1JgKtBttyq7bKqehp. Recommended yes.
- Q156 (role views): archive the 36 "As …" role views in the master. Recommended archive.
- Q161 (dock): light the top-bar Menu button on pages with no dock tab. Recommended yes.
- Q162 (Transport dock): keep each person's own dock everywhere; officer dock only for a signed-in transport officer. Yes, built in #1247.
- Q163: close-check five more phone pages on main. Yes.

Numbers not listed above in this block were not recorded in HANDOVER.md.

### Q164 to Q306 (1 to 2 November 2026)

- Q164 to Q166, Q173 to Q178 and Q190 to Q216: all yes (Q215 withdrawn). Q175: switch auto-merge on while checks are still running. Q205: #1263 uptime false alarm. Q206 and Q216: Codex drafts #1262 and #1269 held for Josh. Q208 and Q213: done (#839 closed).
- Q179 (Alerts): no. Josh rejected the "For you / With other desks" labels; the Alerts count header stays. Q180 to Q184: yes.
- Q217 to Q306: answered yes as recommended (2 November). Q225: phone tabs 40px on a 48px row. Q226: staff names as written. Q231: desktop tabs stay 30px. Q288: dated status kept. Q297: needs a real-phone check by Josh. Q305: keep "Releases held up". Q306: kit labels wrap at large text.
- The per-question detail for this block is in the threads named in project memory; it was not copied into HANDOVER.md.

### Q307 to Q326 (2 November 2026)

- Q307: dock fix. Yes (#1310).
- Q308 to Q326 (Tools review, `/mnt/project-files/ward-flow/reviews/tools-2-nov/SUGGESTIONS.md`): all yes, plus an overhaul of every role view. Q308 to Q316 layout and look (Q311 two panes recommended "not yet"); Q317 to Q322 tool redesigns; Q323 to Q326 new tools (Remind me, Message builder, Book transport, Due back from leave).

### Q327 to Q349 (design system and Home flow, 2 to 3 November 2026)

- Q327: DESIGN-SYSTEM.md is the design system of record. Yes (#1311).
- Q328: one signature part per page inside the variation zone. Yes.
- Q329: a part two pages want moves into the kit. Yes.
- Q330: add 744 and 768 to the design sweep widths. Yes (#1313).
- Q331: patient names surname first as recorded, staff names as written. Yes.
- Q332: dated 2 November review notes stay word for word. Yes.
- Q333 to Q340 (Home lists): Open patients only, Waiting renamed Open, waiting alerts as badges, My list rows lead with the action, mock-up first, Open renamed Queue, Open grouped by stage, and Q340 Home as a "Needs you" strip plus stage flow (replacing Q333, Q335, Q338 and Q339). Superseded by the Home flow (Q341).
- Q341: the Home flow is the master Home tab (mock-up https://claude.ai/artifact/28i1iqpx6Le844G3rbPL5U). Yes.
- Q342: build the Home flow as a PR. Yes, #1324 merged 3 November.
- Q343: stage tiles always shown, Needs you | Flow tabs. Yes.
- Q344: merge the ED strip into the stage card as one chip row (option A). Open; tracked in the [backlog](../../ward-flow/backlog.md#ideas).
- Q345: one nav row, Needs you | Flow raised, stages as lighter trackless tabs. Yes, in #1324.
- Q346 to Q349: reserved for the design system block; not used.

### Q350 to Q369 (Tools build, 2 to 3 November 2026)

- Q350 to Q352: D-93 bans countdowns on form times; On-call has no tel links; Find a bed keeps no default legal status. Asked with the Tools mock-up (https://claude.ai/artifact/TQH13yeormtfmqzPWPWbYv).
- Q353: delete the old Tools pieces under the dead-code override. Yes (#1323).
- Q354: deepen the shallow cloud clone so the push guard finds its anchor. Yes.
- Q355: re-arm auto-merge. Yes.
- Q356: one-off hand merge of #1316, because GitHub refused auto-merge on a green PR. Yes.
- Q357 and Q358: withdrawn (merged before Josh answered).
- Q359 to Q369: reserved for the Tools block; not used.

### Q370 to Q381 (whole-repository review, 3 November 2026)

Josh answered "Yes to 2 to 12" at 17:09 UTC, which is Q371 to Q381. Q370 was not answered.

- Q370: move the Railway app and backend from Singapore to Sydney, next to the database, and turn sleeping off. Not answered.
- Q371: harden the demo-code rate limit (spoofable first forwarded address, table cleared at 5,000, 4-character minimum). Yes.
- Q372: confirm the front door is required on Railway and make production fail closed. Yes.
- Q373: stop stacked PRs and written "auto-merge off" notes; use a hold label. Yes.
- Q374: let the branch and PR be the claim, and archive `claims/` (protected; needs Josh's yes on the move). Yes.
- Q375: one token layer, with DESIGN-SYSTEM.md the source of truth and a lint ratchet on raw colours and sizes. Yes.
- Q376: repoint the PriorityQueue tests at the Home flow and delete the old path. Yes.
- Q377: phone targets that look 28 to 32px; add a 40px hit-box test. Yes.
- Q378: a real-data go/no-go checklist. Yes.
- Q379: STATUS owner tasks, including the sign-in renewal test before about 16 November and migration 13. Yes.
- Q380: next feature is finishing role access (D-80 PR 5) and pilot readiness; refresh the roadmap. Yes.
- Q381: retire `HANDOVER.md` in favour of this file. Yes, done here.

### Q382 to Q389 (threads started 3 November 2026)

- Q383: Josh to check the Railway `WARD_FRONT_DOOR`, `WARD_PASS_SECRET` and `WARD_DEMO_CODE` settings before #1345 can merge. Not kept: #1345 merged.
- Q384: Josh adds `Ward Flow hold` as a required check in the main ruleset, so the `hold` label blocks merges. Open; tracked in the [backlog](../../ward-flow/backlog.md#agreed-not-started).
- Other numbers in this block are held for those threads.

### Q390 to Q392 (real-data go/no-go, 3 November 2026)

- Q390: where "about 16 November" came from. Nothing in the database expires then. Recommend dropping the date: Josh signs in with a test account in the morning and makes one save after lunch. Yes (3 November, 17:17 UTC).
- Q391: turn off the Supabase organisation's AI SQL, log and data options (on now). Recommend yes; needs Josh to do it. Yes (3 November, 17:17 UTC).
- Q392: keep referral and legal-form drafts out of browser storage unless the workspace is in prototype mode (checklist C1). Recommend yes. Yes (3 November, 17:17 UTC); built in #1346.

### Q393 (triage PSOLIS pick-lists, 7 November 2026)

- Q393: show the webPSOLIS referral type "BREACH RELEASE ORDER" as "Breach release order", with a narrow exclusion in the no-invented-figures guard for that exact value, since it names a legal referral source and not a missed target. Recommend yes. Yes (7 November, 21:24 UTC); built in #1504.
